import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isGalleryCategory, mapGalleryRow, toDbGalleryCategory, type GalleryRow } from "../../../lib/gallery";

const GALLERY_TIMEOUT_MS = 30000;
const execFileAsync = promisify(execFile);

type GalleryResult = {
  data: GalleryRow[] | null;
  error: { message: string } | null;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gallery request timed out.")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

function getGalleryRestUrl(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || "All";
  const sort = url.searchParams.get("sort") || "featured";
  const query = url.searchParams.get("q")?.trim() || "";
  const limitParam = Number(url.searchParams.get("limit") || "60");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 120) : 60;
  const params = new URLSearchParams({
    select:
      "id,title,category,image_url,thumbnail_url,prompt,model,author_name,author_handle,source_platform,source_url,aspect_ratio,width,height,is_featured,published_at,created_at",
    is_published: "eq.true",
    order: sort === "latest" ? "published_at.desc,created_at.desc" : "is_featured.desc,published_at.desc",
    limit: String(limit)
  });

  if (isGalleryCategory(category) && category !== "All") {
    params.set("category", `eq.${toDbGalleryCategory(category)}`);
  }

  if (query) {
    const escapedQuery = query.replace(/[,*()]/g, " ");
    params.set(
      "or",
      `(title.ilike.*${escapedQuery}*,prompt.ilike.*${escapedQuery}*,author_name.ilike.*${escapedQuery}*,author_handle.ilike.*${escapedQuery}*,model.ilike.*${escapedQuery}*)`
    );
  }

  return `${supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`;
}

async function fetchGalleryRowsWithPowerShell(restUrl: string, serviceKey: string) {
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
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });

  const envelope = JSON.parse(stdout.trim()) as { status: number; content: string };
  if (envelope.status < 200 || envelope.status >= 300) {
    throw new Error(envelope.content || `Supabase REST failed with ${envelope.status}.`);
  }

  return JSON.parse(envelope.content || "[]") as GalleryRow[];
}

async function fetchGalleryRows(request: Request) {
  const restUrl = getGalleryRestUrl(request);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!restUrl || !serviceKey) {
    throw new Error("Gallery storage is not configured.");
  }

  if ((process.platform as string) === "win32") {
    return fetchGalleryRowsWithPowerShell(restUrl, serviceKey);
  }

  try {
    const response = await fetch(restUrl, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(GALLERY_TIMEOUT_MS)
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Supabase REST failed with ${response.status}.`);
    }
    return JSON.parse(text || "[]") as GalleryRow[];
  } catch (error) {
    if ((process.platform as string) !== "win32") {
      throw error;
    }
    return fetchGalleryRowsWithPowerShell(restUrl, serviceKey);
  }
}

export async function GET(request: Request) {
  const { data, error } = await withTimeout<GalleryResult>(
    fetchGalleryRows(request).then((rows) => ({ data: rows, error: null })),
    GALLERY_TIMEOUT_MS
  ).catch((error: unknown) => ({
    data: [],
    error: error instanceof Error ? error : new Error("Gallery request failed.")
  }));

  if (error) {
    return NextResponse.json({
      items: [],
      storageWarning: `Gallery is temporarily unavailable: ${error.message}`
    });
  }

  return NextResponse.json({ items: (data ?? []).map(mapGalleryRow) });
}
