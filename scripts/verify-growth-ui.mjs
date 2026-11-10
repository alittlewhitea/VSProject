// Disposable Chrome CDP :9362, local Next :3000. All business APIs and GTM mocked.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const origin='http://127.0.0.1:3000';
const tab=await(await fetch('http://127.0.0.1:9362/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),events=[],requests=[],errors=[];let sequence=0,authenticated=false,growthError=false;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Fetch.requestPaused'){
 const {requestId,request}=message.params,url=new URL(request.url);let body={},responseCode=200,type='application/json';requests.push({path:url.pathname,method:request.method});
 if(url.hostname.includes('googletagmanager')){body='';type='text/javascript';}
 if(url.pathname==='/api/auth/session')body={session:authenticated?{access_token:'qa-only',expires_at:'2099-01-01',user:{id:'qa-admin',email:'fixture@example.invalid'}}:null};
 if(url.pathname==='/api/analytics/track')events.push(JSON.parse(request.postData));
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/model-pricing')body={rows:[]};
 if(url.pathname==='/api/model-availability')body={models:{dreamfaceIo:false}};
 if(url.pathname==='/api/referrals/availability')body={visible:false};
 if(url.pathname==='/api/gallery')body={items:[]};
 if(url.pathname==='/api/admin/growth'){
  if(growthError){responseCode=503;body={error:'Fixture data is temporarily unavailable.'};}
  else body={generatedAt:'2026-11-10T04:00:00Z',start:'2026-10-13T04:00:00Z',end:'2026-11-10T04:00:00Z',days:Number(url.searchParams.get('days')),totals:{visitors:12,workspaceClicks:7,signups:5,activated:2,payers:1},coverage:{newUsers:5,attributedNewUsers:4,earlierTouchSignups:0},rows:[{landingPath:'/avatar/ai-avatar-generator',channel:'organic_search',visitors:12,workspaceClicks:7,signups:4,activated:2,payers:1},{landingPath:'unknown',channel:'unknown',visitors:0,workspaceClicks:0,signups:1,activated:0,payers:0}]};
 }
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
  await navigate('/avatar/ai-avatar-generator?utm_source=google&utm_medium=organic');
  await wait("Object.keys(document.querySelector('a[data-growth-cta=hero]')||{}).some(key=>key.startsWith('__reactProps'))");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'Avatar '+name+' overflow');
  assert.ok((await evaluate("document.querySelector('h1').textContent")).includes('AI avatar'));
  const count=events.filter(event=>event.eventName==='landing_view').length;
  await evaluate("window.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('focus'))");await pause(150);
  assert.equal(events.filter(event=>event.eventName==='landing_view').length,count,'Ordinary rerenders do not create another view');
  await screenshot('avatar-'+name);
  await evaluate("document.querySelector('a[data-growth-cta=hero]').click()");
  await wait("location.pathname==='/studio'&&new URLSearchParams(location.search).get('mode')==='avatar'");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('workflow')"),'avatar-video');
  for(let n=0;n<100&&!events.some(event=>event.eventName==='landing_cta_clicked'&&event.properties.landing_path==='/avatar/ai-avatar-generator');n++)await pause(50);
  assert.ok(events.some(event=>event.eventName==='landing_cta_clicked'&&event.properties.target_mode==='avatar'));
  await navigate('/video/examples');await wait("document.querySelectorAll('video').length===6");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'Examples '+name+' overflow');
  assert.ok(await evaluate("[...document.querySelectorAll('video')].every(video=>video.preload==='none'&&!video.autoplay)"));
  const href=await evaluate("document.querySelector('#image-to-video-examples a[data-growth-cta=example]').getAttribute('href')");
  const next=new URL(href,origin);assert.equal(next.searchParams.get('workflow'),'image-to-video');assert.ok(next.searchParams.get('reference'));assert.ok(next.searchParams.get('prompt'));
  await screenshot('video-examples-'+name);
  await evaluate("document.querySelector('#image-to-video-examples a[data-growth-cta=example]').click()");
  await wait("location.pathname==='/studio'&&new URLSearchParams(location.search).get('workflow')==='image-to-video'");
  assert.equal(await evaluate("new URLSearchParams(location.search).get('provider')"),next.searchParams.get('provider'));
  await navigate('/video/gemini-omni');await wait("!!document.querySelector('h1')&&document.body.textContent.includes('Flash 1.2')");
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'Omni '+name+' overflow');
  assert.equal(await evaluate("document.title.includes('Editor')"),false);
  assert.ok(await evaluate("document.body.textContent.includes('354')&&document.body.textContent.includes('118')"));
 }
 authenticated=true;await navigate('/admin/growth');await wait("document.querySelectorAll('tbody tr').length===2");
 assert.ok(await evaluate("document.body.textContent.includes('50.0%')&&document.body.textContent.includes('25.0%')"));
 assert.ok(await evaluate("document.body.textContent.includes('Unknown / before tracking')"));
 await evaluate("document.querySelector('select[aria-label=\"Reporting window\"]').value='7';document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))");
 await wait("document.querySelector('select').value==='7'&&document.querySelectorAll('tbody tr').length===2");
 await screenshot('admin-growth-mobile');
 growthError=true;await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh').click()");await wait("!!document.querySelector('[role=alert]')");
 assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"),0,'A failed report cannot show previous counts as current');
 growthError=false;await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent==='Refresh').click()");await wait("document.querySelectorAll('tbody tr').length===2");
 authenticated=false;await navigate('/en');await wait("Object.keys(document.querySelector('header a[href*=\"/auth?next\"]')||{}).some(key=>key.startsWith('__reactProps'))");
 await evaluate("document.querySelector('header a[href*=\"/auth?next\"]').click()");await wait("!!document.querySelector('[data-auth-dialog]')");
 for(let n=0;n<100&&!events.some(event=>event.eventName==='landing_cta_clicked'&&event.properties.landing_path==='/en');n++)await pause(50);
 assert.ok(events.some(event=>event.eventName==='landing_cta_clicked'&&event.properties.landing_path==='/en'),'Homepage login intent is counted before authentication');
 await evaluate("document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
 assert.equal(requests.filter(item=>/\/api\/(generate|billing\/checkout)/.test(item.path)).length,0,'Opening examples cannot generate or buy anything');
 assert.deepEqual(errors,[]);
 writeFileSync('outputs/growth/browser-regression.json',JSON.stringify({passed:true,landingViews:events.filter(event=>event.eventName==='landing_view').length,ctaClicks:events.filter(event=>event.eventName==='landing_cta_clicked').length,coverage:['desktop/mobile Avatar and video pages','exact workspace/model/reference CTA','single view per route','Omni facts and prices','admin cohorts/window/error recovery','no generation or checkout'],allApisMocked:true,errors},null,2));
 console.log('Growth UI passed: desktop/mobile Avatar, six sourced videos, Omni facts and prices, exact CTA state, landing view/click tracking and admin cohort/error behavior. No generation, payment or database calls; all APIs and GTM mocked.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1200)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
