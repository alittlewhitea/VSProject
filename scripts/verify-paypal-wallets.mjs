import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url);
function load(path,mocks={}) {
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>{if(id in mocks)return mocks[id];if(id.startsWith('node:'))return native(id);throw new Error('Unmocked: '+id);},module,module.exports);
 return module.exports;
}
const pack={id:'starter',name:'Starter Pack',credits:800,amountCents:499};
let authenticated=true,ready=true,allowed=true,created=0;
const purchases=[];
const helper=load('src/lib/paypal-credit-checkout.ts',{
 './billing':{getCreditPack:id=>id==='starter'?pack:null},
 './paypal':{createPayPalOrder:async input=>{assert.equal(input.amountCents,499);assert.ok(['applepay','googlepay'].includes(input.wallet));created++;return{id:'ORDER1234'};},paypalApprovalUrl:()=>null},
 './mysql':{mysqlExecute:async(sql,args)=>purchases.push(args)}
});
const orderRoute=load('src/app/api/billing/paypal/wallet-orders/route.ts',{
 'next/server':{NextResponse:Response},
 '../../../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'owner'}:null},
 '../../../../../lib/billing':{getCreditPack:id=>id==='starter'?pack:null},
 '../../../../../lib/paypal':{paypalWalletConfiguration:()=>({enabled:ready,merchantCountry:'GB'})},
 '../../../../../lib/paypal-credit-checkout':helper,
 '../../../../../lib/request-security':{consumeRateLimit:async()=>({allowed}),trustedPublicOrigin:()=> 'https://dreamface.invalid'}
});
const request=body=>new Request('https://dreamface.invalid/api/billing/paypal/wallet-orders',{method:'POST',body:JSON.stringify(body)});
const body={packId:'starter',wallet:'applepay',expectedAmountCents:499,expectedCredits:800};
for(const wallet of ['applepay','googlepay']){
 const response=await orderRoute.POST(request({...body,wallet,credits:999999,amountCents:1}));
 assert.equal(response.status,200);assert.equal((await response.json()).orderId,'ORDER1234');assert.equal(purchases.at(-1)[0],'owner');
}
assert.equal((await orderRoute.POST(request({...body,expectedAmountCents:1}))).status,409);
assert.equal((await orderRoute.POST(request({...body,expectedCredits:99999}))).status,409);
assert.equal((await orderRoute.POST(request({...body,wallet:'invalid'}))).status,400);
authenticated=false;assert.equal((await orderRoute.POST(request(body))).status,401);authenticated=true;
ready=false;assert.equal((await orderRoute.POST(request(body))).status,503);ready=true;
allowed=false;assert.equal((await orderRoute.POST(request(body))).status,429);allowed=true;assert.equal(created,2);

