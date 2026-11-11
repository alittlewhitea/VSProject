// Requires the local production build :3000 and this task's headless CDP :9353.
// Every API and every external resource is intercepted; no live user/provider calls.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='http://127.0.0.1:3000',tab=await(await fetch('http://127.0.0.1:9353/json/new?about:blank',{method:'PUT'})).json(),socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const waiting=new Map(),errors=[],actions=[],inspections=[];let sequence=0,resolved=false;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
const pending=()=>({id:'qa-pending',userId:'qa-user',mode:'video',provider:'grok-video',prompt:'Fixture pending job',status:resolved?'failed':'queued',estimatedCredits:10,chargedCredits:10,chargeLedgerId:'fixture-ledger',refundedCredits:resolved?10:0,refundLedgerId:resolved?'fixture-refund':null,refundStatus:resolved?'refunded':'not_applicable',transport:'real',providerRequestId:null,outputUrl:null,createdAt:'2026-11-01T00:00:00Z',updatedAt:null,title:null,failureCode:'provider_submission_unknown',failureReason:'The provider result is awaiting confirmation.',lastCheckedAt:null,timedOutAt:null});
socket.addEventListener('message',async event=>{
 const message=JSON.parse(event.data);if(message.id){const item=waiting.get(message.id);if(item){waiting.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}return;}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
 if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params,url=new URL(request.url);let body={},status=200,type='application/json';
 try {
  if(url.origin!==origin){await send('Fetch.fulfillRequest',{requestId,responseCode:204,body:''});return;}
  if(url.pathname==='/api/auth/session')body={session:{access_token:'cookie:qa-placeholder',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}};
  else if(url.pathname==='/api/admin/tasks'){
   if(request.method==='POST'){const input=JSON.parse(request.postData);actions.push(input);if(input.action==='resolve_no_job')resolved=true;body={task:pending(),providerStatus:'RECONCILED'};}
   else body={adminEmail:'admin-fixture@example.invalid',items:[pending()],totals:{all:1,failed:resolved?1:0,refunded:resolved?1:0,notRefundedFailures:0}};
  } else if(url.pathname==='/api/credits')body={balance:1000,ledger:[],purchases:[],subscriptions:[]};
  else if(url.pathname==='/api/tasks')body={tasks:[]};
  else if(url.pathname==='/api/model-pricing')body={rows:[]};
  else if(url.pathname==='/api/referrals/availability')body={visible:false};
  else if(url.pathname==='/api/generate/audio/inspect'){
   inspections.push(JSON.parse(request.postData));await new Promise(resolve=>setTimeout(resolve,700));
   body={audioUrl:origin+'/api/uploads/generation-inputs/qa-user/audio-'+'a'.repeat(64)+'.wav',seconds:2.2,billableSeconds:3};
  }
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 } catch(error){errors.push(error.message);await send('Fetch.failRequest',{requestId,errorReason:'Aborted'}).catch(()=>{});}
});
const evaluate=async(expression)=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
async function until(expression){const deadline=Date.now()+12000;while(Date.now()<deadline){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,120));}throw new Error('UI timeout: '+expression);}
mkdirSync('outputs/priority-ui',{recursive:true});
try {
 await send('Runtime.enable');await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'https://*'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:origin+'/admin/tasks'});
 await until(`Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Review')`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='Review').click()`);
 await until(`document.body.innerText.includes('Confirmed total provider cost')`);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Settle confirmed failure').disabled`),true,'Manual settlement starts disabled without provider evidence');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'Mobile review form fits the viewport');
 const mobile=await send('Page.captureScreenshot',{format:'png'});writeFileSync('outputs/priority-ui/admin-review-mobile.png',Buffer.from(mobile.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const desktop=await send('Page.captureScreenshot',{format:'png'});writeFileSync('outputs/priority-ui/admin-review-desktop.png',Buffer.from(desktop.data,'base64'));
 await evaluate(`(()=>{const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Provider support fixture confirms no active job and zero cost');input.dispatchEvent(new Event('input',{bubbles:true}));Array.from(document.querySelectorAll('input[type=checkbox]')).find(input=>input.closest('label').textContent.includes('provider confirmed')).click();})()`);
 await until(`!Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Settle confirmed failure').disabled`);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='Settle confirmed failure').click()`);await until(`!document.body.innerText.includes('Review pending task')`);
 assert.equal(actions.length,1);assert.equal(actions[0].action,'resolve_no_job');assert.equal(actions[0].providerConfirmedNoJob,true);assert.equal(actions[0].confirmedCostUsd,0);assert.ok(actions[0].note.length>=12);
 await send('Page.navigate',{url:origin+'/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard&audioUrl='+encodeURIComponent('https://voice-fixture.invalid/sample.mp3')});
 await until(`Boolean(document.body?.innerText.includes('Avatar'))`);
 const deadline=Date.now()+12000;while(!inspections.length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,120));assert.equal(inspections.length,1,'Remote audio is sent for server verification after login');assert.equal(inspections[0].audioUrl,'https://voice-fixture.invalid/sample.mp3');
 await new Promise(resolve=>setTimeout(resolve,900));assert.equal(errors.length,0,JSON.stringify(errors));
 const audio=await send('Page.captureScreenshot',{format:'png'});writeFileSync('outputs/priority-ui/avatar-audio-verified.png',Buffer.from(audio.data,'base64'));
 console.log('UI passed: mobile/desktop Admin review layout, disabled settlement without evidence, audited-action request payload, and authenticated Avatar remote-audio verification. All APIs/resources mocked; screenshots saved under outputs/priority-ui.');
} finally {await send('Fetch.disable').catch(()=>{});await fetch('http://127.0.0.1:9353/json/close/'+tab.id).catch(()=>{});if(socket.readyState!==WebSocket.CLOSED)await new Promise(resolve=>{socket.addEventListener('close',resolve,{once:true});setTimeout(resolve,1000);});}
