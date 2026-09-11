import { createHmac, timingSafeEqual } from "node:crypto";

export const KYREN_PRODUCT_ENVS: Record<string, string> = {
  starter: "KYRENPAY_PRODUCT_STARTER", creator: "KYRENPAY_PRODUCT_CREATOR",
  studio: "KYRENPAY_PRODUCT_STUDIO", "pro-topup": "KYRENPAY_PRODUCT_PRO"
};
export function kyrenCheckoutEnabled() {
  return process.env.KYRENPAY_CHECKOUT_ENABLED === "true";
}
export function kyrenConfigured() {
  return Boolean(process.env.KYRENPAY_API_KEY?.trim() && process.env.KYRENPAY_WEBHOOK_SECRET?.trim());
}
export function kyrenProductId(packId: string) {
  const value = process.env[KYREN_PRODUCT_ENVS[packId] || ""]?.trim();
  if (!value || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error("This credit pack is not configured for payment yet.");
  return value;
}
export function moneyCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export type KyrenCheckout = { id: string; productId: string; amount: string; currency: string; url: string; orderId?: string | null; expiresAt?: number };
export type KyrenOrder = {
  id: string; checkoutSessionId: string; productId: string; amount: string; currency: string;
  status: string; metadata?: Record<string, unknown> | null;
};
export async function kyrenRequest<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.KYRENPAY_API_KEY?.trim();
  if (!key) throw new Error("KyrenPay is not configured.");
  const response = await fetch(`https://api.kyrenpay.com/v1${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", redirect: "error",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => null) as { code?: number; data?: T } | null;
  if (!response.ok || payload?.code !== 0 || !payload.data) throw new Error(`KyrenPay request failed (HTTP ${response.status}).`);
  return payload.data;
}
export const getKyrenOrder = (id: string) => kyrenRequest<KyrenOrder>(`/orders/${encodeURIComponent(id)}`);
export const getKyrenCheckout = (id: string) => kyrenRequest<KyrenCheckout>(`/checkouts/${encodeURIComponent(id)}`);
export function kyrenCheckoutUrl(value: string) {
  const url = new URL(value);
  // Hosted checkout origin documented by Kyren. No customer-controlled redirects.
  if (url.protocol !== "https:" || url.hostname !== "payment.kyren.io" || url.port || url.username || url.password) {
    throw new Error("Unexpected KyrenPay checkout URL.");
  }
  return url.href;
}
export function verifyKyrenSignature(raw: string, headers: Headers, now = Date.now()) {
  const secret = process.env.KYRENPAY_WEBHOOK_SECRET?.trim();
  const timestamp = headers.get("x-kyren-timestamp") || "";
  const signature = headers.get("x-kyren-signature") || "";
  if (!secret || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
