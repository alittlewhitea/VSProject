import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { cookies } from "next/headers";
import { growthSource, publicLandingPath, type GrowthTouch } from "./growth-policy";
import { mysqlExecute } from "./mysql";
export const GROWTH_COOKIE = "dreamface_growth_touch";
const LIFETIME = 30 * 24 * 60 * 60 * 1000;
type CookieStore = Pick<Awaited<ReturnType<typeof cookies>>, "get" | "set">;
function secret() { return process.env.AUTH_SESSION_SECRET || process.env.AUTH_RATE_LIMIT_SECRET || process.env.ANALYTICS_IP_SECRET || process.env.MYSQL_PASSWORD || (process.env.NODE_ENV !== "production" ? "local-growth-secret" : null); }

export function readGrowthTouch(value: string | undefined): GrowthTouch | null {
  const key = secret();
  if (!key || !value || value.length > 2500) return null;
  const [body, signature, extra] = value.split(".");
  if (extra || !body || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  if (!timingSafeEqual(createHmac("sha256", key).update(body).digest(), Buffer.from(signature, "hex"))) return null;
  try {
    const touch = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GrowthTouch;
    const firstSeen = Date.parse(touch.firstSeenAt);
    if (!/^g_[a-f0-9]{32}$/.test(touch.id) || publicLandingPath(touch.landingPath) !== touch.landingPath || !Number.isFinite(firstSeen) || firstSeen > Date.now() + 60000 || !Number.isFinite(touch.expires) || touch.expires <= Date.now() || touch.expires - firstSeen !== LIFETIME) return null;
    if (!["organic_search", "ai_referral", "paid_search", "campaign", "referral", "direct"].includes(touch.channel) || typeof touch.source !== "string") return null;
    return touch;
  } catch { return null; }
}

export function captureGrowthTouch(store: CookieStore, body: { pagePath?: string | null; referrer?: string | null; anonymousId?: string | null }, ownHost: string): GrowthTouch | null {
  const existing = readGrowthTouch(store.get(GROWTH_COOKIE)?.value);
  if (existing) return existing;
  const key = secret(), landingPath = publicLandingPath(body.pagePath);
  if (!key || !landingPath) return null;
  const now = Date.now();
  const browserId = /^anon_[a-zA-Z0-9_-]{8,100}$/.test(body.anonymousId || "") ? body.anonymousId! : randomUUID();
  const touch: GrowthTouch = { id: `g_${createHmac("sha256", key).update(`growth:${browserId}`).digest("hex").slice(0, 32)}`, landingPath, ...growthSource(body.pagePath!, body.referrer, ownHost), firstSeenAt: new Date(now).toISOString(), expires: now + LIFETIME };
  const encoded = Buffer.from(JSON.stringify(touch)).toString("base64url");
  store.set(GROWTH_COOKIE, `${encoded}.${createHmac("sha256", key).update(encoded).digest("hex")}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: LIFETIME / 1000 });
  return touch;
}

export function growthProperties(touch: GrowthTouch | null) {
  return touch ? { attribution_id: touch.id, first_landing_path: touch.landingPath, first_seen_at: touch.firstSeenAt, acquisition_channel: touch.channel, acquisition_source: touch.source, acquisition_medium: touch.medium, acquisition_campaign: touch.campaign } : {};
}

/** New-user attribution is an observed first browser touch, never a login count. */
export async function recordSignupAttribution(userId: string, isNew: boolean, cookieValue: string | undefined) {
  if (!isNew) return false;
  const touch = readGrowthTouch(cookieValue);
  if (!touch) return false;
  await mysqlExecute("update users set raw_user_meta_data = json_set(coalesce(raw_user_meta_data, json_object()), '$.growthAttribution', json_extract(?, '$')) where id = ? and json_extract(raw_user_meta_data, '$.growthAttribution') is null", [JSON.stringify(touch), userId]);
  return true;
}
