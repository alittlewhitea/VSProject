// Optional UI smoke test. Requires Node 22+ and a disposable Chrome/Edge CDP session at 127.0.0.1:9338.
// Run the app at 127.0.0.1:3000. Every browser /api request is intercepted; no real accounts or rewards.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const tabs=await (await fetch("http://127.0.0.1:9338/json/list")).json();
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
  await send("Page.addScriptToEvaluateOnNewDocument",{source:"try{localStorage.setItem('dreamface_locale','en')}catch{}"});
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"}]});
  for(const [width,height,name] of [[1440,1100,"desktop"],[390,844,"mobile"]]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
    await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?mode=video&workflow=image-to-video&provider=minimax-h3-max-turbo-video"});
    await waitFor("document.querySelectorAll('[data-frame-index]').length===2");
    await pause(750);
    await upload(0);await upload(1);
    await waitFor("document.querySelectorAll('[data-video-keyframes] img').length===2");
    const expected=await evaluate("[...document.querySelectorAll('[data-video-keyframes] img')].map(x=>x.src)");
    const count=generations.length;
    await evaluate("[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Generate')&&!x.disabled&&x.className.includes('min-h-[48px]')).click()");
    for(let attempt=0;attempt<80 && generations.length===count;attempt++) await pause(100);
    await pause(250);
    assert.equal(generations.length,count+1);
    assert.deepEqual(generations.at(-1).imageUrls,expected);
    assert.equal(generations.at(-1).provider,'minimax-h3-max-turbo-video');
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,name+" overflow");
    const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    writeFileSync(join(tmpdir(),"dreamface-video-keyframes-"+name+".png"),Buffer.from(shot.data,"base64"));
    await evaluate("document.querySelector('[data-frame-index=\"1\"] button').click()");
    assert.equal(await evaluate("document.querySelectorAll('[data-video-keyframes] img').length"),1);
    await upload(1);
    await evaluate("document.querySelector('[data-frame-index=\"0\"] button').click()");
    assert.equal(await evaluate("document.querySelectorAll('[data-video-keyframes] img').length"),0);
    assert.equal(await evaluate("document.querySelector('[data-frame-index=\"1\"] input').disabled"),true);
    await upload(0); await upload(1);
    const preservedStart = await evaluate("document.querySelector('[data-frame-index=\"0\"] img').src");
    await evaluate("document.querySelector('button[aria-haspopup=dialog]').click()");
    await waitFor("document.querySelector('[aria-labelledby=model-picker-title]')!==null");
    await evaluate("[...document.querySelectorAll('[aria-labelledby=model-picker-title] button')].find(b=>b.innerText.includes('Grok')).click()");
    await waitFor("document.querySelectorAll('[data-frame-index]').length===1");
    assert.equal(await evaluate("document.querySelector('[data-frame-index=\"0\"] img').src"),preservedStart);
  }
  for(const [provider,slots] of [['grok-video',1],['seedance-mini-video',1],['seedance-video',2],['gemini-omni-flash-video',2],['minimax-h3-max-video',2]]) {
    await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?mode=video&workflow=image-to-video&provider="+provider});
    await waitFor(`document.querySelectorAll('[data-frame-index]').length===${slots}`);
    assert.equal(await evaluate("document.querySelector('[data-video-keyframes]').parentElement.querySelectorAll('input[type=file]').length"),slots);
  }
  assert.equal(errors.length,0,errors.join('; '));
  console.log("Video keyframe UI passed: desktop/mobile two-frame upload, real request ordering, remove/clear, single-frame model restrictions. All API traffic mocked.");
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
