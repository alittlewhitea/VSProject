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


async function waitFor(expr){for(let i=0;i<80;i++){if(await evaluate(expr))return;await pause(100);}throw Error(expr);}
let expected;
try {
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.clear();localStorage.setItem('dreamface_locale','en')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:'*://127.0.0.1:3000/api/*',requestStage:'Request'}]});
 for(const width of [1280,1440,1920,390]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  for(const workflow of ['text-to-video','image-to-video']) {
   for(const provider of (width===1440?['dreamface-io-video','minimax-h3-max-turbo-video','minimax-h3-max-video','grok-video','seedance-video']:['minimax-h3-max-turbo-video'])) {
    await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=video&workflow='+workflow+'&provider='+provider});
    await waitFor("document.querySelectorAll('[data-video-showcases] button[aria-pressed]').length===3");
    await pause(450);
    const info=await evaluate(`(() => {
      const row=document.querySelector('[data-video-showcases]'), panel=row.closest('section');
      const samples=[...row.querySelectorAll('button[aria-pressed]')];
      const recent=panel.parentElement.nextElementSibling;
      return {src:panel.querySelector('video').getAttribute('src'),posters:samples.map(e=>e.querySelector('img').getAttribute('src')),durations:samples.map(e=>e.innerText),
       recentPosters:[...recent.querySelectorAll('img')].map(e=>e.getAttribute('src')),
       visible:samples.every(e=>{const r=e.getBoundingClientRect(),p=row.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right}),
       overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    if(!expected)expected={src:info.src,posters:info.posters};
    assert.deepEqual({src:info.src,posters:info.posters},expected,provider+' '+workflow);
    assert.deepEqual(info.durations,['15s','10s','15s']);
    assert.deepEqual(info.recentPosters,expected.posters);
    assert.equal(info.visible,true);assert.equal(info.overflow,false);
    if(provider==='minimax-h3-max-turbo-video') {
     const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
     writeFileSync(join(tmpdir(),'dreamface-shared-previews-'+width+'-'+workflow+'.png'),Buffer.from(shot.data,'base64'));
    }
    console.log(width,workflow,provider,'passed');
   }
  }
 }
 assert.equal(generations.length,0);
 assert.equal(errors.length,0,errors.join(';'));
 console.log('Shared preview checks passed: same three videos/posters/durations across models and workflows, visible thumbnails and unchanged empty-history media set. All APIs mocked.');
} finally {await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Fetch.disable').catch(()=>{});socket.close();}
