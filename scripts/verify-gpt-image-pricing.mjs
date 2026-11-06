import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve, dirname} from 'node:path';
import ts from 'typescript';
const native = createRequire(import.meta.url), cache = new Map();
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports:{}}; cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(id => id.startsWith('.') ? load(resolve(dirname(file),id+'.ts')) : native(id), module, module.exports);
  return module.exports;
}
const pricing = load('src/lib/model-pricing.ts'), billing = load('src/lib/billing.ts'), failures = load('src/lib/fal-errors.ts');
// Independent values from OpenAI's published calculator, not legacy cost tables.
const fixtures = [
  [1024,768,[563,993,1204,2140,4815]],
  [1024,1024,[823,1449,1756,3122,7024]],
  [1536,864,[504,924,1078,1917,4312]],
  [3840,2160,[1558,2855,3336,5930,13342]],
  [1024,800,[571,null,null,null,null]] // 12.5 short grid must round to even (12).
];
const qualities = ['low','medium','high','xhigh','max'];
for (const [width,height,tokens] of fixtures) qualities.forEach((quality,index) => {
  if (tokens[index] === null) return;
  assert.equal(pricing.gptImageOutputTokens(width,height,quality),tokens[index]);
  assert.equal(pricing.gptImageOutputTokens(height,width,quality),tokens[index]);
  for (const provider of ['chatgpt-image','gpt-image-2.6-sunburst']) {
    const input = {mode:'image',provider,imageSize:'custom',imageWidth:width,imageHeight:height,quality,promptText:'Product photograph.'};
    const cost = pricing.estimateGenerationCostUsd(input), credits = pricing.estimateGenerationCredits(input);
    assert.ok(cost >= tokens[index]*30/1_000_000, 'Never price below image-output cost');
    for (const pack of billing.CREDIT_PACKS) {
      const revenue = credits * pack.amountCents / 100 / pack.credits;
      assert.ok((revenue*0.95-cost)/revenue >= 0.20-1e-9, '20% target after 5% fee budget at every current pack price');
    }
    const cheapestUnit = 49.99/11000;
    assert.ok((credits-1)*cheapestUnit*0.75 < cost, 'Do not add more than the necessary credit rounding');
    for (const count of [1,2,10]) assert.equal(pricing.estimateGenerationCredits({...input,numImages:count}),credits*count);
  }
});
assert.equal(pricing.gptImageOutputTokens(1024,768,'auto'),4815);
const base = {mode:'image',provider:'chatgpt-image',quality:'low'};
assert.equal(pricing.estimateGenerationCredits(base),6);
assert.equal(pricing.estimateGenerationCredits({...base,imageSize:'square_hd'}),8);
assert.equal(pricing.estimateGenerationCredits({...base,hasReferences:true,referenceCount:1}),9);
for (const quality of qualities) {
  const autoCost = pricing.estimateGenerationCostUsd({...base,quality,imageSize:'auto'});
  for (const [width,height] of fixtures) assert.ok(autoCost >= pricing.estimateGenerationCostUsd({...base,quality,imageSize:'custom',imageWidth:width,imageHeight:height}));
}
const svgCosts = ['gpt-6-luna','gpt-5.6-terra','gpt-5.4','gpt-5.5','gpt-6-astra'].map(svgModel => pricing.estimateGenerationCostUsd({...base,outputFormat:'svg',svgModel}));
assert.ok(svgCosts.every((cost,index) => index===0 || cost > svgCosts[index-1]), 'SVG must use the chosen authoring model rate');
assert.equal(pricing.generationPricingMultiplier({...base,quality:'max'}),1, 'No duplicate HD markup');
assert.equal(pricing.creditsFromFalUsd(0.1),15, 'Other models keep existing conversion');
// Partial failures recover cost/fee budget without a profit margin and never
// charge more than the original quote, including old historical 1-credit tasks.
for (const provider of ['chatgpt-image','gpt-image-2.6-sunburst','gpt-image-2.5-sunburst']) {
  assert.equal(failures.falActualCreditsFromCost(.01,20,provider),3);
  assert.equal(failures.falRefundCreditsFromCost(.01,20,provider),17);
  assert.equal(failures.falActualCreditsFromCost(.2,1,provider),1);
  assert.equal(failures.falRefundCreditsFromCost(null,20,provider),20);
  assert.equal(failures.falRefundCreditsFromCost(0,20,provider),20);
}
assert.equal(failures.falActualCreditsFromCost(.01,20,'flux-image'),2);
assert.equal(failures.falActualCreditsFromCost(.01,20),2);
console.log('GPT 2.6 pricing passed: official token fixtures, round-to-even, 20% margin + 5% fee budget, four pack prices, both models, batches, auto bounds, SVG authoring rates and capped failure refunds. No network or database.');
