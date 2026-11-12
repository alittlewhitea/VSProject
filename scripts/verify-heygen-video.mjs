import {readStudioSource} from './studio-source.mjs';
import {generationFixtureDependency} from './generation-runtime-fixture.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
const spends=[],submissions=[],records={};
const admin={from(table){assert.equal(table,'generation_tasks');let inserted,updated,filters={};const q={select(){return q;},eq(key,value){filters[key]=value;return q;},maybeSingle:async()=>({data:records[filters.id]||null}),insert(value){inserted=value;return q;},update(value){updated=value;return q;},then(resolve){if(inserted)records[inserted.id]={...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({error:null}).then(resolve);}};return q;}};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>({id:'fixture-user'})},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:10000}),ensureCreditAccount:async()=>({balance:10000}),spendCredits:async(_a,_u,amount)=>{spends.push(amount);return {ok:true,balance:10000-amount};},refundCredits:async()=>10000},
 '../../../lib/h3-daily-free':{createH3DailyFreeTask:async()=>{throw new Error('HeyGen is not a free task');}},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{submissions.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/fixture/status'})};}}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:(generationFixtureDependency(id,overrides,load)??(id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id))),module,module.exports);return module.exports;}
const oldKey=process.env.FAL_KEY,oldFetch=globalThis.fetch,oldNow=Date.now;process.env.FAL_KEY='fixture-no-network';globalThis.fetch=async()=>{throw new Error('Unexpected network');};
try{
 const pricing=load('src/lib/model-pricing.ts');let now=pricing.HEYGEN_PROMOTION_END-1;Date.now=()=>now;
 const models=load('src/features/studio/video-models.ts');const config=models.videoModelConfig('heygen-video');
 assert.equal(config.defaultDuration,'5s');assert.equal(config.defaultResolution,'480p');
 assert.deepEqual(config.resolutions,['480p','768p','1080p','2k']);
 for(const workflow of ['text-to-video','image-to-video'])assert.equal(models.VIDEO_PROVIDERS_BY_WORKFLOW[workflow][0],'heygen-video');
 const costs=(resolution,duration='5s',time=now)=>pricing.estimateGenerationCredits({mode:'video',provider:'heygen-video',resolution,duration,pricingTime:time});
 assert.deepEqual(['480p','768p','1080p','2k'].map(r=>costs(r)),[8,9,27,27]);
 assert.deepEqual(['480p','768p','1080p','2k'].map(r=>costs(r,'5s',pricing.HEYGEN_PROMOTION_END)),[15,18,54,54]);
 assert.equal(costs('2k','15s'),81);
 const route=load('src/app/api/generate/route.ts');
 const request=(extra={})=>({headers:new Headers(),json:async()=>({mode:'video',provider:'heygen-video',videoWorkflow:'text-to-video',duration:'5s',resolution:'768p',ratio:'16:9',prompt:'A peaceful landscape.',expectedCredits:9,idempotencyKey:crypto.randomUUID(),...extra})});
 let response=await route.POST(request());assert.equal(response.status,200);assert.equal(response.body.estimatedCredits,9);assert.deepEqual(spends,[9]);
 assert.equal(submissions[0].url,'https://queue.fal.run/heygen/heygen-video/text-to-video');
 assert.deepEqual(submissions[0].input,{prompt:'A peaceful landscape.',duration:5,resolution:'768p',prompt_enhancement:'turbo',enable_safety_checker:true,aspect_ratio:'16:9'});
 response=await route.POST(request({videoWorkflow:'image-to-video',imageUrls:['https://example.invalid/start.png'],duration:'15s',resolution:'2k',ratio:'source',enableSafetyChecker:true,seed:4294967295,expectedCredits:81}));
 assert.equal(response.status,200);assert.equal(submissions.at(-1).url,'https://queue.fal.run/heygen/heygen-video/image-to-video');
 assert.deepEqual(submissions.at(-1).input,{prompt:'A peaceful landscape.',duration:15,resolution:'2k',prompt_enhancement:'turbo',enable_safety_checker:true,image_url:'https://example.invalid/start.png',seed:4294967295});
 for(const extra of [{duration:'16s'},{duration:'5junk'},{resolution:'720p'},{videoWorkflow:'image-to-video',imageUrls:[]},{videoWorkflow:'image-to-video',imageUrls:['one','two']},{ratio:'auto'},{mode:'avatar'},{seed:4294967296}]){
  response=await route.POST(request(extra));assert.equal(response.status,400,JSON.stringify(extra));
 }
 assert.deepEqual(spends,[9,81]);assert.equal(submissions.length,2);
 now=pricing.HEYGEN_PROMOTION_END;
 response=await route.POST(request({dailyFree:true}));assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,18);assert.equal(submissions.length,2);assert.deepEqual(spends,[9,81]);
 response=await route.POST(request({expectedCredits:18}));assert.equal(response.status,200);assert.deepEqual(spends,[9,81,18]);
 // Reference workflow uses the same billing and queue lifecycle, with separate video/image inputs.
 const videoUrl='https://cdn.example.test/ref.mp4?token=a,b&version=2';
 const reference=(extra={})=>request({videoWorkflow:'reference-to-video',videoUrls:[videoUrl],ratio:'adaptive',expectedCredits:18,...extra});
 response=await route.POST(reference());assert.equal(response.status,200);assert.equal(response.body.estimatedCredits,18);
 assert.equal(submissions.at(-1).url,'https://queue.fal.run/heygen/heygen-video/reference-to-video');
 assert.deepEqual(submissions.at(-1).input,{prompt:'A peaceful landscape.',duration:5,resolution:'768p',prompt_enhancement:'turbo',enable_safety_checker:true,reference_video_urls:[videoUrl],aspect_ratio:'adaptive'});
 const record=Object.values(records).at(-1);assert.equal(record.request_settings.workflow,'reference-to-video');assert.deepEqual(record.request_settings.video_urls,[videoUrl]);
 const refImages=['https://cdn.example.test/product.png','data:image/png;base64,aGVsbG8='];
 response=await route.POST(reference({imageUrls:refImages,ratio:'9:16',resolution:'2k',duration:'15s',expectedCredits:162,seed:0,enableSafetyChecker:true}));
 assert.equal(response.status,200);assert.equal(response.body.estimatedCredits,162);
 assert.deepEqual(submissions.at(-1).input,{prompt:'A peaceful landscape.',duration:15,resolution:'2k',prompt_enhancement:'turbo',enable_safety_checker:true,reference_video_urls:[videoUrl],reference_image_urls:refImages,aspect_ratio:'9:16',seed:0});
 const count=submissions.length,charged=[...spends];
 for(const extra of [{videoUrls:[]},{videoUrls:'wrong'},{videoUrls:[videoUrl,videoUrl]},{videoUrls:['javascript:alert(1)']},{videoUrls:['http://127.0.0.1/a.mp4']},{videoUrls:['https://user:password@host.test/a.mp4']},{videoUrls:['https://192.168.0.1/a.mp4']},{videoUrls:['https://[::1]/a.mp4']},{imageUrls:[...refImages,...refImages,...refImages]},{imageUrls:['data:image/gif;base64,aGVsbG8=']},{imageUrls:'wrong'},{ratio:'source'},{resolution:'720p'},{provider:'grok-video'},{mode:'image'},{duration:'16s'}]) {
  response=await route.POST(reference(extra));assert.equal(response.status,400,JSON.stringify(extra));
 }
 response=await route.POST(request({videoUrls:[videoUrl],expectedCredits:18}));assert.equal(response.status,400);
 response=await route.POST(reference({expectedCredits:9}));assert.equal(response.status,409);
 assert.deepEqual(spends,charged);assert.equal(submissions.length,count);
 delete process.env.FAL_KEY;response=await route.POST(reference());assert.equal(response.status,503);assert.deepEqual(spends,charged);
 process.env.FAL_KEY='fixture-no-network';
 const configRef=models.VIDEO_PROVIDERS_BY_WORKFLOW['reference-to-video'];assert.deepEqual(configRef,['heygen-video']);
 assert.deepEqual(models.videoModelRatios('heygen-video','reference-to-video'),['adaptive','21:9','16:9','4:3','1:1','3:4','9:16']);
 const links=load('src/features/studio/studio-video-template-link.ts');
 const linked=new URL(links.studioVideoTemplateHref({id:'template-id',videoUrl},'Keep my product.'),'https://dreamface.io');
 assert.equal(linked.searchParams.get('referenceVideo'),videoUrl);assert.equal(linked.searchParams.get('workflow'),'reference-to-video');assert.equal(linked.searchParams.get('prompt'),'Keep my product.');
 const avatarTools=load('src/lib/heygen-avatar.ts');
 const avatarRequest=(extra={})=>request({mode:'avatar',videoWorkflow:'avatar-video',imageUrls:['https://example.invalid/avatar.jpg'],ratio:'source',prompt:'Hello, welcome to our studio.',expectedCredits:18,...extra});
 response=await route.POST(avatarRequest());assert.equal(response.status,200,JSON.stringify(response));
 assert.equal(submissions.at(-1).url,'https://queue.fal.run/heygen/heygen-video/image-to-video');
 assert.deepEqual(submissions.at(-1).input,{prompt:avatarTools.heygenAvatarPrompt('Hello, welcome to our studio.'),duration:5,resolution:'768p',prompt_enhancement:'disabled',enable_safety_checker:true,image_url:'https://example.invalid/avatar.jpg'});
 const avatarRecord=Object.values(records).at(-1);assert.equal(avatarRecord.prompt,'Hello, welcome to our studio.');assert.equal(avatarRecord.request_settings.workflow,'avatar-video');assert.equal(avatarRecord.request_settings.submitted_prompt,submissions.at(-1).input.prompt);
 const avatarCount=submissions.length,avatarSpends=[...spends];
 for(const extra of [{imageUrls:[]},{imageUrls:['one','two']},{prompt:'word '.repeat(80)},{prompt:'\u4f60'.repeat(100)},{audioUrl:'https://example.invalid/speech.mp3'},{videoWorkflow:'image-to-video'},{videoUrls:['https://example.invalid/video.mp4']}]){response=await route.POST(avatarRequest(extra));assert.equal(response.status,400,JSON.stringify(extra));}
 for(const duration of ['4s','16s']){response=await route.POST(avatarRequest({duration}));assert.equal(response.status,400);}
 response=await route.POST(avatarRequest({duration:'15s',expectedCredits:18}));assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,54);
 assert.equal(submissions.length,avatarCount);assert.deepEqual(spends,avatarSpends);
 for(const [duration,credits] of [['5s',18],['10s',36],['15s',54]]) {
  response=await route.POST(avatarRequest({duration,expectedCredits:credits}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.duration,parseInt(duration,10));assert.equal(spends.at(-1),credits);
 }
 const longScript=Array.from({length:18},()=> 'hello').join(' ');
 response=await route.POST(avatarRequest({prompt:longScript,duration:'10s',expectedCredits:36}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.duration,10);
 now=pricing.HEYGEN_PROMOTION_END;
 for(const extra of [{},{videoWorkflow:'image-to-video',imageUrls:['https://example.invalid/start.png'],ratio:'source'}]){
  response=await route.POST(request({...extra,resolution:undefined,expectedCredits:15}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.resolution,'480p');assert.equal(response.body.estimatedCredits,15);
 }
 response=await route.POST(reference({resolution:undefined,expectedCredits:15}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.resolution,'480p');
 response=await route.POST(avatarRequest({resolution:undefined,expectedCredits:15}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.resolution,'480p');assert.equal(response.body.estimatedCredits,15);
 assert.equal(pricing.estimateGenerationCredits({mode:'video',provider:'heygen-video',duration:'5s'}),15);
 const client=ts.createSourceFile('studio-client.tsx',readStudioSource(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const defaultFunction=client.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='defaultVideoResolutionForProvider');
 const chooseDefault=new Function('videoModelDefaultResolution',ts.transpileModule(defaultFunction.getText(client),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return defaultVideoResolutionForProvider;')(models.videoModelDefaultResolution);
 assert.equal(chooseDefault('heygen-video','video'),'480p');assert.equal(chooseDefault('heygen-video','avatar'),'480p');
 const hdSpends=[...spends],hdSubmissions=submissions.length;
 for(const resolution of ['1080p','2k']){
  for(const ratio of ['21:9','4:3','1:1','3:4']){
   response=await route.POST(request({resolution,ratio,expectedCredits:costs(resolution)}));
   assert.equal(response.status,400);assert.equal(response.body.code,'heygen_resolution_aspect_ratio');
   response=await route.POST(reference({resolution,ratio,expectedCredits:costs(resolution)}));
   assert.equal(response.status,400);assert.equal(response.body.code,'heygen_resolution_aspect_ratio');
  }
  response=await route.POST(reference({resolution,ratio:'adaptive',expectedCredits:costs(resolution)}));
  assert.equal(response.status,400);assert.equal(response.body.code,'heygen_resolution_aspect_ratio');
  assert.deepEqual(models.videoModelRatios('heygen-video','text-to-video',resolution),['16:9','9:16']);
  assert.deepEqual(models.videoModelRatios('heygen-video','reference-to-video',resolution),['16:9','9:16']);
  assert.deepEqual(models.videoModelRatios('heygen-video','image-to-video',resolution),['source']);
 }
 assert.deepEqual(spends,hdSpends,'Invalid HD ratio combinations do not spend credits');
 assert.equal(submissions.length,hdSubmissions,'Invalid HD ratios never reach the supplier');
 for(const resolution of ['1080p','2k']) for(const ratio of ['16:9','9:16']){
  response=await route.POST(request({resolution,ratio,expectedCredits:costs(resolution)}));assert.equal(response.status,200);
  assert.equal(submissions.at(-1).input.aspect_ratio,ratio);assert.equal(submissions.at(-1).input.resolution,resolution);
  response=await route.POST(reference({resolution,ratio,expectedCredits:costs(resolution)}));assert.equal(response.status,200);
  assert.equal(submissions.at(-1).input.aspect_ratio,ratio);
 }
 const hdOptions=load('src/lib/heygen-video-options.ts');
 assert.equal(hdOptions.preferredHeygenHdRatio('3:4'),'9:16');assert.equal(hdOptions.preferredHeygenHdRatio('1:1'),'16:9');assert.equal(hdOptions.preferredHeygenHdRatio('9:16'),'9:16');
 assert.equal(hdOptions.heygenAspectRatioError('image-to-video','2k','source'),null);
 assert.ok(models.videoModelRatios('heygen-video','text-to-video','480p').includes('1:1'));
 assert.ok(models.videoModelRatios('heygen-video','reference-to-video','768p').includes('adaptive'));
 const promptTools=load('src/lib/video-prompt-enhancement.ts');
 for(const resolution of ['1080p','2k']) assert.throws(()=>promptTools.validatePromptContext({mode:'text-to-video',model:'heygen-video',prompt:'A quiet landscape.',duration:'5s',aspectRatio:'1:1',resolution}));
 const originalSpeech="Hello my love how are you doing today? How was work today I hope you have a wonderful day today I just want to know what's wrong with you but I'm really worried about you";
 const beforeSpeechSpends=[...spends],beforeSpeechSubmissions=submissions.length;
 for(const duration of ['5s','15s']){
  response=await route.POST(request({prompt:originalSpeech,duration,expectedCredits:18}));
  assert.equal(response.status,400);assert.equal(response.body.code,'video_dialogue_too_long');assert.equal(response.body.requiredSeconds,16);
 }
 assert.deepEqual(spends,beforeSpeechSpends,'Overlong dialogue is rejected before charging');
 assert.equal(submissions.length,beforeSpeechSubmissions,'Overlong dialogue never reaches the paid provider');
 const speechTools=load('src/lib/video-spoken-script.ts');
 response=await route.POST(request({prompt:'Hello, my love!',expectedCredits:18}));assert.equal(response.status,200);
 assert.equal(submissions.at(-1).input.prompt,speechTools.heygenVideoSpokenPrompt('Hello, my love!'));
 assert.equal(submissions.at(-1).input.prompt_enhancement,'disabled');assert.equal(submissions.at(-1).input.duration,5);
 assert.equal(Object.values(records).at(-1).request_settings.submitted_prompt,submissions.at(-1).input.prompt);
 for(const status of ['off','enhanced','fallback','disabled']){
  response=await route.POST(request({expectedCredits:18,promptEnhancement:{status,originalPrompt:'A peaceful landscape.',finalPrompt:'A peaceful landscape.'}}));
  assert.equal(response.status,200);assert.equal(submissions.at(-1).input.prompt_enhancement,'disabled','Website enhancement policy must not be followed by another provider rewrite');
 }
 const completePrompt='A steady natural shot. Dialogue: "Hello my love, how are you doing today?"';
 response=await route.POST(request({prompt:completePrompt,duration:'10s',expectedCredits:36}));assert.equal(response.status,200);
 assert.equal(submissions.at(-1).input.prompt,completePrompt);assert.equal(submissions.at(-1).input.prompt_enhancement,'disabled');assert.equal(submissions.at(-1).input.duration,10);
 console.log('HeyGen Video passed: existing workflows; Avatar native speech; verbatim Video dialogue and metadata; no double enhancement; overlong scripts rejected before charging or submission; explicit durations and existing pricing. No paid calls or database.');
}finally{Date.now=oldNow;globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=oldKey;}
