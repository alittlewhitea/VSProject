import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {projectLoader} from './load-project-ts.mjs';

// Exercise the real durable-submission implementation; only SQL and fal are
// fixtures. Payload-only route tests would miss validation before the paid POST.
let task,posts=[],tail=Promise.resolve();
const connection={async execute(sql,args=[]) {
  if(sql.startsWith('select * from generation_tasks'))return [[task?.id===args[0]?structuredClone(task):null].filter(Boolean)];
  if(sql.startsWith('select id from generation_tasks'))return [[]];
  if(sql.startsWith('update generation_tasks set')) {
    const keys=[...sql.slice(0,sql.indexOf(' where ')).matchAll(/`(\w+)` = \?/g)].map(match=>match[1]);
    keys.forEach((key,index)=>task[key]=key==='request_settings'?JSON.parse(args[index]):args[index]);
    return [{affectedRows:1}];
  }
  throw new Error('Unexpected fixture SQL: '+sql);
}};
const transaction=fn=>{
  const run=tail.then(async()=>{const snapshot=structuredClone(task);try{return await fn(connection);}catch(error){task=snapshot;throw error;}});
  tail=run.catch(()=>{});return run;
};
const load=projectLoader({
  './mysql':{withMysqlTransaction:transaction,withMysqlAdvisoryTransaction:(_name,fn)=>transaction(fn),toMysqlDate:value=>value},
  './site-url':{siteUrl:()=> 'http://localhost:3000'},
  './fal-fetch':{fetchFal:async(url,options)=>{
    posts.push({url,input:JSON.parse(options.body)});
    return Response.json({request_id:'fixture-request',status:'IN_QUEUE'});
  }}
});
const {providerTracking,submitTrackedFal,SubmissionNotStarted}=load('src/lib/generation-submission.ts');
const configured=load('src/lib/model-pricing.ts').MODEL_PRICING_ROWS.map(row=>row.endpointId);
const endpoints=[...new Set([...configured,'google/nano-banana-2.1','google/nano-banana-2.1/edit',
  'fal-ai/veo3.1','fal-ai/minimax-music/v2.6','bytedance/seedance-2.0/text-to-video',
  'xai/grok-imagine-video/v1.5/lite/text-to-video'])];
for(const endpoint of endpoints) {
  const tracking=providerTracking(endpoint,'fixture-request');
  assert.equal(tracking.responseUrl,`https://queue.fal.run/${endpoint.split('/').slice(0,2).join('/')}/requests/fixture-request`);
  assert.equal(tracking.statusUrl,tracking.responseUrl+'/status');
}
for(const endpoint of ['google/../other','google/./other','google//model','/google/model','google/model/',
  'google/%2e%2e/model','google/model?secret=1','google/model#fragment','https://evil.invalid/model',
  'google/model\\evil','google/model\n','google','google/.hidden']) {
  assert.throws(()=>providerTracking(endpoint,'fixture-request'),/Invalid provider tracking/);
}
for(const requestId of ['../evil','id/other','id?foo=1','id#part','%2e%2e','id\n','', 'a'.repeat(192)]) {
  assert.throws(()=>providerTracking('google/nano-banana-2.1',requestId),/Invalid provider tracking/);
}
for(const endpoint of endpoints) {
  task={id:'fixture-task',user_id:'owner',status:'queued',request_settings:{model_id:endpoint}};
  const input={prompt:'A blue ceramic cup',resolution:'1K',num_images:1};
  const before=posts.length;
  const results=await Promise.allSettled(Array.from({length:6},()=>submitTrackedFal('fixture-key',endpoint,input,{taskId:task.id,userId:task.user_id,stage:'primary'})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(posts.length,before+1,'A dotted model is submitted once, even with concurrent callers');
  assert.equal(posts.at(-1).url,`https://queue.fal.run/${endpoint}`);
  assert.deepEqual(posts.at(-1).input,input);
  assert.equal(task.provider_request_id,'fixture-request');
  assert.equal(task.request_settings.provider_attempts.primary.state,'accepted');
  assert.equal(task.request_settings.provider_attempts.primary.modelId,endpoint);
  assert.equal(task.status_url,providerTracking(endpoint,'fixture-request').statusUrl);
}
const beforeInvalid=posts.length;
await assert.rejects(submitTrackedFal('fixture-key','google/../model',{}, {taskId:'fixture-task',userId:'owner',stage:'primary'}),SubmissionNotStarted);
assert.equal(posts.length,beforeInvalid,'Invalid model paths never reach the provider');

// Run the actual client error-response branch with mocked state/storage. A
// confirmed refund must show its message and clear its key; an ambiguous 5xx
// must preserve the key advertised by the retry hint.
const source=readFileSync('src/features/studio/use-studio-controller.tsx','utf8');
const ast=ts.createSourceFile('controller.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let rejection;
function visit(node){if(ts.isIfStatement(node)&&ts.isBlock(node.thenStatement)&&node.expression.getText(ast)==='!response.ok')rejection=node;ts.forEachChild(node,visit);}
visit(ast);assert.ok(rejection);
const compiled=ts.transpileModule(rejection.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const run=new Function('context',`with(context){return (async()=>{${compiled}})();}`);
async function rejectResponse(status,payload) {
  const state={response:Response.json(payload,{status}),idempotencyStorageKey:'saved-task-key',cleared:[],balance:null,cached:null,
    st:key=>key,localizeStudioError:(message,status)=>status>=500?'generic-unavailable':message,
    clearPersistentIdempotency(key){state.cleared.push(key);},setCreditBalance(value){state.balance=value;},cacheCreditBalance(value){state.cached=value;}};
  try{await run(state);assert.fail('The rejection branch must throw');}catch(error){state.message=error.message;}
  return state;
}
let state=await rejectResponse(503,{code:'provider_not_submitted',error:'Generation could not be submitted. Your credits were returned.',balance:100,refundedCredits:8});
assert.equal(state.message,'Generation could not be submitted. Your credits were returned.');
assert.deepEqual(state.cleared,['saved-task-key']);assert.equal(state.idempotencyStorageKey,null);
assert.equal(state.balance,100);assert.equal(state.cached,100);
state=await rejectResponse(500,{code:'generation_unavailable',error:'Unable to process generation request.'});
assert.equal(state.idempotencyStorageKey,'saved-task-key');assert.deepEqual(state.cleared,[]);
state=await rejectResponse(502,{error:'Upstream failed'});
assert.equal(state.idempotencyStorageKey,'saved-task-key');assert.deepEqual(state.cleared,[]);
state=await rejectResponse(400,{error:'Invalid settings'});
assert.equal(state.idempotencyStorageKey,null);assert.deepEqual(state.cleared,['saved-task-key']);
console.log(`Submission passed: actual durable submissions for all ${endpoints.length} configured/versioned endpoints, traversal/URL rejection, concurrent single POST, persisted tracking, confirmed refund UI and ambiguous-error key reuse. All SQL/provider/network calls simulated.`);
