// Optional UI smoke test. Requires Node 22+ and a disposable Chrome/Edge CDP session at 127.0.0.1:9338.
// Run the app at STUDIO_BASE_URL (defaults to 127.0.0.1:3012). Every browser /api request is intercepted; no real accounts or rewards.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const baseUrl=process.env.STUDIO_BASE_URL || "http://127.0.0.1:3012";
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
  if(message.method==="Runtime.exceptionThrown")errors.push(message.params.exceptionDetails.text);
  if(message.method==="Fetch.requestPaused"){
    const {requestId,request}=message.params;
    const path=new URL(request.url).pathname;
    let body={};
    if(path==="/api/auth/session")body={session:null};
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
  await send("Page.enable");await send("Runtime.enable");
  await send("Network.enable");await send("Network.setCacheDisabled",{cacheDisabled:true});
  await send("Fetch.enable",{patterns:[{urlPattern:new URL("/api/*",baseUrl).toString(),requestStage:"Request"}]});
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  for(const provider of ["chatgpt-image","gpt-image-2.6-sunburst","gpt-image-2.5-sunburst"]) for(const workflow of ["text-to-image","image-to-image"]) {
    await send("Page.navigate",{url:baseUrl+"/studio?mode=image&workflow="+workflow+"&provider="+provider});
    for(let i=0;i<120;i++){if(await evaluate("Boolean(document.querySelector('.df-image-settings > button:not([aria-haspopup])'))"))break;await pause(250);}
    assert.equal(await evaluate("document.querySelector('.df-unified-inspector textarea[dir=auto]').value"),"","No sample prompt substitutes for user input");
    assert.equal(await evaluate("document.querySelectorAll('[data-reference-panel] img').length"),0,"No invented references");
    assert.equal(await evaluate("document.querySelector('.df-image-settings').textContent.includes('GPT Image 2.6')"),true);
    await evaluate("document.querySelector('.df-image-settings > button:not([aria-haspopup])').click()");await pause(100);
    const settings=await evaluate(`(()=>{const block=document.querySelector('[data-gpt26-controls]'),selects=block.querySelectorAll('select');return {quality:selects[0].value,reasoning:selects[1].value,qualities:selects[0].options.length,count:selects[4].options.length,formats:[...selects[2].options].map(e=>e.value),safe:block.querySelector('[data-gpt-safety]').getAttribute('aria-checked')}})()`);
    assert.equal(settings.quality,'low');assert.equal(settings.reasoning,'low');assert.equal(settings.qualities,6);assert.equal(settings.count,10);assert.equal(settings.safe,'true');
    assert.equal(settings.formats.includes('svg'),workflow==='text-to-image');assert.ok(settings.formats.includes('gif'));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true);
    console.log(provider+" "+workflow+" 2.6 settings passed");
  }
  // User-written drafts survive a real model picker transition.
  await evaluate(`(()=>{const e=document.querySelector('.df-unified-inspector textarea[dir=auto]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Keep this user-written editing draft.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("document.querySelector('.df-image-settings button[aria-haspopup=dialog]').click()");await pause(200);
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('GPT Image 2.6 Flare')).click()");await pause(250);
  assert.equal(await evaluate("document.querySelector('.df-unified-inspector textarea[dir=auto]').value"),'Keep this user-written editing draft.');
  for(const [width,height,name] of [[1440,1100,"desktop"],[390,844,"mobile"]]){
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});await pause(250);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true,name+" overflow");
    const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const path=join(tmpdir(),"dreamface-gpt-image-"+name+".png");writeFileSync(path,Buffer.from(screenshot.data,"base64"));console.log(path);
  }
  assert.equal(errors.length,0,errors.join("; "));
  console.log("GPT Image UI fixtures passed; no live API requests or generation charges.");
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
