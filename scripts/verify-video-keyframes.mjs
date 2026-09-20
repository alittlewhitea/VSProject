import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('module', 'exports', compile(readFileSync('src/lib/video-keyframes.ts', 'utf8')))(module, module.exports);
const frames = module.exports;
const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
// Execute the actual endpoint selection/payload builders without loading any external clients.
const source = route.slice(route.indexOf('function isValidBody'), route.indexOf('function buildRequestSettings'));
const builders = new Function('videoEndFrameInput', 'isGptImageProvider', 'DREAMFACE_IO_MODEL', 'gptImageEndpoint', compile(source) + '\nreturn { buildFalInput, getModelId };')(frames.videoEndFrameInput, () => false, 'unused', () => 'unused');
const start = 'https://example.invalid/start.png', end = 'https://example.invalid/end.png';
for (const provider of ['minimax-h3-max-video', 'minimax-h3-max-turbo-video', 'seedance-video', 'gemini-omni-flash-video']) {
  assert.equal(frames.videoSupportsEndFrame(provider), true);
  for (const imageUrls of [[], [start], [start, end]]) {
    assert.equal(frames.validateVideoImages(provider, imageUrls), null);
    const input = builders.buildFalInput({ mode: 'video', provider, videoWorkflow: imageUrls.length ? 'image-to-video' : 'text-to-video', imageUrls, duration: '5s', ratio: '16:9', resolution: '480p' }, 'Test motion');
    assert.equal(input.end_image_url, imageUrls[1]);
    if (imageUrls.length) assert.equal(input.image_url, start);
    assert.equal('image_urls' in input, false);
    if (provider.startsWith('minimax')) assert.equal(input.enable_safety_checker, false);
    if (provider.startsWith('gemini') && imageUrls.length) assert.equal(input.resolution, '720p');
  }
  assert.ok(frames.validateVideoImages(provider, [start, end, start]));
}
for (const provider of ['grok-video', 'seedance-mini-video', 'kling-video', 'unknown']) {
  assert.equal(frames.videoSupportsEndFrame(provider), false);
  assert.equal(frames.validateVideoImages(provider, [start]), null);
  assert.ok(frames.validateVideoImages(provider, [start, end]));
  assert.deepEqual(frames.videoEndFrameInput(provider, [start, end]), {});
}
for (const bad of [null, 'url', [null], [''], [123]]) assert.ok(frames.validateVideoImages('seedance-video', bad));
assert.equal(builders.getModelId('video', 'gemini-omni-flash-video', true), 'google/gemini-omni-flash/v1.1/image-to-video');
assert.equal(builders.getModelId('video', 'gemini-omni-flash-video', false), 'google/gemini-omni-flash');
const avatar = builders.buildFalInput({ mode: 'avatar', provider: 'minimax-h3-max-turbo-video', imageUrls: [start], duration: '5s', ratio: '16:9' }, 'Speak');
assert.equal(avatar.image_url, start); assert.equal(avatar.end_image_url, undefined);
console.log('Video keyframe checks passed: actual payloads, frame ordering, single-image restrictions, Gemini 1.1 endpoint and unchanged H3 safety/Avatar. No paid calls.');
