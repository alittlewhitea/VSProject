import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url);
function loader(overrides={}) {
 const cache=new Map();
 function load(path) {
  path=resolve(path);if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):native(id),module,module.exports);
  return module.exports;
 }
 return load;
}
const env={SIGNUP_IP_SECRET:process.env.SIGNUP_IP_SECRET,FAL_KEY:process.env.FAL_KEY};
process.env.SIGNUP_IP_SECRET='isolated-h3-free-signing-secret';process.env.FAL_KEY='isolated-no-network';
let state,failSql=null,queue=Promise.resolve();
function reset() {state={bonuses:{a:{amount:100,reference_id:'a'.repeat(64)},b:{amount:100,reference_id:'b'.repeat(64)},low:{amount:15},oldLow:{amount:10}},owners:{},usage:{},tasks:{}};failSql=null;}
reset();
async function execute(sql,args=[]) {
 if(failSql&&sql.includes(failSql))throw new Error('Injected SQL failure');
 let result=[];
 if(sql.startsWith('SELECT amount,reference_id'))result=state.bonuses[args[0]]?[state.bonuses[args[0]]]:[];
 else if(sql.startsWith('SELECT user_id FROM user_credit_accounts'))result=state.bonuses[args[0]]?[{user_id:args[0]}]:[];
 else if(sql.startsWith('INSERT IGNORE INTO h3_daily_free_identities'))state.owners[args[0]+':'+args[1]]??=args[2];
 else if(sql.startsWith('SELECT owner_user_id')){const owner=state.owners[args[0]+':'+args[1]];result=owner?[{owner_user_id:owner}]:[];}
 else if(sql.startsWith('SELECT task_id FROM h3_daily_free_usage')){const task=state.usage[args[0]+':'+args[1]];result=task?[{task_id:task}]:[];}
 else if(sql.startsWith('INSERT INTO generation_tasks')) {
  if(state.tasks[args[0]])throw Object.assign(new Error('Duplicate task'),{code:'ER_DUP_ENTRY'});
  state.tasks[args[0]]={id:args[0],user_id:args[1],mode:args[2],provider:args[3],prompt:args[4],status:'queued',estimated_credits:0,transport:args[5],request_settings:JSON.parse(args[6])};
 } else if(sql.startsWith('INSERT INTO h3_daily_free_usage'))state.usage[args[0]+':'+args[1]]=args[2];
 else throw new Error('Unexpected SQL: '+sql);
 return [result];
}
const mysql={mysqlExecute:async(sql,args)=>(await execute(sql,args))[0],withMysqlTransaction:async fn=>{
 let release;const previous=queue;queue=new Promise(resolve=>release=resolve);await previous;
 const saved=structuredClone(state);
 try{return await fn({execute});}catch(error){state=saved;throw error;}finally{release();}
}};
const cookieValues=new Map();
const load=loader({'next/headers':{cookies:async()=>({get:key=>cookieValues.has(key)?{value:cookieValues.get(key)}:undefined,set:(key,value)=>cookieValues.set(key,value)})},'./mysql':mysql});
const service=load('src/lib/h3-daily-free.ts'),policy=load('src/lib/h3-daily-free-policy.ts'),credits=load('src/lib/credits.ts');
const context={ipHash:'1'.repeat(64),deviceHash:'2'.repeat(64)};
const task=(id,userId='a',overrides={})=>({id,userId,prompt:'Test motion',settings:{duration:'5s',resolution:'480p'},mode:'video',transport:'real',...overrides});
try {
 assert.equal(credits.signupBonusCreditsForCountry('IN'),15);
 assert.equal(credits.signupBonusCreditsForCountry('NG'),15);
 assert.equal(credits.signupBonusCreditsForCountry('US'),100);
 assert.deepEqual(policy.h3DailyFreePeriod(new Date('2026-10-15T15:59:59Z')),{day:'2026-10-15',resetsAt:'2026-10-15T16:00:00.000Z'});
 assert.equal(policy.h3DailyFreePeriod(new Date('2026-10-15T16:00:00Z')).day,'2026-10-16');
 for(const mode of ['video','avatar'])assert.equal(policy.isH3DailyFreeRequest({mode,provider:policy.H3_DAILY_FREE_PROVIDER,resolution:'480p',duration:'5s'}),true);
 for(const change of [{mode:'image'},{provider:'minimax-h3-max-video'},{resolution:'768p'},{resolution:'1080p'},{duration:'10s'},{duration:'15s'}])assert.equal(policy.isH3DailyFreeRequest({mode:'video',provider:policy.H3_DAILY_FREE_PROVIDER,resolution:'480p',duration:'5s',...change}),false);
 const signed=service.signH3Device('a'.repeat(64));
 assert.equal(service.readH3Device(signed),'a'.repeat(64));
 assert.equal(service.readH3Device(signed.slice(0,-1)+(signed.endsWith('0')?'1':'0')),null);
 const headers=new Headers({'cf-connecting-ip':'203.0.113.1','cf-ipcountry':'US'});
 const identity=await service.h3FreeContext(headers);
 assert.deepEqual(await service.h3FreeContext(headers),identity);
 assert.deepEqual(await service.h3FreeContext(new Headers({'cf-ipcountry':'IN','cf-connecting-ip':'203.0.113.1'})),identity,'Current location cannot rewrite signup cohort');
 assert.deepEqual(await service.h3FreeContext(new Headers({'cf-connecting-ip':'203.0.113.1'})),identity);
 assert.equal(await service.h3FreeContext(new Headers({'cf-ipcountry':'US'})),null);
 assert.equal((await service.getH3DailyFreeStatus('a',context)).available,true);
 assert.equal(Object.keys(state.owners).length,0,'Preview must not bind identities');
 assert.equal((await service.createH3DailyFreeTask(task('missing'),null)).allowed,false);
 assert.equal((await service.createH3DailyFreeTask(task('mock','a',{transport:'mock'}),context)).allowed,false);
 for(const userId of ['low','oldLow'])assert.equal((await service.createH3DailyFreeTask(task(userId,userId),context)).allowed,false);
 const results=await Promise.all(Array.from({length:8},(_,i)=>service.createH3DailyFreeTask(task('parallel-'+i),context)));
 assert.equal(results.filter(x=>x.allowed).length,1);
 assert.equal(Object.keys(state.tasks).length,1);
 assert.equal(Object.values(state.tasks)[0].estimated_credits,0);
 assert.equal(Object.values(state.tasks)[0].request_settings.free_program,policy.H3_DAILY_FREE_PROGRAM);
 assert.equal((await service.getH3DailyFreeStatus('a',context)).available,false);
 for(const second of [{ipHash:context.ipHash,deviceHash:'3'.repeat(64)},{ipHash:'4'.repeat(64),deviceHash:context.deviceHash}]) {
  const snapshot=structuredClone(state);
  assert.equal((await service.createH3DailyFreeTask(task('shared','b'),second)).allowed,false);
  assert.deepEqual(state,snapshot,'Rejected identities must roll back other identity inserts');
 }
 // Changing IP/device cannot bypass the account's daily limit.
 assert.equal((await service.createH3DailyFreeTask(task('rotated'),{ipHash:'4'.repeat(64),deviceHash:'5'.repeat(64)})).allowed,false);
 assert.equal((await service.createH3DailyFreeTask(task('independent','b'),{ipHash:'4'.repeat(64),deviceHash:'5'.repeat(64)})).allowed,true,'Independent eligible users must retain their own quota');
 // Simulate a new day: same account can claim again, alternate accounts stay blocked.
 state.usage={};
 assert.equal((await service.createH3DailyFreeTask(task('next-day'),context)).allowed,true);
 assert.equal((await service.createH3DailyFreeTask(task('next-day-other','b'),context)).allowed,false);
 reset();failSql='INSERT INTO h3_daily_free_usage';
 await assert.rejects(service.createH3DailyFreeTask(task('rollback'),context),/Injected/);
 assert.equal(Object.keys(state.tasks).length,0);assert.equal(Object.keys(state.owners).length,0);
 failSql=null;
 assert.equal((await service.createH3DailyFreeTask(task('retry'),context)).allowed,true);
 const snapshot=structuredClone(state);assert.equal((await service.createH3DailyFreeTask(task('retry'),context)).allowed,false);assert.deepEqual(state,snapshot);
 reset();
 const accounts=await Promise.all(['a','b'].map(user=>service.createH3DailyFreeTask(task('race-'+user,user),context)));
 assert.equal(accounts.filter(result=>result.allowed).length,1,'Accounts sharing one identity cannot both claim concurrently');

 // Execute the real POST route with isolated storage and a fake fal transport.
 reset();let currentUser='a',spends=0,submissions=0,providerFailure=false,accountBalance=0;
 const admin={from(table){
  assert.equal(table,'generation_tasks');let values=null,insert=null,filters={};
  const query={select(){return query;},eq(key,value){filters[key]=value;return query;},maybeSingle:async()=>({data:state.tasks[filters.id]?.user_id===filters.user_id?state.tasks[filters.id]:null}),
   insert(value){insert=value;return query;},update(value){values=value;return query;},
   then(resolve){if(insert)state.tasks[insert.id]={...insert};if(values&&state.tasks[filters.id])Object.assign(state.tasks[filters.id],values);return Promise.resolve({error:null}).then(resolve);}};
  return query;
 }};
 const route=loader({
  'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
  '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:currentUser})},
  '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
  '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:accountBalance}),ensureCreditAccount:async()=>({balance:accountBalance}),spendCredits:async()=>{spends++;return {ok:true,balance:85};},refundCredits:async()=>100},
  '../../../lib/h3-daily-free':{...service,h3FreeContext:async()=>context},
  '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async()=>15},
  '../../../lib/fal-fetch':{fetchFal:async()=>{submissions++;if(providerFailure)throw new Error('Fixture upstream unavailable');return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/fixture/status'})};}}
 })('src/app/api/generate/route.ts');
 const request=(key,extra={})=>({headers:new Headers(),json:async()=>({mode:'video',provider:policy.H3_DAILY_FREE_PROVIDER,duration:'5s',resolution:'480p',ratio:'16:9',prompt:'Test motion',videoWorkflow:'text-to-video',dailyFree:true,idempotencyKey:key,...extra})});
 let result=await route.POST(request('fixture-free-1'));
 assert.equal(result.status,200);assert.equal(result.body.estimatedCredits,0);assert.equal(result.body.billingSource,'daily_free');assert.equal(spends,0);assert.equal(submissions,1);
 result=await route.POST(request('fixture-free-1'));assert.equal(result.body.duplicate,true);assert.equal(submissions,1);
 result=await route.POST(request('fixture-free-2'));assert.equal(result.status,409);assert.equal(spends,0);assert.equal(submissions,1);
 accountBalance=100;result=await route.POST(request('fixture-paid-1',{dailyFree:false}));assert.equal(result.body.estimatedCredits,15);assert.equal(spends,1);assert.equal(submissions,2);
 result=await route.POST(request('fixture-wrong-1',{resolution:'1080p'}));assert.equal(result.status,400);assert.equal(spends,1);
 currentUser='low';result=await route.POST(request('fixture-low-1'));assert.equal(result.status,409);assert.equal(spends,1);assert.equal(submissions,2);
 reset();currentUser='a';providerFailure=true;result=await route.POST(request('fixture-failure-1'));assert.equal(result.status,502);assert.equal(spends,1);assert.equal(Object.keys(state.usage).length,1,'Submitted attempts consume one daily opportunity even if upstream fails');
 reset();failSql='h3_daily_free_identities';result=await route.POST(request('fixture-no-db-1'));assert.equal(result.status,503);assert.equal(spends,1);assert.equal(Object.keys(state.tasks).length,0);
 console.log('H3 daily free checks passed: 15-credit signup tier, cohort/IP/device rules, signed identity, daily reset, concurrent claims, rollback, duplicate submission, zero charge, explicit paid retries and unavailable storage. Isolated fixtures only.');
} finally {
 for(const [key,value] of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}
