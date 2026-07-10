import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import {
  getSessionFromToken,
  getUserIdsForAuthUser,
  SESSION_COOKIE_NAME
} from "../../../../lib/server-auth";

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function getExtFromContentType(contentType: string | null): string {
  if (!contentType) return "bin";
  if (contentType.includes("image/png")) return "png";
  if (contentType.includes("image/jpeg")) return "jpg";
  if (contentType.includes("image/webp")) return "webp";
  if (contentType.includes("video/mp4")) return "mp4";
  if (contentType.includes("video/webm")) return "webm";
  if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) return "mp3";
  if (contentType.includes("audio/wav")) return "wav";
  return "bin";
}

function isMediaContentType(contentType: string | null) {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized.startsWith("image/") || normalized.startsWith("video/") || normalized.startsWith("audio/");
}

function extractMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") return payload.url;
  for (const key of ["image", "video", "audio", "audio_file"]) {
    const value = payload[key];
    if (value && typeof value === "object" && typeof (value as Record<string, unknown>).url === "string") {
      return String((value as Record<string, unknown>).url);
    }
  }
  for (const key of ["images", "videos"]) {
    const value = payload[key];
    if (Array.isArray(value) && value[0] && typeof value[0] === "object" && typeof (value[0] as Record<string, unknown>).url === "string") {
      return String((value[0] as Record<string, unknown>).url);
    }
  }
  return null;
}

function limitedStream(body: ReadableStream<Uint8Array>, abort: AbortController, timer: ReturnType<typeof setTimeout>) {
  const reader = body.getReader();
  let received = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          clearTimeout(timer);
          controller.close();
          return;
        }
        received += chunk.value.byteLength;
        if (received > MAX_DOWNLOAD_BYTES) {
          clearTimeout(timer);
          abort.abort();
          controller.error(new Error("Asset exceeds the download size limit."));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        clearTimeout(timer);
        controller.error(error);
      }
    },
    async cancel() {
      clearTimeout(timer);
      abort.abort();
      await reader.cancel().catch(() => null);
    }
  });
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromToken((await cookies()).get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId")?.trim() || "";
    const name = searchParams.get("name") || "generated";
    if (!/^tsk_[a-zA-Z0-9_-]{8,84}$/.test(taskId)) {
      return NextResponse.json({ error: "Invalid taskId." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
    }
    const userIds = await getUserIdsForAuthUser(session.user);
    const { data: task, error } = await admin
      .from("generation_tasks")
      .select("output_url, raw_result")
      .eq("id", taskId)
      .in("user_id", userIds)
      .maybeSingle();
    if (error) throw error;
    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const taskRecord = task as { output_url?: unknown; raw_result?: unknown };
    const url = typeof taskRecord.output_url === "string" ? taskRecord.output_url : extractMediaUrl(taskRecord.raw_result);
    if (!url) {
      return NextResponse.json({ error: "Task has no downloadable asset." }, { status: 404 });
    }
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only HTTPS assets are allowed." }, { status: 400 });
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), DOWNLOAD_TIMEOUT_MS);
    const upstream = await fetch(parsed.toString(), {
      cache: "no-store",
      redirect: "error",
      signal: abort.signal
    });
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timer);
      return NextResponse.json({ error: `Failed to fetch asset (${upstream.status}).` }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type");
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (!isMediaContentType(contentType)) {
      clearTimeout(timer);
      abort.abort();
      return NextResponse.json({ error: "Upstream response is not a media asset." }, { status: 415 });
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
      clearTimeout(timer);
      abort.abort();
      return NextResponse.json({ error: "Asset exceeds the 100 MB download limit." }, { status: 413 });
    }

    const ext = getExtFromContentType(contentType);
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) || "generated";
    return new Response(limitedStream(upstream.body, abort, timer), {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to download asset." }, { status: 500 });
  }
}
