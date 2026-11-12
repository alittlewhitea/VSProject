// Local :3000 and owned Chrome CDP :9353. Business/provider/auth APIs are
// fixtures. Browser time travels across the UTC+8 promotion boundary.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='http://127.0.0.1:3000',output='outputs/heygen-voice';
const end=Date.parse('2026-12-01T00:00:00+08:00'),initial=end-5000;
const href=origin+'/studio?mode=audio&workflow=text-to-audio&provider=heygen-voice-turbo';
const tab=await(await fetch('http://127.0.0.1:9353/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),errors=[],generated=[];let sequence=0,authenticated=true,balance=0,clock=initial;
const session={access_token:'cookie:voice-ui-fixture',expires_at:'2099-01-01',user:{id:'qa-voice-user',email:'fixture@example.invalid'}};
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}return;}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(arg=>arg.value??arg.description??'').join(' '));
  if(message.method!=='Fetch.requestPaused')return;
  const {requestId,request}=message.params,url=new URL(request.url);let body={},status=200;
  if(url.origin!==origin){body='';status=204;}
  else if(url.pathname==='/api/auth/session')body={session:authenticated?session:null};
  else if(url.pathname==='/api/credits')body={balance,ledger:[],purchases:[],subscriptions:[]};
  else if(url.pathname==='/api/tasks')body={tasks:[]};
  else if(url.pathname==='/api/model-pricing')body={rows:[]};
  else if(url.pathname==='/api/referrals/availability')body={visible:false};
  else if(url.pathname==='/api/generate'){
    const payload=JSON.parse(request.postData);generated.push(payload);
    if(clock>=end&&payload.expectedCredits===0){status=409;body={code:'generation_price_changed',error:'Review the new price.',estimatedCredits:1,pricingTime:clock};}
    else body={taskId:'qa-voice-'+generated.length,status:'queued',transport:'real',provider:'heygen-voice-turbo',mode:'audio',estimatedCredits:payload.expectedCredits,balance,statusUrl:'https://queue.fal.run/heygen/heygen-voice/requests/qa/status',responseUrl:'https://queue.fal.run/heygen/heygen-voice/requests/qa'};
  } else if(url.pathname==='/api/generate/status')body={status:'COMPLETED',balance,outputUrl:'https://example.invalid/speech.wav',url:'https://example.invalid/speech.wav',result:{audio:{url:'https://example.invalid/speech.wav'}}};
  void send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>errors.push(error.message));
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let n=0;n<220;n++){if(await evaluate(expression))return;await pause(125);}throw new Error('UI timeout: '+expression);}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function value(selector,value,event='input'){await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
async function setClock(value){clock=value;await evaluate(`localStorage.setItem('qa_voice_clock',${JSON.stringify(String(value))});window.__voiceNow=${value};window.dispatchEvent(new Event('focus'));`);}
async function ready(){await until("Object.keys(document.querySelector('[data-heygen-voice]')||{}).some(key=>key.startsWith('__reactProps'))");await until("document.documentElement.lang==='en'");await until(`document.querySelector('[data-signed-in]')?.dataset.signedIn===${JSON.stringify(String(authenticated))}`);}
async function shot(name){await evaluate('document.fonts.ready');const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${output}/${name}.png`,Buffer.from(result.data,'base64'));}
async function noOverflow(){assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await evaluate("[...document.querySelectorAll('[data-heygen-voice],[data-heygen-language],[data-heygen-reference],[data-composer-prompt]')].every(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})"),true,'Voice controls fit the viewport');}
try{
  mkdirSync(output,{recursive:true});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'https://*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{window.__voiceNow=Number(localStorage.getItem('qa_voice_clock'))||${initial};const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){if(args.length)super(...args);else super(window.__voiceNow);}static now(){return window.__voiceNow;}};localStorage.setItem('dreamface_locale','en');window.addEventListener('dreamface-open-auth',event=>window.__voiceSignIn=event.detail);}catch{}`});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:href});await ready();
  assert.equal(await evaluate("document.querySelectorAll('[data-heygen-voice] option').length"),24);assert.equal(await evaluate("document.querySelectorAll('[data-heygen-language] option').length"),40);
  assert.equal(await evaluate("document.querySelector('[data-heygen-voice]').value"),'Jonah');await until("!!document.querySelector('[data-heygen-voice-free]')");
  assert.equal(await evaluate("document.querySelector('[data-composer-prompt]').maxLength"),5000);
  await value('[data-composer-prompt]','Have a wonderful day!');await value('[data-heygen-voice]','Nadine','change');await value('[data-heygen-language]','zh','change');
  await click('[data-audio-advanced-trigger]');await value('[data-heygen-expression]','0.35');await noOverflow();await shot('desktop');
  assert.match(await evaluate("document.querySelector('.df-composer-quote').innerText"),/^0 credits/);
  await click('.df-composer-generate');await until('location.search.includes("view=projects")');
  assert.equal(generated.length,1);assert.equal(generated[0].expectedCredits,0);assert.deepEqual(generated[0].heygenVoice,{voice:'Nadine',language:'zh',expressivenessBoost:0.35,referenceAudioUrl:''});
  for(const width of [390,320]){
    await setClock(initial);await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:href});await ready();
    await value('[data-composer-prompt]','Hello from the voice studio.');await click('[data-audio-advanced-trigger]');
    await value('[data-heygen-reference]','data:audio/wav;base64,invalid');await until("!!document.querySelector('.df-audio-settings [role=alert]')");assert.equal(await evaluate("document.querySelector('.df-composer-generate').disabled"),true);
    await value('[data-heygen-reference]','https://example.invalid/reference.wav');await until("!document.querySelector('.df-composer-generate').disabled");assert.equal(await evaluate("document.querySelector('[data-heygen-voice]').disabled"),true);
    await noOverflow();await shot('mobile-'+width);
  }
  await click('.df-composer-generate');await until('location.search.includes("view=projects")');assert.equal(generated.at(-1).heygenVoice.referenceAudioUrl,'https://example.invalid/reference.wav');assert.equal(generated.at(-1).expectedCredits,0);
  await setClock(initial);await send('Page.navigate',{url:href});await ready();await value('[data-composer-prompt]','A short spoken message.');
  await setClock(end);await until("!document.querySelector('[data-heygen-voice-free]')&&document.querySelector('.df-composer-quote').innerText.startsWith('1 credits')");
  const beforePaid=generated.length;await click('.df-composer-generate');await until("!!document.querySelector('[aria-labelledby=credit-shop-title]')");assert.equal(generated.length,beforePaid,'A zero-balance user is not sent to a paid generation');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  // A free click cannot silently become a paid automatic submission after popup sign-in.
  authenticated=false;await setClock(initial);await send('Page.navigate',{url:href});await ready();await value('[data-composer-prompt]','Keep this free request.');
  await click('.df-composer-generate');await until("!!window.__voiceSignIn&&!!document.querySelector('[data-auth-dialog]')");
  await setClock(end);authenticated=true;await evaluate(`window.dispatchEvent(new Event('dreamface-auth-change'));window.__voiceSignIn.onSuccess(${JSON.stringify(session)});`);
  await until("document.body.innerText.includes('The free offer has ended')");await pause(500);assert.equal(generated.length,beforePaid);
  // The same protection applies to a persisted draft after a redirect/reload.
  authenticated=false;await setClock(initial);await send('Page.navigate',{url:href});await ready();await value('[data-composer-prompt]','Preserve my voice and language.');await value('[data-heygen-voice]','Soren','change');await value('[data-heygen-language]','zh','change');
  await click('.df-composer-generate');await until('!!window.__voiceSignIn');await evaluate('window.__voiceSignIn.onBeforeRedirect()');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('nova_studio_login_draft')).heygenVoiceFreeRequested"),true);
  authenticated=true;await setClock(end);await send('Page.reload');await ready();await until("document.body.innerText.includes('The free offer has ended')");await pause(500);
  assert.equal(generated.length,beforePaid);assert.equal(await evaluate("document.querySelector('[data-heygen-voice]').value"),'Soren');assert.equal(await evaluate("document.querySelector('[data-heygen-language]').value"),'zh');
  assert.equal(await evaluate("document.querySelector('[data-composer-prompt]').value"),'Preserve my voice and language.');
  await evaluate("localStorage.removeItem('nova_studio_login_draft')");await setClock(initial);await send('Page.navigate',{url:href});await ready();
  await value('.df-language-select select','zh-CN','change');await until("document.querySelector('[data-heygen-voice-free]')?.innerText.includes('北京时间')");await noOverflow();await shot('mobile-zh-CN');
  assert.doesNotMatch(await evaluate("document.querySelector('.df-audio-settings').innerText"),/studio\.heygenVoice/);
  assert.deepEqual(errors,[]);
  console.log('HeyGen Voice UI passed: desktop/390/320, 24 voices and 39 languages, expression/reference controls, invalid-reference prevention, zero-balance 0-credit generation, exact request options, localized WAV/free copy, live cutoff repricing, insufficient-credit gate after expiry, and no automatic paid generation after popup or persisted-draft sign-in. All APIs mocked.');
}finally{
  // Keep interception active until the owned tab is destroyed, including any
  // auth/analytics requests emitted during navigation/unmount.
  await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await new Promise(resolve=>{socket.addEventListener('close',resolve,{once:true});socket.close();});await fetch('http://127.0.0.1:9353/json/close/'+tab.id).catch(()=>{});await pause(150);
}
