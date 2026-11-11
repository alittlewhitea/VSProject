import {generationFixtureDependency} from './generation-runtime-fixture.mjs';
import {settlementRpcFixture} from './generation-settlement-fixture.mjs';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';

const native=createRequire(import.meta.url),cache=new Map(),refunds=[],records={};
let authenticated=true,allowHistory=false,syncStatus='COMPLETED',providerCalls=0;
const admin={from(table){
 assert.ok(allowHistory,'Retired generation must not access storage');assert.equal(table,'generation_tasks');let updated,filters={},predicates=[];
 const query={select(){return query;},eq(key,value){filters[key]=value;return query;},
  neq(key,value){predicates.push(row=>row[key]!==value);return query;},in(key,values){predicates.push(row=>values.includes(row[key]));return query;},is(key,value){predicates.push(row=>row[key]===value);return query;},order(){return query;},limit(){return query;},
  update(value){updated=value;return query;},
  then(done){if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({data:Object.values(records).filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value)&&predicates.every(predicate=>predicate(row))),error:null}).then(done);}};
 return query;
}};
const forbidden=()=>{throw new Error('Retired generation reached billing, storage or provider preparation');};
admin.rpc=settlementRpcFixture(records,amount=>refunds.push(amount));
const overrides={
 '../../../lib/mysql':{mysqlExecute:async()=>[{active:0}],toMysqlDate:value=>value},
 '../../../lib/request-security':{consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})},
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'mischief-fixture'}:null,getUserIdsForAuthUser:async()=>['mischief-fixture']},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>{assert.ok(allowHistory,'Retired generation cannot create a database client');return admin;}},
 '../../../lib/credits':{ensureSignupCreditAccount:forbidden,ensureCreditAccount:forbidden,spendCredits:forbidden,refundCredits:async(_admin,_user,amount)=>{assert.ok(allowHistory);refunds.push(amount);return 10000;}},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:forbidden},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:forbidden},
 '../../../lib/fal-billing':{resolveFalCostUsd:async()=>null,resolveFalTaskCostUsd:async()=>({costUsd:null,pendingAuxiliary:false})},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{
  assert.ok(allowHistory);assert.notEqual(options.method,'POST','No new provider generation is permitted');providerCalls++;
  return {ok:true,json:async()=>url.endsWith('/status')?{status:syncStatus}:syncStatus==='COMPLETED'?{video:{url:'https://example.invalid/mischief.mp4'}}:{error:'Isolated historical generation failure'}};
 }}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:(generationFixtureDependency(id,overrides,load)??(id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id))),module,module.exports);return module.exports;}
Object.assign(overrides,{'./fal-fetch':overrides['../../../lib/fal-fetch'],'./fal-billing':overrides['../../../lib/fal-billing']});
const previousFetch=globalThis.fetch,previousKey=process.env.FAL_KEY;
globalThis.fetch=forbidden;process.env.FAL_KEY='fixture-no-real-network';
try{
 const route=load('src/app/api/generate/route.ts'),models=load('src/features/studio/video-models.ts');
 assert.equal(load('src/lib/model-release.ts').MISCHIEF_RETIRED,true);
 assert.equal(models.videoModelConfig('mischief-video'),undefined);
 for(const providers of Object.values(models.VIDEO_PROVIDERS_BY_WORKFLOW))assert.ok(!providers.includes('mischief-video'));
 assert.ok(!load('src/lib/model-pricing.ts').MODEL_PRICING_ROWS.some(row=>row.provider==='mischief-video'));
 assert.equal(existsSync('src/app/video/mischief-1/page.tsx'),false);
 for(const file of ['src/components/site-footer.tsx','src/app/sitemap.ts','src/lib/growth-policy.ts'])assert.ok(!readFileSync(file,'utf8').includes('/video/mischief-1'),file);
 const core=load('src/lib/video-prompt-enhancement.ts');
 assert.throws(()=>core.validatePromptContext({model:'mischief-video',mode:'image-to-video',prompt:'A camera pans.',duration:'5s',aspectRatio:'16:9',resolution:'720p',imageUrls:['https://example.invalid/start.png']}),/Unsupported/);
 const request=extra=>({headers:new Headers(),json:async()=>({mode:'video',provider:'mischief-video',videoWorkflow:'image-to-video',duration:'5s',resolution:'720p',ratio:'16:9',prompt:'A camera pans.',imageUrls:['https://example.invalid/start.png'],...extra})});
 for(const mode of ['video','avatar','image','audio']){
  const result=await route.POST(request({mode}));assert.equal(result.status,410,JSON.stringify(result.body));assert.equal(result.body.code,'model_retired');
 }
 delete process.env.FAL_KEY;assert.equal((await route.POST(request({}))).status,410);process.env.FAL_KEY='fixture-no-real-network';
 authenticated=false;assert.equal((await route.POST(request({}))).status,401);authenticated=true;
 assert.equal(providerCalls,0);assert.equal(refunds.length,0);
 // Pre-existing jobs must still finish and refund through the original task synchronizer.
 allowHistory=true;const taskRoute=load('src/app/api/tasks/route.ts');
 const historyTask=id=>({id,user_id:'mischief-fixture',provider:'mischief-video',mode:'video',prompt:'Existing task',status:'queued',estimated_credits:9,transport:'real',provider_request_id:'old-request',status_url:'https://queue.fal.run/tbc/mischief-1/requests/old/status',response_url:'https://queue.fal.run/tbc/mischief-1/requests/old',request_settings:{},deleted_at:null,created_at:new Date().toISOString()});
 records.success=historyTask('success');
 assert.equal((await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}))).status,200);
 assert.equal(records.success.status,'completed');assert.equal(records.success.output_url,'https://example.invalid/mischief.mp4');
 syncStatus='FAILED';records.failed=historyTask('failed');
 await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.equal(records.failed.status,'failed');assert.deepEqual(refunds,[9]);
 await taskRoute.POST(new Request('https://site.invalid/api/tasks',{method:'POST'}));assert.deepEqual(refunds,[9]);
 console.log('Mischief retirement passed: no selectable model or public pricing/page/links, optimizer rejected, generation returns 410 before storage/billing/provider access in every workspace, historical task completion and one-time refund preserved. All external calls mocked.');
}finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=previousKey;}
