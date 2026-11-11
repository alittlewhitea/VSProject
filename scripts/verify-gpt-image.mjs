import {generationFixtureDependency} from './generation-runtime-fixture.mjs';
﻿import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map(),spends=[],submissions=[],records={};let authenticated=true;
const admin={from(table){assert.equal(table,'generation_tasks');let inserted,updated,filters={};const q={select(){return q;},eq(key,value){filters[key]=value;return q;},in(key,value){filters[key]=value;return q;},maybeSingle:async()=>{const row=records[filters.id];return {data:row&&(!filters.user_id||(Array.isArray(filters.user_id)?filters.user_id.includes(row.user_id):filters.user_id===row.user_id))?row:null};},insert(value){inserted=value;return q;},update(value){updated=value;return q;},then(resolve){if(inserted)records[inserted.id]={...inserted};if(updated&&records[filters.id])Object.assign(records[filters.id],updated);return Promise.resolve({error:null}).then(resolve);}};return q;}};
const auth={getUserFromBearerToken:async()=>authenticated?{id:'fixture-user'}:null,getSessionFromToken:async()=>authenticated?{user:{id:'fixture-user'}}:null,getUserIdsForAuthUser:async()=>['fixture-user'],SESSION_COOKIE_NAME:'fixture-session'};
const overrides={
 'next/server':{NextResponse:{json:(body,options={})=>({status:options.status||200,body})}},'next/headers':{cookies:async()=>({get:()=>({value:'fixture-session'})})},
 '../../../lib/server-auth':auth,'../../../../lib/server-auth':auth,
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},'../../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/credits':{ensureSignupCreditAccount:async()=>({balance:100000}),ensureCreditAccount:async()=>({balance:100000}),spendCredits:async(_a,_u,amount)=>{spends.push(amount);return {ok:true,balance:100000-amount};},refundCredits:async()=>100000},
 '../../../lib/fal-pricing':{estimateGenerationCreditsWithLivePricing:async input=>load('src/lib/model-pricing.ts').estimateGenerationCredits(input)},
 '../../../lib/fal-fetch':{fetchFal:async(url,options)=>{submissions.push({url,input:JSON.parse(options.body)});return {ok:true,json:async()=>({request_id:'fixture-request',status:'IN_QUEUE',status_url:'https://queue.fal.run/fixture/status'})};}}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id in overrides?overrides[id]:(generationFixtureDependency(id,overrides,load)??(id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id))),module,module.exports);return module.exports;}
