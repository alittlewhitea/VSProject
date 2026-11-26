import assert from "node:assert/strict";
import test from "node:test";
import { buildLlmsTxt } from "../src/lib/llms-txt";
import { CREDIT_PACKS } from "../src/lib/billing";

test("llms.txt includes all active credit packs, cheapest-model entitlements, and canonical routes", () => {
  const content = buildLlmsTxt("https://dreamface.io");

  assert.match(content, /^# DreamFace\n/m);
  assert.match(content, /https:\/\/dreamface\.io\/en\/price/);
  assert.match(content, /https:\/\/dreamface\.io\/studio/);
  assert.match(content, /https:\/\/dreamface\.io\/compare\/dreamface-vs-heygen/);
  assert.match(content, /https:\/\/dreamface\.io\/\.well-known\/search/);
  assert.match(content, /FLUX Schnell/);
  assert.match(content, /HeyGen Video/);
  assert.match(content, /HeyGen Voice Turbo/);

  for (const pack of CREDIT_PACKS) {
    assert.ok(content.includes(pack.name), `missing pack ${pack.name}`);
    assert.ok(content.includes(pack.credits.toLocaleString("en-US")), `missing credits for ${pack.name}`);
  }
});

test("llms.txt excludes retired models and outdated subscription offers", () => {
  const content = buildLlmsTxt("https://dreamface.io");

  assert.doesNotMatch(content, /Premium Lite|\$4\.99 weekly|800 weekly/i);
  assert.doesNotMatch(content, /dreamface-io-video|mischief-video|veo-video/i);
});
