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
  for(let i=0;i<80;i++){if(await evaluate(expression))return;await pause(100);}
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
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
  await send("Network.setCacheDisabled",{cacheDisabled:true});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:"try{localStorage.clear();sessionStorage.clear();localStorage.setItem('dreamface_locale','en')}catch{}"});
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"}]});
  for(const [width,height] of [[1440,1000],[390,844]]) for(const workflow of ['text-to-video','image-to-video']) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=video&workflow='+workflow+'&provider=grok-video'});
    await waitFor("document.querySelector('[data-video-advanced-trigger]')?.onclick!=null");await pause(700);
    await evaluate("document.querySelector('button[aria-haspopup=dialog]').click()");
    await waitFor("document.querySelector('[aria-labelledby=model-picker-title]')!==null");
    const labels=await evaluate("[...document.querySelectorAll('[aria-labelledby=model-picker-title] button[aria-pressed]')].map(b=>b.innerText)");
    assert.ok(labels[1]?.includes('Grok Imagine Video 1.5 Lite'),labels.join('; '));
    await evaluate("[...document.querySelectorAll('[aria-labelledby=model-picker-title] button[aria-pressed]')].find(b=>b.innerText.includes('Grok')).click()");
    await evaluate("document.querySelector('[data-video-advanced-trigger]').click()");
    await waitFor("document.querySelector('[data-video-safety-checker]')!==null");
    assert.equal(await evaluate("document.querySelector('[data-video-safety-checker]').getAttribute('aria-checked')"),'false');
    await evaluate("(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='1080p'));s.value='1080p';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
    if(workflow==='image-to-video') {
      assert.equal(await evaluate("document.querySelectorAll('[data-frame-index]').length"),1);
      assert.equal(await evaluate("[...document.querySelectorAll('select')].find(s=>s.value==='source').disabled"),true,JSON.stringify(await evaluate("({url:location.href,selects:[...document.querySelectorAll('select')].map(s=>({v:s.value,disabled:s.disabled})),trigger:document.querySelector('button[aria-haspopup=dialog]').innerText})")));
      await upload(0);
    }
    await evaluate("(()=>{const b=document.querySelector('[data-video-ai-enhance]');if(b?.getAttribute('aria-checked')==='true')b.click();})()");
    await evaluate("(()=>{const input=document.querySelector('#video-studio-prompt');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'A cinematic forest with drifting mist');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await pause(200);
    const submit="[...document.querySelectorAll('button')].find(b=>b.className.includes('min-h-[48px]')&&b.innerText.includes('Generate'))";
    const text=await evaluate(submit+'.innerText');
    assert.ok(text.includes(workflow==='image-to-video'?'107':'105'),text);
    const before=generations.length;
    assert.equal(await evaluate(submit+'.disabled'),false);
    await evaluate(submit+'.click()');
    for(let attempt=0;attempt<80&&generations.length===before;attempt++)await pause(100);
    assert.equal(generations.length,before+1);
    assert.equal(generations.at(-1).resolution,'1080p');assert.equal(generations.at(-1).enableSafetyChecker,false);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  }
  assert.equal(errors.length,0,errors.join('; '));
  console.log('Grok Lite UI passed: desktop/mobile ordering, 1080p quote, safety OFF, image aspect ratio and real submission payload. Mock APIs only.');
} finally {await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Fetch.disable').catch(()=>{});socket.close();}
