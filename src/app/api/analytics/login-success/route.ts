import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "../../../../lib/server-auth";
import { LOGIN_SUCCESS_COOKIE, readLoginSuccessReceipt } from "../../../../lib/login-success-receipt";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

function text(value: unknown, limit: number) { return typeof value === "string" ? value.trim().slice(0, limit) : null; }

export async function POST(request: Request) {
  const store = await cookies();
  const session = await getSessionFromToken(store.get(SESSION_COOKIE_NAME)?.value);
  const receipt = readLoginSuccessReceipt(store.get(LOGIN_SUCCESS_COOKIE)?.value, session);
  if (!receipt || !session) return NextResponse.json({ claimed: false, event: null });
  const body = await request.json().catch(() => null) as { loginEventId?: string; anonymousId?: string; sessionId?: string; pagePath?: string; referrer?: string } | null;
  if (body?.loginEventId !== receipt.id) return NextResponse.json({ error: "Login event does not match authentication." }, { status: 409 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Analytics storage unavailable." }, { status: 503 });
  const path = text(body.pagePath, 700) || "/";
  const url = new URL(path.startsWith("/") ? path : "/", "https://dreamface.invalid");
  const surface = url.pathname === "/studio" ? url.searchParams.get("view") === "billing" ? "billing" : "studio" : /\/(?:billing|price)$/.test(url.pathname) ? "billing" : "website";
  const country = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "cloudfront-viewer-country"].map(key => request.headers.get(key)?.trim().toUpperCase()).find(value => value && /^[A-Z]{2}$/.test(value) && value !== "XX");
  const { error } = await admin.from("analytics_events").insert({
    // The existing primary key arbitrates concurrent tabs and repeated callbacks.
    id: receipt.id, user_id: session.user.id, event_name: "login_success", created_at: new Date(receipt.issuedAt).toISOString(),
    anonymous_id: text(body.anonymousId, 120), session_id: text(body.sessionId, 120), page_path: path,
    referrer: text(body.referrer, 700), user_agent: text(request.headers.get("user-agent"), 500),
    properties: { method: receipt.method, login_event_id: receipt.id, surface, ...(country ? { countryCode: country } : {}) }
  });
  const event = { id: receipt.id, method: receipt.method, surface };
  if (error?.code === "23505" || error?.code === "ER_DUP_ENTRY") return NextResponse.json({ claimed: false, event });
  if (error) return NextResponse.json({ error: "Analytics storage unavailable." }, { status: 503 });
  return NextResponse.json({ claimed: true, event });
}
