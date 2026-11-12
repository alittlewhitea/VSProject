import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
import {generationFixtureDependency} from './generation-runtime-fixture.mjs';
import {settlementRpcFixture} from './generation-settlement-fixture.mjs';

const native=createRequire(import.meta.url),cache=new Map(),records={},spends=[],submissions=[],refunds=[];
let balance=0,authenticated=true,reject=false;
const admin={rpc:settlementRpcFixture(records,amount=>refunds.push(amount)),from(table){
  assert.equal(table,'generation_tasks');let insert,update;const filters={};
  const q={select(){return q;},eq(key,value){filters[key]=value;return q;},maybeSingle:async()=>({data:Object.values(records).find(row=>Object.entries(filters).every(([key,value])=>row[key]===value))||null,error:null}),insert(value){insert=value;return q;},update(value){update=value;return q;},then(done){if(insert)records[insert.id]={...insert};if(update&&records[filters.id])Object.assign(records[filters.id],update);return Promise.resolve({error:null}).then(done);}};return q;
}};
const overrides={
  'next/server':{NextResponse:Response},
  '../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'voice-fixture'}:null},
  '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
  '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance}),ensureCreditAccount:async()=>({balance}),spendCredits:async(_admin,_user,amount)=>{spends.push(amount);return {ok:true,balance:balance-amount};},refundCredits:async(_admin,_user,amount)=>{refunds.push(amount);return balance;}},
  '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
  '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{
    assert.equal(options.method,'POST');submissions.push({url,input:JSON.parse(options.body)});
    if(reject)return Response.json({detail:'Fixture validation failed',error_type:'validation_error'},{status:422});
    return Response.json({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/heygen/heygen-voice/requests/fixture-request/status'});
  }}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:(generationFixtureDependency(id,overrides,load)??(id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id))),module,module.exports);return module.exports;}
