import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('src/lib/paypal-cards-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const savedWindow=globalThis.window;
let eligible=true,valid=true,mode='success',captureFails=false,orders=0,captures=0,successes=0,invalids=0,errors=0,closed=0,busy=false,authorized=0,submittedAddress,delayRender;
const callbacks={canStart:()=>!busy,createOrder:async()=>`ORDER-${++orders}`,capture:async()=>{captures++;if(captureFails)throw new Error('Ambiguous confirmation');return{completed:true,orderId:'fixture',transactionId:'capture'};},onBusy:value=>busy=value,onAuthorized:()=>authorized++,onSuccess:()=>successes++,onInvalid:()=>invalids++,onError:()=>errors++};
const address={addressLine1:'Fixture street',adminArea1:'',adminArea2:'Fixture city',countryCode:'GB',postalCode:'SW1A 1AA'};
const sdk={CardFields(options){const field=()=>({render:async target=>{if(delayRender)await delayRender;if(mode==='render-error')throw new Error('Isolated render failure');target.replaceChildren({fixture:true});},close:()=>closed++});return{
 isEligible:()=>eligible,NameField:field,NumberField:field,ExpiryField:field,CVVField:field,getState:async()=>({isFormValid:valid}),
 submit:async input=>{
  submittedAddress=input.billingAddress;
  const [id,repeated]=await Promise.all([options.createOrder(),options.createOrder()]);assert.equal(id,repeated,'Concurrent SDK createOrder callbacks share one order');
  if(mode==='cancel'||mode==='declined')throw new Error('Isolated payer cancellation / decline');
  const data={orderID:mode==='mismatch'?'OTHER-ORDER':id,liabilityShift:mode==='unknown-auth'?'UNKNOWN':'POSSIBLE'};
  await Promise.all([options.onApprove(data),options.onApprove(data)]);
 }
};}};
const module={exports:{}};
new Function('require','module','exports',source)(id=>{assert.equal(id,'./paypal-wallets-client');return{getPayPalCheckoutSdk:async()=>sdk};},module,module.exports);
const {mountPayPalCards}=module.exports;
const containers=()=>Object.fromEntries(['name','number','expiry','cvv'].map(key=>[key,{children:[],replaceChildren(...children){this.children=children;}}]));
const setup=async(signal=new AbortController().signal)=>{const hosts=containers();const controller=await mountPayPalCards({enabled:true,clientId:'fixture'},{containers:hosts,placeholders:{name:'Name',number:'Card number',expiry:'MM/YY',cvv:'CVV'},callbacks,signal});return{controller,hosts};};
try{
 globalThis.window={setTimeout,clearTimeout};
 eligible=false;let fixture=await setup();assert.equal(fixture.controller.eligible,false);assert.equal(orders,0);fixture.controller.destroy();eligible=true;
 fixture=await setup();assert.equal(fixture.controller.eligible,true);assert.equal(orders,0,'Loading and eligibility cannot create orders');
 assert.ok(Object.values(fixture.hosts).every(host=>host.children.length===1));
 valid=false;await fixture.controller.submit(address);assert.equal(invalids,1);assert.equal(orders,0);assert.equal(busy,false);valid=true;
 await Promise.all([fixture.controller.submit(address),fixture.controller.submit(address)]);
 assert.equal(orders,1);assert.equal(captures,1);assert.equal(successes,1);assert.equal(authorized,1,'Duplicate approvals cannot capture twice');assert.deepEqual(submittedAddress,address);assert.equal(busy,false);
 mode='cancel';await fixture.controller.submit(address);assert.equal(captures,1);assert.equal(successes,1);assert.equal(busy,false);
 mode='declined';await fixture.controller.submit(address);assert.equal(captures,1);assert.equal(successes,1);
 mode='unknown-auth';await fixture.controller.submit(address);assert.equal(captures,1);assert.equal(authorized,1);
 mode='mismatch';await fixture.controller.submit(address);assert.equal(captures,1);assert.equal(authorized,1);
 mode='success';captureFails=true;await fixture.controller.submit(address);assert.equal(captures,2);assert.equal(successes,1);assert.equal(authorized,2,'Authorization is remembered before uncertain capture');captureFails=false;
 busy=true;const before=orders;await fixture.controller.submit(address);assert.equal(orders,before,'Another active payment blocks card submission');busy=false;
 fixture.controller.destroy();await fixture.controller.submit(address);assert.equal(orders,before);assert.ok(Object.values(fixture.hosts).every(host=>host.children.length===0));
 mode='render-error';await assert.rejects(setup(),/unavailable/);mode='success';
 let release;delayRender=new Promise(resolve=>release=resolve);const abort=new AbortController(),pending=setup(abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();release();fixture=await pending;assert.equal(fixture.controller.eligible,false);assert.ok(Object.values(fixture.hosts).every(host=>host.children.length===0));delayRender=undefined;
 assert.ok(errors>=5);assert.ok(closed>=8);
 console.log('PayPal cards passed: hosted inputs and billing-address handoff, eligibility without orders, invalid form, duplicate submit/approval, cancel/decline, unknown 3DS, order mismatch, uncertain capture, payment mutex, render failure and cleanup including late render. All SDK and network calls mocked.');
}finally{globalThis.window=savedWindow;}
