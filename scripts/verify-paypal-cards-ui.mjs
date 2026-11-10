// Local :3000 and an owned Chrome CDP :9353. All APIs and external SDKs mocked.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='http://127.0.0.1:3000';
const tab=await(await fetch('http://127.0.0.1:9353/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),errors=[],orders=[],captures=[],analytics=[];let sequence=0,captureMode='success';
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
const sdk=`window.dreamfacePayPal={Applepay:()=>({config:async()=>({isEligible:false})}),Googlepay:()=>({config:async()=>({isEligible:false})}),CardFields:options=>{
 const field=label=>{let iframe;return{render:async host=>{if(window.cardRenderFailure)throw new Error('Fixture loading failure');iframe=document.createElement('iframe');iframe.title=label;iframe.style='height:100%;width:100%;border:0';host.replaceChildren(iframe);},close:()=>iframe?.remove()}};
 return{isEligible:()=>!window.cardIneligible,NameField:()=>field('Cardholder name'),NumberField:()=>field('Card number'),ExpiryField:()=>field('Expiry'),CVVField:()=>field('CVV'),getState:async()=>({isFormValid:!window.cardInvalid}),submit:async()=>{
  const orderID=await options.createOrder();if(window.cardCanceled)throw new Error('Fixture cancel');await Promise.all([options.onApprove({orderID,liabilityShift:'POSSIBLE'}),options.onApprove({orderID,liabilityShift:'POSSIBLE'})]);
 }};}};`;
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params,url=new URL(request.url);let body={},status=200,type='application/json';
 if(url.pathname==='/api/auth/session')body={session:{access_token:'qa-card-only',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}};
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/model-pricing')body={rows:[]};
 if(url.pathname==='/api/model-availability')body={models:{dreamfaceIo:false}};
 if(url.pathname==='/api/referrals/availability')body={visible:false};
 if(url.pathname==='/api/billing/paypal/wallet-config')body={enabled:true,clientId:'qa-client-only',environment:'TEST',merchantCountry:'GB'};
 if(url.pathname==='/api/billing/paypal/wallet-orders'){
  const input=JSON.parse(request.postData);orders.push(input);assert.deepEqual(Object.keys(input).sort(),['expectedAmountCents','expectedCredits','packId','wallet']);assert.equal(input.wallet,'card');assert.equal(input.expectedAmountCents,499);assert.equal(input.expectedCredits,800);
  body={orderId:'ORDER'+String(orders.length).padStart(8,'0'),amountCents:499,credits:800,currency:'USD'};
 }
 if(url.pathname==='/api/billing/paypal/capture'){
  const input=JSON.parse(request.postData);captures.push(input);assert.deepEqual(Object.keys(input),['orderId']);
  if(captureMode==='uncertain'){captureMode='success';status=502;body={error:'Fixture capture uncertain'};}
  else if(captureMode==='auth-failed'){status=409;body={error:'Fixture authentication refused',code:'paypal_authentication_failed'};}
  else body={completed:true,orderId:input.orderId,transactionId:'CAPTURE'+input.orderId,packId:'starter',credits:800,amountCents:499,currency:'USD'};
 }
 if(url.pathname==='/api/analytics/track')analytics.push(JSON.parse(request.postData));
 if(url.hostname==='www.paypal.com'&&url.pathname==='/sdk/js'){assert.ok(url.searchParams.get('components').split(',').includes('card-fields'));body=sdk;type='application/javascript';}
 else if(url.hostname==='applepay.cdn-apple.com'){body='window.ApplePaySession=class {static canMakePayments(){return false}}';type='application/javascript';}
 else if(url.hostname==='pay.google.com'){body='';type='application/javascript';}
 else if(url.hostname!=='127.0.0.1'){status=204;body='';type='text/plain';}
 void send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>{if(!/closed|Invalid InterceptionId/.test(error.message))errors.push(error.message);});
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let n=0;n<160;n++){if(await evaluate(expression))return;await pause(125);}throw new Error(expression);}
async function open(){await evaluate("document.querySelector('[data-credit-pack-select=starter]').click()");await wait("!!document.querySelector('[data-payment-provider=paypal-card]')");await evaluate("document.querySelector('[data-payment-provider=paypal-card]').click()");await wait("document.querySelector('[data-card-status]')?.dataset.cardStatus!=='loading'");}
async function close(){await evaluate("document.querySelector('[data-credit-payment-dialog] button[aria-label=Close]').click()");await wait("!document.querySelector('[data-credit-payment-dialog]')");}
async function address(){await evaluate("{const form=document.querySelector('[data-paypal-card-payment] form');for(const [name,value] of Object.entries({countryCode:'GB',addressLine1:'Fixture street',adminArea2:'Fixture city',postalCode:'SW1A 1AA'})){form.elements.namedItem(name).value=value;}} ");}
async function shot(name){const result=await send('Page.captureScreenshot',{format:'png'});writeFileSync('outputs/paypal-cards/'+name+'.png',Buffer.from(result.data,'base64'));}
try{
 mkdirSync('outputs/paypal-cards',{recursive:true});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'https://*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('dreamface_locale','en');sessionStorage.removeItem('dreamface_wallet_pending_order')"});
 for(const [width,height] of [[1440,1000],[390,844],[320,740]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:origin+'/en/price'});
  await wait("Object.keys(document.querySelector('[data-credit-pack-select=starter]')||{}).some(key=>key.startsWith('__reactProps'))");
  const before=orders.length;await open();assert.equal(await evaluate("document.querySelector('[data-card-status]').dataset.cardStatus"),'ready');assert.equal(orders.length,before,'Rendering card fields cannot create a purchase');
  assert.equal(await evaluate("document.querySelectorAll('[data-card-field] iframe').length"),4);assert.equal(await evaluate("!!document.querySelector('[data-payment-provider=dodo]')"),false);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await address();await evaluate("document.querySelector('[data-paypal-card-payment] form').scrollIntoView({block:'start'})");await shot('form-'+width);
  await evaluate("window.cardInvalid=true;document.querySelector('[data-card-pay]').click()");await wait("!!document.querySelector('[data-paypal-card-payment] [role=alert]')");assert.equal(orders.length,before);
  await evaluate("window.cardInvalid=false");captureMode='uncertain';const captureBefore=captures.length;
  await evaluate("document.querySelector('[data-card-pay]').click();document.querySelector('[data-card-pay]').click()");await wait("!!document.querySelector('[data-wallet-retry]')&&!document.querySelector('[data-wallet-retry]').disabled");
  assert.equal(orders.length,before+1);assert.equal(captures.length,captureBefore+1);assert.equal(await evaluate("document.querySelector('[data-payment-provider=paypal]').disabled"),true);
  await evaluate("document.querySelector('[data-wallet-retry]').click()");await wait("document.querySelector('[data-credit-payment-dialog]').innerText.includes('Payment confirmed')");assert.equal(orders.length,before+1);assert.equal(captures.at(-1).orderId,captures.at(-2).orderId);await close();
  await open();await address();captureMode='auth-failed';await evaluate("document.querySelector('[data-card-pay]').click()");await wait("!!document.querySelector('[data-credit-payment-dialog] [role=alert]')&&!document.querySelector('[data-payment-provider=paypal]').disabled");assert.equal(await evaluate("!!document.querySelector('[data-wallet-retry]')"),false,'An explicitly rejected, uncaptured order does not block another payment method');captureMode='success';await close();
  await evaluate("window.cardIneligible=true");const noOrder=orders.length;await open();assert.equal(await evaluate("document.querySelector('[data-card-status]').dataset.cardStatus"),'unavailable');assert.equal(orders.length,noOrder);assert.equal(await evaluate("document.querySelector('[data-payment-provider=paypal]').disabled"),false);await close();await evaluate("window.cardIneligible=false;window.cardRenderFailure=true");
  await open();assert.equal(await evaluate("document.querySelector('[data-card-status]').dataset.cardStatus"),'error');await evaluate("window.cardRenderFailure=false;document.querySelector('[data-card-load-retry]').click()");await wait("document.querySelector('[data-card-status]')?.dataset.cardStatus==='ready'");await close();
 }
 assert.deepEqual(errors,[]);
 writeFileSync('outputs/paypal-cards/browser.json',JSON.stringify({passed:true,widths:[1440,390,320],orders:orders.length,captures:captures.length,checks:['hosted fields','no Dodo','invalid card creates no order','single submit and approval','uncertain capture recovery same order','3DS refusal permits fallback','ineligible fallback','load failure retry','no card data in own APIs'],errors},null,2));
 console.log('PayPal card UI passed: desktop/mobile/320px fields, no Dodo dependency, validation, concurrent clicks, capture recovery, 3DS failure fallback, ineligible and load retry. All business APIs and external SDKs mocked.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1200)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
