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
for(const resolution of ['720p','1080p']) for(const imageUrls of [[],[start],[start,end]]) {
 for(const reasoningLevel of [undefined,'low','high']) for(const generateAudio of [undefined,false,true]) {
  const input=builders.buildFalInput({mode:'video',provider:'flux-3-max-video',duration:'20s',ratio:'2:1',resolution,imageUrls,reasoningLevel,generateAudio,seed:42},'Flux motion');
  assert.equal(builders.getModelId('video','flux-3-max-video',Boolean(imageUrls.length)),`blackforestlabs/flux-3-max/${imageUrls.length?'image-to-video':'text-to-video'}`);
  assert.equal(input.duration,20);assert.equal(input.resolution,resolution);assert.equal(input.aspect_ratio,'2:1');
  assert.equal(input.reasoning_level,reasoningLevel==='low'?'low':'high');assert.equal(input.generate_audio,generateAudio!==false);
  assert.equal(input.image_url,imageUrls[0]);assert.equal(input.end_image_url,imageUrls[1]);assert.equal(input.seed,42);
  assert.equal('enable_safety_checker' in input,false);
 }
}
for(const resolution of ['480p','720p','1080p']) for(const hasReferences of [false,true]) {
 for(const enableSafetyChecker of [undefined,false,true]) {
  const body={mode:'video',provider:'grok-video',duration:'15s',ratio:'9:16',resolution,imageUrls:hasReferences?[start]:[],enableSafetyChecker};
  const input=builders.buildFalInput(body,'Test Grok Lite');
  assert.equal(builders.getModelId('video','grok-video',hasReferences),`xai/grok-imagine-video/v1.5/lite/${hasReferences?'image-to-video':'text-to-video'}`);
  assert.equal(input.resolution,resolution);assert.equal(input.duration,15);
  assert.equal(input.enable_safety_checker,enableSafetyChecker===true);
  assert.equal(input.image_url,hasReferences?start:undefined);
  assert.equal(input.aspect_ratio,hasReferences?undefined:'9:16');
  assert.equal('seed' in input,false);assert.equal('end_image_url' in input,false);
 }
}
for (const provider of ['minimax-h3-max-video','minimax-h3-max-turbo-video']) {
  for (const resolution of ['480p','768p','1080p']) for (const imageUrls of [[],[start],[start,end]]) {
    const body={mode:'video',provider,imageUrls,duration:'15s',ratio:'9:16',resolution};
    const input=builders.buildFalInput(body,'Preserve keyframes');
    assert.equal(input.resolution,resolution.toUpperCase());
    assert.equal(input.duration,15);
    assert.equal(input.image_url,imageUrls[0]);
    assert.equal(input.end_image_url,imageUrls[1]);
    assert.equal(builders.getModelId('video',provider,Boolean(imageUrls.length)),
      `minimax/${provider==='minimax-h3-max-video'?'h3-max':'h3-max-turbo'}/${imageUrls.length?'image-to-video':'text-to-video'}`);
  }
}
for (const provider of ['flux-3-max-video', 'minimax-h3-max-video', 'minimax-h3-max-turbo-video', 'seedance-video', 'gemini-omni-flash-video']) {
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
