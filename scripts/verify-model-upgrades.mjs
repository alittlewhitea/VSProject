import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(path) {
  path=resolve(path);if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',compiled)(id=>id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):native(id),module,module.exports);
  return module.exports;
}

const pricing=load('src/lib/model-pricing.ts');
const estimate=pricing.estimateGenerationCredits;
assert.equal(estimate({mode:'audio',provider:'elevenlabs-tts',promptText:'x'.repeat(1000)}),10);
assert.equal(estimate({mode:'audio',provider:'elevenlabs-tts',promptText:'x'.repeat(5000)}),50);
for(const provider of ['nano-banana-image','nano-banana-edit']) {
 const input={mode:'image',provider,resolution:'1K'};
 assert.equal(estimate(input),11);
 assert.equal(estimate({...input,numImages:4}),44);
 assert.ok(estimate({...input,resolution:'4K'})>estimate(input));
 assert.ok(estimate({...input,hasReferences:true,referenceCount:14})>estimate(input));
 assert.ok(estimate({...input,thinkingLevel:'high'})>estimate(input));
}
const route=readFileSync('src/app/api/generate/route.ts','utf8');
const start=route.indexOf('  if (body.provider === "nano-banana-edit" ||');
const end=route.indexOf('  if (body.provider === "flux-image"',start);
const segment=ts.transpileModule(route.slice(start,route.indexOf("  if (isGptImageProvider(body.provider)) {",start)) + route.slice(route.indexOf('  if (body.provider === "nano-banana-image" || body.provider === "nano-banana-pro" ||',start),end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const build=new Function('body','prompt','hasReferenceImages','EDIT_ASPECT_RATIOS','OUTPUT_FORMATS','SAFETY_TOLERANCES','EDIT_RESOLUTIONS','THINKING_LEVELS','NANO_21_THINKING_LEVELS','clampInt','optionalSeed','cleanSystemPrompt',segment);
for(const provider of ['nano-banana-image','nano-banana-edit']) for(const refs of [[],['https://example.com/image.png']]) {
 const input=build({provider,imageUrls:refs,resolution:'0.5K',thinkingLevel:'medium'},'edit image',b=>b.imageUrls.length>0,new Set(['auto']),new Set(['png']),new Set(['4']),new Set(['1K','2K','4K']),new Set(['minimal','high']),new Set(['minimal','medium','high']),(v,min,max,fallback)=>v??fallback,()=>undefined,()=>undefined);
 assert.equal(input.resolution,'1K');assert.equal(input.thinking_level,'medium');assert.equal(input.num_images,1);
 if(refs.length||provider==='nano-banana-edit') assert.deepEqual(input.image_urls,refs);
}
assert.doesNotMatch(route,/fal-ai\/nano-banana-2|eleven-v3/);
console.log('Model upgrades passed: TTS pricing, Nano token estimates, text/edit payloads, medium default and stale 0.5K normalization. No paid API calls.');
