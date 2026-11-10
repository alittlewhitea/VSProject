// Disposable Chrome CDP :9564, local Next :3000. All business APIs and GTM mocked.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const origin='http://127.0.0.1:3000';

const stamp=n=>new Date(Date.UTC(2026,10,10,12-n)).toISOString();
const users=Array.from({length:15},(_,n)=>({id:'user-'+n,email:'member-'+n+'@example.invalid',createdAt:stamp(n),lastSignInAt:stamp(n),balance:100,creditsSpent:10,creditsRefunded:0,creditsPurchased:100,purchaseRevenueCents:500,completedPurchases:1,generationTasks:2,completedTasks:1,failedTasks:1,runningTasks:0,hasSpentCredits:true,countryCode:'US',countryName:'United States',countryEventCount:2}));
const purchases=Array.from({length:12},(_,n)=>({id:n,user_id:'user-'+n,payment_provider:'paypal',provider_transaction_id:'transaction-'+n,pack_id:'pack-'+n,credits:100,amount_cents:500,currency:'usd',status:'completed',created_at:stamp(n),updated_at:stamp(n)}));
purchases.reverse();
const tasks=Array.from({length:12},(_,n)=>({id:'task-'+n,user_id:'user-'+n,mode:'video',provider:'mischief-video',prompt:'Test motion '+n,status:'failed',estimated_credits:9,transport:'real',failure_reason:'Fixture failure',created_at:stamp(n)}));
const fixture={adminEmail:'admin@example.invalid',summary:{authUsers:15},users,purchases,tasks,failedTasks:tasks,ledger:purchases.map(p=>({id:p.id,user_id:p.user_id,amount:-9,reason:'generation',created_at:p.created_at})),accounts:users.map(u=>({user_id:u.id,balance:100,free_granted:true,updated_at:u.createdAt})),subscriptions:[{id:'sub-1',user_id:'user-0',payment_provider:'paypal',plan_id:'old-plan',cycle:'monthly',status:'active',credits_per_cycle:100}],analytics:{summary:{totalEvents:12,todayEvents:12,uniqueUsers:12,uniqueSessions:12,byEvent:{},byModel:{},byMode:{},byCountry:{}},funnel:[],countries:[],recentEvents:tasks.map((t,n)=>({event_name:'event-'+n,user_id:t.user_id,created_at:t.created_at,properties:{index:n}}))}};

