// Optional UI smoke test. Requires Node 22+ and a disposable Chrome/Edge CDP session at 127.0.0.1:9338.
// Run the app at 127.0.0.1:3000. Every browser /api request is intercepted; no real accounts or rewards.
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
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


const baseline = process.argv.includes('--baseline');
const metricsPath = join(tmpdir(), 'dreamface-desktop-mobile-baseline.json');
const mobileMetrics = {};
async function waitFor(expr) { for(let i=0;i<100;i++){if(await evaluate(expr))return;await pause(100);}throw Error(expr); }
async function geometry() {
  return evaluate(`(() => {
    const prompt=document.querySelector('#video-studio-prompt'), panel=prompt.closest('section');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
    const cta=[...panel.querySelectorAll('button')].find(b=>b.className.includes('min-h-[48px]'));
    return {prompt:rect(prompt),panel:rect(panel),model:rect(panel.querySelector('[aria-haspopup=dialog]')),cta:rect(cta),
      preview:rect(panel.nextElementSibling),selects:[...panel.querySelectorAll('select')].map(rect),
      viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try {localStorage.clear();localStorage.setItem('dreamface_locale','en')} catch {}"});
 await send('Fetch.enable',{patterns:[{urlPattern:'*://127.0.0.1:3000/api/*',requestStage:'Request'}]});
 for(const width of [390,768,1280,1440,1920]) {
  for(const workflow of ['text-to-video','image-to-video']) {
   const height=width<1024?844:900;
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
   await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=video&workflow='+workflow+'&provider=minimax-h3-max-turbo-video'});
   await waitFor("Boolean(document.querySelector('#video-studio-prompt'))");
   await pause(800);
   const key=width+'-'+workflow, g=await geometry();
   assert.equal(g.overflow,false,key+' page overflow');
   if(width<1024) mobileMetrics[key]=g;
   if(!baseline && width>=1024) {
    assert.ok(g.panel.width/(g.panel.width+g.preview.width)>=0.52 && g.panel.width/(g.panel.width+g.preview.width)<=0.55,key+' column ratio');
    assert.ok(g.cta.bottom<=height,key+' CTA first fold');
    assert.ok(g.prompt.bottom<g.cta.y,key+' full prompt visible');
    assert.ok(g.model.bottom<g.cta.y,key+' model visible');
    assert.ok(g.selects.every(r=>r.bottom<g.cta.y),key+' parameters visible');
    assert.ok(g.selects.every(r=>Math.abs(r.y-g.selects[0].y)<1),key+' controls on one row');
    assert.equal(await evaluate("(() => {const scroll=document.querySelector('[data-video-editor-scroll]').getBoundingClientRect();return [...document.querySelectorAll('[data-video-editor-scroll] select')].every(el=>el.parentElement.getBoundingClientRect().bottom<=scroll.bottom)})()"),true,key+' full parameter borders visible');
    assert.ok(g.cta.height>=56&&g.cta.height<=64,key+' CTA height');
    // Expand advanced settings, scroll only the creation body; CTA must not move.
    await evaluate("document.querySelector('[data-video-advanced-trigger]').click()");
    await pause(100);
    const before=(await geometry()).cta;
    await evaluate("document.querySelector('[data-video-editor-scroll]').scrollTop=9999");
    const after=(await geometry()).cta;
    assert.deepEqual(after,before,key+' panel scroll moved CTA');
    if(workflow==='image-to-video') {
      const disabledCount=generations.length;
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',modifiers:2,windowsVirtualKeyCode:13});
      await pause(100);
      assert.equal(generations.length,disabledCount,'Disabled generation ignores shortcuts');
      await evaluate(`(() => {
        const input=document.querySelector('[data-frame-index="0"] input');
        const dt=new DataTransfer();
        dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'frame.png',{type:'image/png'}));
        input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await waitFor("Boolean(document.querySelector('[data-frame-index=\"0\"] img'))");
      await evaluate(`(() => {
        const input=document.querySelector('[data-frame-index="1"] input'),dt=new DataTransfer();
        dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'end.png',{type:'image/png'}));
        input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await waitFor("Boolean(document.querySelector('[data-frame-index=\"1\"] img'))");
      await evaluate("document.querySelector('[data-video-advanced-trigger]').click();document.querySelector('[data-video-editor-scroll]').scrollTop=0");
      assert.equal(await evaluate("(() => {const scroll=document.querySelector('[data-video-editor-scroll]').getBoundingClientRect();return [...document.querySelectorAll('[data-video-editor-scroll] select')].every(el=>el.parentElement.getBoundingClientRect().bottom<=scroll.bottom)})()"),true,key+' uploaded keyframes still fit first fold');
      await evaluate("document.querySelector('[data-video-advanced-trigger]').click()");
    }
    // Keyboard shortcut reuses the real handler, captured by the API fixture.
    const count=generations.length;
    await evaluate("document.querySelector('#video-studio-prompt').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',modifiers:width===1920?4:2,windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',modifiers:0,windowsVirtualKeyCode:13});
    for(let i=0;i<30&&generations.length===count;i++)await pause(100);
    assert.equal(generations.length,count+1,key+' shortcut submits exactly once');
    await pause(100);
    await evaluate("document.querySelector('[data-video-editor-scroll] [aria-haspopup=dialog]').click()");
    await waitFor("Boolean(document.querySelector('[role=dialog]'))");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',modifiers:2,windowsVirtualKeyCode:13});
    await pause(100);
    assert.equal(generations.length,count+1,key+' modal prevents background shortcut');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await waitFor("!document.querySelector('[role=dialog]')");
    await pause(150);
    await evaluate("document.querySelector('[data-video-advanced-trigger]').click();document.querySelector('[data-video-editor-scroll]').scrollTop=0;document.activeElement.blur()");
   }
   await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(shot=>writeFileSync(join(tmpdir(),'dreamface-desktop-'+(baseline?'before-':'after-')+key+'.png'),Buffer.from(shot.data,'base64')));
   console.log(key,JSON.stringify(g));
  }
 }
 if(baseline)writeFileSync(metricsPath,JSON.stringify(mobileMetrics));
 else assert.deepEqual(mobileMetrics,JSON.parse(readFileSync(metricsPath,'utf8')),'Mobile/tablet geometry changed');
 assert.equal(errors.length,0,errors.join(';'));
 console.log(baseline?'Baseline captured.':'Desktop layout, sticky CTA, shortcuts and unchanged mobile geometry passed. All APIs mocked.');
} finally {await send('Page.navigate',{url:'about:blank'}).catch(()=>{});await send('Fetch.disable').catch(()=>{});socket.close();}
