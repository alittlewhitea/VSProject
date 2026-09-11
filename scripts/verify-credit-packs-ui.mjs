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
    if(path==="/api/credits")body={balance:180,ledger:[],purchases:[],subscriptions:[]};
    if(path==="/api/tasks")body={tasks:[]};
    if(path==="/api/model-pricing")body={rows:[]};
    void send("Fetch.fulfillRequest",{requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")}).catch(e=>errors.push(e.message));
  }
});
async function evaluate(expression){const data=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(data.exceptionDetails)throw new Error(data.exceptionDetails.text);return data.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled",{cacheDisabled:true});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:"try { if(location.hostname==='127.0.0.1') localStorage.setItem('dreamface_locale','en'); } catch {}"});
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"}]});
  for(const [width,height,name] of [[1440,1100,"desktop"],[390,844,"mobile"]]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
    await send("Page.navigate",{url:"http://127.0.0.1:3000/en/price"});
    for(let i=0;i<90;i++){if(await evaluate("document.querySelectorAll('[data-credit-packs] article').length===4"))break;await pause(500);}
    assert.equal(await evaluate("document.querySelectorAll('[data-credit-packs] article').length"),4);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,name+" price overflow");
    const copy=await evaluate("document.querySelector('main').innerText");
    assert.ok(copy.includes("No subscription or automatic renewal."));
    for(const expected of ["Starter Pack","Creator Pack","Studio Pack","Pro Pack","$4.99","$9.99","$24.99","$49.99"])assert.ok(copy.includes(expected),expected);
    assert.doesNotMatch(copy,/Weekly|Monthly|Yearly|Subscribe|Premium Lite/);
    assert.doesNotMatch(copy,/KyrenPay|\/ 1,000 credits/);
    for(const expected of ["11% OFF", "16% OFF", "27% OFF", "H3 Max Turbo · 5s · 480p"]) assert.ok(copy.includes(expected),expected);
    const priceShot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const pricePath=join(tmpdir(),"dreamface-credit-packs-price-"+name+".png");
    writeFileSync(pricePath,Buffer.from(priceShot.data,"base64"));console.log(pricePath);
    await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?mode=image&workflow=text-to-image"});
    for(let i=0;i<30;i++){if(await evaluate("[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Buy credits')"))break;await pause(500);}
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Buy credits').click()");
    for(let i=0;i<30;i++){if(await evaluate("Boolean(document.querySelector('[aria-labelledby=credit-shop-title]'))"))break;await pause(200);}
    assert.equal(await evaluate("document.querySelectorAll('[role=dialog] [data-credit-packs] article').length"),4);
    const modal=await evaluate("document.querySelector('[aria-labelledby=credit-shop-title]').innerText");
    assert.doesNotMatch(modal,/Weekly|Monthly|Yearly|Subscribe|Premium Lite|PayPal/);
    assert.doesNotMatch(modal,/KyrenPay|\/ 1,000 credits/);
    assert.ok(modal.includes("H3 Max Turbo · 5s · 480p"));
    assert.ok(modal.includes("No subscription or automatic renewal."));
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,name+" modal overflow");
    assert.equal(await evaluate("document.querySelector('[role=dialog]').scrollWidth<=document.querySelector('[role=dialog]').clientWidth"),true);
    await pause(300);
    const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const path=join(tmpdir(),"dreamface-credit-packs-modal-"+name+".png");writeFileSync(path,Buffer.from(shot.data,"base64"));console.log(path);
    await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await pause(250);assert.equal(await evaluate("Boolean(document.querySelector('[aria-labelledby=credit-shop-title]'))"),false);
  }
  await send("Page.navigate",{url:"http://127.0.0.1:3000/zh-CN/price"});
  for(let i=0;i<90;i++){if(await evaluate("document.body?.innerText.includes('为下一个创意充值')"))break;await pause(500);}
  assert.equal(await evaluate("document.body.innerText.includes('为下一个创意充值')"),true);
  assert.equal(errors.length,0,errors.join("; "));
  console.log("Credit pack UI checks passed: desktop/mobile price and studio modal, four packs, localized title, no subscription offers, no overflow, Escape dismissal. All API traffic mocked.");
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
