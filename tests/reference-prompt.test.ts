import assert from "node:assert/strict";
import { test } from "node:test";
import { filterReferenceAssets, insertReferenceToken, referenceMentionQuery, referencePromptAssets, referencePromptParts, removeReferenceImageFromPrompt } from "../src/lib/reference-prompt";

const assets = referencePromptAssets(["first.png", "second.png"], ["clip.mp4"], ["voice.wav"]);

test("mention completion uses the actual ordered media references", () => {
  assert.deepEqual(assets.map(asset => asset.token), ["@Image1", "@Image2", "@Video1", "@Audio1"]);
  assert.deepEqual(filterReferenceAssets(assets, "im").map(asset => asset.url), ["first.png", "second.png"]);
  assert.deepEqual(filterReferenceAssets(assets, "2").map(asset => asset.token), ["@Image2"]);
  assert.deepEqual(filterReferenceAssets(assets, "VIDEO").map(asset => asset.token), ["@Video1"]);
});

test("completion works at the caret in Chinese and replaces the entire partial token", () => {
  assert.deepEqual(referenceMentionQuery("让@im向前走", 4), { start: 1, end: 4, query: "im" });
  assert.deepEqual(referenceMentionQuery("Use @Image2 here", 7), { start: 4, end: 11, query: "Im" });
  assert.deepEqual(referenceMentionQuery("(@", 2), { start: 1, end: 2, query: "" });
  assert.equal(referenceMentionQuery("@Image1", 0, 7), null);
  for (const text of ["user@example", "https://host/@Image", "@@Image", "a+@Image"]) {
    assert.equal(referenceMentionQuery(text, text.length), null);
  }
});

test("highlighting identifies exact tokens, missing media and case-insensitive references", () => {
  const text = "让@image1跑到@Image2旁边，参照@Video1。Missing @Image10; mail x@Image1, @Image2_extra";
  const parts = referencePromptParts(text, assets);
  assert.equal(parts.map(part => part.text).join(""), text);
  assert.deepEqual(parts.filter(part => part.asset).map(part => part.asset!.token), ["@Image1", "@Image2", "@Video1"]);
  assert.deepEqual(parts.filter(part => part.missing).map(part => part.text), ["@Image10"]);
  assert.equal(referencePromptParts("@Image10", referencePromptAssets(Array.from({ length: 10 }, (_, i) => `${i}.png`)))[0].asset?.index, 10);
});

test("insertion preserves the surrounding prompt and creates appropriate spacing", () => {
  assert.deepEqual(insertReferenceToken("Use @Im here", 4, 7, "@Image2"), { value: "Use @Image2 here", insertion: "@Image2", caret: 11 });
  assert.equal(insertReferenceToken("Use @", 4, 5, "@Video1").value, "Use @Video1 ");
  assert.equal(insertReferenceToken("@，然后镜头拉远", 0, 1, "@Image1").value, "@Image1，然后镜头拉远");
  assert.equal(insertReferenceToken("First selected last", 6, 14, "@Audio1").value, "First @Audio1 last");
});

test("removing an image keeps remaining mentions bound to their original images", () => {
  assert.equal(removeReferenceImageFromPrompt("@Image1 follows @Image2 past @Image3.", 0, 3), " follows @Image1 past @Image2.");
  assert.equal(removeReferenceImageFromPrompt("@image1，@IMAGE2，@Image10，x@Image2，@Video1", 1, 10), "@image1，，@Image9，x@Image2，@Video1");
  assert.equal(removeReferenceImageFromPrompt("@Image11 was already missing", 0, 10), "@Image11 was already missing");
});
