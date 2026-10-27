import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
const spends=[],submissions=[],records={};
const admin={from(table){assert.equal(table,'generation_tasks');let inserted,updated,filters={};const q={select(){return q;},eq(key,value){filters[key]=value;return q;},maybeSingle:async()=>({data:records[filters.id]||null}),insert(value){inserted=value;return q;},update(value){updated=value;return q;},then(resolve){if(inserted)records[inserted.id]={...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({error:null}).then(resolve);}};return q;}};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:'fixture-user'})},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:10000}),ensureCreditAccount:async()=>({balance:10000}),spendCredits:async(_a,_u,amount)=>{spends.push(amount);return {ok:true,balance:10000-amount};},refundCredits:async()=>10000},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:async()=>{throw new Error('HeyGen is not a free task');}},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{submissions.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/fixture/status'})};}}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const oldKey=process.env.FAL_KEY,oldFetch=globalThis.fetch,oldNow=Date.now;process.env.FAL_KEY='fixture-no-network';globalThis.fetch=async()=>{throw new Error('Unexpected network');};
try{
 const pricing=load('src/lib/model-pricing.ts');let now=pricing.HEYGEN_PROMOTION_END-1;Date.now=()=>now;
 const models=load('src/features/studio/video-models.ts');const config=models.videoModelConfig('heygen-video');
 assert.equal(config.defaultDuration,'5s');assert.equal(config.defaultResolution,'768p');
 assert.deepEqual(config.resolutions,['480p','768p','1080p','2k']);
 for(const workflow of ['text-to-video','image-to-video'])assert.equal(models.VIDEO_PROVIDERS_BY_WORKFLOW[workflow][0],'heygen-video');
 const costs=(resolution,duration='5s',time=now)=>pricing.estimateGenerationCredits({mode:'video',provider:'heygen-video',resolution,duration,pricingTime:time});
 assert.deepEqual(['480p','768p','1080p','2k'].map(r=>costs(r)),[8,9,27,27]);
 assert.deepEqual(['480p','768p','1080p','2k'].map(r=>costs(r,'5s',pricing.HEYGEN_PROMOTION_END)),[15,18,54,54]);
 assert.equal(costs('2k','15s'),81);
 const route=load('src/app/api/generate/route.ts');
 const request=(extra={})=>({headers:new Headers(),json:async()=>({mode:'video',provider:'heygen-video',videoWorkflow:'text-to-video',duration:'5s',resolution:'768p',ratio:'16:9',prompt:'A peaceful landscape.',expectedCredits:9,idempotencyKey:crypto.randomUUID(),...extra})});
 let response=await route.POST(request());assert.equal(response.status,200);assert.equal(response.body.estimatedCredits,9);assert.deepEqual(spends,[9]);
 assert.equal(submissions[0].url,'https://queue.fal.run/heygen/heygen-video/text-to-video');
 assert.deepEqual(submissions[0].input,{prompt:'A peaceful landscape.',duration:5,resolution:'768p',prompt_enhancement:'turbo',enable_safety_checker:false,aspect_ratio:'16:9'});
 response=await route.POST(request({videoWorkflow:'image-to-video',imageUrls:['https://example.invalid/start.png'],duration:'15s',resolution:'2k',ratio:'source',enableSafetyChecker:true,seed:4294967295,expectedCredits:81}));
 assert.equal(response.status,200);assert.equal(submissions.at(-1).url,'https://queue.fal.run/heygen/heygen-video/image-to-video');
 assert.deepEqual(submissions.at(-1).input,{prompt:'A peaceful landscape.',duration:15,resolution:'2k',prompt_enhancement:'turbo',enable_safety_checker:true,image_url:'https://example.invalid/start.png',seed:4294967295});
 for(const extra of [{duration:'16s'},{duration:'5junk'},{resolution:'720p'},{videoWorkflow:'image-to-video',imageUrls:[]},{videoWorkflow:'image-to-video',imageUrls:['one','two']},{ratio:'auto'},{mode:'avatar'},{seed:4294967296}]){
  response=await route.POST(request(extra));assert.equal(response.status,400,JSON.stringify(extra));
 }
 assert.deepEqual(spends,[9,81]);assert.equal(submissions.length,2);
 now=pricing.HEYGEN_PROMOTION_END;
 response=await route.POST(request({dailyFree:true}));assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,18);assert.equal(submissions.length,2);assert.deepEqual(spends,[9,81]);
 response=await route.POST(request({expectedCredits:18}));assert.equal(response.status,200);assert.deepEqual(spends,[9,81,18]);
 console.log('HeyGen Video passed: default model and settings, 4 resolutions, both API payloads, safety toggle, seed, input validation, promo expiry, stale price protection, no paid calls or database.');
}finally{Date.now=oldNow;globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=oldKey;}
