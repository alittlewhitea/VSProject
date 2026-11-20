import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { getRequestIp, getCreditAccount } from "../../../../lib/credits";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getH3DailyFreeStatus, h3FreeContext } from "../../../../lib/h3-daily-free";
import { assistantRequirements } from "../../../../lib/creation-assistant-recommendations";
import { assistantKnowledgeScope } from "../../../../lib/assistant-knowledge-scope";
import { assistantDirectIntent } from "../../../../lib/assistant-direct-intent";
import { trustedPublicOrigin } from "../../../../lib/request-security";
import { isSameOriginRequest } from "../../../../lib/session-transport";
import { validateAssistantRequest } from "../../../../lib/creation-assistant-context";
import { AssistantServiceError, replyWithCreationAssistant } from "../../../../lib/creation-assistant-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request.headers, trustedPublicOrigin(request.url))) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "invalid_request" }, { status: 415, headers: responseHeaders });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: responseHeaders });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1000000) { await reader.cancel(); return NextResponse.json({ error: "request_too_large" }, { status: 413, headers: responseHeaders }); }
      chunks.push(value);
    }
    let input;
    try { input = validateAssistantRequest(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: responseHeaders }); }
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    const directIntent = assistantDirectIntent(input);
    const needsBalance = directIntent
      ? ["budget", "pricing", "billing", "current-cost"].includes(directIntent)
      : assistantKnowledgeScope(input).needsBalance;
    if (user && needsBalance) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const admin = createSupabaseAdminClient();
        const workflow = assistantRequirements(input).workflow;
        const checkFree = directIntent !== "billing" && (directIntent === "pricing" || workflow === "text-to-video" || workflow === "image-to-video" || !workflow && /视频|影片|video/i.test(input.messages.at(-1)!.content));
        const snapshot = admin ? await Promise.race([
          Promise.all([getCreditAccount(admin, user.id), checkFree ? h3FreeContext(request.headers).then(context=>getH3DailyFreeStatus(user.id,context)).catch(()=>null) : null]),
          new Promise<null>(resolve=>{ timer=setTimeout(()=>resolve(null),1200); })
        ]) : null;
        if (snapshot?.[0] && Number.isFinite(Number(snapshot[0].balance)) && Number(snapshot[0].balance) >= 0) input.account = { creditBalance: Number(snapshot[0].balance), h3DailyFreeAvailable: snapshot[1]?.available === true };
      } catch { /* Budget advice remains available when a read-only balance lookup fails. */ }
      finally { clearTimeout(timer); }
    }
    const ip = getRequestIp(request.headers) || "unknown";
    const reply = await replyWithCreationAssistant(input, { subject: user ? `user:${user.id}` : `guest:${ip}`, ip, authenticated: Boolean(user), userId: user?.id });
    return NextResponse.json(reply, { headers: responseHeaders });
  } catch (error) {
    const status = error instanceof AssistantServiceError ? error.status : 503;
    return NextResponse.json({ error: status === 429 ? "rate_limited" : "assistant_unavailable" }, { status, headers: { ...responseHeaders, ...(status === 429 ? { "Retry-After": String((error as AssistantServiceError).retryAfter) } : {}) } });
  }
}
