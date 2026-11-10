// Disposable Chrome CDP :9463, local Next :3000. All business APIs and GTM mocked.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const origin='http://127.0.0.1:3000';
const tab=await(await fetch('http://127.0.0.1:9463/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),events=[],requests=[],errors=[],generated=[];let sequence=0;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Fetch.requestPaused'){
 const {requestId,request}=message.params,url=new URL(request.url);let body={},responseCode=200,type='application/json';requests.push({path:url.pathname,method:request.method});
 if(url.hostname.includes('googletagmanager')){body='';type='text/javascript';}
 if(url.pathname==='/api/auth/session')body={session:{access_token:'qa-only',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}};
 if(url.pathname==='/api/analytics/track')events.push(JSON.parse(request.postData));
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/generate'){generated.push(JSON.parse(request.postData));body={taskId:'12345678-1234-4234-8234-123456789abc',status:'queued',transport:'real',mode:'video',provider:'mischief-video',estimatedCredits:3,balance:9997};}
 if(url.pathname==='/api/model-pricing')body={rows:[]};
 if(url.pathname==='/api/model-availability')body={models:{dreamfaceIo:false}};
 if(url.pathname==='/api/referrals/availability')body={visible:false};
 if(url.pathname==='/api/gallery')body={items:[]};
 void send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>{if(!/closed|Invalid InterceptionId/.test(error.message))errors.push(error.message);});
}});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let n=0;n<220;n++){if(await evaluate(expression))return;await pause(150);}throw new Error(expression);}
async function navigate(path){await send('Page.navigate',{url:origin+path});}
async function screenshot(name){const value=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('outputs/growth/'+name+'.png',Buffer.from(value.data,'base64'));}
try{
 mkdirSync('outputs/growth',{recursive:true});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'*googletagmanager.com/*'}]});
 for(const [width,height,name]of[[1440,1000,'desktop'],[390,844,'mobile']]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await navigate('/video/mischief-1');await wait("Object.keys(document.querySelector('a[data-growth-cta=hero]')||{}).some(key=>key.startsWith('__reactProps'))");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Landing '+name+' overflow');
  assert.ok((await evaluate('document.querySelector("h1").textContent')).includes('mischief 1'));
  assert.equal(await evaluate("document.querySelectorAll('script[type=\"application/ld+json\"]').length"),1);
  await screenshot('mischief-landing-'+name);
  await evaluate("document.querySelector('a[data-growth-cta=hero]').click()");await wait("!!document.querySelector('[data-mischief-notice]')&&!!document.querySelector('.df-composer-generate')");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('provider')"),'mischief-video');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-video-parameters] select')].map(select=>[...select.options].map(option=>option.value))"),[['3s','5s'],['16:9'],['480p','720p']]);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-video-parameters] select')].map(select=>select.value)"),['5s','16:9','720p']);
  assert.equal(await evaluate("document.querySelectorAll('[data-video-keyframes] [data-frame-index]').length"),1);
  assert.equal(await evaluate("document.querySelector('.df-composer-generate').disabled"),true,'Starting image required before submit');
  assert.ok((await evaluate("document.querySelector('.df-composer-quote').textContent")).includes('9'));
  await navigate('/video/mischief-1');await wait("Object.keys(document.querySelector('a[data-growth-cta=example]')||{}).some(key=>key.startsWith('__reactProps'))");
  await evaluate("document.querySelector('a[data-growth-cta=example]').click()");await wait("!!document.querySelector('[data-mischief-notice]')&&!!document.querySelector('[data-frame-index] img')&&!!document.querySelector('.df-composer-generate')");
  await evaluate("document.querySelectorAll('[data-video-parameters] select')[0].value='3s';document.querySelectorAll('[data-video-parameters] select')[0].dispatchEvent(new Event('change',{bubbles:true}))");
  await evaluate("document.querySelectorAll('[data-video-parameters] select')[2].value='480p';document.querySelectorAll('[data-video-parameters] select')[2].dispatchEvent(new Event('change',{bubbles:true}))");
  await wait("document.querySelector('.df-composer-quote').textContent.trim().startsWith('3 ')");
  await evaluate("const toggle=document.querySelector('[data-video-ai-enhance]');if(toggle?.getAttribute('aria-checked')==='true')toggle.click();document.querySelector('[data-video-advanced-trigger]').click()");
  await wait("!!document.querySelector('[data-video-advanced] input')");
  await evaluate("const input=document.querySelector('[data-video-advanced] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0');input.dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Workspace '+name+' overflow');
  await wait("document.querySelector('[data-frame-index] img')?.complete&&document.querySelector('[data-frame-index] img').naturalWidth>0");
  await screenshot('mischief-workspace-'+name);
  const previous=generated.length;await evaluate("document.querySelector('.df-composer-generate').click()");
  for(let n=0;n<100&&generated.length===previous;n++)await pause(100);
  assert.equal(generated.length,previous+1,'One mocked generation request');
  const payload=generated.at(-1);assert.equal(payload.provider,'mischief-video');assert.equal(payload.resolution,'480p');assert.equal(payload.duration,'3s');assert.equal(payload.ratio,'16:9');assert.equal(payload.seed,0);assert.equal(payload.expectedCredits,3);assert.equal(payload.generateAudio,false);assert.equal(payload.imageUrls.length,1);assert.ok(payload.prompt.includes('pumpkin'));
 }
 assert.ok(events.some(event=>event.eventName==='landing_view'&&event.properties.landing_path==='/video/mischief-1'));
 assert.ok(events.some(event=>event.eventName==='landing_cta_clicked'&&event.properties.landing_path==='/video/mischief-1'));
 assert.deepEqual(errors,[]);
 writeFileSync('outputs/growth/mischief-browser.json',JSON.stringify({passed:true,desktopMobile:true,generationRequests:generated.length,allApisMocked:true,errors},null,2));
 console.log('Mischief UI passed: desktop/mobile landing, FAQ schema, exact model CTA, one image, duration/resolution options, 3/9 credit quotes, seed zero and correct generation payload. All APIs and GTM intercepted; no live generation, payment or database calls.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1400)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
