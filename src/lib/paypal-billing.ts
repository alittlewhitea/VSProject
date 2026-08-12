import type { SubscriptionPlanPrice } from "./billing";
import { SUBSCRIPTION_PLANS } from "./billing";
import { getPayPalPlan } from "./paypal";

type PayPalPlanExpectation = {
  amountCents: number;
  currency: string;
  interval: SubscriptionPlanPrice["interval"];
};

export type PayPalPlanValidation = {
  valid: boolean;
  planId: string | null;
  error: string | null;
};

const planValidationCache = new Map<string, { expiresAt: number; result: PayPalPlanValidation }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function moneyToCents(value: string | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function expectedIntervalUnit(interval: SubscriptionPlanPrice["interval"]) {
  return interval.toUpperCase();
}

export async function validatePayPalPlan(
  planId: string | null | undefined,
  expected: PayPalPlanExpectation
): Promise<PayPalPlanValidation> {
  const normalizedPlanId = planId?.trim() || null;
  if (!normalizedPlanId) return { valid: false, planId: null, error: "PayPal plan ID is missing." };

  const cacheKey = [
    process.env.PAYPAL_ENV?.trim().toLowerCase() || "sandbox",
    normalizedPlanId,
    expected.amountCents,
    expected.currency.toLowerCase(),
    expected.interval
  ].join(":");
  const cached = planValidationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const plan = await getPayPalPlan(normalizedPlanId);
    const regularCycle = plan.billing_cycles?.find((cycle) => cycle.tenure_type === "REGULAR");
    let error: string | null = null;
    if (plan.status !== "ACTIVE") {
      error = `PayPal plan is ${plan.status || "not active"}.`;
    } else if (!regularCycle) {
      error = "PayPal plan has no regular billing cycle.";
    } else if (regularCycle.frequency?.interval_unit !== expectedIntervalUnit(expected.interval) || Number(regularCycle.frequency?.interval_count) !== 1) {
      error = `PayPal plan billing interval does not match ${expected.interval}.`;
    } else if (regularCycle.pricing_scheme?.fixed_price?.currency_code?.toLowerCase() !== expected.currency.toLowerCase()) {
      error = `PayPal plan currency does not match ${expected.currency.toUpperCase()}.`;
    } else if (moneyToCents(regularCycle.pricing_scheme?.fixed_price?.value) !== expected.amountCents) {
      error = `PayPal plan amount does not match ${(expected.amountCents / 100).toFixed(2)} ${expected.currency.toUpperCase()}.`;
    }

    const result = { valid: !error, planId: normalizedPlanId, error };
    planValidationCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  } catch (error) {
    const result = {
      valid: false,
      planId: normalizedPlanId,
      error: error instanceof Error ? error.message : "Unable to validate PayPal plan."
    };
    planValidationCache.set(cacheKey, { expiresAt: Date.now() + 30_000, result });
    return result;
  }
}

export async function validateConfiguredPayPalPlans() {
  const entries = await Promise.all(SUBSCRIPTION_PLANS.flatMap((plan) =>
    Object.entries(plan.prices).map(async ([cycle, price]) => {
      const result = await validatePayPalPlan(process.env[price.paypalPlanEnv], {
        amountCents: price.amountCents,
        currency: "usd",
        interval: price.interval
      });
      return { key: `${plan.id}:${cycle}`, env: price.paypalPlanEnv, ...result };
    })
  ));
  return {
    valid: entries.every((entry) => entry.valid),
    validCount: entries.filter((entry) => entry.valid).length,
    total: entries.length,
    entries
  };
}
