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
const videos=load('src/features/studio/video-models.ts');
const flux3=load('src/lib/flux3-max.ts');
assert.equal(flux3.isFlux3MaxPromotion(Date.parse('2026-11-07T00:00:00+08:00')),true);
assert.equal(flux3.isFlux3MaxPromotion(Date.parse('2026-11-07T23:59:59.999+08:00')),true);
assert.equal(flux3.isFlux3MaxPromotion(Date.parse('2026-11-08T00:00:00+08:00')),false);
assert.equal(flux3.isFlux3MaxPromotion(flux3.FLUX3_MAX_PROMO_START-1),false);
assert.equal(flux3.isFlux3MaxPromotion(flux3.FLUX3_MAX_PROMO_START),true);
assert.equal(flux3.isFlux3MaxPromotion(flux3.FLUX3_MAX_PROMO_END-1),true);
assert.equal(flux3.isFlux3MaxPromotion(flux3.FLUX3_MAX_PROMO_END),false);
for(const [resolution,promoRate,fullRate] of [['720p',0.0425,0.17],['1080p',0.0725,0.29]]) {
 for(let seconds=5;seconds<=20;seconds++) for(const hasReferences of [false,true]) {
  const input={mode:'video',provider:'flux-3-max-video',duration:seconds+'s',resolution,hasReferences,pricingTime:flux3.FLUX3_MAX_PROMO_END-1};
  assert.equal(estimate(input),Math.ceil(seconds*promoRate*150*1.65));
  assert.equal(estimate({...input,falUnitPriceUsd:promoRate,falUnit:'second'}),estimate(input),'Do not discount the already promotional fal rate twice');
  assert.equal(estimate({...input,pricingTime:flux3.FLUX3_MAX_PROMO_END}),Math.ceil(seconds*fullRate*150*1.65));
 }
}
for(const workflow of ['text-to-video','image-to-video']) {
 assert.ok(videos.VIDEO_PROVIDERS_BY_WORKFLOW[workflow].includes('flux-3-max-video'));
 assert.ok(videos.videoModelRatios('flux-3-max-video',workflow).includes('2:1'));
}
assert.deepEqual(videos.videoModelResolutions('flux-3-max-video'),['720p','1080p']);
assert.deepEqual(videos.videoModelDurations('flux-3-max-video'),Array.from({length:16},(_,index)=>(index+5)+'s'));
// Grok Lite quotes must match documented supplier cost at every supported duration.
for (const [resolution,centsPerSecond] of [['480p',2],['720p',3],['1080p',14]]) {
 for(let seconds=1;seconds<=15;seconds++) for(const hasReferences of [false,true]) {
  const input={mode:'video',provider:'grok-video',duration:seconds+'s',resolution,hasReferences};
  const expected=Math.ceil((seconds*centsPerSecond+(hasReferences?1:0))*1.5);
  assert.equal(estimate(input),expected);
  assert.equal(estimate({...input,falUnitPriceUsd:99,falUnit:'second'}),expected);
 }
}
assert.deepEqual(videos.VIDEO_MODEL_CONFIGS['grok-video'].resolutions,['480p','720p','1080p']);
assert.equal(videos.VIDEO_MODEL_CONFIGS['grok-video'].group,'freeDraft');
for(const workflow of ['text-to-video','image-to-video'])assert.equal(videos.VIDEO_PROVIDERS_BY_WORKFLOW[workflow][1],'grok-video');
assert.deepEqual(videos.VIDEO_MODEL_CONFIGS['grok-video'].workflows['image-to-video'].ratios,['source']);
// All four H3 endpoints share the same resolution-dependent estimate. Use fixed promotional rates even if live pricing changes.
for (const [provider,expected] of [
 ['minimax-h3-max-video',{'480p':[30,60,90],'768p':[60,119,179],'1080p':[100,200,300]}],
 ['minimax-h3-max-turbo-video',{'480p':[15,30,45],'768p':[30,60,90],'1080p':[60,119,179]}]
]) {
 assert.deepEqual(videos.VIDEO_MODEL_CONFIGS[provider].resolutions,['480p','768p','1080p']);
 for (const [resolution,costs] of Object.entries(expected)) for (const hasReferences of [false,true]) {
  for (const [index,seconds] of [5,10,15].entries()) {
   const input={mode:'video',provider,resolution,duration:seconds+'s',hasReferences};
   assert.equal(estimate(input),costs[index]);
   assert.equal(estimate({...input,falUnitPriceUsd:0.001,falUnit:'second'}),costs[index]);
  }
 }
 assert.equal(estimate({mode:'video',provider,duration:'5s'}),expected['480p'][0]);
}
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
