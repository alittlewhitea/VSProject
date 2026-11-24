import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const module = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync('src/features/studio/avatar-preview-selection.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(module, module.exports);
const { centralAvatarPreviews } = module.exports;
const card = (key, top, bottom, left = 0, right = 180) => ({ key, top, bottom, left, right });
const viewport = { top: 0, bottom: 800, width: 390 };
const twoColumns = [card('first-left', 20, 220), card('first-right', 20, 220, 200, 380), card('center-left', 250, 450), card('center-right', 250, 450, 200, 380), card('last-left', 480, 680), card('last-right', 480, 680, 200, 380)];
assert.deepEqual(centralAvatarPreviews(twoColumns, viewport), ['center-left', 'center-right']);
assert.deepEqual(centralAvatarPreviews(twoColumns, { ...viewport, top: 180, bottom: 980 }), ['last-left', 'last-right'], 'Scrolling changes the selected row');
assert.deepEqual(centralAvatarPreviews([card('above', -200, 10), card('below', 790, 1000), card('outside', 250, 450, 500, 680)], viewport), [], 'Tiny edge slivers and horizontal offscreen cards never autoplay');
assert.deepEqual(centralAvatarPreviews([card('visible', 250, 450), card('almost-hidden', 750, 1000)], viewport), ['visible']);
assert.deepEqual(centralAvatarPreviews(twoColumns, viewport, 'last-left'), ['last-left', 'center-left'], 'Tapping an eligible card replaces a preview without adding a third slot');
assert.deepEqual(centralAvatarPreviews(twoColumns, viewport, 'missing'), ['center-left', 'center-right']);
assert.deepEqual(centralAvatarPreviews([card('tall', -200, 1000)], viewport), ['tall'], 'A tall visible card is eligible even if the whole card cannot fit');
assert.deepEqual(centralAvatarPreviews([], viewport), []);

const optCard = (key, top, bottom, left = 0, right = 180, optimized = true) => ({ key, top, bottom, left, right, optimized });
const optimizedTwoCol = [
  optCard('r1-l', 20, 220, 0, 180, true),
  optCard('r1-r', 20, 220, 200, 380, true),
  optCard('r2-l', 250, 450, 0, 180, true),
  optCard('r2-r', 250, 450, 200, 380, true),
  optCard('r3-l', 480, 680, 0, 180, true),
  optCard('r3-r', 480, 680, 200, 380, true)
];
assert.deepEqual(
  centralAvatarPreviews(optimizedTwoCol, viewport, null, { maxSlots: 4, maxHeavySlots: 1 }),
  ['r2-l', 'r2-r', 'r3-l', 'r3-r'],
  'Lightweight R2 clips can fill up to 4 central slots in a 2-column grid'
);
const heavyTwoCol = optimizedTwoCol.map(entry => ({ ...entry, optimized: false }));
assert.deepEqual(
  centralAvatarPreviews(heavyTwoCol, viewport, null, { maxSlots: 4, maxHeavySlots: 1 }),
  ['r2-l'],
  'Heavy unoptimized raw MP4s are capped at 1 concurrent autoplay slot'
);
const mixedTwoCol = [
  optCard('heavy-1', 250, 450, 0, 180, false),
  optCard('heavy-2', 250, 450, 200, 380, false),
  optCard('opt-1', 480, 680, 0, 180, true),
  optCard('opt-2', 480, 680, 200, 380, true)
];
assert.deepEqual(
  centralAvatarPreviews(mixedTwoCol, viewport, null, { maxSlots: 4, maxHeavySlots: 1 }),
  ['heavy-1', 'opt-1', 'opt-2'],
  'Mixed grids cap heavy streams while still allowing lightweight R2 clips'
);
console.log('Avatar preview selection passed: central multi-slot playback, heavy stream cap, scrolling, edge visibility, horizontal bounds, tall cards, manual priority and empty lists. No network or generation.');
