// Optional UI smoke test. Requires Node 22+ and a disposable Chrome/Edge CDP session at 127.0.0.1:9338.
// Run the app at 127.0.0.1:3000. Every browser /api request is intercepted; no real accounts or rewards.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
    let body={},contentType="application/json";
    if(request.url.includes('googletagmanager.com')){body='';contentType='text/javascript';}
    if(path==="/api/auth/session")body={session:{access_token:"ui-fixture",expires_at:"2099-01-01T00:00:00Z",user:{id:"ui-fixture-user",email:"fixture@example.invalid"}}};
    if(path==="/api/referrals/availability")body={visible:false};
    if(path==="/api/credits")body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
    if(path==="/api/generate"){generations.push(JSON.parse(request.postData));body={error:"Mock generation stopped"};}
    if(path==="/api/tasks")body={tasks:[]};
    if(path==="/api/model-pricing")body={rows:[]};
    if(path==="/api/billing/checkout"){checkoutRequests.push(JSON.parse(request.postData));body={error:"Fixture checkout unavailable"};}
    void send("Fetch.fulfillRequest",{requestId,responseCode:(path==="/api/billing/checkout" || path==="/api/generate")?503:200,responseHeaders:[{name:"Content-Type",value:contentType}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString("base64")}).catch(e=>errors.push(e.message));
  }
});
async function evaluate(expression){const data=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(data.exceptionDetails)throw new Error(data.exceptionDetails.exception?.description||data.exceptionDetails.text);return data.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitFor(expression) {
  for(let i=0;i<180;i++){if(await evaluate(expression))return;await pause(100);}
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
async function prompt(){
  await waitFor("Object.keys(document.querySelector('#video-studio-prompt')||{}).some(key=>key.startsWith('__reactProps'))");
  await evaluate("(() => {const el=document.querySelector('#video-studio-prompt');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'A lighthouse on a rocky cliff at dusk.');el.dispatchEvent(new Event('input',{bubbles:true}));})()");
}
try {
  mkdirSync('outputs/gemini-omni',{recursive:true});
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
  await send("Network.setCacheDisabled",{cacheDisabled:true});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:"try{localStorage.setItem('dreamface_locale','en')}catch{}"});
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"},{urlPattern:'*googletagmanager.com/*'}]});
  for(const [width,height,name] of [[1440,1100,"desktop"],[390,844,"mobile"]]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});
    await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?mode=video&workflow=image-to-video&provider=minimax-h3-max-turbo-video"});
    await waitFor("document.querySelectorAll('[data-frame-index]').length===2");
    await pause(750);
    await prompt();
    await upload(0);await upload(1);
    await waitFor("document.querySelectorAll('[data-video-keyframes] img').length===2");
    const expected=await evaluate("[...document.querySelectorAll('[data-video-keyframes] img')].map(x=>x.src)");
    const count=generations.length;
    await evaluate("document.querySelector('[data-video-workspace] .df-composer-generate:not(:disabled)').click()");
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
    await evaluate("document.querySelector('[data-video-workspace] .df-inline-model-picker').click()");
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
  const duration="document.querySelectorAll('[data-video-parameters] select')[0]",resolution="document.querySelectorAll('[data-video-parameters] select')[2]";
  async function choose(selector,value){await evaluate(`(() => {const el=${selector};el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  async function generate(expected){const count=generations.length;await evaluate("document.querySelector('[data-video-workspace] .df-composer-generate:not(:disabled)').click()");for(let i=0;i<100&&generations.length===count;i++)await pause(100);assert.equal(generations.length,count+1);for(const [key,value] of Object.entries(expected))assert.deepEqual(generations.at(-1)[key],value,key);await waitFor("!!document.querySelector('[data-video-workspace] .df-composer-generate:not(:disabled)')");}
  for(const [width,height,name] of [[1440,1100,'desktop'],[390,844,'mobile']]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=video&workflow=text-to-video&provider=gemini-omni-flash-video'});
    await waitFor("Object.keys(document.querySelector('#video-studio-prompt')||{}).some(key=>key.startsWith('__reactProps'))&&document.querySelector('[data-video-workspace]')?.getAttribute('data-video-workspace')==='text-to-video'");
    assert.deepEqual(await evaluate(`[...${resolution}.options].map(x=>x.value)`),['360p','720p','1080p','4k']);
    assert.equal(await evaluate(`${resolution}.disabled`),false);assert.equal(await evaluate(`${duration}.options[${duration}.options.length-1].value`),'15s');
    await prompt();
    await choose(duration,'15s');await choose(resolution,'4k');
    await generate({provider:'gemini-omni-flash-video',duration:'15s',resolution:'4k',expectedCredits:664,generateAudio:true});
    await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=video&workflow=image-to-video&provider=gemini-omni-flash-video'});
    await waitFor("Object.keys(document.querySelector('#video-studio-prompt')||{}).some(key=>key.startsWith('__reactProps'))&&document.querySelectorAll('[data-frame-index]').length===2");
    await prompt();
    await upload(0);await waitFor("document.querySelectorAll('[data-video-keyframes] img').length===1");
    await choose(duration,'15s');await choose(resolution,'1080p');
    await generate({duration:'15s',resolution:'1080p',expectedCredits:332});
    await upload(1);await waitFor("document.querySelectorAll('[data-video-keyframes] img').length===2");
    await waitFor(`[...${duration}.options].every(x=>parseInt(x.value)<=10)`);
    await choose(duration,'10s');await choose(resolution,'360p');
    await generate({duration:'10s',resolution:'360p',expectedCredits:41});
    assert.equal(generations.at(-1).imageUrls.length,2);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,name+' Omni overflow');
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('outputs/gemini-omni/'+name+'.png',Buffer.from(screenshot.data,'base64'));
    await evaluate("document.querySelector('[data-frame-index=\"1\"] button').click()");
    await waitFor(`[...${duration}.options].some(x=>x.value==='15s')`);
  }
  assert.equal(errors.length,0,errors.join('; '));
  writeFileSync('outputs/gemini-omni/browser-regression.json',JSON.stringify({passed:true,generationRequests:generations.length,coverage:['desktop/mobile','Omni 1.2 resolutions','15s text and single-frame generation','two-frame 10s cap','duration restoration after removing end frame','resolution and credit payloads','legacy keyframe restrictions'],errors},null,2));
  console.log("Video keyframe UI passed: desktop/mobile Omni 1.2 four-resolution options, 15s text/single-frame requests, two-frame 10s cap, matching credit quotes, removal restores 15s, and existing model restrictions. All API and GTM traffic mocked.");
} catch(error) {
  console.log(await evaluate("JSON.stringify({url:location.href,prompt:document.querySelector('#video-studio-prompt')?.value,buttons:[...document.querySelectorAll('button')].filter(x=>x.innerText.includes('Generate')).map(x=>({text:x.innerText,disabled:x.disabled,classes:x.className})),errors:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent)})").catch(()=>''));
  throw error;
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
