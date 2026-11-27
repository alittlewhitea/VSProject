import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync("src/features/studio/studio-masonry-layout.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
Function("module", "exports", compiled)(module, module.exports);
const { layoutStudioMasonry, studioMasonryWindow } = module.exports;
const image = JSON.parse(readFileSync("public/data/studio-image-templates.json", "utf8"));
const video = JSON.parse(readFileSync("public/data/studio-video-templates.json", "utf8"));
const combined = JSON.parse(readFileSync("public/data/studio-combined-template-order.json", "utf8"));
const slides = JSON.parse(readFileSync("public/data/studio-home-template-slides.json", "utf8"));
const all = [...image.items, ...video.items];
const allowedCategories = {
  image: ["product-shot", "ads", "posters", "marketplace"],
  video: ["motion", "ugc", "tiktok", "shorts"]
};
for (const [kind, catalog] of [["image", image], ["video", video]]) {
  assert.equal(catalog.version, 1, `${kind} catalog version must be 1`);
  assert.ok(Array.isArray(catalog.items) && catalog.items.length > 0, `${kind} catalog items must be non-empty`);
  for (const item of catalog.items) {
    assert.equal(typeof item.id, "string", `${kind} item missing id`);
    assert.equal(typeof item.title, "string", `${kind} item ${item.id} missing title`);
    assert.ok(Array.isArray(item.categories) && item.categories.some(c => allowedCategories[kind].includes(c)), `${kind} item ${item.id} missing valid category`);
    assert.ok(Number.isFinite(item.width) && item.width > 0 && Number.isFinite(item.height) && item.height > 0, `${kind} item ${item.id} invalid dimensions`);
    assert.ok(typeof item.sourceUrl === "string" && item.sourceUrl.startsWith("https://"), `${kind} item ${item.id} missing https sourceUrl`);
    if (kind === "video") {
      assert.ok(typeof item.videoUrl === "string" && item.videoUrl.startsWith("https://"), `video item ${item.id} invalid videoUrl`);
      assert.ok(typeof item.posterUrl === "string" && item.posterUrl.startsWith("https://"), `video item ${item.id} invalid posterUrl`);
    } else {
      assert.ok(typeof item.imageUrl === "string" && item.imageUrl.startsWith("https://"), `image item ${item.id} invalid imageUrl`);
    }
  }
  if (catalog.categoryOrder) {
    for (const [category, order] of Object.entries(catalog.categoryOrder)) {
      const expected = catalog.items.filter(item => category === "all" || item.categories.includes(category));
      const ids = new Set(expected.map(item => item.id));
      assert.ok(Array.isArray(order), `${kind} categoryOrder.${category} must be array`);
      assert.equal(order.length, expected.length, `${kind} categoryOrder.${category} length mismatch (${order.length} !== ${expected.length})`);
      assert.equal(new Set(order).size, order.length, `${kind} categoryOrder.${category} has duplicate ids`);
      assert.ok(order.every(id => ids.has(id)), `${kind} categoryOrder.${category} contains unknown id`);
    }
  }
}
assert.equal(combined.ids.length, all.length);
assert.deepEqual([...combined.ids].sort(), all.map(item => item.id).sort());
assert.equal(new Set(combined.ids).size, all.length);
assert.ok(slides.items.length >= 7);
assert.equal(slides.items[Math.floor(slides.items.length / 2)].category, "pet-sing-dance", "Pet Sing & Dance must match the center pagination dot");
for (const slide of slides.items) {
  const original = all.find(item => item.id === slide.id);
  assert.ok(original && original.categories.includes(slide.category));
  assert.equal(slide.videoUrl || slide.imageUrl, original.videoUrl || original.imageUrl);
}
let peakMounted = 0;
for (const items of [image.items, video.items, all]) {
  for (const [width, columns, gap, viewport] of [[328, 2, 10, 740], [358, 2, 10, 844], [900, 3, 16, 768], [1168, 4, 16, 900], [1520, 5, 16, 1080]]) {
    const layout = layoutStudioMasonry(items, width, columns, gap);
    assert.equal(layout.tiles.length, items.length);
    assert.equal(new Set(layout.tiles.map(tile => tile.id)).size, items.length);
    assert.equal(layout.height, Math.max(...layout.tiles.map(tile => tile.bottom)));
    for (let column = 0; column < columns; column++) {
      const tiles = layout.tiles.filter(tile => tile.column === column);
      tiles.forEach((tile, index) => {
        assert.ok(tile.start >= 0 && tile.start + tile.width <= width + .01);
        assert.ok(tile.height > 0 && tile.bottom <= layout.height);
        if (index) assert.ok(tile.top >= tiles[index - 1].bottom + gap - .01, "Cards must never overlap");
      });
    }
    const visited = new Set();
    for (let top = -viewport; top <= layout.height; top += viewport / 2) {
      const mounted = studioMasonryWindow(layout.tiles, top, top + viewport, 900);
      mounted.forEach(index => visited.add(index));
      peakMounted = Math.max(peakMounted, mounted.length);
      assert.ok(mounted.length < 80, "The DOM window must remain bounded for full catalogs");
    }
    assert.equal(visited.size, items.length, "Every template must remain reachable by scrolling");
    const bottom = studioMasonryWindow(layout.tiles, layout.height - viewport, layout.height, 900);
    assert.ok(bottom.some(index => layout.tiles[index].bottom === layout.height), "A direct jump must render the true end of the list");
  }
}
assert.equal(layoutStudioMasonry([], 400, 2, 10).height, 0);
assert.equal(layoutStudioMasonry(image.items, 0, 2, 10).tiles.length, 0);
console.log(`Virtual gallery passed: all ${all.length} real assets reachable at five layouts, no overlaps, stable full height, peak window ${peakMounted} cards; seven original carousel assets and combined order are valid. No network or paid calls.`);
