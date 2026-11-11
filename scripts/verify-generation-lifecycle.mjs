import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import {settlementRpcFixture} from './generation-settlement-fixture.mjs';
const native=createRequire(import.meta.url),cache=new Map(),records={},refunds=[],calls=[];
let status='COMPLETED',resultStatus=200,result={video:{url:'https://example.invalid/video.mp4'}},authenticated=true;
const task=()=>({id:'task',user_id:'owner',status:'queued',estimated_credits:10,transport:'real',provider:'grok-video',status_url:'https://queue.fal.run/grok/requests/own/status',response_url:'https://queue.fal.run/grok/requests/own',deleted_at:null,created_at:new Date().toISOString()});
const admin={rpc:settlementRpcFixture(records,amount=>refunds.push(amount)),from(table){assert.equal(table,'generation_tasks');const filters={};const q={select(){return q;},eq(key,value){filters[key]=value;return q;},is(key,value){filters[key]=value;return q;},maybeSingle:async()=>({data:Object.values(records).find(row=>Object.entries(filters).every(([key,value])=>row[key]===value))||null,error:null})};return q;}};
const overrides={
 'next/server':{NextResponse:Response},
 '../../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'owner'}:null},
 '../../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../../lib/request-security':{consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})},
 './fal-fetch':{fetchFal:async url=>{calls.push(url);return url.endsWith('/status')?Response.json({status,response_url:'https://attacker.invalid/result'}):Response.json(result,{status:resultStatus});}},
 './fal-billing':{resolveFalCostUsd:async()=>0,resolveFalTaskCostUsd:async()=>({costUsd:0,pendingAuxiliary:false})}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const originalFetch=globalThis.fetch,originalNative=process.env.FAL_USE_NATIVE_FETCH,originalKey=process.env.FAL_KEY;
globalThis.fetch=async()=>{throw new Error('Unexpected network access');};process.env.FAL_KEY='mock-no-network';
try{
 const route=load('src/app/api/generate/status/route.ts');
 const poll=(id='task')=>route.GET(new Request(`https://site.invalid/api/generate/status?taskId=${id}&statusUrl=https://attacker.invalid/status&responseUrl=https://attacker.invalid/failed`));
 records.task=task();let response=await poll();assert.equal(response.status,200);assert.equal((await response.json()).status,'COMPLETED');assert.deepEqual(calls,[records.task.status_url,records.task.response_url]);assert.equal(refunds.length,0);
 const before=calls.length;response=await poll();assert.equal((await response.json()).status,'COMPLETED');assert.equal(calls.length,before,'Terminal reads do not contact providers or refund');
 assert.equal((await poll('other')).status,404);authenticated=false;assert.equal((await poll()).status,401);authenticated=true;
 records.task=task();resultStatus=503;await poll();assert.equal(records.task.status,'queued');assert.equal(refunds.length,0,'Transient result errors do not establish billable failure');resultStatus=200;
 records.task=task();status='UNKNOWN_NEW_STATUS';await poll();assert.equal(records.task.status,'queued');assert.equal(refunds.length,0);
 records.task={...task(),created_at:'2020-01-01T00:00:00Z'};status='IN_PROGRESS';await poll();assert.equal(records.task.status,'running');assert.equal(records.task.failure_code,'provider_timeout_pending');assert.equal(refunds.length,0,'A running timed-out provider job is not automatically refunded');
 records.task={...task(),status_url:null};await poll();assert.equal(records.task.failure_code,'provider_tracking_pending');assert.equal(refunds.length,0);
 records.task=task();status='FAILED';result={error:'Fixture provider rejection'};await poll();assert.equal(records.task.status,'failed');assert.deepEqual(refunds,[10]);await poll();assert.deepEqual(refunds,[10]);
 records.task={...task(),provider:'dreamface-io-video'};const retired=await poll();assert.equal((await retired.json()).failureCode,'model_retired');assert.equal(refunds.length,1,'Retired providers have no automatic polling or allowance code');
 const safety=load('src/lib/generation-safety.ts');assert.equal(safety.applyGenerationSafety({provider:'grok-video',enableSafetyChecker:false,safetyTolerance:'6'}).enableSafetyChecker,true);assert.equal(safety.applyGenerationSafety({provider:'nano-banana-image',safetyTolerance:'6'}).safetyTolerance,'4');assert.equal(safety.applyGenerationSafety({provider:'minimax-h3-max-video',enableSafetyChecker:true}).enableSafetyChecker,false);
 const {readRequestJson,RequestBodyError}=load('src/lib/request-body.ts');
 const streamed=new Request('https://site.invalid',{method:'POST',body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"text":"'+'a'.repeat(50)));controller.enqueue(new TextEncoder().encode('b'.repeat(50)+'"}'));controller.close();}}),duplex:'half'});
 await assert.rejects(readRequestJson(streamed,64),error=>error instanceof RequestBodyError&&error.status===413);
 await assert.rejects(readRequestJson(new Request('https://site.invalid',{method:'POST',body:'{}',headers:{'content-length':'1000'}}),64),error=>error.status===413);
 assert.deepEqual(await readRequestJson(new Request('https://site.invalid',{method:'POST',body:'{"ok":true}'}),64),{ok:true});
 await assert.rejects(readRequestJson(new Request('https://site.invalid',{method:'POST'}),64),error=>error.status===400);
 // Exercise the actual transport with failures, forcing its native path. Never
 // contact an external host: fetch is a throwing fixture.
 process.env.FAL_USE_NATIVE_FETCH='1';let attempts=0;
 globalThis.fetch=async()=>{attempts++;throw new Error('Fixture ambiguous network timeout');};
 const transport=load('src/lib/fal-fetch.ts');
 await assert.rejects(transport.fetchFal('https://queue.fal.run/fixture',{method:'POST',attempts:3,timeoutMs:10}));assert.equal(attempts,1,'A billable POST is attempted exactly once');
 attempts=0;await assert.rejects(transport.fetchFal('https://queue.fal.run/fixture',{method:'GET',attempts:2,timeoutMs:10,fallback:false}));assert.equal(attempts,2,'Read retries remain supported');
 console.log('Lifecycle passed: actual status route, stored owner-only URLs, terminal reads, transient/unknown status, timeout and orphan uncertainty, definitive failure once, server safety policy, streamed JSON bounds and single-attempt paid POST. All network/storage simulated.');
}finally{globalThis.fetch=originalFetch;if(originalNative===undefined)delete process.env.FAL_USE_NATIVE_FETCH;else process.env.FAL_USE_NATIVE_FETCH=originalNative;if(originalKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=originalKey;}
