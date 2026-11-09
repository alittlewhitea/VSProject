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
console.log('Avatar preview selection passed: two central cards, scrolling, edge visibility, horizontal bounds, tall cards, manual priority and empty lists. No network or generation.');
