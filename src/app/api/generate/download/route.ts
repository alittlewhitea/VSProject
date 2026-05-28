import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const name = searchParams.get("name") || "generated";

    if (!url) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid url." }, { status: 400 });
    }

    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only https urls are allowed." }, { status: 400 });
    }

    const upstream = await fetch(parsed.toString(), { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Failed to fetch asset (${upstream.status}).` }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type");
    const ext = getExtFromContentType(contentType);
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}.${ext}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to download asset." }, { status: 500 });
  }
}
