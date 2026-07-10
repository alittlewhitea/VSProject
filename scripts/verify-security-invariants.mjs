import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [credits, download, verify, redirects, cron, debug] = await Promise.all([
  source("src/app/api/credits/route.ts"),
  source("src/app/api/generate/download/route.ts"),
  source("src/app/api/auth/verify/route.ts"),
  source("src/lib/request-security.ts"),
  source("src/lib/cron-auth.ts"),
  source("src/app/api/debug-auth/route.ts")
]);

assert.match(credits, /NODE_ENV === "production"[\s\S]+ENABLE_DEV_CREDIT_TOPUP/);
assert.match(download, /searchParams\.get\("taskId"\)/);
assert.doesNotMatch(download, /searchParams\.get\("url"\)/);
assert.match(download, /redirect: "error"/);
assert.match(download, /MAX_DOWNLOAD_BYTES/);
assert.match(verify, /consumed_at is null and expires_at > now\(6\)/i);
assert.match(verify, /affectedRows !== 1/);
assert.match(redirects, /path\.startsWith\("\/\/"\)/);
assert.match(redirects, /trustedPublicOrigin/);
assert.doesNotMatch(cron, /searchParams|get\("secret"\)/);
assert.match(debug, /NODE_ENV === "production"/);

console.log("Security invariants passed.");
