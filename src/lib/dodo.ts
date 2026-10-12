import DodoPayments from "dodopayments";
import type { Product } from "dodopayments/resources/products/products";
import type { CreditPack } from "./billing";

export const DODO_PRODUCT_ENVS: Record<string, string> = {
  starter: "DODO_PRODUCT_STARTER", creator: "DODO_PRODUCT_CREATOR",
  studio: "DODO_PRODUCT_STUDIO", "pro-topup": "DODO_PRODUCT_PRO_TOPUP"
};
export function dodoEnvironment() {
  const mode = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() || "test_mode";
  if (mode !== "test_mode" && mode !== "live_mode") throw new Error("Invalid Dodo environment.");
  return mode;
}
export function dodoProductId(packId: string) {
  return process.env[DODO_PRODUCT_ENVS[packId] || ""]?.trim() || null;
}
export function isDodoConfigured(packId?: string) {
  try {
    dodoEnvironment();
    return Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim() && process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() &&
      (packId ? dodoProductId(packId) : Object.keys(DODO_PRODUCT_ENVS).every(id => dodoProductId(id))));
  } catch { return false; }
}
export function getDodoClient() {
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) throw new Error("Dodo Payments is not configured.");
  return new DodoPayments({ bearerToken, webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim(),
    environment: dodoEnvironment(), timeout: 15000, maxRetries: 1 });
}
export function validateDodoProduct(product: Product, pack: CreditPack) {
  const price = product.price;
  if (product.is_recurring || price.type !== "one_time_price" || price.currency !== "USD" ||
    price.price !== pack.amountCents || price.tax_inclusive === true || price.pay_what_you_want ||
    price.purchasing_power_parity || price.discount || price.discount_bps) {
    throw new Error("Dodo product must match the fixed USD, tax-exclusive, one-time credit pack price.");
  }
}
