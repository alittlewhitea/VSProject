import { lowestPaidCreditPriceUsd } from "./credit-pack-prices";
import { SEEDANCE_FLASH_PROVIDER } from "./seedance-flash";
import { SEEDREAM_55_PROVIDER } from "./seedream-55";

export const SEED_MODEL_TARGET_MARGIN = 0.20;
// Planning allowance, not a verified payment-provider fee schedule.
export const SEED_MODEL_PAYMENT_FEE_RESERVE = 0.05;

export function isSeedModelProvider(provider?: string | null) {
  return provider === SEEDANCE_FLASH_PROVIDER || provider === SEEDREAM_55_PROVIDER;
}

/** Derive credits from the cheapest paid pack, without adding a second HD markup. */
export function seedModelCreditsFromCostUsd(costUsd: number, targetMargin = SEED_MODEL_TARGET_MARGIN) {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 1;
  if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin + SEED_MODEL_PAYMENT_FEE_RESERVE >= 1) {
    throw new Error("Invalid Seed model pricing margin");
  }
  const availableRevenuePerCredit = lowestPaidCreditPriceUsd() * (1 - targetMargin - SEED_MODEL_PAYMENT_FEE_RESERVE);
  return Math.max(1, Math.ceil(costUsd / availableRevenuePerCredit - 1e-9));
}
