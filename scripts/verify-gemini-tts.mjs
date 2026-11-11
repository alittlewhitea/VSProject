import {generationFixtureDependency} from './generation-runtime-fixture.mjs';
import {settlementRpcFixture} from './generation-settlement-fixture.mjs';
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
  neq(key,value){predicates.push(row=>row[key]!==value);return query;},in(key,values){predicates.push(row=>values.includes(row[key]));return query;},is(key,value){predicates.push(row=>row[key]===value);return query;},order(){return query;},limit(){return query;},
  insert(value){inserted=value;return query;},update(value){updated=value;return query;},
  then(done){if(inserted)records[inserted.id]={deleted_at:null,...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({data:Object.values(records).filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value)&&predicates.every(predicate=>predicate(row))),error:null}).then(done);}};
 return query;
}};
admin.rpc=settlementRpcFixture(records,amount=>refunds.push(amount));
const overrides={
 '../../../lib/mysql':{mysqlExecute:async()=>[{active:0}],toMysqlDate:value=>value},
 '../../../lib/request-security':{consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})},
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'speech-fixture'}:null,getUserIdsForAuthUser:async()=>['speech-fixture']},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:10000}),ensureCreditAccount:async()=>({balance:10000}),spendCredits:async(_admin,_user,amount)=>{spends.push(amount);return {ok:true,balance:10000-amount};},refundCredits:async(_admin,_user,amount)=>{refunds.push(amount);return 10000;}},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:async()=>{throw new Error('Unexpected free reservation');}},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-billing':{resolveFalCostUsd:async()=>null,resolveFalTaskCostUsd:async()=>({costUsd:null,pendingAuxiliary:false})},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{
  if(options.method!=='POST')return {ok:true,json:async()=>url.endsWith('/status')?{status:syncStatus}:syncStatus==='COMPLETED'?{audio:{url:'https://example.invalid/speech.wav',content_type:'audio/wav'}}:{error:'Isolated generation failure'}};
  submissions.push({url,input:JSON.parse(options.body)});if(failSubmit)throw new Error('Isolated provider submission failure');return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/google/gemini-3.8-flash-tts/requests/fixture/status',response_url:'https://queue.fal.run/google/gemini-3.8-flash-tts/requests/fixture'})};}}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:(generationFixtureDependency(id,overrides,load)??(id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id))),module,module.exports);return module.exports;}
