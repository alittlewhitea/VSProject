import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { cookies } from "next/headers";
import { captureGrowthTouch, readGrowthTouch, growthProperties, GROWTH_COOKIE } from "../../../../lib/growth-attribution";
import { publicLandingPath } from "../../../../lib/growth-policy";
import { siteUrl } from "../../../../lib/site-url";

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "landing_cta_clicked",
  "generation_insufficient_credits_shown",
  "studio_prompt_improved",
  "gallery_prompt_copied",
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
  "checkout_login_required",
  "checkout_started",
  "checkout_success",
  "subscription_checkout_started",
  "subscription_checkout_success",
  "purchase",
  "checkout_cancelled",
  "studio_workflow_selected",
  "studio_billing_modal_opened",
  "gallery_template_applied"
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

function cleanCountryCode(value: string | null) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

function requestCountryCode(headers: Headers) {
  return (
    cleanCountryCode(headers.get("cf-ipcountry")) ||
    cleanCountryCode(headers.get("x-vercel-ip-country")) ||
    cleanCountryCode(headers.get("x-country-code")) ||
    cleanCountryCode(headers.get("cloudfront-viewer-country"))
  );
}

function hashIp(value: string | null) {
  if (!value) return null;
  const secret = process.env.ANALYTICS_IP_SECRET || process.env.AUTH_SESSION_SECRET || process.env.MYSQL_PASSWORD;
  if (!secret) return null;
  return createHmac("sha256", secret).update(value.split(",")[0].trim()).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TrackBody | null;
  const eventName = cleanText(body?.eventName, 80);

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, error: "Unsupported analytics event." }, { status: 400 });
  }
  // Old page bundles cannot add duplicate login records via the generic mirror.
  if (eventName === "login_success") return NextResponse.json({ ok: true, ignored: true });
  const isLandingEvent = eventName === "landing_view" || eventName === "landing_cta_clicked";
  if (isLandingEvent && /bot\b|spider|crawler|slurp/i.test(request.headers.get("user-agent") || "")) return NextResponse.json({ ok: true, ignored: true });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, storageWarning: "Analytics storage is not configured." });
  }

  const user = await getUserFromBearerToken(request.headers.get("authorization")).catch(() => null);
  const userAgent = request.headers.get("user-agent");
  const forwardedFor = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const countryCode = requestCountryCode(request.headers);
  const properties = cleanProperties(body?.properties);
  // Browser-supplied properties cannot forge the signed attribution fields.
  for (const key of ["attribution_id", "first_landing_path", "first_seen_at", "acquisition_channel", "acquisition_source", "acquisition_medium", "acquisition_campaign"]) delete properties[key];
  const store = await cookies();
  const landing = publicLandingPath(body?.pagePath);
  if ((eventName === "landing_view" || eventName === "landing_cta_clicked") && !landing) return NextResponse.json({ ok: false, error: "Not a public landing page." }, { status: 400 });
  const touch = eventName === "landing_view" ? captureGrowthTouch(store, body || {}, new URL(siteUrl()).hostname) : readGrowthTouch(store.get(GROWTH_COOKIE)?.value);

  const { error } = await admin.from("analytics_events").insert({
    id: randomUUID(),
    user_id: user?.id || null,
    anonymous_id: cleanText(body?.anonymousId, 120),
    session_id: cleanText(body?.sessionId, 120),
    event_name: eventName,
    page_path: isLandingEvent ? landing : cleanText(body?.pagePath, 700),
    referrer: isLandingEvent ? touch?.referrerHost || null : cleanText(body?.referrer, 700),
    user_agent: cleanText(userAgent, 500),
    ip_hash: hashIp(forwardedFor),
    properties: { ...properties, ...growthProperties(touch), ...(landing && eventName.startsWith("landing_") ? { landing_path: landing } : {}), ...(countryCode ? { countryCode } : {}) }
  });

  if (error) {
    return NextResponse.json({ ok: true, storageWarning: error.message });
  }

  return NextResponse.json({ ok: true });
}
