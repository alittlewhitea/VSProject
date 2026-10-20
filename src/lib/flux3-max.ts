// Shared promotion window. The supplied fal rates already include 75% off.
export const FLUX3_MAX_PROMO_START = Date.parse("2026-10-15T00:00:00+08:00");
export const FLUX3_MAX_PROMO_END = Date.parse("2026-11-08T00:00:00+08:00");
export function isFlux3MaxPromotion(now = Date.now()) {
  return now >= FLUX3_MAX_PROMO_START && now < FLUX3_MAX_PROMO_END;
}
export function flux3MaxDuration(duration?: string | null) {
  const seconds = Number.parseInt(String(duration || "5s"), 10);
  return Number.isInteger(seconds) && seconds >= 5 && seconds <= 20 ? seconds : 5;
}
export function flux3MaxSecondPrice(resolution?: string | null, now = Date.now()) {
  const fullPrice = resolution === "1080p" ? 0.29 : 0.17;
  return fullPrice * (isFlux3MaxPromotion(now) ? 0.25 : 1);
}
