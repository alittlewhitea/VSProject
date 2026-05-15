import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { GALLERY_CATEGORIES, mapGalleryRow, toDbGalleryCategory, type GalleryRow } from "../../../../lib/gallery";

const INSERTABLE_CATEGORIES = GALLERY_CATEGORIES.filter((category) => category !== "All");
const execFileAsync = promisify(execFile);
const SELECT_COLUMNS =
  "id,title,category,image_url,thumbnail_url,prompt,model,author_name,author_handle,source_platform,source_url,aspect_ratio,width,height,is_featured,published_at,created_at";

type GalleryAdminPayload = {
  id?: string;
  title?: string;
  category?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  prompt?: string;
  model?: string;
  authorName?: string;
  authorHandle?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  aspectRatio?: string;
  width?: number | string;
  height?: number | string;
  publishedAt?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
};

function getSupabaseRestConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return null;
  return { supabaseUrl, serviceKey };
}

function parseOptionalInt(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validatePayload(body: GalleryAdminPayload) {
  const title = cleanOptionalText(body.title);
  const category = cleanOptionalText(body.category);
  const imageUrl = cleanOptionalText(body.imageUrl);
  const thumbnailUrl = cleanOptionalText(body.thumbnailUrl);
  const prompt = cleanOptionalText(body.prompt);
  const sourceUrl = cleanOptionalText(body.sourceUrl);

  if (!title) return { error: "Title is required." };
  if (!category || !INSERTABLE_CATEGORIES.includes(category as (typeof INSERTABLE_CATEGORIES)[number])) {
    return { error: "A valid category is required." };
  }
  if (!imageUrl || !isHttpUrl(imageUrl)) return { error: "A valid image URL is required." };
  if (thumbnailUrl && !isHttpUrl(thumbnailUrl)) return { error: "Thumbnail URL must be a valid URL." };
  if (!prompt) return { error: "Prompt is required." };
  if (!sourceUrl || !isHttpUrl(sourceUrl)) return { error: "A valid source URL is required." };

  const data: Record<string, unknown> = {
    title,
    category: toDbGalleryCategory(category),
    image_url: imageUrl,
    thumbnail_url: thumbnailUrl,
    prompt,
    model: cleanOptionalText(body.model) || "GPT-image-2",
    author_name: cleanOptionalText(body.authorName),
    author_handle: cleanOptionalText(body.authorHandle)?.replace(/^@/, "") || null,
    source_platform: cleanOptionalText(body.sourcePlatform) || "X",
    source_url: sourceUrl,
    aspect_ratio: cleanOptionalText(body.aspectRatio),
    width: parseOptionalInt(body.width),
    height: parseOptionalInt(body.height),
    is_featured: Boolean(body.isFeatured),
    is_published: body.isPublished !== false
  };
  const publishedAt = cleanOptionalText(body.publishedAt);
  if (publishedAt) {
    data.published_at = publishedAt;
  }

  return {
    data
  };
}

type SupabaseMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function requestSupabaseWithPowerShell(restUrl: string, serviceKey: string, method: SupabaseMethod, body?: unknown) {
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
try {
  $req = [System.Net.WebRequest]::Create($env:SUPABASE_REST_URL)
  $req.Method = $env:SUPABASE_METHOD
  $req.Timeout = 60000
  $req.ContentType = 'application/json; charset=utf-8'
  $req.Headers.Add('apikey', $env:SUPABASE_SERVICE_ROLE_KEY)
  $req.Headers.Add('Authorization', "Bearer $env:SUPABASE_SERVICE_ROLE_KEY")
  if ($env:SUPABASE_METHOD -eq 'POST' -or $env:SUPABASE_METHOD -eq 'PATCH' -or $env:SUPABASE_METHOD -eq 'DELETE') {
    $req.Headers.Add('Prefer', 'return=representation')
  }
  if ($env:SUPABASE_METHOD -eq 'POST' -or $env:SUPABASE_METHOD -eq 'PATCH') {
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    $bytes = $utf8.GetBytes($env:SUPABASE_BODY)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
  }
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
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      SUPABASE_METHOD: method,
      SUPABASE_BODY: body ? JSON.stringify(body) : ""
    },
    timeout: 70000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });

  const envelope = JSON.parse(stdout.trim()) as { status: number; content: string };
  if (envelope.status < 200 || envelope.status >= 300) {
    throw new Error(envelope.content || `Supabase REST failed with ${envelope.status}.`);
  }

  return envelope.content;
}

