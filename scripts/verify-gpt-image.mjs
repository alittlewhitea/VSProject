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
const models=load('src/lib/gpt-image-models.ts'),pricing=load('src/lib/model-pricing.ts');
const route=readFileSync('src/app/api/generate/route.ts','utf8');
const begin=route.indexOf('  if (isGptImageProvider(body.provider)) {');
const end=route.indexOf('\n  if (body.provider === "nano-banana-image"',begin);
assert.ok(begin>0&&end>begin);
const segment=ts.transpileModule(route.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const inputBuilder=new Function('body','prompt','isGptImageProvider','hasReferenceImages','gptImageSize','gptImageQuality','OUTPUT_FORMATS','clampInt',segment);
for(const provider of ['chatgpt-image','gpt-image-2.5-sunburst']) {
  for(const edit of [false,true]) {
    const example=models.gptImageExample(provider,edit?'image-to-image':'text-to-image');
    assert.ok(example.prompt.length>20);assert.match(example.preview,/^https:\/\/v3b.fal.media\//);
    assert.equal(example.references.length,edit?(provider==='chatgpt-image'?2:1):0);
    assert.equal(models.gptImageEndpoint(provider,edit),`openai/gpt-image-2.5/${provider==='chatgpt-image'?'flare':'sunburst'}/${edit?'edit':'text-to-image'}`);
    const input=inputBuilder({provider,imageUrls:example.references,seed:'123'},example.prompt,models.isGptImageProvider,b=>Boolean(b.imageUrls.length),models.gptImageSize,models.gptImageQuality,new Set(['png','jpeg','webp']),(x,min,max,fallback)=>Math.max(min,Math.min(max,x||fallback)));
    assert.equal(input.quality,'low');assert.equal(input.num_images,1);assert.equal(input.background,'auto');assert.equal('seed' in input,false);assert.deepEqual(input.image_urls,edit?example.references:undefined);
    let previous=0;
    for(const quality of models.GPT_IMAGE_QUALITIES) {
      const args={mode:'image',provider,quality,imageSize:provider==='chatgpt-image'?'default_4_3':'landscape_16_9',hasReferences:edit,referenceCount:example.references.length,promptText:example.prompt};
      const credits=pricing.estimateGenerationCredits(args);
      assert.ok(credits>previous);previous=credits;
      assert.equal(pricing.estimateGenerationCredits({...args,numImages:4}),credits*4);
      if(quality==='low')console.log(`${provider} ${edit?'edit':'text'}: ${credits} credits; estimated supplier allowance $${pricing.estimateGptImageUsd(args).toFixed(5)}`);
    }
  }
}
for(const size of models.GPT_IMAGE_SIZES) {
  const {width:w,height:h}=models.gptImageSize(size.value);
  assert.ok(w%16===0&&h%16===0&&w*h>=655360&&w*h<=8294400&&Math.max(w,h)<=3840&&Math.max(w/h,h/w)<=3);
}
const base={mode:'image',provider:'chatgpt-image',quality:'low',hasReferences:true};
assert.ok(pricing.estimateGenerationCredits({...base,referenceCount:2})>pricing.estimateGenerationCredits({...base,referenceCount:1}));
assert.equal(pricing.MODEL_PRICING_ROWS.filter(r=>models.isGptImageProvider(r.provider)).length,4);
assert.doesNotMatch(route,/"openai\/gpt-image-2(?:\/edit)?"/);
console.log('GPT Image 2.5 tests passed: four routes/examples, Low defaults, no unsupported seed, valid dimensions, quality/reference/count pricing. No paid API calls.');
