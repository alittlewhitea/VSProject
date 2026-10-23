import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const pricing=load('src/lib/model-pricing.ts'),estimate=input=>pricing.estimateGenerationCredits({pricingTime:Date.parse('2026-10-23T00:00:00+08:00'),...input});
// Independent supplier-cost fixtures: catch old minimums, flat overrides and wrong tier factors.
for(const [provider,rates] of [['minimax-h3-max-turbo-video',{'480p':.01625,'768p':.026,'1080p':.052}],['minimax-h3-max-video',{'480p':.0325,'768p':.052,'1080p':.104}],['seedance-video',{'480p':.1407,'720p':.3034,'1080p':.682,'4k':1.5552}],['seedance-mini-video',{'480p':.0721,'720p':.1547}]]){
 for(const [resolution,rate] of Object.entries(rates))for(const seconds of [5,10,15])for(const hasReferences of [false,true])assert.equal(estimate({mode:'video',provider,resolution,duration:seconds+'s',hasReferences}),Math.ceil(rate*seconds*150*(resolution==='480p'?1:1.2)-1e-9));
}
assert.equal(estimate({mode:'audio',provider:'elevenlabs-tts',promptText:'x'.repeat(1000)}),6);
assert.equal(estimate({mode:'audio',provider:'minimax-music-2.6'}),23);
assert.equal(estimate({mode:'image',provider:'bria-background-remove'}),3);
assert.equal(estimate({mode:'image',provider:'nano-banana-pro',resolution:'1K'}),23);
assert.equal(estimate({mode:'image',provider:'nano-banana-pro',resolution:'2K'}),27);
assert.equal(estimate({mode:'image',provider:'nano-banana-pro',resolution:'4K'}),54);
assert.equal(estimate({mode:'image',provider:'topaz-image'}),15);
for(const [quality,cost,markup] of [['low',.005,1],['medium',.037,1.2],['high',.145,1.2]])assert.equal(estimate({mode:'image',provider:'chatgpt-image',quality}),Math.ceil(cost*150*markup-1e-9));
for(const [resolution,rate] of [['480p',.02],['720p',.03],['1080p',.14]])assert.equal(estimate({mode:'video',provider:'grok-video',duration:'5s',resolution,hasReferences:true}),Math.ceil((5*rate+.01)*150*(resolution==='480p'?1:1.2)-1e-9));
for(const [provider,cost,factor] of [['kling-avatar-standard',.0562,1],['kling-avatar-pro',.115,1.2],['gemini-omni-flash-video',.125,1.2],['happy-horse-video',.14,1.2]])assert.equal(estimate({mode:'video',provider,duration:'5s'}),Math.ceil(cost*5*150*factor-1e-9));
assert.equal(pricing.creditsFromFalUsd(.1,1),15,'No phantom extra credit from floating-point rounding');
const billing=load('src/lib/billing.ts');
assert.deepEqual(billing.CREDIT_PACKS.map(({credits,amountCents})=>[credits,amountCents]),[[800,499],[1800,999],[4800,2499],[11000,4999]]);
assert.equal(billing.CREDIT_USAGE_REFERENCE.video.credits,13);
const component=readFileSync('src/app/compare/dreamface-credit-packs.tsx','utf8');assert.match(component,/CREDIT_PACKS\.map/);
for(const locale of ['en','zh-CN','zh-TW','pt-BR','ru','vi','de','fr','ja','th','nl','he','ko','es','it','ar']){
 const d=JSON.parse(readFileSync('messages/'+locale+'.json','utf8'));
 assert.doesNotMatch(d.home.faq.freeTrial.answer,/Premium|100/);
 assert.doesNotMatch(d.home.pricing.trial.credits,/100/);
 assert.doesNotMatch(d.metadata.price.description,/Premium/);
}
for(const name of ['artlist','heygen','higgsfield','kling-ai','pika','runway']){
 const s=readFileSync('src/app/compare/dreamface-vs-'+name+'/page.tsx','utf8');
 assert.match(s,/<DreamfaceCreditPacks/);assert.doesNotMatch(s,/Premium Lite|\$4\.99 weekly|\$4\.99 per week|800 weekly|DreamFace (?:supports|provides|offers) weekly/);
}
console.log('Cost-tier pricing and marketing checks passed: supplier fixtures, basic/HD rates, image quality/count, audio, avatars, rounding, pack invariants, 16 locales and six comparison pages. No network or database.');

assert.equal(estimate({mode:"video",provider:"minimax-h3-max-turbo-video",duration:"5s",resolution:"480p",pricingTime:pricing.H3_PROMOTION_END}),19);
