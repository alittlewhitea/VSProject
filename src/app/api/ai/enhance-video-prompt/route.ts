import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { validatePromptContext } from "../../../../lib/video-prompt-enhancement";
import { enhanceVideoPrompt } from "../../../../lib/video-prompt-enhancer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Sign in to optimize your prompt." }, { status: 401 });
    // Bound streamed bodies as well as Content-Length; images use the existing data URL flow.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Missing request." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_100_000) { await reader.cancel(); return NextResponse.json({ error: "Image input is too large." }, { status: 413 }); }
      chunks.push(value);
    }
    let context;
    try { context = validatePromptContext(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { return NextResponse.json({ error: "Check your prompt, selected model, settings and reference image." }, { status: 400 }); }
    return NextResponse.json(await enhanceVideoPrompt(context, user.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "AI optimization is temporarily unavailable. Your original prompt can still be used." }, { status: 503 });
  }
}
