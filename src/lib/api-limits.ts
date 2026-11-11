// Request limits for expensive or high-volume endpoints. Kept free of database
// imports so the decision logic is unit-testable; routes pass in the real
// consumeRateLimit from request-security.

export type LimitRule = { scope: string; limit: number; windowSeconds: number };
export type ConsumeLimit = (input: LimitRule & { subject: string }) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;

// Sized well above normal studio use: one tab polls a running task about
// every 1.8s (~33/min), and several tasks can run at once.
export const GENERATE_LIMITS: LimitRule[] = [
  { scope: "generate_minute", limit: 12, windowSeconds: 60 },
  { scope: "generate_hour", limit: 150, windowSeconds: 60 * 60 }
];
export const STATUS_LIMITS: LimitRule[] = [{ scope: "generate_status", limit: 240, windowSeconds: 60 }];
export const TASKS_LIMITS: LimitRule[] = [{ scope: "task_history", limit: 120, windowSeconds: 60 }];
export const ANALYTICS_LIMITS: LimitRule[] = [{ scope: "analytics_track", limit: 120, windowSeconds: 60 }];
export const ANALYTICS_MAX_BODY_BYTES = 16 * 1024;

/** Maximum admitted pending tasks per user, enforced under a database account lock. */
export const MAX_ACTIVE_GENERATIONS = 5;

/**
 * Consumes each rule and returns the first one exceeded, or null. If the limiter
 * itself fails, callers return 503 without submitting or charging a paid request.
 */
export async function firstExceededLimit(subject: string, rules: LimitRule[], consume: ConsumeLimit): Promise<{scope:string; retryAfterSeconds:number; unavailable?:boolean} | null> {
  for (const rule of rules) {
    try {
      const result = await consume({ ...rule, subject });
      if (!result.allowed) return { scope: rule.scope, retryAfterSeconds: Math.max(1, result.retryAfterSeconds) };
    } catch {
      console.error(`Rate limiter unavailable for ${rule.scope}; request refused.`);
      return { scope: rule.scope, retryAfterSeconds: 15, unavailable: true as const };
    }
  }
  return null;
}

export function exceedsActiveGenerationLimit(activeCount: number) {
  return Number.isFinite(activeCount) && activeCount >= MAX_ACTIVE_GENERATIONS;
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return { "Retry-After": String(retryAfterSeconds) };
}