const saved={fetch:globalThis.fetch,now:Date.now,key:process.env.FAL_KEY};
const speech=load('src/lib/heygen-voice.ts'),end=speech.HEYGEN_VOICE_FREE_END;
let clock=end-1;Date.now=()=>clock;process.env.FAL_KEY='fixture-no-network';
globalThis.fetch=async()=>{throw new Error('Unexpected real network access');};
try{
  assert.equal(new Date(end).toISOString(),'2026-11-30T16:00:00.000Z');
  assert.equal(speech.isHeygenVoiceFree(end-1),true);assert.equal(speech.isHeygenVoiceFree(end),false);assert.equal(speech.isHeygenVoiceFree(NaN),false);
  assert.equal(speech.HEYGEN_VOICES.length,24);assert.equal(speech.HEYGEN_VOICE_LANGUAGES.length,39);
  assert.equal(speech.heygenVoiceCharacters('😀中文'),3);
  const defaults=speech.newHeygenVoiceOptions(),pricing=load('src/lib/model-pricing.ts'),provider=speech.HEYGEN_VOICE_PROVIDER;
  for(const count of [0,1,1000,5000]){
    const input={mode:'audio',provider,promptText:'x'.repeat(count)};
    assert.equal(pricing.estimateGenerationCredits(input),0,'Promotion bypasses the ordinary minimum-one-credit floor');
    assert.equal(pricing.estimateGenerationCredits({...input,falUnitPriceUsd:999,falUnit:'1000 characters'}),0,'Supplier prices cannot override the customer promotion');
  }
  assert.equal(pricing.estimateGenerationCostUsd({mode:'audio',provider,promptText:'x'.repeat(1000)}),0.004,'Supplier expense remains non-zero');
  assert.equal(await load('src/lib/fal-pricing.ts').estimateGenerationCreditsWithLivePricing({mode:'audio',provider,promptText:'Hello'}),0,'Free quotes do not depend on supplier pricing HTTP availability');
  assert.equal(pricing.estimateGenerationCredits({mode:'audio',provider:'elevenlabs-tts',promptText:'x'.repeat(1000)}),6,'Other speech models retain their normal price');
  const route=load('src/app/api/generate/route.ts');
  const body=extra=>({mode:'audio',audioWorkflow:'text-to-audio',provider,prompt:'Have a wonderful day!',ratio:'16:9',duration:'single',expectedCredits:0,idempotencyKey:crypto.randomUUID(),...extra});
  const send=payload=>route.POST(new Request('https://site.invalid/api/generate',{method:'POST',body:JSON.stringify(payload)}));
  for(const voice of speech.HEYGEN_VOICES){
    const response=await send(body({heygenVoice:{...defaults,voice}})),payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));assert.equal(payload.estimatedCredits,0);assert.equal(payload.balance,0);
    assert.deepEqual(submissions.at(-1),{url:'https://queue.fal.run/heygen/heygen-voice/turbo',input:{text:'Have a wonderful day!',voice,expressiveness_boost:1,enable_safety_checker:true}});
    assert.equal(records[payload.taskId].request_settings.output_format,'wav');
    assert.equal(records[payload.taskId].request_settings.credit_promotion.ends_at,new Date(end).toISOString());
  }
  for(const language of speech.HEYGEN_VOICE_LANGUAGES){
    const response=await send(body({heygenVoice:{...defaults,language,expressivenessBoost:0},enableSafetyChecker:false}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.language,language);assert.equal(submissions.at(-1).input.expressiveness_boost,0);assert.equal(submissions.at(-1).input.enable_safety_checker,true);
  }
  let response=await send(body({heygenVoice:{...defaults,referenceAudioUrl:'https://example.invalid/reference.wav',language:'zh',voice:'Ignored legacy voice',expressivenessBoost:0.35}}));
  assert.equal(response.status,200);assert.deepEqual(submissions.at(-1).input,{text:'Have a wonderful day!',reference_audio_url:'https://example.invalid/reference.wav',language:'zh',expressiveness_boost:0.35,enable_safety_checker:true});
  assert.equal(spends.length,0,'A zero-balance account can generate without invoking the debit boundary');
  const before=submissions.length;
  for(const extra of [{mode:'video'},{mode:'avatar'},{mode:'image'},{audioWorkflow:'text-to-music'},{prompt:''},{prompt:'x'.repeat(5001)},{heygenVoice:null},{heygenVoice:[]},{heygenVoice:{voice:'Rachel'}},{heygenVoice:{language:'xx'}},{heygenVoice:{expressivenessBoost:1.1}},{heygenVoice:{expressivenessBoost:-0.1}},{heygenVoice:{expressivenessBoost:'1'}},{heygenVoice:{referenceAudioUrl:'data:audio/wav;base64,abc'}},{heygenVoice:{referenceAudioUrl:'http://127.0.0.1/a.wav'}},{heygenVoice:{referenceAudioUrl:'https://user:password@example.invalid/a.wav'}},{imageUrls:['https://example.invalid/image.png']},{videoUrls:['https://example.invalid/video.mp4']},{audioUrl:'https://example.invalid/audio.wav'},{dailyFree:true}]){
    const invalid=await send(body(extra));assert.equal(invalid.status,400,JSON.stringify(extra).slice(0,120));
  }
  assert.equal(submissions.length,before);assert.equal(spends.length,0);
  authenticated=false;assert.equal((await send(body({}))).status,401);authenticated=true;
  delete process.env.FAL_KEY;assert.equal((await send(body({}))).status,503);process.env.FAL_KEY='fixture-no-network';
  const duplicate=body({});await send(duplicate);const calls=submissions.length;response=await send(duplicate);assert.equal((await response.json()).duplicate,true);assert.equal(submissions.length,calls);
  reject=true;response=await send(body({}));assert.equal(response.status,422);assert.equal((await response.json()).refundedCredits,0);assert.equal(refunds.length,0,'Failed free jobs cannot mint refund credits');reject=false;
  clock=end;
  for(const [characters,credits]of [[1,1],[1000,1],[2000,2],[5000,3]])assert.equal(pricing.estimateGenerationCredits({mode:'audio',provider,promptText:'x'.repeat(characters)}),credits);
  const expiredBefore=submissions.length;balance=100;
  response=await send(body({pricingTime:end-1,free:true}));let payload=await response.json();assert.equal(response.status,409);assert.equal(payload.code,'generation_price_changed');assert.equal(payload.estimatedCredits,1);assert.equal(submissions.length,expiredBefore);assert.equal(spends.length,0,'An old zero-credit quote is rejected before debit');
  response=await send(body({expectedCredits:1}));payload=await response.json();assert.equal(response.status,200);assert.equal(payload.estimatedCredits,1);assert.deepEqual(spends,[1]);
  for(const locale of ['en','zh-CN','zh-TW','pt-BR','ru','vi','de','fr','ja','th','nl','he','ko','es','it','ar']){
    const messages=load('src/lib/studio-message-catalog.ts').resolveStudioMessages(locale);
    assert.ok(messages['studio.heygenVoice.freeNotice']);assert.ok(messages['studio.heygenVoice.expired']);
  }
  console.log('HeyGen Voice passed: 24 voices, 39 languages, exact text/library/cloning inputs, safe settings, 5,000-character app bound, real supplier expense, 0-credit zero-balance admission, no free-job refund minting, idempotency, explicit UTC+8 cutoff and rejected expired/forged quotes before debit. All database/provider/payment responses mocked.');
}finally{globalThis.fetch=saved.fetch;Date.now=saved.now;if(saved.key===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=saved.key;}
