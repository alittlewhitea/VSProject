import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
let spends=[],submissions=[],records={};
const admin={from(table){
 assert.equal(table,'generation_tasks');let inserted,updated,filters={};
 const query={select(){return query;},eq(key,value){filters[key]=value;return query;},maybeSingle:async()=>({data:records[filters.id]||null}),
  insert(value){inserted=value;return query;},update(value){updated=value;return query;},
  then(resolve){if(inserted)records[inserted.id]={...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({error:null}).then(resolve);}};
 return query;
}};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:'flux-fixture-user'})},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:10000}),ensureCreditAccount:async()=>({balance:10000}),spendCredits:async(_admin,_user,amount)=>{spends.push(amount);return {ok:true,balance:10000-amount};},refundCredits:async()=>10000},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:async()=>{throw new Error('No free reservation allowed');}},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{submissions.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/fixture/status'})};}}
};
function load(file){
 file=resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);
 return module.exports;
}
const previousKey=process.env.FAL_KEY,previousFetch=globalThis.fetch,previousNow=Date.now;
process.env.FAL_KEY='fixture-no-real-network';
globalThis.fetch=async()=>{throw new Error('Unexpected network call');};
try {
 const policy=load('src/lib/flux3-max.ts');let now=policy.FLUX3_MAX_PROMO_END-1;Date.now=()=>now;
 const route=load('src/app/api/generate/route.ts');
 const request=(extra={})=>({headers:new Headers(),json:async()=>({mode:'video',provider:'flux-3-max-video',videoWorkflow:'text-to-video',duration:'5s',resolution:'720p',ratio:'auto',prompt:'A red panda walks in a forest.',expectedCredits:53,idempotencyKey:crypto.randomUUID(),...extra})});
 let response=await route.POST(request());
 assert.equal(response.status,200);assert.equal(response.body.estimatedCredits,53);assert.deepEqual(spends,[53]);
 assert.equal(submissions[0].url,'https://queue.fal.run/blackforestlabs/flux-3-max/text-to-video');
 assert.equal(submissions[0].input.generate_audio,true);assert.equal(submissions[0].input.reasoning_level,'high');
 const originalTask=Object.values(records)[0];
 response=await route.POST(request({videoWorkflow:'image-to-video',imageUrls:['https://example.invalid/start.png','https://example.invalid/end.png'],duration:'20s',resolution:'1080p',reasoningLevel:'low',generateAudio:false,expectedCredits:359}));
 assert.equal(response.status,200);assert.deepEqual(spends,[53,359]);
 assert.equal(submissions.at(-1).url,'https://queue.fal.run/blackforestlabs/flux-3-max/image-to-video');
 assert.equal(submissions.at(-1).input.end_image_url,'https://example.invalid/end.png');
 assert.equal(submissions.at(-1).input.duration,20);assert.equal(submissions.at(-1).input.resolution,'1080p');
 assert.equal(submissions.at(-1).input.reasoning_level,'low');assert.equal(submissions.at(-1).input.generate_audio,false);
 now=policy.FLUX3_MAX_PROMO_END;
 response=await route.POST(request());
 assert.equal(response.status,409);assert.equal(response.body.code,'video_price_changed');assert.equal(response.body.estimatedCredits,211);
 assert.deepEqual(spends,[53,359]);assert.equal(submissions.length,2,'Expired quote must not charge or submit');
 assert.equal(records[originalTask.id].estimated_credits,53,'Promotion expiry must not rewrite existing task prices');
 response=await route.POST(request({expectedCredits:211}));
 assert.equal(response.status,200);assert.deepEqual(spends,[53,359,211]);
 for(const extra of [{videoWorkflow:'image-to-video',imageUrls:[]},{mode:'avatar'},{videoWorkflow:'image-to-video',imageUrls:['a','b','c']}]) {
  response=await route.POST(request({...extra,expectedCredits:211}));assert.equal(response.status,400);
 }
 assert.deepEqual(spends,[53,359,211]);
 console.log('FLUX 3 Max passed: actual route/endpoints, 20s/1080p, start/end frames, audio/reasoning, promotion expiry, stale quote rejection before charge, immutable old prices. No real network or database.');
} finally {
 Date.now=previousNow;globalThis.fetch=previousFetch;
 if(previousKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=previousKey;
}
