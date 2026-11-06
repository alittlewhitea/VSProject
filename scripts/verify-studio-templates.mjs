import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync("public/data/studio-video-templates.json", "utf8"));
assert.equal(catalog.version, 1);
assert.equal(new Set(catalog.items.map(item => item.id)).size, catalog.items.length);
assert.equal(catalog.selection.limitPerCategory, null, "Import the complete public category lists without a per-category cap");
assert.equal(catalog.selection.coverage, "all-public-category-videos");
assert.equal(catalog.selection.publishedAtAvailable, false, "Do not invent publication dates for the public feed");
for (const category of ["motion", "ugc", "tiktok"]) {
  const count = catalog.items.filter(item => item.categories.includes(category)).length;
  assert.ok(count >= 25);
  assert.equal(count, catalog.categoryCounts[category]);
}
assert.ok(catalog.categoryCounts.motion > 25 && catalog.categoryCounts.ugc > 25, "Retain entries beyond the previous 25-item selection");
for (const item of catalog.items) {
  assert.ok(item.id && item.title && item.width > 0 && item.height > 0);
  assert.ok(!("prompt" in item), "Preview assets must not invent an executable generation preset");
  for (const key of ["videoUrl", "posterUrl", "sourceUrl"]) {
    const url = new URL(item[key]);
    assert.equal(url.protocol, "https:");
    assert.ok(["cdn.higgsfield.ai", "static.higgsfield.ai", "d29nkk4626dxhc.cloudfront.net", "higgsfield.ai"].includes(url.hostname));
  }
}
function verifyOrder(value) {
  for (const [category, order] of Object.entries(value.categoryOrder)) {
    const expected = value.items.filter(item => category === "all" || item.categories.includes(category)).map(item => item.id);
    assert.equal(new Set(order).size, expected.length);
    assert.deepEqual([...order].sort(), expected.sort(), `Complete ${category} order without duplicates`);
  }
}
verifyOrder(catalog);
const images = JSON.parse(readFileSync("public/data/studio-image-templates.json", "utf8"));
assert.equal(images.version, 1);
assert.equal(images.selection.limitPerCategory, null);
assert.equal(images.selection.coverage, "all-public-category-images");
assert.equal(images.selection.publishedAtAvailable, false);
assert.equal(new Set(images.items.map(item => item.id)).size, images.items.length);
for (const category of ["product-shot", "ads", "posters", "marketplace"]) {
  assert.ok(images.categoryCounts[category] > 0);
  assert.equal(images.items.filter(item => item.categories.includes(category)).length, images.categoryCounts[category]);
}
for (const item of images.items) {
  assert.ok(item.id && item.title && item.width > 0 && item.height > 0);
  assert.ok(!("prompt" in item) && !("videoUrl" in item));
  const asset = new URL(item.imageUrl);
  assert.equal(asset.protocol, "https:");
  assert.equal(asset.hostname, "cdn.higgsfield.ai", "Image templates must use the public CDN, never local placeholder assets");
  const sourceUrl = new URL(item.sourceUrl);
  assert.equal(sourceUrl.protocol, "https:");
  assert.equal(sourceUrl.hostname, "higgsfield.ai");
}
verifyOrder(images);
const titles = [...new Set([...images.items, ...catalog.items].map(item => item.title))];
const sourceHash = createHash("sha256").update(titles.join("\n")).digest("hex");
for (const locale of ["en", "zh-CN", "zh-TW", "es", "pt-BR", "fr", "de", "ja", "ko", "ru", "vi", "th", "nl", "he", "it", "ar"]) {
  const messages = JSON.parse(readFileSync(`public/data/studio-template-titles/${locale}.json`, "utf8"));
  assert.equal(messages.version, 1);
  assert.equal(messages.sourceHash, sourceHash, `${locale} title translations must match the current source catalog`);
  assert.deepEqual(Object.keys(messages.titles).sort(), [...titles].sort());
  for (const value of Object.values(messages.titles)) assert.ok(typeof value === "string" && value.trim());
}
const source = readFileSync("src/app/studio/studio-client.tsx", "utf8");
assert.ok(source.includes('<VideoTemplateGallery translate={st} locale={studioI18n.locale} />'),"Keep the video template gallery below the creation form");
const videoSettings=readFileSync("src/features/studio/video-settings.tsx","utf8");
assert.ok(videoSettings.includes('data-video-workspace={workflow}'));
assert.ok(!videoSettings.includes('df-preview-stage')&&!videoSettings.includes('promptShowcases'),"Side preview and sample rail were intentionally removed from video creation");
console.log(`Studio templates passed: all ${catalog.categoryCounts.motion} Motion + ${catalog.categoryCounts.ugc} UGC + ${catalog.categoryCounts.tiktok} TikTok public video references, valid metadata and source links, and template gallery retained below the creation form. No network or paid calls.`);
console.log(`Image templates passed: all ${images.items.length} public CDN images with complete Product shot/Ads/Posters/Marketplace and All ordering; no local pictures or executable generation presets.`);
console.log(`Title localization passed: all ${titles.length} unique source titles covered in 16 locale files; source hash and complete nonempty display strings verified.`);