// Execute the real owner-only capture route with canonical provider responses.
let status='created',owned=true,providerStatus='COMPLETED',amount='4.99',currency='USD',captureFails=false,captureCalls=0,granted=0;
const ledger=new Set();
const snapshot=()=>({id:1,user_id:'owner',pack_id:'starter',credits:800,amount_cents:499,currency:'usd',status,provider_capture_id:status==='completed'?'CAPTURE123':null});
const admin={from(table){assert.equal(table,'credit_purchases');let update;
 const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:owned?snapshot():null}),update(value){update=value;return q;},throwOnError:async()=>{status=update.status;return {};}};return q;
}};
const canonical=()=>({id:'ORDER1234',status:providerStatus,purchase_units:[{amount:{value:amount,currency_code:currency},payments:{captures:[{id:'CAPTURE123',status:providerStatus,amount:{value:amount,currency_code:currency}}]}}]});
const capture=load('src/app/api/billing/paypal/capture/route.ts',{
 'next/server':{NextResponse:Response},
 '../../../../../lib/paypal':{capturePayPalOrder:async()=>{captureCalls++;if(captureFails)throw new Error('Already captured / network ambiguity');return canonical();},getPayPalOrder:async()=>canonical()},
 '../../../../../lib/credits':{addCredits:async(_db,_user,credits,_reason,key)=>{if(!ledger.has(key)){ledger.add(key);granted+=credits;}}},
 '../../../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'owner'}:null},
 '../../../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../../../lib/request-security':{consumeRateLimit:async()=>({allowed})}
});
const confirm=()=>capture.POST(request({orderId:'ORDER1234'}));
owned=false;assert.equal((await confirm()).status,404);assert.equal(captureCalls,0);owned=true;
amount='0.01';assert.equal((await confirm()).status,400);assert.equal(granted,0);amount='4.99';
currency='EUR';assert.equal((await confirm()).status,400);assert.equal(granted,0);currency='USD';
providerStatus='PENDING';assert.equal((await confirm()).status,409);assert.equal(granted,0);providerStatus='COMPLETED';
status='refunded';assert.equal((await confirm()).status,409);status='created';
captureFails=true;let result=await confirm();assert.equal(result.status,200);assert.equal((await result.json()).transactionId,'CAPTURE123');
assert.equal(granted,800);result=await confirm();assert.equal((await result.json()).duplicate,true);assert.equal(granted,800);
status='created';await Promise.all([confirm(),confirm()]);assert.equal(granted,800);

