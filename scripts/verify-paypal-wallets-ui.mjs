// Optional browser smoke test. App: localhost:3000. Isolated Chromium CDP: localhost:9353.
// All APIs and external requests are fixtures; this script never creates a real payment.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const tabs=await(await fetch('http://127.0.0.1:9353/json/list')).json();
const socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let sequence=0,balance=100,orderCount=0,failCapture=false;
const requests=new Map(),orders=new Map(),errors=[],sdkRequests=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const sdk=`window.dreamfacePayPal={Applepay:()=>({config:async()=>({isEligible:true,countryCode:'GB',merchantCapabilities:['supports3DS'],supportedNetworks:['visa']}),validateMerchant:async()=>({merchantSession:{}}),confirmOrder:async()=>({status:'APPROVED'})}),Googlepay:()=>({config:async()=>({allowedPaymentMethods:[{type:'CARD'}],merchantInfo:{merchantName:'DreamFace'}}),confirmOrder:async()=>({status:'APPROVED'}),initiatePayerAction:async()=>({liabilityShift:'POSSIBLE'})})};`;
const appleSdk=`if(!customElements.get('apple-pay-button'))customElements.define('apple-pay-button',class extends HTMLElement{connectedCallback(){this.textContent='Apple Pay';this.setAttribute('role','button');this.tabIndex=0;Object.assign(this.style,{background:'#000',color:'#fff',textAlign:'center',lineHeight:'48px',borderRadius:'12px',cursor:'pointer',fontWeight:'700'});}});window.ApplePaySession=class{static canMakePayments(){return true;}static STATUS_SUCCESS=1;static STATUS_FAILURE=0;begin(){queueMicrotask(async()=>{await this.onvalidatemerchant({validationURL:'https://apple.invalid/session'});await this.onpaymentauthorized({payment:{token:{},billingContact:{}}});});}completeMerchantValidation(){}completePayment(){}abort(){}};`;
const googleSdk=`window.google={payments:{api:{PaymentsClient:class{constructor(options){this.options=options;}async isReadyToPay(){return{result:true};}createButton(options){const button=document.createElement('button');button.textContent='Google Pay';button.type='button';Object.assign(button.style,{background:'#000',color:'#fff',width:'100%',height:'48px',borderRadius:'12px',fontWeight:'700'});button.onclick=options.onClick;return button;}loadPaymentData(){return this.options.paymentDataCallbacks.onPaymentAuthorized({paymentMethodData:{}});}}}}};`;
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
 else if(path==='/api/billing/paypal/wallet-config')body={enabled:true,clientId:'fixture-public-id',environment:'TEST',merchantCountry:'GB'};
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
 void send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>errors.push(error.message));
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await pause(250);}throw new Error('Timed out: '+expression);}
async function openPayment(){await evaluate(`document.querySelector('[data-credit-pack-select="starter"]').click()`);await wait(`Boolean(document.querySelector('[data-credit-payment-dialog] apple-pay-button')) && Boolean(document.querySelector('[data-wallet-container="googlepay"] button'))`);}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Fetch.enable',{patterns:[{urlPattern:'http://127.0.0.1:3000/api/*'},{urlPattern:'https://*'}]});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en');sessionStorage.removeItem('dreamface_wallet_pending_order');}catch{}"});
 for(const [width,height,name] of [[1440,1000,'desktop'],[390,844,'mobile']]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  await send('Page.navigate',{url:'http://127.0.0.1:3000/en/price'});
  await wait(`document.querySelectorAll('[data-credit-pack-select]').length===4`);await pause(1000);
  assert.equal(await evaluate(`document.querySelectorAll('script[data-dreamface-wallet-sdk]').length`),0,'Wallet SDK must stay lazy');
  await openPayment();
  const text=await evaluate(`document.querySelector('[data-credit-payment-dialog]').innerText`);
  for(const expected of ['Starter Pack','800','4.99','Apple Pay','Google Pay','PayPal','Credit Card'])assert.ok(text.includes(expected),expected);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const file=join(tmpdir(),'dreamface-wallet-dialog-'+name+'.png');writeFileSync(file,Buffer.from(screenshot.data,'base64'));console.log(file);
  await evaluate(`document.querySelector('[data-payment-provider="dodo"]').click()`);await wait(`document.querySelector('[data-credit-payment-dialog] [role="alert"]')?.innerText.includes('Fixture checkout unavailable')`);
  await evaluate(`document.querySelector('apple-pay-button').click()`);await wait(`document.querySelector('[data-credit-payment-dialog]')?.innerText.includes('Payment confirmed')`);
  assert.equal(await evaluate(`document.querySelector('[data-credit-payment-dialog] [role="alert"]')===null`),true);
  await evaluate(`document.querySelector('[data-credit-payment-dialog] button[aria-label="Close"]').click()`);
  await openPayment();failCapture=true;
  await evaluate(`document.querySelector('[data-wallet-container="googlepay"] button').click()`);await wait(`Boolean(document.querySelector('[data-wallet-retry]')) && !document.querySelector('[data-wallet-retry]').disabled`);
  const before=orderCount;await evaluate(`document.querySelector('[data-wallet-retry]').click()`);await wait(`document.querySelector('[data-credit-payment-dialog]')?.innerText.includes('Payment confirmed')`);assert.equal(orderCount,before,'Recovery must reuse the existing order');
  await evaluate(`document.querySelector('[data-credit-payment-dialog] button[aria-label="Close"]').click()`);
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
 assert.deepEqual(errors,[]);console.log('Wallet desktop/mobile UI passed: lazy SDKs, unified dialog, card fallback, Apple purchase, Google recovery without another order, responsive layout and nested Studio dialogs. No real payments.');
} finally {socket.close();}
