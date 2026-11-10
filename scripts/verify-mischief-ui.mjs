// Disposable Chrome CDP :9463, local Next :3000. Business APIs and GTM mocked.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
const origin='http://127.0.0.1:3000';
const tab=await(await fetch('http://127.0.0.1:9463/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),errors=[],requests=[];let sequence=0;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Fetch.requestPaused'){
 const {requestId,request}=message.params,url=new URL(request.url);let body={},type='application/json';requests.push({path:url.pathname,method:request.method});
 if(url.hostname.includes('googletagmanager')){body='';type='text/javascript';}
 if(url.pathname==='/api/auth/session')body={session:{access_token:'qa-only',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}};
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/model-pricing')body={rows:[]};
 if(url.pathname==='/api/model-availability')body={models:{dreamfaceIo:false}};
 if(url.pathname==='/api/referrals/availability')body={visible:false};
 if(url.pathname==='/api/gallery')body={items:[]};
 void send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>{if(!/closed|Invalid InterceptionId/.test(error.message))errors.push(error.message);});
}});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let n=0;n<180;n++){if(await evaluate(expression))return;await pause(150);}throw new Error(expression);}
async function navigate(path){await send('Page.navigate',{url:origin+path});}
try{
 mkdirSync('outputs/mischief-retirement',{recursive:true});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en');localStorage.setItem('dreamface_studio_last_model_v1:image-to-video:v2','mischief-video')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'*googletagmanager.com/*'}]});
 const oldPage=await fetch(origin+'/video/mischief-1');assert.equal(oldPage.status,404,'Removed landing returns HTTP 404');assert.ok(!(await oldPage.text()).includes('Create with mischief 1'));
 for(const [width,height] of [[1440,1000],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  for(const suffix of ['&provider=mischief-video','']){
   await navigate('/studio?mode=video&workflow=image-to-video'+suffix);await wait("!!document.querySelector('.df-inline-model-picker')&&document.querySelector('.df-composer-quote')?.textContent.includes('15')");
   assert.ok((await evaluate("document.querySelector('.df-inline-model-picker').textContent")).includes('HeyGen'),'Old URL/remembered choice falls back to the current recommended model');
   await evaluate("document.querySelector('.df-inline-model-picker').click()");await wait("!!document.querySelector('#model-picker-title')");
   assert.ok(!(await evaluate("document.querySelector('[role=dialog]').innerText")).toLowerCase().includes('mischief'),'Retired model absent from picker');
   await evaluate("document.querySelector('.df-model-close').click()");
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  // A pending login draft may restore inputs, but must not auto-charge the fallback model.
  await evaluate("localStorage.setItem('nova_studio_login_draft',JSON.stringify({createdAt:new Date().toISOString(),autoSubmit:true,mode:'video',provider:'mischief-video',videoWorkflow:'image-to-video',imageWorkflow:'text-to-image',ratio:'16:9',duration:'5s',imageSize:'landscape_16_9',referenceImagesText:'https://example.invalid/start.png',referenceImageFiles:[],editResolution:'1K',videoResolution:'720p',outputFormat:'png',prompt:'A camera pans slowly.'}))");
  await navigate('/studio?mode=video&workflow=image-to-video');await wait("document.querySelector('#video-studio-prompt')?.value==='A camera pans slowly.'");await pause(500);
  assert.ok((await evaluate("document.querySelector('.df-inline-model-picker').textContent")).includes('HeyGen'));
  assert.equal(requests.filter(request=>request.path==='/api/generate').length,0,'Restored retired-model draft never auto-submits');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`outputs/mischief-retirement/studio-${width}.png`,Buffer.from(screenshot.data,'base64'));
 }
 assert.deepEqual(errors,[]);assert.equal(requests.filter(request=>request.path==='/api/generate').length,0);
 writeFileSync('outputs/mischief-retirement/browser.json',JSON.stringify({passed:true,oldPageStatus:404,widths:[1440,390],oldUrlAndRememberedChoiceFallback:true,noRetiredModelInPicker:true,retiredDraftNoAutoSubmit:true,errors},null,2));
 console.log('Mischief retirement UI passed: landing 404, desktop/mobile old URL and remembered choice fallback, no model in picker, pending retired-model login draft cannot auto-submit. All business APIs mocked.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1000)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
