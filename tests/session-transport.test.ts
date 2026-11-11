import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bearerCredential, isSameOriginRequest, publicSessionToken, PUBLIC_SESSION_PREFIX } from "../src/lib/session-transport";

const root = join(__dirname, "..", "..");
const sessionRoute = readFileSync(join(root, "src/app/api/auth/session/route.ts"), "utf8");
const serverAuth = readFileSync(join(root, "src/lib/server-auth.ts"), "utf8");

const realToken = "a".repeat(64);
const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

test("the token given to page scripts is not the session credential", () => {
  const exposed = publicSessionToken(realToken);
  assert.ok(exposed.startsWith(PUBLIC_SESSION_PREFIX));
  assert.equal(exposed.includes(realToken), false);
  assert.equal(exposed, publicSessionToken(realToken), "stable per session");
  assert.notEqual(exposed, publicSessionToken("b".repeat(64)), "different per session");
});

test("the placeholder is never accepted as a bearer credential", () => {
  assert.equal(bearerCredential(`Bearer ${publicSessionToken(realToken)}`), null);
  assert.equal(bearerCredential("Bearer null"), null);
  assert.equal(bearerCredential("Bearer "), null);
  assert.equal(bearerCredential(null), null);
  assert.equal(bearerCredential(`Bearer ${realToken}`), realToken, "real tokens still work for API clients");
});

test("cookie authentication refuses cross-site requests", () => {
  const site = "https://dreamface.io";
  assert.equal(isSameOriginRequest(headers({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), site), false);
  assert.equal(isSameOriginRequest(headers({ origin: "https://evil.example", host: "dreamface.io" }), site), false);
  assert.equal(isSameOriginRequest(headers({ origin: "null", host: "dreamface.io" }), site), false);
  assert.equal(isSameOriginRequest(headers({ "sec-fetch-site": "same-origin", origin: site, host: "127.0.0.1:3002" }), site), true, "proxy host rewrite still allowed via configured origin");
  assert.equal(isSameOriginRequest(headers({ origin: "http://localhost:3000", host: "localhost:3000" }), null), true);
  assert.equal(isSameOriginRequest(headers({ "sec-fetch-site": "same-origin", host: "dreamface.io" }), site), true, "same-origin GET without Origin");
  assert.equal(isSameOriginRequest(headers({origin:"http://dreamface.io",host:"dreamface.io"}),site),false,"HTTPS cookies cannot authorize an HTTP origin");
  assert.equal(isSameOriginRequest(headers({origin:"https://evil.example",host:"dreamface.io","x-forwarded-host":"evil.example"}),site),false,"Spoofed proxy host cannot bypass the configured origin");
  assert.equal(isSameOriginRequest(headers({"sec-fetch-site":"same-site",host:"dreamface.io"}),site),false,"Other subdomains need an exact Origin");
});

test("session endpoint never returns the raw token", () => {
  assert.match(sessionRoute, /access_token: publicSessionToken\(session\.access_token\)/);
  assert.doesNotMatch(sessionRoute, /NextResponse\.json\(\{\s*session,/);
});

test("server auth falls back to the httpOnly cookie for browser requests", () => {
  assert.match(serverAuth, /const bearer = bearerCredential\(authHeader\)/);
  assert.match(serverAuth, /isSameOriginRequest\(requestHeaders, configuredPublicOrigin\(\)\)/);
});
