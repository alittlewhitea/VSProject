import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

const ALLOWED_EVENTS = new Set([
  "home_view",
  "home_cta_clicked",
  "hero_slide_clicked",
  "nav_clicked",
  "studio_view",
  "studio_mode_selected",
  "studio_model_selected",
  "studio_size_selected",
  "studio_reference_uploaded",
  "generate_clicked",
  "generate_login_required",
  "generation_queued",
  "generation_completed",
  "generation_failed",
  "auth_view",
  "login_started",
  "login_success",
  "login_magic_link_sent",
  "login_failed",
  "billing_view",
  "balance_refreshed",
  "checkout_started",
  "checkout_success",
  "checkout_cancelled"
]);

type TrackBody = {
  eventName?: string;
  anonymousId?: string | null;
  sessionId?: string | null;
  pagePath?: string | null;
  referrer?: string | null;
  properties?: Record<string, unknown>;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : null;
}

function cleanProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item) || item === null)
      .slice(0, 40)
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TrackBody | null;
  const eventName = cleanText(body?.eventName, 80);

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, error: "Unsupported analytics event." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, storageWarning: "Analytics storage is not configured." });
  }

  const user = await getUserFromBearerToken(request.headers.get("authorization")).catch(() => null);
  const userAgent = request.headers.get("user-agent");
  const forwardedFor = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");

  const { error } = await admin.from("analytics_events").insert({
    user_id: user?.id || null,
    anonymous_id: cleanText(body?.anonymousId, 120),
    session_id: cleanText(body?.sessionId, 120),
    event_name: eventName,
    page_path: cleanText(body?.pagePath, 700),
    referrer: cleanText(body?.referrer, 700),
    user_agent: cleanText(userAgent, 500),
    ip_hash: forwardedFor ? Buffer.from(forwardedFor.split(",")[0].trim()).toString("base64").slice(0, 80) : null,
    properties: cleanProperties(body?.properties)
  });

  if (error) {
    return NextResponse.json({ ok: true, storageWarning: error.message });
  }

  return NextResponse.json({ ok: true });
}
