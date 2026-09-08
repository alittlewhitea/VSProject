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
let blockedRegion=false;
const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
const dashboard={enabled:true,url:"https://example.test/r/abcdef123456abcdef123456",code:"abcdef123456abcdef123456",eligible:true,verified:true,generated:true,settings:{inviterCredits:100,inviteeCredits:100,dailyLimit:3,monthlyLimit:30},usage:{daily:1,monthly:8,earned:350,pending:50},incoming:{status:"pending",invitee_credits:100},history:[{id:"one",status:"pending",bound_at:"2026-09-08 08:00:00",inviter_credits:100},{id:"two",status:"paid",bound_at:"2026-09-07 08:00:00",inviter_credits:100},{id:"three",status:"review",bound_at:"2026-09-06 08:00:00",inviter_credits:100}]};
socket.addEventListener("message",event=>{
  const message=JSON.parse(event.data);
  if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}return;}
  if(message.method==="Runtime.exceptionThrown")errors.push(message.params.exceptionDetails.text);
  if(message.method==="Fetch.requestPaused"){
    const {requestId,request}=message.params;
    const path=new URL(request.url).pathname;
    let body={};
    if(path==="/api/auth/session")body={session:{access_token:"ui-fixture",expires_at:new Date(Date.now()+3600000).toISOString(),user:{id:"ui-fixture-user",email:"fixture@example.test"}}};
    if(path==="/api/referrals")body=request.method==="POST"?{ok:true}:blockedRegion?{enabled:false}:dashboard;
    if(path==="/api/referrals/availability")body={visible:!blockedRegion};
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
  await send("Fetch.enable",{patterns:[{urlPattern:"*://127.0.0.1:3000/api/*",requestStage:"Request"}]});
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?view=referrals"});
  for(let n=0;n<60;n++){if(await evaluate("Boolean(document.querySelector('#referral-link'))"))break;await pause(250);}
  assert.equal(await evaluate("document.querySelector('#referral-link')?.value"),dashboard.url);
  let text=await evaluate("document.body.innerText");
  assert.match(text,/350/);assert.match(text,/1\/3/);assert.match(text,/8\/30/);
  for (const locale of ["en", "zh-CN"]) {
    await evaluate(`(() => { const select = [...document.querySelectorAll('select')].find(el => [...el.options].some(option => option.value === 'zh-CN')); if (!select) throw new Error('Locale selector missing'); select.value = '${locale}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await pause(400);
    const heading = await evaluate("document.querySelector('section h1')?.textContent");
    assert.match(heading, locale === "en" ? /Invite/i : /邀请/);
  }
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true);
  for(const [width,height,name] of [[1440,1000,"desktop"],[390,844,"mobile"]]){
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<600});await pause(250);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true,`${name} horizontal overflow`);
    const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
    const path=join(tmpdir(),`dreamface-referral-${name}.png`);writeFileSync(path,Buffer.from(screenshot.data,"base64"));console.log(path);
  }
  blockedRegion=true;
  await send("Page.navigate",{url:"http://127.0.0.1:3000/studio?view=referrals"});
  await pause(1800);
  assert.equal(await evaluate("Boolean(document.querySelector('#referral-link'))"),false,"Blocked regions must not show invitation details");
  assert.equal(await evaluate("Boolean(document.querySelector('a[href=\"/studio?view=referrals\"]'))"),false,"Blocked regions must not show invitation navigation");
  await send("Page.navigate",{url:"http://127.0.0.1:3000/auth"});
  await pause(1200);
  assert.equal(await evaluate("Boolean(document.querySelector('#signup-referral'))"),false,"Blocked registration must not show referral code input");
  assert.equal(errors.length,0,errors.join("; "));
  console.log("Referral UI fixtures passed: hydrated invitation page, quota/history data, desktop/mobile without horizontal overflow. No live API requests.");
} finally {await send("Page.navigate",{url:"about:blank"}).catch(()=>{});await send("Fetch.disable").catch(()=>{});socket.close();}
