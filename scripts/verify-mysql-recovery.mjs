import assert from 'node:assert/strict';
import {randomUUID,generateKeyPairSync,createHash,sign} from 'node:crypto';
import {projectLoader} from './load-project-ts.mjs';

export async function verifyMysqlRecovery({db,admin,store}) {
 const owner=randomUUID();await db.execute('INSERT INTO users(id) VALUES (?)',[owner]);await db.execute('INSERT INTO user_credit_accounts(user_id,balance,created_at,updated_at) VALUES (?,1000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',[owner]);
 const savedFetch=globalThis.fetch,keys=['NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_SITE_URL','FAL_KEY','FAL_WEBHOOK_SECRET','FAL_WEBHOOK_USER_ID'],saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 Object.assign(process.env,{NEXT_PUBLIC_APP_URL:'https://recovery-fixture.invalid',NEXT_PUBLIC_SITE_URL:'https://recovery-fixture.invalid',FAL_KEY:'fixture-no-network',FAL_WEBHOOK_SECRET:'isolated-recovery-signing-secret',FAL_WEBHOOK_USER_ID:'fixture-provider-account'});
 const pair=generateKeyPairSync('ed25519'),publicJwk=pair.publicKey.export({format:'jwk'});
 let mode='accept',providerStatus='COMPLETED',cancelStatus='CANCELLATION_REQUESTED',postCalls=0,webhookUrl,requestId;
 const fakeProvider={fetchFal:async(url,options={})=>{
  if(options.method==='POST') {postCalls++;webhookUrl=new URL(new URL(url).searchParams.get('fal_webhook'));requestId=randomUUID();if(mode==='lost')throw new Error('Fixture response lost after acceptance');if(mode==='reject')return Response.json({detail:'Fixture rejected',error_type:'validation_error'},{status:422});return Response.json({request_id:requestId,status:'IN_QUEUE'});}
  if(options.method==='PUT')return Response.json({status:cancelStatus},{status:cancelStatus==='OK'?200:202});
  if(String(url).includes('/billing-events'))return Response.json({billing_events:[]});
  if(String(url).endsWith('/status'))return Response.json({status:providerStatus});
  if(String(url).includes('/elevenlabs/tts/requests/'))return Response.json({audio:{url:'https://example.invalid/recovered-voice.wav'}});
  return Response.json({video:{url:'https://example.invalid/recovered.mp4'}});
 }};
 const load=projectLoader({'./mysql':store,'./fal-fetch':fakeProvider,'next/server':{NextResponse:Response},'../../../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin}});
 globalThis.fetch=async url=>{assert.equal(String(url),'https://rest.fal.ai/.well-known/jwks.json');return Response.json({keys:[publicJwk]});};
 const submission=load('src/lib/generation-submission.ts'),reserve=load('src/lib/generation-capacity.ts').reserveGenerationTask,settle=load('src/lib/generation-task-settlement.ts').settleGenerationTask,webhook=load('src/app/api/generate/webhook/fal/route.ts');
 const balance=async()=>Number((await db.execute('SELECT balance FROM user_credit_accounts WHERE user_id=?',[owner]))[0][0].balance);
 const read=async id=>(await admin.from('generation_tasks').select('*').eq('id',id).maybeSingle()).data;
 const create=async id=>reserve(admin,{id,user_id:owner,mode:'video',provider:'grok-video',prompt:'Recovery fixture',estimated_credits:10,transport:'real',request_settings:{model_id:'fixture/model'}});
 function callback(url,id=requestId,mutate={}) {
  const body=JSON.stringify({request_id:id,status:'OK',payload:{video:{url:'https://untrusted.invalid/ignored.mp4'}}});const timestamp=String(Math.floor(Date.now()/1000));
  const signature=sign(null,Buffer.from([id,'fixture-provider-account',timestamp,createHash('sha256').update(body).digest('hex')].join('\n')),pair.privateKey).toString('hex');
  return new Request(url,{method:'POST',headers:{'x-fal-webhook-request-id':id,'x-fal-webhook-user-id':'fixture-provider-account','x-fal-webhook-timestamp':timestamp,'x-fal-webhook-signature':signature,...mutate.headers},body:mutate.body||body});
 }
 try {
  await create('recovery-concurrent');
  const concurrent=await Promise.allSettled(Array.from({length:12},()=>submission.submitTrackedFal('fixture','fixture/model',{prompt:'same input'},{taskId:'recovery-concurrent',userId:owner,stage:'primary'})));
  assert.equal(concurrent.filter(row=>row.status==='fulfilled').length,1);assert.equal(postCalls,1,'A durable stage intent permits exactly one paid POST');
  let row=await read('recovery-concurrent');assert.ok(row.provider_request_id);assert.ok(row.request_settings.provider_attempts.primary.inputHash);await settle(admin,owner,row.id,{status:'completed'});
  mode='lost';await create('recovery-lost');await assert.rejects(submission.submitTrackedFal('fixture','fixture/model',{prompt:'lost response'},{taskId:'recovery-lost',userId:owner,stage:'primary'}));
  const lostUrl=new URL(webhookUrl),lostId=requestId;row=await read('recovery-lost');assert.equal(row.provider_request_id,null);assert.equal(row.request_settings.provider_attempts.primary.state,'unknown');
  const beforeCallback=await balance();assert.equal((await webhook.POST(callback(lostUrl,lostId,{headers:{'x-fal-webhook-signature':'00'.repeat(64)}}))).status,403);assert.equal(await balance(),beforeCallback);
  const tampered=new URL(lostUrl);tampered.searchParams.set('taskId','recovery-concurrent');assert.equal((await webhook.POST(callback(tampered,lostId))).status,403);
  assert.equal((await webhook.POST(callback(lostUrl,lostId,{headers:{'x-fal-webhook-timestamp':'1000000000'}}))).status,403);
  assert.equal((await webhook.POST(callback(lostUrl,lostId))).status,200);row=await read('recovery-lost');assert.equal(row.status,'completed');assert.equal(row.provider_request_id,lostId);assert.equal(row.output_url,'https://example.invalid/recovered.mp4','Signed webhook maps the request; actual stored provider endpoint supplies the output');
  assert.equal((await webhook.POST(callback(lostUrl,lostId))).status,200);assert.equal(await balance(),beforeCallback,'Duplicate callback cannot refund or charge a settled task');
  mode='accept';await create('recovery-persist-fault');
  await db.query("CREATE TRIGGER fixture_acceptance_failure BEFORE UPDATE ON generation_tasks FOR EACH ROW BEGIN IF NEW.id='recovery-persist-fault' AND JSON_UNQUOTE(JSON_EXTRACT(NEW.request_settings,'$.provider_attempts.primary.state'))='accepted' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated tracking write failure'; END IF; END");
  const accepted=await submission.submitTrackedFal('fixture','fixture/model',{prompt:'persist fault'},{taskId:'recovery-persist-fault',userId:owner,stage:'primary'});const retryUrl=new URL(webhookUrl);
  assert.ok(accepted.request_id);row=await read('recovery-persist-fault');assert.equal(row.provider_request_id,null);
  assert.equal((await webhook.POST(callback(retryUrl,accepted.request_id))).status,503);await db.query('DROP TRIGGER fixture_acceptance_failure');
  assert.equal((await webhook.POST(callback(retryUrl,accepted.request_id))).status,200);assert.equal((await read(row.id)).status,'completed');
  mode='reject';await create('recovery-rejected');await assert.rejects(submission.submitTrackedFal('fixture','fixture/model',{prompt:'rejected'},{taskId:'recovery-rejected',userId:owner,stage:'primary'}));
  const beforeRejected=await balance();await load('src/lib/fal-task-sync.ts').syncFalTask(admin,await read('recovery-rejected'),'fixture');assert.equal((await read('recovery-rejected')).status,'failed');assert.equal(await balance(),beforeRejected+10);
  mode='accept';providerStatus='IN_PROGRESS';await create('recovery-cancel');await submission.submitTrackedFal('fixture','fixture/model',{prompt:'cancel'},{taskId:'recovery-cancel',userId:owner,stage:'primary'});
  const actions=load('src/lib/admin-generation-actions.ts'),beforeCancel=await balance();
  await actions.actOnGeneration(admin,await read('recovery-cancel'),{action:'cancel_provider'},'admin-fixture');assert.equal((await read('recovery-cancel')).status,'running');assert.equal(await balance(),beforeCancel,'A cancellation signal does not prove completion or permit a refund');
  cancelStatus='OK';await actions.actOnGeneration(admin,await read('recovery-cancel'),{action:'cancel_provider'},'admin-fixture');row=await read('recovery-cancel');assert.equal(row.status,'failed');assert.equal(await balance(),beforeCancel+10);assert.ok(row.request_settings.reconciliation_events.some(event=>event.action==='cancel_queue_removed'));
  await create('recovery-manual');await db.execute("UPDATE generation_tasks SET created_at='2020-01-01' WHERE id='recovery-manual'");row=await read('recovery-manual');
  await assert.rejects(actions.actOnGeneration(admin,row,{action:'resolve_no_job',note:'Provider support confirms no active job',confirmedCostUsd:0},'admin-fixture'));
  const beforeManual=await balance();await actions.actOnGeneration(admin,row,{action:'resolve_no_job',note:'Provider support reference fixture confirms no active job and zero total cost',providerConfirmedNoJob:true,confirmedCostUsd:0},'admin-fixture');row=await read(row.id);assert.equal(row.status,'failed');assert.equal(await balance(),beforeManual+10);assert.equal(row.request_settings.reconciliation_events.at(-1).actor,'admin-fixture');
  await assert.rejects(actions.actOnGeneration(admin,await read('recovery-lost'),{action:'resolve_no_job',note:'Provider support confirms no active job',providerConfirmedNoJob:true,confirmedCostUsd:0},'admin-fixture'));
  // Two different tasks cannot claim the same provider request concurrently.
  await create('recovery-binding-a');await create('recovery-binding-b');const sharedId=randomUUID();
  const bindings=await Promise.allSettled(['recovery-binding-a','recovery-binding-b'].map(async id=>submission.attachProviderTracking(await read(id),sharedId,'admin-fixture','Verified provider reference for this fixture')));
  assert.equal(bindings.filter(row=>row.status==='fulfilled').length,1);assert.equal((await db.execute('SELECT COUNT(*) AS count FROM generation_tasks WHERE provider_request_id=?',[sharedId]))[0][0].count,1);
  for(const id of ['recovery-binding-a','recovery-binding-b'])await settle(admin,owner,id,{status:'completed'});
  await create('recovery-review-race');await db.execute("UPDATE generation_tasks SET created_at='2020-01-01' WHERE id='recovery-review-race'");const stale=await read('recovery-review-race');
  await submission.attachProviderTracking(stale,randomUUID(),'admin-fixture','Tracking arrived while operator was reviewing');
  const beforeReviewRace=await balance();await assert.rejects(actions.actOnGeneration(admin,stale,{action:'resolve_no_job',note:'Provider support reference checked earlier',providerConfirmedNoJob:true,confirmedCostUsd:0},'admin-fixture'));assert.equal(await balance(),beforeReviewRace);await settle(admin,owner,stale.id,{status:'completed'});
  // The TTS result is not the parent's final video. A stranded pipeline can start
  // its unsent primary stage exactly once after the original route has timed out.
  await reserve(admin,{id:'recovery-tts',user_id:owner,mode:'video',provider:'kling-avatar-standard',prompt:'Pipeline recovery fixture',estimated_credits:10,transport:'real',request_settings:{model_id:'fal-ai/kling-video/ai-avatar/v2/standard',image_urls:['https://example.invalid/avatar.png']}});
  await submission.submitTrackedFal('fixture','elevenlabs/tts/eleven-v4-turbo',{text:'Pipeline recovery fixture'},{taskId:'recovery-tts',userId:owner,stage:'tts'});
  await db.execute("UPDATE generation_tasks SET request_settings=JSON_SET(request_settings,'$.provider_attempts.tts.startedAt','2020-01-01T00:00:00Z') WHERE id='recovery-tts'");providerStatus='COMPLETED';const beforeResume=postCalls;
  await Promise.all(Array.from({length:6},async()=>load('src/lib/fal-task-sync.ts').syncFalTask(admin,await read('recovery-tts'),'fixture')));
  row=await read('recovery-tts');assert.equal(row.status,'completed');assert.equal(postCalls,beforeResume+1,'Concurrent reconciliation resumes only the unsent video stage');assert.ok(row.request_settings.tts_step.recovered);
  // Paid and daily-free admission coordinate on the same account lock.
  const mixedUser=randomUUID();await db.execute('INSERT INTO users(id) VALUES (?)',[mixedUser]);await db.execute('INSERT INTO user_credit_accounts(user_id,balance,created_at,updated_at) VALUES (?,1000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',[mixedUser]);await db.execute("INSERT INTO credit_ledger(user_id,amount,reason,reference_id,created_at) VALUES (?,100,'signup_bonus',?,UTC_TIMESTAMP(6))",[mixedUser,'a'.repeat(64)]);
  const free=load('src/lib/h3-daily-free.ts'),mixed=await Promise.allSettled([
    free.createH3DailyFreeTask({id:'recovery-free',userId:mixedUser,prompt:'Free fixture',settings:{},mode:'video',transport:'real'},{ipHash:'b'.repeat(64),deviceHash:'c'.repeat(64)}),
    ...Array.from({length:12},(_,i)=>reserve(admin,{id:'recovery-mixed-'+i,user_id:mixedUser,mode:'video',provider:'grok-video',prompt:'Mixed admission',estimated_credits:10,transport:'real',request_settings:{}}))
  ]);
  assert.equal(mixed.filter(row=>row.status==='fulfilled'&&(row.value.allowed===true)).length,5);assert.equal((await db.execute('SELECT COUNT(*) AS count FROM generation_tasks WHERE user_id=?',[mixedUser]))[0][0].count,5,'Free and paid creation share the strict cap');
  // Execute the real POST route with a failed limiter and ensure no money or
  // provider boundary is reached, rather than testing only a pure helper.
  const route=projectLoader({'./mysql':store,'../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},'../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:owner})},'../../../lib/request-security':{consumeRateLimit:async()=>{throw new Error('Fixture limiter outage');}},'next/server':{NextResponse:Response}})('src/app/api/generate/route.ts');
  const beforeOutage=await balance(),postsBeforeOutage=postCalls;const refused=await route.POST(new Request('https://recovery-fixture.invalid/api/generate',{method:'POST',body:JSON.stringify({mode:'video',provider:'grok-video',prompt:'Limiter test',ratio:'16:9',duration:'5s',idempotencyKey:'limiter-outage-fixture'})}));assert.equal(refused.status,503);assert.equal(await balance(),beforeOutage);assert.equal(postCalls,postsBeforeOutage);
  console.log('Real MySQL recovery passed: 12 competing stage submissions create one POST, signed Ed25519/HMAC callback recovers a lost response, forged/stale/mismatched/repeated callbacks rejected or idempotent, tracking-write trigger failure retries safely, durable rejection refunds, cancellation signal versus confirmed removal, audited operator evidence, completed-task protection and actual POST fails closed on limiter outage. All provider/network responses simulated.');
 } finally {globalThis.fetch=savedFetch;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
}
