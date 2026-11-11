import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANALYTICS_LIMITS,
  GENERATE_LIMITS,
  MAX_ACTIVE_GENERATIONS,
  STATUS_LIMITS,
  exceedsActiveGenerationLimit,
  firstExceededLimit,
  type ConsumeLimit
} from "../src/lib/api-limits";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** In-memory stand-in for the MySQL-backed limiter. */
function memoryLimiter(): ConsumeLimit {
  const counts = new Map<string, number>();
  return async ({ scope, subject, limit, windowSeconds }) => {
    const key = `${scope}:${subject}`;
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);
    return { allowed: count <= limit, retryAfterSeconds: windowSeconds };
  };
}

test("generation is limited per user per minute", async () => {
  const consume = memoryLimiter();
  const perMinute = GENERATE_LIMITS[0].limit;
  for (let i = 0; i < perMinute; i += 1) assert.equal(await firstExceededLimit("user-a", GENERATE_LIMITS, consume), null);
  const denied = await firstExceededLimit("user-a", GENERATE_LIMITS, consume);
  assert.equal(denied?.scope, "generate_minute");
  assert.ok((denied?.retryAfterSeconds || 0) >= 1);
  assert.equal(await firstExceededLimit("user-b", GENERATE_LIMITS, consume), null, "other users are unaffected");
});

test("status limit leaves room for several tasks polling every 1.8s", () => {
  const pollsPerTaskPerMinute = Math.ceil(60 / 1.8);
  assert.ok(STATUS_LIMITS[0].limit >= pollsPerTaskPerMinute * MAX_ACTIVE_GENERATIONS);
});

test("analytics is limited per IP", async () => {
  const consume = memoryLimiter();
  for (let i = 0; i < ANALYTICS_LIMITS[0].limit; i += 1) await firstExceededLimit("203.0.113.9", ANALYTICS_LIMITS, consume);
  assert.equal((await firstExceededLimit("203.0.113.9", ANALYTICS_LIMITS, consume))?.scope, "analytics_track");
});

test("a limiter outage refuses new paid work", async () => {
  const failing: ConsumeLimit = async () => { throw new Error("database unavailable"); };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await firstExceededLimit("user-a", GENERATE_LIMITS, failing))?.unavailable, true);
  } finally {
    console.error = originalError;
  }
});

test("concurrent generations are capped", () => {
  assert.equal(exceedsActiveGenerationLimit(MAX_ACTIVE_GENERATIONS - 1), false);
  assert.equal(exceedsActiveGenerationLimit(MAX_ACTIVE_GENERATIONS), true);
  assert.equal(exceedsActiveGenerationLimit(Number.NaN), false);
});

test("routes enforce their limits", () => {
  const generate = read("src/app/api/generate/route.ts");
  const replayAt = generate.indexOf("return returnExistingTask(admin, user.id, existingTask);");
  const limitAt = generate.indexOf("firstExceededLimit(user.id, GENERATE_LIMITS, consumeRateLimit)");
  const chargeAt = generate.indexOf('await reserveGenerationTask(admin,');
  assert.ok(replayAt > 0 && replayAt < limitAt && limitAt < chargeAt, "limits run after idempotent replay and before any charge");
  assert.match(generate, /GenerationCapacityError/);
  assert.match(read("src/app/api/generate/status/route.ts"), /firstExceededLimit\(user\.id, STATUS_LIMITS, consumeRateLimit\)/);
  assert.equal((read("src/app/api/tasks/route.ts").match(/await taskHistoryLimited\(user\.id\)/g) || []).length, 2);
  const analytics = read("src/app/api/analytics/track/route.ts");
  assert.match(analytics, /ANALYTICS_MAX_BODY_BYTES/);
  assert.match(analytics, /firstExceededLimit\(getRequestIp\(request\.headers\) \|\| "unknown", ANALYTICS_LIMITS/);
});
