// Optional UI smoke test. Requires Node 22+ and a disposable Chrome/Edge CDP session at 127.0.0.1:9353.
// Run the app at 127.0.0.1:3000. Every browser /api request is intercepted; no real accounts or rewards.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tabs=await (await fetch("http://127.0.0.1:9353/json/list")).json();
const tab=tabs.find(t=>t.type==="page");
assert.ok(tab,"Start an isolated debug browser first.");
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true});});
const pending=new Map();let id=0;const errors=[];
const checkoutRequests=[]; const generations=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
socket.addEventListener("message",event=>{
  const message=JSON.parse(event.data);
  if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}return;}
  if(message.method==="Runtime.exceptionThrown")errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if(message.method==="Fetch.requestPaused"){
    const {requestId,request}=message.params;
    const path=new URL(request.url).pathname;
    let body={};
    if(path==="/api/auth/session")body={session:{access_token:"ui-fixture",expires_at:"2099-01-01T00:00:00Z",user:{id:"ui-fixture-user",email:"fixture@example.invalid"}}};
    if(path==="/api/referrals/availability")body={visible:false};
    if(path==="/api/credits")body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
    if(path==="/api/generate"){generations.push(JSON.parse(request.postData));body={error:"Mock generation stopped"};}
    if(path==="/api/tasks")body={tasks:[]};
    if(path==="/api/model-pricing")body={rows:[]};
    if(path==="/api/billing/checkout"){checkoutRequests.push(JSON.parse(request.postData));body={error:"Fixture checkout unavailable"};}
    void send("Fetch.fulfillRequest",{requestId,responseCode:(path==="/api/billing/checkout" || path==="/api/generate")?503:200,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")}).catch(e=>errors.push(e.message));
  }
});
async function evaluate(expression){const data=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(data.exceptionDetails)throw new Error(data.exceptionDetails.text);return data.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitFor(expression) {
  for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(100);}
  throw new Error("UI condition not met: "+expression);
}
async function upload(index, count=1) {
  await evaluate(`(() => {
    const dt = new DataTransfer();
    for(let i=0;i<${count};i++) dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='), c=>c.charCodeAt(0))], 'frame.png', {type:'image/png'}));
    const input = document.querySelector('[data-frame-index="${index}"] input');
    input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await pause(150);
}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.clear();sessionStorage.clear();localStorage.setItem('dreamface_locale',new URL(location.href).searchParams.get('testLocale')||'en')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:'*://127.0.0.1:3000/api/*',requestStage:'Request'}]});
 for(const [width,height,workflow,locale] of [[1440,1000,'text-to-video','en'],[1440,1000,'image-to-video','en'],[390,844,'text-to-video','zh-CN'],[390,844,'image-to-video','zh-TW']]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Page.navigate',{url:`http://127.0.0.1:3000/studio?mode=video&workflow=${workflow}&provider=flux-3-max-video&testLocale=${locale}`});
  await waitFor("document.querySelector('[data-video-advanced-trigger]')?.onclick!=null");await pause(800);
  assert.equal(await evaluate("document.documentElement.lang"),locale);
  const trigger="document.querySelector('button[aria-haspopup=dialog]')";
  assert.ok((await evaluate(trigger+'.innerText')).includes('FLUX 3 Max'));
  assert.ok((await evaluate(trigger+'.innerText')).includes('75% OFF'));
  assert.ok((await evaluate(trigger+'.innerText')).includes('53'));
  assert.equal(await evaluate("[...document.querySelectorAll('select')].filter(s=>s.getClientRects().length).find(s=>s.value==='5s').options.length"),16);
  await evaluate("document.querySelector('[data-video-advanced-trigger]').click()");
  await waitFor("document.querySelector('[data-flux3-reasoning]')!==null");
  assert.equal(await evaluate("document.querySelector('[data-flux3-reasoning]').value"),'high');
  assert.equal(await evaluate("document.querySelector('[data-video-safety-checker]')"),null);
  await evaluate("(()=>{const input=document.querySelector('[data-flux3-reasoning]');input.value='low';input.dispatchEvent(new Event('change',{bubbles:true}));const all=[...document.querySelectorAll('select')].filter(s=>s.getClientRects().length);for(const [oldValue,newValue] of [['5s','20s'],['720p','1080p']]){const s=all.find(s=>s.value===oldValue);s.value=newValue;s.dispatchEvent(new Event('change',{bubbles:true}));}})()");
  if(workflow==='image-to-video') {
   assert.equal(await evaluate("document.querySelectorAll('[data-frame-index]').length"),2);await upload(0);await upload(1);
  }
  await evaluate("(()=>{const b=document.querySelector('[data-video-ai-enhance]');if(b?.getAttribute('aria-checked')==='true')b.click();const input=document.querySelector('#video-studio-prompt');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'A red panda walks slowly through the forest');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await pause(300);
  const submit="[...document.querySelectorAll('button')].find(b=>b.className.includes('min-h-[48px]'))";
  assert.ok((await evaluate(submit+'.innerText')).includes('359'));
  assert.equal(await evaluate(submit+'.disabled'),false);
  const before=generations.length;await evaluate(submit+'.click()');
  for(let attempt=0;attempt<100&&generations.length===before;attempt++)await pause(100);
  assert.equal(generations.length,before+1);
  const payload=generations.at(-1);
  assert.equal(payload.provider,'flux-3-max-video');assert.equal(payload.duration,'20s');assert.equal(payload.resolution,'1080p');
  assert.equal(payload.reasoningLevel,'low');assert.equal(payload.generateAudio,true);assert.equal(payload.expectedCredits,359);
  if(workflow==='image-to-video')assert.equal(payload.imageUrls.length,2);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.equal(await evaluate("document.querySelector('[data-video-editor-scroll]').innerText.includes('??')"),false);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  writeFileSync(join(tmpdir(),`dreamface-flux3-${width}-${workflow}.png`),Buffer.from(shot.data,'base64'));
  await evaluate("window.__fluxOriginalNow=Date.now;Date.now=()=>Date.parse('2026-11-08T00:00:00+08:00');window.dispatchEvent(new Event('focus'));");
  await waitFor(trigger+".innerText.includes('1436')");
  assert.equal((await evaluate(trigger+'.innerText')).includes('75% OFF'),false);
  await evaluate('Date.now=window.__fluxOriginalNow');
 }
 assert.equal(errors.length,0,errors.join('; '));
 console.log('FLUX 3 Max UI passed: desktop/mobile and Chinese locales, promotion badge/expiry, 20s/1080p quotes, audio/reasoning, two frames and real submission payloads. Mock APIs only.');
} finally {await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Fetch.disable').catch(()=>{});socket.close();}