const oldKey=process.env.FAL_KEY,oldFetch=globalThis.fetch;process.env.FAL_KEY='fixture-no-network';globalThis.fetch=async()=>{throw new Error('Unexpected network');};
try {
 const models=load('src/lib/gpt-image-models.ts'),pricing=load('src/lib/model-pricing.ts'),route=load('src/app/api/generate/route.ts');
 const ref='https://fixture.invalid/reference.png',mask='https://fixture.invalid/mask.png';
 const request=(extra={})=>({headers:new Headers(),json:async()=>({mode:'image',provider:'chatgpt-image',imageWorkflow:'text-to-image',ratio:'4:3',duration:'5s',prompt:'A minimal product photograph.',idempotencyKey:crypto.randomUUID(),...extra})});
 for(const provider of ['chatgpt-image','gpt-image-2.6-sunburst','gpt-image-2.5-sunburst'])for(const edit of [false,true]) {
  const response=await route.POST(request({provider,...(edit?{imageWorkflow:'image-to-image',imageUrls:[ref]}:{})}));assert.equal(response.status,200,JSON.stringify(response));
  assert.equal(submissions.at(-1).url,`https://queue.fal.run/openai/gpt-image-2.6/${provider==='chatgpt-image'?'flare':'sunburst'}/${edit?'edit':'text-to-image'}`);
  assert.deepEqual(submissions.at(-1).input,{prompt:'A minimal product photograph.',image_size:{width:1024,height:768},quality:'low',background:'auto',reasoning_effort:'low',num_images:1,output_format:'png',enable_safety_checker:true,...(edit?{image_urls:[ref]}:{})});
 }
 for(const quality of models.GPT_IMAGE_QUALITIES){const response=await route.POST(request({quality}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.quality,quality);}
 let response=await route.POST(request({imageSize:'custom',imageWidth:2048,imageHeight:1536,quality:'max',imageReasoningEffort:'high',background:'opaque',numImages:10,outputFormat:'webp',outputCompression:0,enableSafetyChecker:false}));assert.equal(response.status,200);
 assert.deepEqual(submissions.at(-1).input,{prompt:'A minimal product photograph.',image_size:{width:2048,height:1536},quality:'max',background:'opaque',reasoning_effort:'high',num_images:10,output_format:'webp',output_compression:0,enable_safety_checker:true});
 response=await route.POST(request({imageSize:'auto',outputFormat:'gif',frameCount:16,frameDurationMs:205}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.frame_duration_ms,210);assert.equal(submissions.at(-1).input.frame_count,16);assert.equal(submissions.at(-1).input.image_size,'auto');
 for(const svgModel of models.GPT_IMAGE_SVG_MODELS){response=await route.POST(request({outputFormat:'svg',svgModel}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.svg_model,svgModel);}
 for(const guide of [{maskUrl:mask},{markupImageUrl:mask}]){response=await route.POST(request({imageWorkflow:'image-to-image',imageUrls:Array(16).fill(ref),...guide}));assert.equal(response.status,200);assert.equal(submissions.at(-1).input.image_urls.length,16);assert.equal(submissions.at(-1).input[guide.maskUrl?'mask_url':'markup_image_url'],mask);const row=Object.values(records).at(-1);assert.equal(row.request_settings[guide.maskUrl?'mask_url':'markup_image_url'],mask);}
 const charged=[...spends],submitted=submissions.length;
 response=await route.POST(request({prompt:'x'.repeat(32001)}));assert.equal(response.status,400);assert.equal(response.body.code,'studio.gpt26.errorPrompt');
 for(const invalid of [{mode:'video'},{imageWorkflow:'background-remove'},{imageWorkflow:'image-to-image',imageUrls:[]},{imageUrls:Array(17).fill(ref)},{imageUrls:['']},{imageUrls:'wrong'},{imageSize:'custom',imageWidth:1001,imageHeight:768},{imageSize:'custom',imageWidth:3840,imageHeight:3840},{imageSize:'custom',imageWidth:3840,imageHeight:640},{imageSize:'custom',imageWidth:256,imageHeight:256},{imageSize:'wrong'},{quality:'ultra'},{quality:0},{background:'wrong'},{background:'transparent',outputFormat:'jpeg'},{imageReasoningEffort:'max'},{numImages:0},{numImages:11},{numImages:1.5},{outputFormat:'bmp'},{outputFormat:'svg',numImages:2},{imageUrls:[ref],outputFormat:'svg'},{outputCompression:80},{outputFormat:'jpeg',outputCompression:101},{outputFormat:'gif',frameCount:17},{outputFormat:'gif',frameDurationMs:10},{frameCount:9},{svgModel:'gpt-6-astra'},{outputFormat:'svg',svgModel:'wrong'},{maskUrl:mask},{imageUrls:[ref],maskUrl:mask,markupImageUrl:mask},{imageUrls:[ref],markupImageUrl:0},{imageUrls:[ref],maskUrl:'javascript:alert(1)'},{imageUrls:[ref],markupImageUrl:'data:image/jpeg;base64,xxx'},{enableSafetyChecker:'false'}]) {
  response=await route.POST(request(invalid));assert.equal(response.status,400,JSON.stringify({invalid,response}));
 }
 response=await route.POST(request({expectedCredits:99999}));assert.equal(response.status,409);assert.equal(response.body.code,'generation_price_changed');
 authenticated=false;response=await route.POST(request());assert.equal(response.status,401);authenticated=true;
 delete process.env.FAL_KEY;response=await route.POST(request());assert.equal(response.status,503);process.env.FAL_KEY='fixture-no-network';
 assert.deepEqual(spends,charged);assert.equal(submissions.length,submitted);
 for(const provider of ['chatgpt-image','gpt-image-2.6-sunburst']) {
  const before=spends.length, beforeSubmissions=submissions.length;
  response=await route.POST(request({provider,expectedCredits:1}));
  assert.equal(response.status,409);assert.equal(response.body.estimatedCredits,6);
  assert.equal(spends.length,before);assert.equal(submissions.length,beforeSubmissions);
  response=await route.POST(request({provider,expectedCredits:6}));
  assert.equal(response.status,200);assert.equal(spends.length,before+1);assert.equal(spends.at(-1),6);
 }
 for(const size of models.GPT_IMAGE_SIZES)assert.equal(models.gptImageOptionError({imageSize:size.value}),null);
 assert.equal(models.gptImageOptionError({imageSize:'custom',imageWidth:3840,imageHeight:2160}),null);
 for(const provider of ['chatgpt-image','gpt-image-2.6-sunburst']) {
  const base={mode:'image',provider,quality:'low',promptText:'Product shot.'};let previous=0;
  assert.equal(pricing.estimateGenerationCredits({...base,promptText:'  Product shot.  '}),pricing.estimateGenerationCredits(base));
  for(const quality of ['low','medium','high','xhigh','max']){const credits=pricing.estimateGenerationCredits({...base,quality});assert.ok(credits>previous,quality);previous=credits;assert.equal(pricing.estimateGenerationCredits({...base,quality,numImages:10}),credits*10);}
  const low=pricing.estimateGenerationCredits(base);for(const extra of [{outputFormat:'gif',frameCount:16},{outputFormat:'svg'},{imageSize:'custom',imageWidth:3840,imageHeight:2160},{imageReasoningEffort:'high'},{hasReferences:true,referenceCount:16}])assert.ok(pricing.estimateGenerationCredits({...base,...extra})>low);
 }
 assert.equal(pricing.MODEL_PRICING_ROWS.filter(row=>models.isGptImageProvider(row.provider)).length,4);
 const download=load('src/app/api/generate/download/route.ts'),id='tsk_fixture_download',urls=Array.from({length:10},(_,index)=>`https://fixture.invalid/output-${index}.${index===9?'svg':'gif'}`);
 records[id]={id,user_id:'fixture-user',output_url:urls[0],raw_result:{images:urls.map(url=>({url}))}};
 const downloads=[];globalThis.fetch=async url=>{downloads.push(url);return new Response('fixture',{headers:{'Content-Type':String(url).endsWith('.svg')?'image/svg+xml':'image/gif'}});};
 for(const index of [0,1,9]){response=await download.GET(new Request(`https://dreamface.io/api/generate/download?taskId=${id}&index=${index}&name=output`));assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),index===9?/output\.svg/:/output\.gif/);await response.text();assert.equal(downloads.at(-1),urls[index]);}
 const downloaded=downloads.length;
 response=await download.GET(new Request(`https://dreamface.io/api/generate/download?taskId=${id}&index=10`));assert.equal(response.status,400);
 records[id].user_id='someone-else';response=await download.GET(new Request(`https://dreamface.io/api/generate/download?taskId=${id}&index=9`));assert.equal(response.status,404);assert.equal(downloads.length,downloaded);
 console.log(`GPT Image 2.6 passed: ${submitted} POST-path fixtures, all endpoints/options, migration, validation before spending, quote/auth/config guards, estimates, owner-only GIF/SVG downloads. No paid API or database calls.`);
} finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=oldKey;}
