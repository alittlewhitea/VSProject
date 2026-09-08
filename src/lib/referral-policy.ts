import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BlockList, isIP } from "node:net";
import disposableDomains from "disposable-email-domains/index.json";

export const REFERRAL_DEVICE_COOKIE = "df_referral_device";
export const REFERRAL_CODE_COOKIE = "df_referral_code";
export const referralCodeValid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);
export function referralConfigured() {
  return process.env.REFERRAL_ENABLED === "true" && (process.env.REFERRAL_SECRET?.length || 0) >= 32 &&
    ["x-real-ip", "cf-connecting-ip"].includes(process.env.REFERRAL_IP_HEADER || "");
}
export function referralHash(scope: string, value: string) {
  const secret = process.env.REFERRAL_SECRET;
  if (!secret || secret.length < 32) throw new Error("Referral secret is not configured.");
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}
export function signReferralValue(value: string) { return `${value}.${referralHash("cookie", value)}`; }
export function readReferralValue(value?: string) {
  if (!value || value.length > 256) return null;
  const [payload, signature, extra] = value.split(".");
  if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  return timingSafeEqual(Buffer.from(referralHash("cookie", payload), "hex"), Buffer.from(signature, "hex")) ? payload : null;
}
export const newReferralDevice = () => randomBytes(32).toString("hex");
export function referralQuotaPeriod(now = new Date()) {
  const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7) };
}
export function isDisposableEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return true;
  const allowed = (process.env.REFERRAL_EMAIL_ALLOWLIST || "").toLowerCase().split(",").map(x => x.trim());
  if (allowed.includes(domain)) return false;
  const denied = new Set([...disposableDomains, ...(process.env.REFERRAL_EMAIL_DENYLIST || "").toLowerCase().split(",").map(x => x.trim())]);
  const labels = domain.split(".");
  return labels.some((_, i) => denied.has(labels.slice(i).join(".")));
}
export function excludedReferralIp(ip: string | null, rules = process.env.REFERRAL_EXCLUDED_IPS || "") {
  if (!ip || !isIP(ip)) return true;
  const list = new BlockList();
  for (const rule of rules.split(",").map(x => x.trim()).filter(Boolean)) {
    const [address, prefix, extra] = rule.split("/");
    const version = isIP(address);
    if (!version || extra) throw new Error("Invalid referral IP exclusion rule.");
    const type = version === 4 ? "ipv4" : "ipv6";
    if (prefix === undefined) list.addAddress(address, type);
    else {
      if (!/^\d+$/.test(prefix) || Number(prefix) > (version === 4 ? 32 : 128)) throw new Error("Invalid referral subnet.");
      list.addSubnet(address, Number(prefix), type);
    }
  }
  return list.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}
