import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { extractGalleryId, mapGalleryRow, type GalleryRow } from "../../../../lib/gallery";

const execFileAsync = promisify(execFile);

async function fetchGalleryItemWithPowerShell(id: string, restUrl: string, serviceKey: string) {
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
  $req = [System.Net.WebRequest]::Create($env:SUPABASE_REST_URL)
  $req.Method = 'GET'
  $req.Timeout = 60000
  $req.Headers.Add('apikey', $env:SUPABASE_SERVICE_ROLE_KEY)
  $req.Headers.Add('Authorization', "Bearer $env:SUPABASE_SERVICE_ROLE_KEY")
  $res = $req.GetResponse()
  $stream = $res.GetResponseStream()
  $memory = [System.IO.MemoryStream]::new()
  $stream.CopyTo($memory)
  $content = [System.Text.Encoding]::UTF8.GetString($memory.ToArray())
  @{ status = [int]$res.StatusCode; content = $content } | ConvertTo-Json -Compress
} catch {
  $status = 502
  $content = $_.Exception.Message
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      $memory = [System.IO.MemoryStream]::new()
      $stream.CopyTo($memory)
      $content = [System.Text.Encoding]::UTF8.GetString($memory.ToArray())
    } catch {}
  }
  @{ status = $status; content = $content } | ConvertTo-Json -Compress
}
`;

  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: {
      ...process.env,
      SUPABASE_REST_URL: restUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey
    },
    timeout: 70000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });

  const envelope = JSON.parse(stdout.trim()) as { status: number; content: string };
  if (envelope.status < 200 || envelope.status >= 300) {
    throw new Error(envelope.content || `Supabase REST failed with ${envelope.status}.`);
  }

  const rows = JSON.parse(envelope.content || "[]") as GalleryRow[];
  return rows.find((row) => row.id === id) || rows[0] || null;
}

async function fetchGalleryItem(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Gallery storage is not configured.");
  }

  const params = new URLSearchParams({
    select:
      "id,title,category,image_url,thumbnail_url,prompt,model,author_name,author_handle,source_platform,source_url,aspect_ratio,width,height,is_featured,published_at,created_at",
    id: `eq.${id}`,
    is_published: "eq.true",
    limit: "1"
  });
  const restUrl = `${supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`;

  if ((process.platform as string) === "win32") {
    return fetchGalleryItemWithPowerShell(id, restUrl, serviceKey);
  }

  const response = await fetch(restUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase REST failed with ${response.status}.`);
  }
  const rows = JSON.parse(text || "[]") as GalleryRow[];
  return rows[0] || null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const item = await fetchGalleryItem(extractGalleryId(params.id));
    if (!item) {
      return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    }

    return NextResponse.json({ item: mapGalleryRow(item) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be loaded." },
      { status: 500 }
    );
  }
}
