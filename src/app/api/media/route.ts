import { NextResponse } from "next/server";
import { firstExceededLimit, rateLimitHeaders } from "../../../lib/api-limits";
import { beginStudioMediaUpload, finishStudioMediaUpload, r2MediaEnabled, StudioMediaError } from "../../../lib/r2-studio-media";
import { readRequestJson, RequestBodyError } from "../../../lib/request-body";
import { consumeRateLimit } from "../../../lib/request-security";
import { getUserFromBearerToken } from "../../../lib/server-auth";

const noStore = { "Cache-Control": "private, no-store" };

export function GET() {
  return NextResponse.json({ enabled: r2MediaEnabled() }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Sign in to upload media." }, { status: 401, headers: noStore });
    if (!r2MediaEnabled()) return NextResponse.json({ code: "cloud_media_disabled" }, { status: 503, headers: noStore });

    const limited = await firstExceededLimit(user.id, [
      { scope: "studio_media_minute", limit: 80, windowSeconds: 60 },
      { scope: "studio_media_hour", limit: 320, windowSeconds: 3600 }
    ], consumeRateLimit);
    if (limited) {
      return NextResponse.json({ error: "Media uploads are temporarily unavailable. Try again shortly." }, {
        status: limited.unavailable ? 503 : 429, headers: { ...noStore, ...rateLimitHeaders(limited.retryAfterSeconds) }
      });
    }

    const body = await readRequestJson(request, 4096);
    const kind = body?.kind;
    if (body?.action === "start" && (kind === "image" || kind === "video" || kind === "audio") &&
      typeof body.type === "string" && typeof body.size === "number") {
      return NextResponse.json(await beginStudioMediaUpload(user.id, kind, body.type, body.size), { headers: noStore });
    }
    if (body?.action === "complete" && typeof body.id === "string" && typeof body.etag === "string") {
      return NextResponse.json({ url: await finishStudioMediaUpload(user.id, body.id, body.etag) }, { headers: noStore });
    }
    return NextResponse.json({ error: "Invalid media upload request." }, { status: 400, headers: noStore });
  } catch (error) {
    const known = error instanceof StudioMediaError || error instanceof RequestBodyError;
    return NextResponse.json({ error: known ? error.message : "Media upload failed. Please try again." }, {
      status: known ? error.status : 503, headers: noStore
    });
  }
}
