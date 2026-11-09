import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map(),spends=[],submissions=[],records={};
const admin={from(table){
 assert.equal(table,'generation_tasks');let inserted,updated,filters={};
 const query={select(){return query;},eq(key,value){filters[key]=value;return query;},maybeSingle:async()=>({data:records[filters.id]||null}),
  insert(value){inserted=value;return query;},update(value){updated=value;return query;},
  then(resolve){if(inserted)records[inserted.id]={...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({error:null}).then(resolve);}};
 return query;
}};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:'omni-fixture-user'})},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:100000}),ensureCreditAccount:async()=>({balance:100000}),spendCredits:async(_admin,_user,amount)=>{spends.push(amount);return {ok:true,balance:100000-amount};},refundCredits:async()=>100000},
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
const saved={fetch:globalThis.fetch,env:Object.fromEntries(['FAL_KEY','FAL_MODEL_VIDEO_GEMINI_OMNI','FAL_MODEL_VIDEO_GEMINI_OMNI_I2V'].map(key=>[key,process.env[key]]))};
process.env.FAL_KEY='fixture-no-real-network';delete process.env.FAL_MODEL_VIDEO_GEMINI_OMNI;delete process.env.FAL_MODEL_VIDEO_GEMINI_OMNI_I2V;
globalThis.fetch=async()=>{throw new Error('Unexpected network call');};
try {
 const route=load('src/app/api/generate/route.ts'),pricing=load('src/lib/model-pricing.ts'),models=load('src/features/studio/video-models.ts');
 const config=models.videoModelConfig('gemini-omni-flash-video');
 assert.equal(config.meta.label,'Gemini Omni Flash 1.2');assert.equal(config.showResolutionControl,true);
 assert.deepEqual(models.videoModelResolutions(config.id),['360p','720p','1080p','4k']);
 assert.equal(models.videoModelDurations(config.id).at(-1),'15s');assert.equal(models.videoModelDurations(config.id,1).at(-1),'15s');assert.equal(models.videoModelDurations(config.id,2).at(-1),'10s');
 const start='https://example.invalid/start.png',end='https://example.invalid/end.png';
 const request=extra=>({headers:new Headers(),json:async()=>({mode:'video',provider:config.id,videoWorkflow:'text-to-video',duration:'8s',resolution:'720p',ratio:'9:16',prompt:'A lighthouse at dusk.',idempotencyKey:crypto.randomUUID(),...extra})});
 for(const [resolution,rate] of [['360p',.0273],['720p',.0819],['1080p',.1229],['4k',.2457]]) for(const count of [0,1,2]) for(const seconds of [3,10,15]) {
  const images=[start,end].slice(0,count),actualSeconds=count===2?Math.min(10,seconds):seconds;
  const expected=Math.ceil(rate*actualSeconds*150*(resolution==='360p'?1:1.2)-1e-9);
  const input={mode:'video',provider:config.id,hasReferences:count>0,referenceCount:count,duration:seconds+'s',resolution};
  assert.equal(pricing.estimateGenerationCredits(input),expected,'Resolution and end-frame duration follow the supplied supplier rates');
  assert.equal(pricing.estimateGenerationCredits({...input,falUnitPriceUsd:99,falUnit:'second'}),expected,'An unqualified live rate must not replace resolution-specific prices');
  const response=await route.POST(request({imageUrls:images,videoWorkflow:count?'image-to-video':'text-to-video',duration:seconds+'s',resolution,expectedCredits:expected}));
  assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.estimatedCredits,expected);assert.equal(spends.at(-1),expected);
  const submitted=submissions.at(-1);assert.equal(submitted.url,`https://queue.fal.run/google/gemini-omni-flash/v1.2/${count?'image-to-video':'text-to-video'}`);
  assert.equal(submitted.input.duration,actualSeconds);assert.equal(submitted.input.resolution,resolution);assert.equal(submitted.input.aspect_ratio,'9:16');
  assert.equal(submitted.input.image_url,images[0]);assert.equal(submitted.input.end_image_url,images[1]);
  assert.equal('generate_audio' in submitted.input,false);assert.equal('seed' in submitted.input,false);
  const task=records[response.body.taskId];assert.equal(task.request_settings.duration,actualSeconds+'s');assert.equal(task.request_settings.resolution,resolution);
 }
 const previousSpends=spends.length,previousSubmissions=submissions.length;
 for(const extra of [{expectedCredits:180},{expectedCredits:180,dailyFree:true},{mode:'avatar'},{videoWorkflow:'image-to-video',imageUrls:[]},{videoWorkflow:'image-to-video',imageUrls:[start,end,start]},{videoWorkflow:'text-to-video',imageUrls:[start]}]) {
  const response=await route.POST(request(extra));assert.equal(response.status,extra.expectedCredits?409:400);
 }
 assert.equal(spends.length,previousSpends);assert.equal(submissions.length,previousSubmissions,'Rejected requests cannot charge or reach fal');
 let response=await route.POST(request({duration:'99s',resolution:'4K',expectedCredits:664}));
 assert.equal(response.status,200);assert.equal(submissions.at(-1).input.duration,15);assert.equal(submissions.at(-1).input.resolution,'4k');
 response=await route.POST(request({duration:'invalid',resolution:'unsupported',expectedCredits:118}));
 assert.equal(response.status,200);assert.equal(submissions.at(-1).input.duration,8);assert.equal(submissions.at(-1).input.resolution,'720p');
 assert.deepEqual(pricing.MODEL_PRICING_ROWS.filter(row=>row.provider===config.id).map(row=>[row.endpointId,row.typicalCredits]),[['google/gemini-omni-flash/v1.2/text-to-video',118],['google/gemini-omni-flash/v1.2/image-to-video',118]]);
 console.log('Gemini Omni 1.2 passed: both real route builders, four resolutions, 3/10/15s, start/end ordering and 10s cap, UI capabilities, independent supplier-rate fixtures, normalized stored settings, stale quote rejection before charge. All provider, billing and database calls mocked.');
} finally {
 globalThis.fetch=saved.fetch;
 for(const [key,value] of Object.entries(saved.env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