// Verify wallet orders omit PayPal redirect funding, and expose only public SDK configuration.
const previous={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,env:{...process.env}};
try {
 process.env.PAYPAL_CLIENT_ID='public-client-id';process.env.PAYPAL_CLIENT_SECRET='private-test-secret';process.env.PAYPAL_WEBHOOK_ID='fixture-hook';process.env.PAYPAL_ENV='live';delete process.env.PAYPAL_MERCHANT_COUNTRY;
 const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json(url.endsWith('/token')?{access_token:'fixture-access',expires_in:3600}:{id:'ORDER1234'});};
 const paypal=load('src/lib/paypal.ts');
 assert.deepEqual(paypal.paypalWalletConfiguration(),{enabled:true,clientId:'public-client-id',environment:'PRODUCTION',merchantCountry:'GB'});
 await paypal.createPayPalOrder({referenceId:'fixture',description:'Credits',amountCents:499,currency:'usd',returnUrl:'https://example.invalid/return',cancelUrl:'https://example.invalid/cancel',wallet:'applepay'});
 assert.equal(JSON.parse(calls.at(-1).init.body).payment_source,undefined);
 await paypal.createPayPalOrder({referenceId:'redirect',description:'Credits',amountCents:499,currency:'usd',returnUrl:'https://example.invalid/return',cancelUrl:'https://example.invalid/cancel'});
 assert.equal(JSON.parse(calls.at(-1).init.body).payment_source.paypal.experience_context.user_action,'PAY_NOW');

 // Mock browser SDKs and enforce synchronous user-gesture entry for both wallets.
 let gesture=false,appleSession,googleClient,googlePromise,confirmed=0,orders=0,captures=0,successes=0,errors=0,extraAuth=0,googleStatus='APPROVED',googleShift='POSSIBLE';
 const sequence=[];
 class Element {constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={setProperty(){}};this.events={};}setAttribute(){}addEventListener(key,fn){this.events[key]=fn;}replaceChildren(...nodes){this.children=nodes;nodes.forEach(node=>node.parent=this);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}click(){gesture=true;try{return this.events.click?.();}finally{gesture=false;}}}
 class Apple {static canMakePayments(){return true;}static STATUS_SUCCESS=1;static STATUS_FAILURE=0;
  constructor(_version,payment){assert.equal(gesture,true);assert.equal(payment.total.amount,'4.99');appleSession=this;}begin(){assert.equal(gesture,true);}completeMerchantValidation(){}completePayment(){}abort(){}
 }
 class Google {constructor(options){this.options=options;googleClient=this;}async isReadyToPay(){return{result:true};}createButton(options){const element=new Element('button');element.addEventListener('click',options.onClick);return element;}
  loadPaymentData(data){assert.equal(gesture,true);assert.equal(data.transactionInfo.countryCode,'GB');assert.equal(data.transactionInfo.totalPrice,'4.99');googlePromise=this.options.paymentDataCallbacks.onPaymentAuthorized({paymentMethodData:{}});return googlePromise;}
 }
 const sdk={Applepay:()=>({config:async()=>({isEligible:true,countryCode:'GB',merchantCapabilities:['supports3DS'],supportedNetworks:['visa']}),validateMerchant:async()=>({merchantSession:{}}),confirmOrder:async()=>{confirmed++;return{status:'APPROVED'};}}),
  Googlepay:()=>({config:async()=>({allowedPaymentMethods:[{type:'CARD'}],merchantInfo:{merchantName:'DreamFace'}}),confirmOrder:async()=>{confirmed++;return{status:googleStatus};},initiatePayerAction:async()=>{extraAuth++;return{liabilityShift:googleShift};}})};
 globalThis.window={setTimeout,clearTimeout,dreamfacePayPal:sdk,ApplePaySession:Apple,google:{payments:{api:{PaymentsClient:Google}}}};
 globalThis.document={createElement:tag=>new Element(tag),head:{appendChild:script=>queueMicrotask(()=>script.onload())},documentElement:{lang:'en-US'}};
 const browser=load('src/lib/paypal-wallets-client.ts');
 const callbacks={createOrder:async()=>{orders++;return'ORDER1234';},capture:async()=>{sequence.push('capture');captures++;return{completed:true,transactionId:'CAPTURE123'};},onBusy(){},onAuthorized(){sequence.push('authorized');},onSuccess(){successes++;},onError(){errors++;}};
 const appleContainer=new Element('div'),googleContainer=new Element('div');
 const mounted=await browser.mountPayPalWallets(paypal.paypalWalletConfiguration(),{amountCents:499,appleContainer,googleContainer,callbacks});
 assert.equal(mounted.apple,true);assert.equal(mounted.google,true);
 appleContainer.children[0].click();await appleSession.onvalidatemerchant({validationURL:'https://apple.invalid/validate'});
 await Promise.all([appleSession.onpaymentauthorized({payment:{token:{},billingContact:{}}}),appleSession.onpaymentauthorized({payment:{token:{},billingContact:{}}})]);
 assert.equal(orders,1);assert.equal(captures,1);assert.deepEqual(sequence,['authorized','capture']);
 googleStatus='PAYER_ACTION_REQUIRED';googleContainer.children[0].click();await googlePromise;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(extraAuth,1);assert.equal(captures,2);assert.equal(successes,2);assert.equal(errors,0);
 googleShift='NO';googleContainer.children[0].click();await googlePromise;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(captures,2,'Failed 3DS cannot reach capture');assert.equal(errors,1);
 const create=callbacks.createOrder;let resume;
 callbacks.createOrder=()=>new Promise(resolve=>resume=resolve);
 appleContainer.children[0].click();const authorizing=appleSession.onpaymentauthorized({payment:{token:{},billingContact:{}}});
 appleSession.oncancel();resume('ORDER1234');await authorizing;
 assert.equal(captures,2,'Cancel during order creation cannot later capture');callbacks.createOrder=create;
 mounted.destroy();assert.equal(appleContainer.children.length,0);
 console.log('PayPal wallet checks passed: authenticated server pricing, owner-only capture, amount/currency validation, retry/idempotent credits, GB configuration, synchronous wallet gestures, duplicate callbacks and Google 3DS. No real payment or DB calls.');
} finally {
 globalThis.fetch=previous.fetch;globalThis.window=previous.window;globalThis.document=previous.document;
 for(const key of Object.keys(process.env))if(!(key in previous.env))delete process.env[key];Object.assign(process.env,previous.env);
}
