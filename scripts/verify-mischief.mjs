import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';

const native=createRequire(import.meta.url),cache=new Map(),spends=[],submissions=[],refunds=[],records={};
let authenticated=true,failSubmit=false,syncStatus='COMPLETED';
const admin={from(table){
 assert.equal(table,'generation_tasks');let inserted,updated,filters={},predicates=[];
 const query={select(){return query;},eq(key,value){filters[key]=value;return query;},maybeSingle:async()=>({data:records[filters.id]||null}),
  in(key,values){predicates.push(row=>values.includes(row[key]));return query;},is(key,value){predicates.push(row=>row[key]===value);return query;},order(){return query;},limit(){return query;},
  insert(value){inserted=value;return query;},update(value){updated=value;return query;},
  then(done){if(inserted)records[inserted.id]={deleted_at:null,...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({data:Object.values(records).filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value)&&predicates.every(predicate=>predicate(row))),error:null}).then(done);}};
 return query;
}};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'mischief-fixture'}:null,getUserIdsForAuthUser:async()=>['mischief-fixture']},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:10000}),ensureCreditAccount:async()=>({balance:10000}),spendCredits:async(_admin,_user,amount)=>{spends.push(amount);return {ok:true,balance:10000-amount};},refundCredits:async(_admin,_user,amount)=>{refunds.push(amount);return 10000;}},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:async()=>{throw new Error('Unexpected free reservation');}},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-billing':{resolveFalCostUsd:async()=>null},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{
  if(options.method!=='POST')return {ok:true,json:async()=>url.endsWith('/status')?{status:syncStatus}:syncStatus==='COMPLETED'?{video:{url:'https://example.invalid/mischief.mp4'},seed:42}:{error:'Isolated generation failure'}};
  submissions.push({url,input:JSON.parse(options.body)});if(failSubmit)throw new Error('Isolated provider submission failure');return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/tbc/mischief-1/requests/fixture/status',response_url:'https://queue.fal.run/tbc/mischief-1/requests/fixture'})};}}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const previousFetch=globalThis.fetch,previousKey=process.env.FAL_KEY;
