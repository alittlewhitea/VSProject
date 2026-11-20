import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { firstExceededLimit, rateLimitHeaders } from "../../../../../lib/api-limits";
import { consumeRateLimit } from "../../../../../lib/request-security";
import { readRequestJson, RequestBodyError } from "../../../../../lib/request-body";
import { StudioMediaError } from "../../../../../lib/r2-studio-media";
import { inspectTopazVideo } from "../../../../../lib/topaz-video-inspection";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Sign in to check your video." }, { status: 401, headers });
    const limited = await firstExceededLimit(user.id, [{ scope: "topaz_video_inspect", limit: 6, windowSeconds: 60 }], consumeRateLimit);
    if (limited) return NextResponse.json({ error: "Video checks are busy. Try again shortly." }, {
      status: limited.unavailable ? 503 : 429, headers: { ...headers, ...rateLimitHeaders(limited.retryAfterSeconds) }
    });
    const body = await readRequestJson(request, 4096);
    if (typeof body?.videoUrl !== "string") return NextResponse.json({ error: "A video upload is required." }, { status: 400, headers });
    return NextResponse.json(await inspectTopazVideo(user.id, body.videoUrl), { headers });
  } catch (error) {
    const known = error instanceof StudioMediaError || error instanceof RequestBodyError;
    return NextResponse.json({ error: known ? error.message : "Video could not be checked." }, { status: known ? error.status : 503, headers });
  }
}
