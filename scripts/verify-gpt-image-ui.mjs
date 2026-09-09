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
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"}]});
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const cases=[
    ["chatgpt-image","text-to-image","create a realistic image","EnWrO3XWjPE0nxBDpaQrj.png",0],
    ["gpt-image-2.5-sunburst","text-to-image","Create a high-end hero infographic","brrnJKoDXxFXhOqwcSVKy_enC0gTH3.png",0],
    ["chatgpt-image","image-to-image","These two are riding together","EtXID57a6RBQSY_ElY17C_ExXxAYZ2.png",2],
    ["gpt-image-2.5-sunburst","image-to-image","Replace her clothing","mrMrDcbFOKzl75tVEdXxo_f44XKXFx.png",1]
  ];
  for(const [provider,workflow,prompt,preview,references] of cases) {
    await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?mode=image&workflow="+workflow+"&provider="+provider});
    for(let i=0;i<120;i++){if(await evaluate("Boolean([...document.querySelectorAll('textarea')].find(e=>e.value.startsWith("+JSON.stringify(prompt)+")))"))break;await pause(500);}
    assert.equal(await evaluate("Boolean([...document.querySelectorAll('textarea')].find(e=>e.value.startsWith("+JSON.stringify(prompt)+")))"),true,provider+" "+workflow+" prompt");
    assert.equal(await evaluate("Boolean(document.querySelector('img[src$="+JSON.stringify(preview)+"]'))"),true,"preview");
    const refs=await evaluate("[...document.querySelectorAll('textarea')].map(e=>e.value).filter(v=>v.includes('andrew-wyeth')||v.includes('johannes-vermeer')).join(' ')");
    assert.equal((refs.match(/https:\/\//g)||[]).length,references,"reference count: "+JSON.stringify(await evaluate("[...document.querySelectorAll('textarea,input:not([type=password])')].map(e=>({tag:e.tagName,value:e.value?.slice(0,300)}))")));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true);
    await pause(300);
    await evaluate("[...document.querySelectorAll('button')].find(e=>/更多设置|More settings/i.test(e.textContent)).click()");
    await pause(100);
    assert.equal(await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='low')?.className.includes('text-[#6a5af9]')"),true,"Low selected by default");
    console.log(provider+" "+workflow+" example passed");
  }
  // Exercise real picker transition, not just direct URLs.
  await evaluate("document.querySelector('button[aria-haspopup=dialog]').click()");
  await pause(250);
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('GPT Image 2.5 Flare')).click()");
  await pause(900);
  assert.equal(await evaluate("Boolean([...document.querySelectorAll('textarea')].find(e=>e.value.startsWith('These two are riding together')))"),true,"Switch restores Flare edit prompt");
  await evaluate("Promise.race([Promise.all([...document.querySelectorAll('figure img')].map(img=>img.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,8000))])");
  for(const [width,height,name] of [[1440,1100,"desktop"],[390,844,"mobile"]]){
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});await pause(250);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true,name+" overflow");
    const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const path=join(tmpdir(),"dreamface-gpt-image-"+name+".png");writeFileSync(path,Buffer.from(screenshot.data,"base64"));console.log(path);
  }
  assert.equal(errors.length,0,errors.join("; "));
  console.log("GPT Image UI fixtures passed; no live API requests or generation charges.");
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