const tab=await(await fetch('http://127.0.0.1:9564/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),events=[],requests=[],errors=[];let sequence=0;let empty=false;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Fetch.requestPaused'){
 const {requestId,request}=message.params,url=new URL(request.url);let body={},responseCode=200,type='application/json';requests.push({path:url.pathname,method:request.method});
 if(url.hostname.includes('googletagmanager')){body='';type='text/javascript';}
 if(url.pathname==='/api/auth/session')body={session:{access_token:'qa-only',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}};
 if(url.pathname==='/api/analytics/track')events.push(JSON.parse(request.postData));
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/admin/ops'){const id=url.searchParams.get('userId');body=empty?{...fixture,users:[],purchases:[],ledger:[],tasks:[],failedTasks:[],analytics:{...fixture.analytics,recentEvents:[]}}:id?{...fixture,users:fixture.users.filter(u=>u.id===id),purchases:fixture.purchases.filter(p=>p.user_id===id),ledger:fixture.ledger.filter(p=>p.user_id===id),tasks:fixture.tasks.filter(p=>p.user_id===id),failedTasks:fixture.tasks.filter(p=>p.user_id===id)}:fixture;}
 void send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>{if(!/closed|Invalid InterceptionId/.test(error.message))errors.push(error.message);});
}});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let n=0;n<220;n++){if(await evaluate(expression))return;await pause(150);}throw new Error(expression);}
async function navigate(path){await send('Page.navigate',{url:origin+path});}
async function screenshot(name){const value=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('outputs/admin/'+name+'.png',Buffer.from(value.data,'base64'));}
async function tap(selector,text){
 const expression=text?`[...document.querySelectorAll(${JSON.stringify(selector)})].find(node=>node.textContent.trim()===${JSON.stringify(text)})`:`document.querySelector(${JSON.stringify(selector)})`;
 await evaluate(`(${expression}).scrollIntoView({block:'center',behavior:'instant'})`);await pause(70);
 const rect=await evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
 assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=900,'Control is fully inside the viewport: '+selector+' '+JSON.stringify(rect));
 const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
 if(width<600){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
}
let width=390;
const rows=id=>`document.querySelector('#${id}-records .divide-y')?.children.length`;
try{
 mkdirSync('outputs/admin',{recursive:true});await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'*googletagmanager.com/*'}]});
 for(const size of [390,320,1440]){
  width=size;empty=false;
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  await navigate('/admin');await wait(`${rows('users')}===3`);
  assert.equal(await evaluate("!!document.querySelector('#credit-accounts,#subscriptions,a[href=\"#credit-accounts\"],a[href=\"#subscriptions\"]')"),false);
  assert.equal(await evaluate("document.body.textContent.includes('Active subs')||document.body.textContent.includes('Past due subs')"),false);
  assert.ok(await evaluate("[...document.querySelectorAll('article[id]')].every(panel=>panel.getBoundingClientRect().width<=innerWidth)"),'Panel width '+width);
  assert.ok(await evaluate("[...document.querySelectorAll('#purchases-records .divide-y>div')].map(row=>row.textContent).every((text,index)=>text.includes('pack-'+index))"),'Latest purchases are first');
  for(const id of ['users','purchases','events','tasks','failed-tasks','credit-ledger']){
   assert.equal(await evaluate(rows(id)),3,id+' starts with three');
   await tap(`#${id} [data-panel-toggle]`);await wait(`${rows(id)}===10`);
   assert.equal(await evaluate(`document.querySelector('#${id} [data-panel-toggle]').getAttribute('aria-expanded')`),'true');
   if(id==='users'){
    await tap('#users-records button','Next');await wait(`${rows(id)}===5`);
    assert.ok(await evaluate("document.querySelector('#users-records .divide-y').textContent.includes('member-10@')"));
    await tap('#users-records button','Previous');await wait(`${rows(id)}===10`);
   }
   await tap(`#${id} [data-panel-collapse]`);await wait(`${rows(id)}===3`);await pause(150);
   assert.equal(await evaluate(`document.querySelector('#${id} [data-panel-toggle]').getAttribute('aria-expanded')`),'false');
  }
  await tap('#users-records .divide-y>button:first-child');await wait("document.querySelector('#user-detail').textContent.includes('member-0@')");
  await wait(`${rows('purchases')}===1`);
  assert.equal(await evaluate("!!document.querySelector('#purchases [data-panel-toggle]')"),false,'No meaningless expand control for a single result');
  await tap('#user-detail button','Clear user');await wait(`${rows('purchases')}===3`);
  await evaluate("document.getElementById('purchases').scrollIntoView({block:'start',behavior:'instant'})");await pause(100);await screenshot('purchases-'+width);
  await evaluate("document.getElementById('users').scrollIntoView({block:'start',behavior:'instant'})");await pause(100);await screenshot('users-'+width);
  empty=true;await tap('#overview button','Refresh');await wait("document.querySelector('#purchases-records').textContent.includes('No records')");
  assert.equal(await evaluate("!!document.querySelector('#purchases [data-panel-toggle]')"),false);
 }
 assert.deepEqual(errors,[]);
 assert.equal(requests.filter(request=>request.path==='/api/admin/ops'&&request.method!=='GET').length,0);
 writeFileSync('outputs/admin/regression.json',JSON.stringify({passed:true,widths:[320,390,1440],realTouchEvents:true,checks:['3/10 rows for six panels','pagination','latest purchases','user filtering','empty state','no obsolete sections','panel widths'],allApisMocked:true,errors},null,2));
 console.log('Admin UI passed at 320/390/1440px: real taps and clicks expand 3 to 10 rows, collapse, pagination, newest purchases, filtering, empty states and retired sections. All APIs and GTM mocked; no database, payment or admin mutations.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1800)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
