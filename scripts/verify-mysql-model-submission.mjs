import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {projectLoader} from './load-project-ts.mjs';

// Called only by the loopback-only, generated-database integration runner.
// Keep the real route, admission, debit/refund, durable submission and tracking.
// Authentication, pricing lookup and all supplier HTTP responses are fixtures.
export async function verifyMysqlModelSubmission({db,admin,store}) {
  const owner=randomUUID();
  await db.execute('INSERT INTO users(id) VALUES (?)',[owner]);
  await db.execute('INSERT INTO user_credit_accounts(user_id,balance,created_at,updated_at) VALUES (?,1000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',[owner]);
  const savedFetch=globalThis.fetch,savedKey=process.env.FAL_KEY,savedNow=Date.now;
  let actor=owner;
  process.env.FAL_KEY='fixture-no-network';
  globalThis.fetch=async()=>{throw new Error('Unexpected network access in model submission fixture');};
  const balance=async()=>Number((await db.execute('SELECT balance FROM user_credit_accounts WHERE user_id=?',[actor]))[0][0].balance);
  const posts=[];let outcome='accept';
  const provider={fetchFal:async(url,options={})=>{
    if(options.method==='POST') {
      posts.push({url,input:JSON.parse(options.body)});
      if(outcome==='lost')throw new Error('Fixture response lost after possible acceptance');
      if(outcome==='reject')return Response.json({detail:'Fixture rejected',error_type:'validation_error'},{status:422});
      return Response.json({request_id:randomUUID(),status:'IN_QUEUE'});
    }
    assert.match(url,/^https:\/\/queue\.fal\.run\/elevenlabs\/tts\/requests\//);
    return Response.json({audio:{url:'https://example.invalid/voice.wav'}});
  }};
  const load=projectLoader({
    './mysql':store,
    'next/server':{NextResponse:Response},
    '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:actor})},
    '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
    '../../../lib/request-security':{consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})},
    '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:await balance()}),ensureCreditAccount:async()=>({balance:await balance()})},
    '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>input.provider===load('src/lib/heygen-voice.ts').HEYGEN_VOICE_PROVIDER?load('src/lib/model-pricing.ts').estimateGenerationCredits(input):1},
    './site-url':{siteUrl:()=> 'http://localhost:3000'},
    './fal-fetch':provider,
    '../../../lib/fal-fetch':provider
  });
  try {
    const voice=load('src/lib/heygen-voice.ts');let clock=voice.HEYGEN_VOICE_FREE_END-1;Date.now=()=>clock;
    const route=load('src/app/api/generate/route.ts');
    const settle=load('src/lib/generation-task-settlement.ts').settleGenerationTask;
    const meta=load('src/features/studio/studio-workspace-config.ts');
    const videos=load('src/features/studio/video-models.ts');
    const send=body=>route.POST(new Request('http://localhost:3000/api/generate',{method:'POST',body:JSON.stringify(body)}));
    const read=async id=>(await admin.from('generation_tasks').select('*').eq('id',id).maybeSingle()).data;
    const cases=[];
    for(const [workflow,config] of Object.entries(meta.WORKFLOW_META))for(const provider of config.providers) {
      const mode=workflow==='avatar-video'?'avatar':workflow.includes('video')?'video':workflow.includes('image')||workflow==='enhance-cleanup'||workflow==='background-remove'?'image':'audio';
      const resolution=mode==='image'?'1K':mode==='video'||mode==='avatar'?videos.videoModelDefaultResolution(provider):undefined;
      cases.push({mode,provider,prompt:mode==='avatar'||mode==='audio'?'Hello from DreamFace.':'A blue ceramic cup on a wooden desk.',
        duration:mode==='video'?videos.videoModelDefaultDuration(provider):'5s',resolution,
        ratio:mode==='video'?videos.videoModelRatios(provider,workflow,resolution)[0]:mode==='avatar'?'source':'auto',
        ...(mode==='image'?{imageWorkflow:workflow,imageSize:'default_4_3',quality:'low'}:mode==='audio'?{audioWorkflow:workflow,isInstrumental:true}:{videoWorkflow:workflow}),
        ...((mode==='image'&&workflow!=='text-to-image')||workflow==='image-to-video'||mode==='avatar'?{imageUrls:['https://example.invalid/input.png']}:{ }),
        ...(workflow==='reference-to-video'?{videoUrls:['https://example.invalid/reference.mp4']}:{ }),
        expectedCredits:provider===voice.HEYGEN_VOICE_PROVIDER?0:1,idempotencyKey:randomUUID()});
    }
    for(const resolution of ['2K','4K'])for(const workflow of ['text-to-image','image-to-image']) {
      cases.push({...cases.find(body=>body.provider==='nano-banana-image'&&body.imageWorkflow===workflow),resolution,idempotencyKey:randomUUID()});
    }
    for(const body of cases) {
      const label=body.provider+' / '+(body.imageWorkflow||body.videoWorkflow||body.audioWorkflow)+' / '+body.resolution;
      const before=await balance(),beforePosts=posts.length;
      const response=await send(body),payload=await response.json();
      assert.equal(response.status,200,label+': '+JSON.stringify(payload));
      const expectedPosts=body.mode==='avatar'&&body.provider.startsWith('kling-avatar-')?2:1;
      assert.equal(posts.length-beforePosts,expectedPosts,label);
      const task=await read(payload.taskId);
      assert.equal(task.request_settings.provider_attempts.primary.state,'accepted',label);
      assert.equal(task.provider_request_id,payload.providerRequestId,label);
      assert.equal(await balance(),before-body.expectedCredits,label+' uses the quoted credits once by real admission');
      const again=await send(body),replayed=await again.json();
      assert.equal(replayed.duplicate,true,label+' reopens the same task');
      assert.equal(replayed.taskId,payload.taskId,label);
      assert.equal(posts.length-beforePosts,expectedPosts,label+' does not resubmit');
      assert.equal(await balance(),before-body.expectedCredits,label+' does not charge again');
      await settle(admin,owner,task.id,{status:'completed'});
    }
    const nano={...cases.find(body=>body.provider==='nano-banana-image'&&body.imageWorkflow==='text-to-image'),idempotencyKey:randomUUID()};
    outcome='reject';let before=await balance(),beforePosts=posts.length;
    let response=await send(nano),payload=await response.json();
    assert.equal(response.status,422);assert.equal(payload.refundedCredits,1);assert.equal(await balance(),before);
    const rejected=await read('tsk_'+nano.idempotencyKey);assert.equal(rejected.status,'failed');
    response=await send(nano);assert.equal((await response.json()).duplicate,true);
    assert.equal(posts.length,beforePosts+1);assert.equal(await balance(),before,'A repeated rejection cannot refund twice');
    outcome='lost';const uncertain={...nano,idempotencyKey:randomUUID()};before=await balance();beforePosts=posts.length;
    response=await send(uncertain);payload=await response.json();assert.equal(response.status,202);
    assert.equal(payload.failureCode,'provider_submission_unknown');
    assert.equal((await read(payload.taskId)).request_settings.provider_attempts.primary.state,'unknown');
    response=await send(uncertain);assert.equal((await response.json()).duplicate,true);
    assert.equal(posts.length,beforePosts+1);assert.equal(await balance(),before-1,'Uncertain acceptance stays pending without another POST or premature refund');
    const freeOwner=randomUUID();actor=freeOwner;outcome='accept';
    await db.execute('INSERT INTO users(id) VALUES (?)',[freeOwner]);await db.execute('INSERT INTO user_credit_accounts(user_id,balance,created_at,updated_at) VALUES (?,0,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',[freeOwner]);
    const freeBody=()=>({...cases.find(body=>body.provider===voice.HEYGEN_VOICE_PROVIDER),idempotencyKey:randomUUID()});
    const firstFree=freeBody();beforePosts=posts.length;
    response=await send(firstFree);payload=await response.json();assert.equal(response.status,200);assert.equal(payload.estimatedCredits,0);assert.equal(await balance(),0);
    assert.equal((await send(firstFree)).status,200);assert.equal(posts.length,beforePosts+1,'Free replay does not create a second provider job');
    clock=voice.HEYGEN_VOICE_FREE_END;
    await settle(admin,freeOwner,payload.taskId,{status:'failed'},9999);
    assert.equal(await balance(),0,'A free task settling after the promotion cannot mint a refund');
    clock=voice.HEYGEN_VOICE_FREE_END-1;
    const parallel=await Promise.all(Array.from({length:12},()=>send(freeBody())));
    assert.equal(parallel.filter(response=>response.status===200).length,5,'Free jobs use the same strict concurrent admission cap');
    assert.equal(parallel.filter(response=>response.status===429).length,7);assert.equal(await balance(),0);
    for(const response of parallel.filter(response=>response.status===200))await settle(admin,freeOwner,(await response.json()).taskId,{status:'failed'},9999);
    const [freeLedger]=await db.execute('SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id=? AND amount<>0',[freeOwner]);assert.equal(Number(freeLedger[0].count),0,'Neither free admission nor oversized refund requests change any credits');
    clock=voice.HEYGEN_VOICE_FREE_END;beforePosts=posts.length;
    response=await send(freeBody());payload=await response.json();assert.equal(response.status,409);assert.equal(payload.code,'generation_price_changed');assert.equal(payload.estimatedCredits,1);assert.equal(posts.length,beforePosts);
    await db.execute('UPDATE user_credit_accounts SET balance=100 WHERE user_id=?',[freeOwner]);
    response=await send({...freeBody(),expectedCredits:1});assert.equal(response.status,200);assert.equal(await balance(),99,'After the cutoff, an explicitly accepted paid quote is charged once');
    console.log(`Real MySQL model submission passed: all ${cases.length} current Studio model/workflow cases, Nano 1K/2K/4K text/edit, real POST route/admission/debit/tracking, idempotent replay, rejection/refund once, lost-acceptance protection, HeyGen zero-balance/free-ledger safety, 12-way free admission capped at five, oversized refund cap and explicit UTC+8 expiry. All supplier HTTP responses mocked; no paid requests.`);
  } finally {
    globalThis.fetch=savedFetch;
    Date.now=savedNow;
    if(savedKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=savedKey;
  }
}
