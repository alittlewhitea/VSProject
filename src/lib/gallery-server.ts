import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type GalleryRow } from "./gallery";

const execFileAsync = promisify(execFile);
const SELECT_COLUMNS =
  "id,title,category,image_url,thumbnail_url,prompt,model,author_name,author_handle,source_platform,source_url,aspect_ratio,width,height,is_featured,published_at,created_at";

async function fetchRowsWithPowerShell(restUrl: string, serviceKey: string) {
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

  return JSON.parse(envelope.content || "[]") as GalleryRow[];
}

export async function fetchPublishedGalleryItem(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return null;

  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    id: `eq.${id}`,
    is_published: "eq.true",
    limit: "1"
  });
  const restUrl = `${supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`;

  if ((process.platform as string) === "win32") {
    const rows = await fetchRowsWithPowerShell(restUrl, serviceKey);
    return rows[0] || null;
  }

  const response = await fetch(restUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as GalleryRow[];
  return rows[0] || null;
}

export async function fetchPublishedGalleryItems(options: { limit?: number; featuredFirst?: boolean } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return [];

  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    is_published: "eq.true",
    order: options.featuredFirst === false ? "published_at.desc,created_at.desc" : "is_featured.desc,published_at.desc",
    limit: String(Math.min(Math.max(options.limit || 24, 1), 200))
  });
  const restUrl = `${supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`;

  if ((process.platform as string) === "win32") {
    return fetchRowsWithPowerShell(restUrl, serviceKey);
  }

  const response = await fetch(restUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) return [];
  return (await response.json()) as GalleryRow[];
}
