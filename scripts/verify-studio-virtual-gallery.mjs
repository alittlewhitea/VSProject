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
assert.equal(combined.ids.length, all.length);
assert.deepEqual([...combined.ids].sort(), all.map(item => item.id).sort());
assert.equal(new Set(combined.ids).size, all.length);
assert.equal(slides.items.length, 7);
assert.equal(slides.items[Math.floor(slides.items.length / 2)].category, "tiktok", "TikTok must match the center pagination dot");
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