globalThis.fetch=async()=>{throw new Error('Unexpected network call');};process.env.FAL_KEY='fixture-no-real-network';
try{
 const route=load('src/app/api/generate/route.ts'),pricing=load('src/lib/model-pricing.ts'),models=load('src/features/studio/video-models.ts');
 const provider='mischief-video',image='https://example.invalid/start.png';
 const request=extra=>({headers:new Headers(),json:async()=>({mode:'video',provider,videoWorkflow:'image-to-video',duration:'5s',resolution:'720p',ratio:'16:9',prompt:'The camera moves slowly toward the subject.',imageUrls:[image],idempotencyKey:crypto.randomUUID(),...extra})});
 assert.ok(models.VIDEO_PROVIDERS_BY_WORKFLOW['image-to-video'].includes(provider));assert.equal(models.VIDEO_PROVIDERS_BY_WORKFLOW['text-to-video'].includes(provider),false);assert.equal(models.VIDEO_PROVIDERS_BY_WORKFLOW['reference-to-video'].includes(provider),false);
 assert.deepEqual(models.videoModelDurations(provider),['3s','5s']);assert.deepEqual(models.videoModelResolutions(provider),['480p','720p']);assert.deepEqual(models.videoModelRatios(provider,'image-to-video'),['16:9']);assert.equal(models.videoModelConfig(provider).showAudioControl,undefined);
 assert.equal(load('src/lib/video-keyframes.ts').videoSupportsEndFrame(provider),false);
 for(const [duration,resolution,cost,credits]of[['3s','480p',.015,3],['5s','480p',.025,4],['3s','720p',.03,6],['5s','720p',.05,9]]){
  const input={mode:'video',provider,duration,resolution,hasReferences:true};
  assert.equal(pricing.estimateGenerationCostUsd(input),cost);assert.equal(pricing.estimateGenerationCredits(input),credits);assert.equal(pricing.estimateGenerationCredits({...input,falUnitPriceUsd:99,falUnit:'second'}),credits,'A generic live rate cannot erase resolution-specific rates');
  const response=await route.POST(request({duration,resolution,expectedCredits:credits}));assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(spends.at(-1),credits);
  const sent=submissions.at(-1);assert.equal(sent.url,'https://queue.fal.run/tbc/mischief-1/image-to-video');assert.deepEqual(sent.input,{prompt:'The camera moves slowly toward the subject.',image_url:image,duration:Number.parseInt(duration),resolution,image_transform:'center_crop',prompt_processing:'enhanced'});
  const task=records[response.body.taskId];assert.equal(task.transport,'real');assert.equal(task.request_settings.duration,duration);assert.equal(task.request_settings.generate_audio,false);assert.equal(task.request_settings.prompt_processing,'enhanced');
 }
 let response=await route.POST(request({seed:0}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.seed,0);assert.equal(submissions.at(-1).input.prompt_processing,'original');assert.equal(records[response.body.taskId].request_settings.seed,0);
 response=await route.POST(request({imageUrls:['data:image/png;base64,aGVsbG8='],resolution:undefined,seed:2147483647}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.resolution,'720p');
 const before=[spends.length,submissions.length];
 for(const extra of [{mode:'avatar'},{mode:'image'},{videoWorkflow:'text-to-video'},{videoWorkflow:'reference-to-video'},{imageUrls:[]},{imageUrls:[image,image]},{imageUrls:['file:///private.png']},{imageUrls:['http://127.0.0.1/private.png']},{imageUrls:['data:text/plain;base64,aGVsbG8=']},{duration:'4s'},{resolution:'1080p'},{resolution:42},{ratio:'9:16'},{seed:-1},{seed:2147483648},{seed:1.5},{seed:'4'},{audioUrl:'https://example.invalid/a.mp3'},{dailyFree:true}]){
  const invalid=await route.POST(request(extra));assert.equal(invalid.status,400,JSON.stringify(extra));
 }
 response=await route.POST(request({expectedCredits:8}));assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,9);assert.deepEqual([spends.length,submissions.length],before,'Validation and stale quotes cannot spend credits or call the provider');
 authenticated=false;assert.equal((await route.POST(request({}))).status,401);authenticated=true;
 delete process.env.FAL_KEY;assert.equal((await route.POST(request({}))).status,503);process.env.FAL_KEY='fixture-no-real-network';
 const id=crypto.randomUUID();await route.POST(request({idempotencyKey:id}));const calls=submissions.length,charged=spends.length;response=await route.POST(request({idempotencyKey:id}));assert.equal(response.body.duplicate,true);assert.equal(submissions.length,calls);assert.equal(spends.length,charged);
 failSubmit=true;response=await route.POST(request({}));assert.equal(response.status,502);assert.equal(response.body.refundedCredits,9);assert.equal(refunds.at(-1),9);
 failSubmit=false;
 for(const task of Object.values(records))task.status='completed';
 const taskRoute=load('src/app/api/tasks/route.ts');
 const success=await route.POST(request({}));
 assert.equal((await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}))).status,200);
 assert.equal(records[success.body.taskId].status,'completed');assert.equal(records[success.body.taskId].output_url,'https://example.invalid/mischief.mp4');
 syncStatus='FAILED';const failed=await route.POST(request({}));const refundCount=refunds.length;
 await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(records[failed.body.taskId].status,'failed');assert.equal(refunds.length,refundCount+1);assert.equal(refunds.at(-1),9);
 await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(refunds.length,refundCount+1,'Repeated sync cannot refund a failed task twice');
 assert.equal(pricing.MODEL_PRICING_ROWS.find(row=>row.provider===provider).typicalCredits,9);
 console.log('Mischief passed: four independent cost/credit fixtures, actual queue payload, seed zero/original prompt, one-image limits, invalid inputs and stale quotes rejected before billing, no-key behavior, idempotency, submission refund, successful task sync and one-time failure refund. All provider, billing and database calls mocked.');
}finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=previousKey;}