Object.assign(overrides,{'./fal-fetch':overrides['../../../lib/fal-fetch'],'./fal-billing':overrides['../../../lib/fal-billing']});
const previousFetch=globalThis.fetch,previousKey=process.env.FAL_KEY;
globalThis.fetch=async()=>{throw new Error('Unexpected network call');};process.env.FAL_KEY='fixture-no-real-network';
try{
 const route=load('src/app/api/generate/route.ts'),pricing=load('src/lib/model-pricing.ts'),speech=load('src/lib/gemini-tts.ts');
 const provider=speech.GEMINI_TTS_PROVIDER;
 const request=extra=>({headers:new Headers(),json:async()=>({mode:'audio',audioWorkflow:'text-to-audio',provider,ratio:'16:9',duration:'single',prompt:'Have a wonderful day!',idempotencyKey:crypto.randomUUID(),...extra})});
 const options=speech.newGeminiTtsOptions();assert.equal(speech.GEMINI_TTS_VOICES.length,30);assert.equal(options.voice,'Kore');
 for(const [count,credits]of [[1,1],[100,1],[500,4],[1000,7],[2000,14]])assert.equal(pricing.estimateGenerationCredits({mode:'audio',provider,promptText:'a'.repeat(count)}),credits);
 assert.equal(speech.geminiTtsCharacters('😀中文'),3);
 assert.equal(pricing.MODEL_PRICING_ROWS.find(row=>row.provider===provider).typicalCredits,7);
 for(const voice of speech.GEMINI_TTS_VOICES){
  const response=await route.POST(request({geminiTts:{...options,voice,styleInstructions:'Warm and friendly.'},expectedCredits:1}));assert.equal(response.status,200,JSON.stringify(response.body));
  assert.deepEqual(submissions.at(-1),{url:'https://queue.fal.run/google/gemini-3.8-flash-tts',input:{prompt:'Have a wonderful day!',voice,style_instructions:'Warm and friendly.',enable_safety_checker:true}});
 }
 let response=await route.POST(request({prompt:'x'.repeat(1000),geminiTts:{...options,styleInstructions:'Instructions that should not add credits.'},expectedCredits:7,enableSafetyChecker:false}));assert.equal(response.status,200);assert.equal(spends.at(-1),7);assert.equal(submissions.at(-1).input.enable_safety_checker,true);assert.equal(records[response.body.taskId].request_settings.output_format,'wav');
 const dialogue={...options,mode:'dialogue',styleInstructions:'Global direction.',speakers:[{speaker_id:'Host',voice:'Kore'},{speaker_id:'Guest',voice:'Puck'}],turns:[{speaker_id:'Host',text:'a'.repeat(500),style_instructions:'Curious.'},{speaker_id:'Guest',text:'b'.repeat(500),style_instructions:'Bright.'}]};
 response=await route.POST(request({prompt:'',geminiTts:dialogue,expectedCredits:7}));assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.estimatedCredits,7);
 const submitted=submissions.at(-1).input;assert.equal('prompt' in submitted,false);assert.equal('voice' in submitted,false);assert.deepEqual(submitted.speakers,dialogue.speakers);assert.deepEqual(submitted.turns,dialogue.turns);assert.equal(submitted.style_instructions,dialogue.styleInstructions);assert.ok(records[response.body.taskId].prompt.startsWith('Host: '));assert.deepEqual(records[response.body.taskId].request_settings.gemini_tts.turns,dialogue.turns);
 const before=[spends.length,submissions.length];
 for(const extra of [{mode:'video'},{mode:'avatar'},{audioWorkflow:'text-to-music'},{prompt:''},{geminiTts:null},{geminiTts:{...options,voice:'Rachel'}},{geminiTts:{...options,mode:'invalid'}},{prompt:'',geminiTts:{...dialogue,speakers:dialogue.speakers.slice(0,1)}},{prompt:'',geminiTts:{...dialogue,speakers:[{speaker_id:'A',voice:'Kore'},{speaker_id:' A ',voice:'Puck'}]}},{prompt:'',geminiTts:{...dialogue,turns:[{speaker_id:'Unknown',text:'Hello'}]}},{prompt:'',geminiTts:{...dialogue,turns:[{speaker_id:'Host',text:' '}]}},{geminiTts:dialogue},{geminiTts:{...options,styleInstructions:'x'.repeat(9000)}},{imageUrls:['https://example.invalid/a.png']},{dailyFree:true}]){
  const invalid=await route.POST(request(extra));assert.equal(invalid.status,400,JSON.stringify(extra).slice(0,150));
 }
 response=await route.POST(request({expectedCredits:99}));assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,1);assert.deepEqual([spends.length,submissions.length],before);
 authenticated=false;assert.equal((await route.POST(request({}))).status,401);authenticated=true;
 delete process.env.FAL_KEY;assert.equal((await route.POST(request({}))).status,503);process.env.FAL_KEY='fixture-no-real-network';
 const id=crypto.randomUUID();await route.POST(request({idempotencyKey:id}));const calls=submissions.length,charged=spends.length;response=await route.POST(request({idempotencyKey:id}));assert.equal(response.body.duplicate,true);assert.equal(submissions.length,calls);assert.equal(spends.length,charged);
 failSubmit=true;const beforeUnknownRefunds=refunds.length;response=await route.POST(request({prompt:'a'.repeat(1000)}));assert.equal(response.status,202);assert.equal(response.body.failureCode,'provider_submission_unknown');assert.equal(refunds.length,beforeUnknownRefunds,'Uncertain submission must not refund or replay');failSubmit=false;
 for(const task of Object.values(records))task.status='completed';
 const taskRoute=load('src/app/api/tasks/route.ts'),success=await route.POST(request({}));await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(records[success.body.taskId].status,'completed');assert.equal(records[success.body.taskId].output_url,'https://example.invalid/speech.wav');
 syncStatus='FAILED';const failed=await route.POST(request({}));const refundCount=refunds.length;await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(records[failed.body.taskId].status,'failed');assert.equal(refunds.length,refundCount+1);await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(refunds.length,refundCount+1);
 const restored=speech.restoreGeminiTtsOptions({mode:'dialogue',speakers:null,turns:[null]});assert.equal(restored.speakers.length,2);assert.equal(restored.turns[0].text,'');assert.equal(speech.restoreGeminiTtsOptions(dialogue).turns[1].text,dialogue.turns[1].text);
 console.log('Gemini Flash TTS passed: 30 voices, exact single/dialogue queue inputs, styles and aliases excluded from credit counts, Unicode characters, WAV result sync, input validation before spend, stale quotes, idempotency, signup restoration and one-time refunds. All provider, database and billing calls mocked.');
}finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=previousKey;}