async function requestSupabase(restUrl: string, serviceKey: string, method: SupabaseMethod, body?: unknown) {
  if ((process.platform as string) === "win32") {
    return requestSupabaseWithPowerShell(restUrl, serviceKey, method, body);
  }

  const response = await fetch(restUrl, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(method === "POST" || method === "PATCH" || method === "DELETE" ? { Prefer: "return=representation" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Supabase REST failed with ${response.status}.`);
  }
  return text;
}

async function listAdminGalleryRows() {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Storage is not configured.");
  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    order: "created_at.desc",
    limit: "12"
  });
  const text = await requestSupabase(
    `${config.supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`,
    config.serviceKey,
    "GET"
  );
  return JSON.parse(text || "[]") as GalleryRow[];
}

async function insertAdminGalleryRow(data: Record<string, unknown>) {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Storage is not configured.");
  const params = new URLSearchParams({ select: SELECT_COLUMNS });
  const text = await requestSupabase(
    `${config.supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`,
    config.serviceKey,
    "POST",
    data
  );
  const rows = JSON.parse(text || "[]") as GalleryRow[];
  return rows[0] || null;
}

async function updateAdminGalleryRow(id: string, data: Record<string, unknown>) {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Storage is not configured.");
  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    id: `eq.${id}`
  });
  const text = await requestSupabase(
    `${config.supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`,
    config.serviceKey,
    "PATCH",
    data
  );
  const rows = JSON.parse(text || "[]") as GalleryRow[];
  return rows[0] || null;
}

async function deleteAdminGalleryRow(id: string) {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Storage is not configured.");
  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    id: `eq.${id}`
  });
  const text = await requestSupabase(
    `${config.supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`,
    config.serviceKey,
    "DELETE"
  );
  const rows = JSON.parse(text || "[]") as GalleryRow[];
  return rows[0] || null;
}

async function findDuplicateGalleryRow(sourceUrl: unknown, imageUrl: unknown, excludeId?: string) {
  if (typeof sourceUrl !== "string" || typeof imageUrl !== "string") return null;
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Storage is not configured.");
  const params = new URLSearchParams({
    select: SELECT_COLUMNS,
    source_url: `eq.${sourceUrl}`,
    image_url: `eq.${imageUrl}`,
    limit: "1"
  });
  if (excludeId) {
    params.set("id", `neq.${excludeId}`);
  }
  const text = await requestSupabase(
    `${config.supabaseUrl}/rest/v1/public_gallery_items?${params.toString()}`,
    config.serviceKey,
    "GET"
  );
  const rows = JSON.parse(text || "[]") as GalleryRow[];
  return rows[0] || null;
}

export async function GET(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  try {
    const data = await listAdminGalleryRows();
    return NextResponse.json({ items: (data ?? []).map(mapGalleryRow), adminEmail: adminUser.email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin gallery could not be loaded." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as GalleryAdminPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validatePayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const duplicate = await findDuplicateGalleryRow(validated.data.source_url, validated.data.image_url);
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Duplicate gallery item: ${duplicate.title}`,
          item: mapGalleryRow(duplicate),
          duplicate: true
        },
        { status: 409 }
      );
    }

    const data = await insertAdminGalleryRow(validated.data);
    return NextResponse.json({ item: data ? mapGalleryRow(data) : null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be saved." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as GalleryAdminPayload | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Gallery item id is required." }, { status: 400 });
  }

  const validated = validatePayload(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const duplicate = await findDuplicateGalleryRow(validated.data.source_url, validated.data.image_url, body.id);
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Duplicate gallery item: ${duplicate.title}`,
          item: mapGalleryRow(duplicate),
          duplicate: true
        },
        { status: 409 }
      );
    }

    const data = await updateAdminGalleryRow(body.id, validated.data);
    if (!data) {
      return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    }
    return NextResponse.json({ item: mapGalleryRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be updated." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Gallery item id is required." }, { status: 400 });
  }

  try {
    const data = await deleteAdminGalleryRow(id);
    if (!data) {
      return NextResponse.json({ error: "Gallery item not found." }, { status: 404 });
    }
    return NextResponse.json({ item: mapGalleryRow(data) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gallery item could not be deleted." },
      { status: 500 }
    );
  }
}
