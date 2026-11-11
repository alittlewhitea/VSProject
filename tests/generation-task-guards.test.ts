import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAllowedFalUrl, isTerminalTaskStatus, providerPollTargets } from "../src/lib/generation-task-guards";

const root = join(__dirname, "..", "..");
const statusRoute = readFileSync(join(root, "src/app/api/generate/status/route.ts"), "utf8");
const cronRoute = readFileSync(join(root, "src/app/api/cron/sync-generation-tasks/route.ts"), "utf8");

test("only fal queue HTTPS addresses are pollable", () => {
  assert.equal(isAllowedFalUrl("https://queue.fal.run/fal-ai/x/requests/abc/status"), true);
  assert.equal(isAllowedFalUrl("http://queue.fal.run/fal-ai/x/requests/abc/status"), false);
  assert.equal(isAllowedFalUrl("https://queue.fal.run.evil.com/x"), false);
  assert.equal(isAllowedFalUrl("not a url"), false);
  assert.equal(isAllowedFalUrl(null), false);
});

test("finished tasks are terminal and never re-synced", () => {
  assert.equal(isTerminalTaskStatus("completed"), true);
  assert.equal(isTerminalTaskStatus("failed"), true);
  assert.equal(isTerminalTaskStatus("queued"), false);
  assert.equal(isTerminalTaskStatus("running"), false);
});

test("poll targets come from the stored task row", () => {
  const stored = {
    status_url: "https://queue.fal.run/m/requests/OWN/status",
    response_url: "https://queue.fal.run/m/requests/OWN"
  };
  assert.deepEqual(providerPollTargets(stored), {
    statusUrl: stored.status_url,
    responseUrl: stored.response_url
  });
  assert.equal(providerPollTargets({ status_url: null }), null);
  assert.equal(providerPollTargets({ status_url: "https://attacker.example/status" }), null);
  assert.deepEqual(providerPollTargets({ status_url: stored.status_url, response_url: "https://attacker.example/r" }), {
    statusUrl: stored.status_url,
    responseUrl: null
  });
});

test("status route ignores browser-supplied provider addresses (refund exploit regression)", () => {
  assert.doesNotMatch(statusRoute, /searchParams\.get\("statusUrl"\)/);
  assert.doesNotMatch(statusRoute, /searchParams\.get\("responseUrl"\)/);
  assert.match(statusRoute, /syncFalTask\(admin, task,/);
  assert.match(readFileSync(join(root, "src/lib/fal-task-sync.ts"), "utf8"), /providerPollTargets\(task\)/);
});

test("all polling entry points delegate settlement to the shared transaction boundary", () => {
  for (const source of [statusRoute, cronRoute, readFileSync(join(root,"src/app/api/tasks/route.ts"),"utf8")]) {
    assert.match(source,/syncFalTask\(admin, task,/);
    assert.doesNotMatch(source,/await refundCredits\(/);
  }
});
