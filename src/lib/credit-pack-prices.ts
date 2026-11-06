// Shared by checkout and cost-based quotes. Keep amounts in cents.
// This module must remain independent of billing/model-pricing (no import cycle).
export const CREDIT_PACK_PRICES = {
  starter: { credits: 800, amountCents: 499 },
  creator: { credits: 1800, amountCents: 999 },
  studio: { credits: 4800, amountCents: 2499 },
  "pro-topup": { credits: 11000, amountCents: 4999 }
} as const;

export function lowestPaidCreditPriceUsd() {
  return Math.min(...Object.values(CREDIT_PACK_PRICES).map(pack => pack.amountCents / 100 / pack.credits));
}
