// Optional browser smoke test. App: localhost:3000. Isolated Chromium CDP: localhost:9353.
// All APIs and external requests are fixtures; this script never creates a real payment.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const tabs=await(await fetch('http://127.0.0.1:9353/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0,balance=100,orderCount=0,failCapture=false,failConfig=false,configCount=0;
let releaseApple;
const appleGate=new Promise(resolve=>{releaseApple=resolve;});
const requests=new Map(),orders=new Map(),errors=[],sdkRequests=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const sdk=`window.dreamfacePayPal={Applepay:()=>({config:async()=>{if(window.fixtureAppleFailure)throw new Error('Fixture Apple unavailable');return{isEligible:!window.fixtureAppleIneligible,countryCode:'GB',merchantCapabilities:['supports3DS'],supportedNetworks:['visa']};},validateMerchant:async()=>({merchantSession:{}}),confirmOrder:async()=>({status:'APPROVED'})}),Googlepay:()=>({config:async()=>({allowedPaymentMethods:[{type:'CARD'}],merchantInfo:{merchantName:'DreamFace'}}),confirmOrder:async()=>({status:'APPROVED'}),initiatePayerAction:async()=>({liabilityShift:'POSSIBLE'})})};`;
const appleSdk=`if(!customElements.get('apple-pay-button'))customElements.define('apple-pay-button',class extends HTMLElement{connectedCallback(){this.textContent='Apple Pay';this.setAttribute('role','button');this.tabIndex=0;Object.assign(this.style,{background:'#000',color:'#fff',textAlign:'center',lineHeight:'48px',borderRadius:'12px',cursor:'pointer',fontWeight:'700'});}});window.ApplePaySession=class{static canMakePayments(){return true;}static STATUS_SUCCESS=1;static STATUS_FAILURE=0;begin(){queueMicrotask(async()=>{await this.onvalidatemerchant({validationURL:'https://apple.invalid/session'});await this.onpaymentauthorized({payment:{token:{},billingContact:{}}});});}completeMerchantValidation(){}completePayment(){}abort(){}};`;
const googleSdk=`window.google={payments:{api:{PaymentsClient:class{constructor(options){this.options=options;}async isReadyToPay(){return{result:!window.fixtureGoogleIneligible};}createButton(options){const button=document.createElement('button');button.textContent='Google Pay';button.type='button';Object.assign(button.style,{background:'#000',color:'#fff',width:'100%',height:'48px',borderRadius:'12px',fontWeight:'700'});button.onclick=options.onClick;return button;}loadPaymentData(){return this.options.paymentDataCallbacks.onPaymentAuthorized({paymentMethodData:{}});}}}}};`;
socket.addEventListener('message',event=>{
 const message=JSON.parse(event.data);
 if(message.id){const item=requests.get(message.id);if(item){requests.delete(message.id);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}return;}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
 if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params,url=new URL(request.url),path=url.pathname;
 let body={},status=200,type='application/json';
 if(path==='/api/auth/session')body={session:{access_token:'wallet-ui-fixture',expires_at:'2099-01-01T00:00:00Z',user:{id:'fixture-user',email:'fixture@example.invalid'}}};
 else if(path==='/api/credits')body={balance,ledger:[],purchases:[],subscriptions:[]};
 else if(path==='/api/tasks')body={tasks:[]};
 else if(path==='/api/model-availability')body={models:{dreamfaceIo:false}};
 else if(path==='/api/model-pricing')body={rows:[]};
 else if(path==='/api/referrals/availability')body={visible:false};
 else if(path==='/api/billing/payment-methods')body={providers:['paypal','dodo']};
 else if(path==='/api/billing/paypal/wallet-config'){configCount++;if(failConfig){status=503;body={error:'Fixture config failed'};}else body={enabled:true,clientId:'fixture-public-id',environment:'TEST',merchantCountry:'GB'};}
 else if(path==='/api/billing/paypal/wallet-orders'){
  const input=JSON.parse(request.postData);assert.equal(input.expectedAmountCents,499);assert.equal(input.expectedCredits,800);assert.match(request.headers.Authorization||request.headers.authorization,/Bearer wallet-ui-fixture/);
  const orderId='ORDER'+String(++orderCount).padStart(8,'0');orders.set(orderId,{paid:false});body={orderId,amountCents:499,credits:800,currency:'USD',provider:'paypal'};
 }else if(path==='/api/billing/paypal/capture'){
  const {orderId}=JSON.parse(request.postData);
  if(failCapture){failCapture=false;status=502;body={error:'Fixture confirmation unavailable'};}
  else{const order=orders.get(orderId);assert.ok(order);if(!order.paid){balance+=800;order.paid=true;}body={completed:true,orderId,transactionId:'CAPTURE'+orderId,packId:'starter',credits:800,amountCents:499,currency:'USD'};}
 }else if(path==='/api/billing/checkout'){status=503;body={error:'Fixture checkout unavailable'};}
 else if(url.hostname==='www.paypal.com'&&path==='/sdk/js'){sdkRequests.push('paypal');body=sdk;type='application/javascript';}
 else if(url.hostname==='applepay.cdn-apple.com'){sdkRequests.push('apple');body=appleSdk;type='application/javascript';}
 else if(url.hostname==='pay.google.com'){sdkRequests.push('google');body=googleSdk;type='application/javascript';}
 else if(url.hostname!=='127.0.0.1'){status=204;body='';type='text/plain';}
 void (async()=>{
  if(url.hostname==='applepay.cdn-apple.com')await appleGate;
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')});
 })().catch(error=>{if(!/Invalid InterceptionId|closed|not found/.test(error.message))errors.push(error.message);});
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await pause(250);}throw new Error('Timed out: '+expression);}
async function openPayment(ready=true){await evaluate(`document.querySelector('[data-credit-pack-select="starter"]').click()`);await wait(`Boolean(document.querySelector('[data-credit-payment-dialog]'))`);if(ready)await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='ready' && document.querySelector('[data-wallet-slot="googlepay"]')?.dataset.walletStatus==='ready'`);}
async function closePayment(){await evaluate(`document.querySelector('[data-credit-payment-dialog] button[aria-label="Close"]').click()`);await wait(`!document.querySelector('[data-credit-payment-dialog]')`);}
async function shot(name){const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('outputs/wallet-loading/'+name+'.png',Buffer.from(screenshot.data,'base64'));}
try {
 mkdirSync('outputs/wallet-loading',{recursive:true});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:3000/api/*'},{urlPattern:'https://*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en');sessionStorage.removeItem('dreamface_wallet_pending_order');}catch{}"});
 for(const [width,height,name] of [[1440,1000,'desktop'],[390,844,'mobile']]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Page.navigate',{url:'http://127.0.0.1:3000/en/price'});
  await wait(`Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))`);
  await wait(`document.querySelectorAll('script[data-dreamface-wallet-sdk]').length===3`);
  assert.equal(orderCount,name==='desktop'?0:2,'Preloading cannot create orders');
  const configurationBefore=configCount,scriptsBefore=sdkRequests.length;
  if(name==='desktop'){
   await openPayment(false);
   await wait(`document.querySelector('[data-wallet-slot="googlepay"]')?.dataset.walletStatus==='ready'`);
   assert.equal(await evaluate(`document.querySelector('[data-wallet-slot="applepay"]').dataset.walletStatus`),'loading');
   assert.equal(await evaluate(`document.querySelector('[data-payment-provider="paypal"]').disabled`),false);
   await shot('desktop-loading');releaseApple();
   await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='ready'`);
   await closePayment();
   await evaluate(`window.fixtureAppleFailure=true`);await openPayment(false);
   await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='error' && document.querySelector('[data-wallet-slot="googlepay"]')?.dataset.walletStatus==='ready'`);
   await evaluate(`window.workingGoogleButton=document.querySelector('[data-wallet-container="googlepay"] button')`);
   await shot('desktop-retry');await evaluate(`window.fixtureAppleFailure=false;document.querySelector('[data-wallet-load-retry="applepay"]').click()`);
   await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='ready'`);
   assert.equal(await evaluate(`window.workingGoogleButton===document.querySelector('[data-wallet-container="googlepay"] button')`),true);
   await closePayment();
  }
  await openPayment();
  assert.equal(configCount,configurationBefore,'Repeated opens reuse public configuration');assert.equal(sdkRequests.length,scriptsBefore,'Repeated opens reuse SDK downloads');
  const text=await evaluate(`document.querySelector('[data-credit-payment-dialog]').innerText`);
  for(const expected of ['Starter Pack','800','4.99','Apple Pay','Google Pay','PayPal'])assert.ok(text.includes(expected),expected);
  assert.equal(await evaluate(`!!document.querySelector('[data-payment-provider="dodo"]')`),false,'Suspended card checkout stays suspended');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await shot(name+'-ready');
  await evaluate(`document.querySelector('[data-payment-provider="paypal"]').click()`);await wait(`document.querySelector('[data-credit-payment-dialog] [role="alert"]')?.innerText.includes('Fixture checkout unavailable')`);
  await evaluate(`document.querySelector('apple-pay-button').click()`);await wait(`document.querySelector('[data-credit-payment-dialog]')?.innerText.includes('Payment confirmed')`);
  assert.equal(await evaluate(`document.querySelector('[data-credit-payment-dialog] [role="alert"]')===null`),true);
  await closePayment();
  await openPayment();failCapture=true;
  await evaluate(`document.querySelector('[data-wallet-container="googlepay"] button').click()`);await wait(`Boolean(document.querySelector('[data-wallet-retry]')) && !document.querySelector('[data-wallet-retry]').disabled`);
  const before=orderCount;await evaluate(`document.querySelector('[data-wallet-retry]').click()`);await wait(`document.querySelector('[data-credit-payment-dialog]')?.innerText.includes('Payment confirmed')`);assert.equal(orderCount,before,'Recovery must reuse the existing order');
  await closePayment();
  await evaluate(`window.fixtureAppleIneligible=true;window.fixtureGoogleIneligible=true`);await openPayment(false);
  await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='unavailable' && document.querySelector('[data-wallet-slot="googlepay"]')?.dataset.walletStatus==='unavailable'`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-wallet-load-retry]').length`),0,'Ineligible devices must not be presented as a network error');
  assert.equal(await evaluate(`document.querySelector('[data-payment-provider="paypal"]').getBoundingClientRect().height>=44`),true);
  await closePayment();
  await send('Page.navigate',{url:'http://127.0.0.1:3000/studio?mode=image&workflow=text-to-image'});
  await wait(`[...document.querySelectorAll('button')].some(button=>button.getAttribute('aria-label')==='Buy credits')`);
  await wait(`document.querySelector('button[aria-label="Buy credits"]')?.onclick !== null`);
  await pause(600);
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')==='Buy credits').click()`);
  await wait(`Boolean(document.querySelector('[aria-labelledby="credit-shop-title"]'))`);await openPayment();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait(`!document.querySelector('[data-credit-payment-dialog]')`);
  assert.equal(await evaluate(`Boolean(document.querySelector('[aria-labelledby="credit-shop-title"]'))`),true,'Closing payment dialog must retain Studio pack selection');
 }
 // Configuration errors expose a retry while keeping the redirect method usable.
 failConfig=true;
 await send('Page.navigate',{url:'http://127.0.0.1:3000/en/price'});
 await wait(`Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))`);
 await openPayment(false);await wait(`document.querySelectorAll('[data-wallet-load-retry]').length===2`);
 assert.equal(await evaluate(`document.querySelector('[data-payment-provider="paypal"]').disabled`),false);
 failConfig=false;await evaluate(`document.querySelector('[data-wallet-load-retry="applepay"]').click()`);
 await wait(`document.querySelector('[data-wallet-slot="applepay"]')?.dataset.walletStatus==='ready' && document.querySelector('[data-wallet-slot="googlepay"]')?.dataset.walletStatus==='ready'`);
 await closePayment();
 assert.deepEqual(errors,[]);
 writeFileSync('outputs/wallet-loading/browser-regression.json',JSON.stringify({passed:true,orders:orderCount,configRequests:configCount,sdkRequests,checks:['preload before selection','parallel downloads','independent loading','working Google retained during Apple retry','cached reopen','unsupported vs error','configuration retry','desktop/mobile','Apple capture','Google capture recovery reuses order','nested Studio close'],errors},null,2));
 console.log('Wallet desktop/mobile UI passed: preloading before selection, independent placeholders/readiness, isolated retries, cached reopen, unsupported/config failure states, PayPal fallback, Apple purchase and Google recovery with the same order. All APIs and SDKs mocked.');
} finally {socket.close();}
