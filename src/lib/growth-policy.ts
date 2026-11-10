import { locales } from "../i18n/routing";
export type GrowthChannel = "organic_search" | "ai_referral" | "paid_search" | "campaign" | "referral" | "direct";
export type GrowthTouch = { id: string; landingPath: string; channel: GrowthChannel; source: string; medium: string | null; campaign: string | null; referrerHost: string | null; firstSeenAt: string; expires: number };

export function publicLandingPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\0]/.test(value)) return null;
  try {
    const url = new URL(value, "https://dreamface.invalid");
    if (url.origin !== "https://dreamface.invalid") return null;
    const path = url.pathname.replace(/\/$/, "") || "/";
    const locale = locales.find(item => path === `/${item}` || path.startsWith(`/${item}/`));
    const base = locale ? path.slice(locale.length + 1) || "/" : path;
    if (locale) {
      if (base === "/" || base === "/price") return path;
      if ((locale === "es" || locale === "pt-BR") && ["/image/text-to-image", "/video/image-to-video", "/video/text-to-video"].includes(base)) return path;
      if (locale === "en" && base === "/video/text-to-video") return base;
      return null;
    }
    if (["/", "/price", "/about", "/gallery", "/compare", "/image/text-to-image", "/video/text-to-video", "/video/image-to-video", "/video/gemini-omni", "/video/seedance-2", "/video/examples", "/avatar/ai-avatar-generator"].includes(base) || /^\/(?:compare|gallery)\/[a-zA-Z0-9-]{1,180}$/.test(base)) return path === "/" ? "/en" : path;
  } catch { /* Invalid URLs are never attribution entry points. */ }
  return null;
}

function campaignText(value: string | null) { return value?.trim().replace(/[^a-zA-Z0-9_. -]/g, "").slice(0, 100) || null; }
const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export function growthSource(pagePath: string, referrer: unknown, ownHost: string): Pick<GrowthTouch, "channel" | "source" | "medium" | "campaign" | "referrerHost"> {
  const url = new URL(pagePath, "https://dreamface.invalid");
  let host: string | null = null;
  try { const ref = new URL(typeof referrer === "string" ? referrer : ""); if (["http:", "https:"].includes(ref.protocol)) host = ref.hostname.toLowerCase(); } catch { /* Direct navigation. */ }
  const own = ownHost.replace(/^www\./, "").toLowerCase();
  if (host && (matches(host, own) || ["accounts.google.com", "paypal.com", "dodopayments.com", "checkout.stripe.com"].some(domain => matches(host!, domain)))) host = null;
  const source = campaignText(url.searchParams.get("utm_source")), medium = campaignText(url.searchParams.get("utm_medium")), campaign = campaignText(url.searchParams.get("utm_campaign"));
  const shared = { medium, campaign, referrerHost: host };
  if (url.searchParams.has("gclid") || url.searchParams.has("gbraid") || url.searchParams.has("wbraid") || (/^(cpc|ppc|paidsearch|paid_search)$/i.test(medium || "") && /^(google|bing|yahoo|baidu)$/i.test(source || ""))) return { ...shared, channel: "paid_search", source: source || "google" };
  const aiDomains = ["chatgpt.com", "chat.openai.com", "perplexity.ai", "copilot.microsoft.com", "gemini.google.com", "claude.ai"];
  if ((host && aiDomains.some(domain => matches(host!, domain))) || (source && [...aiDomains, "chatgpt", "perplexity", "copilot", "gemini", "claude"].includes(source.toLowerCase()))) return { ...shared, channel: "ai_referral", source: source || host! };
  if (source && /^organic$/i.test(medium || "")) return { ...shared, channel: "organic_search", source };
  if (source) return { ...shared, channel: "campaign", source };
  if (host && /(^|\.)(google\.[a-z.]+|bing\.com|search\.yahoo\.com|duckduckgo\.com|ecosia\.org|baidu\.com)$/.test(host)) return { ...shared, channel: "organic_search", source: host };
  return { ...shared, channel: host ? "referral" : "direct", source: host || "direct" };
}
