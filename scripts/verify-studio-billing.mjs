import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {projectLoader} from './load-project-ts.mjs';

// Marketing uses next-intl's nested paths; Studio uses flat keys. Verify the
// new shared purchase copy through both representations, including ICU values.
const localeLoad=projectLoader();
const {creditShopDesignMessages}=localeLoad('src/lib/credit-shop-design-messages.ts');
for(const [locale,messages] of Object.entries(creditShopDesignMessages)) {
 const creditShop=JSON.parse(readFileSync(`messages/credit-shop/${locale}.json`,'utf8'));
 const studio=JSON.parse(readFileSync(`messages/studio/${locale}.json`,'utf8'));
 const translate=createTranslator({locale,messages:{creditShop:Object.fromEntries(Object.entries(creditShop).map(([key,value])=>[key.replace(/^creditShop\./,''),value]))},onError:error=>{throw error;}});
 for(const [key,value] of Object.entries(messages)) {
  assert.equal(creditShop[key],value);assert.equal(studio[key],value);
  assert.ok(!translate(key,{count:'100',percent:11,credits:1800,seconds:5,characters:'1,000'}).includes('creditShop.'),`${locale}: ${key}`);
 }
}

const compile = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module = {exports:{}};
new Function('module','exports',compile(readFileSync('src/features/billing/billing-navigation.ts','utf8')))(module,module.exports);
const {billingNavigationUrl} = module.exports;
assert.equal(billingNavigationUrl('/studio','',true),'/studio?view=billing');
const success = new URL(billingNavigationUrl('/studio','checkout=success&provider=paypal&payment_id=order_123',true),'https://dreamface.test');
assert.equal(success.searchParams.get('view'),'billing');
assert.equal(success.searchParams.get('payment_id'),'order_123');
assert.equal(success.searchParams.get('provider'),'paypal');
assert.equal(billingNavigationUrl('/billing','checkout=cancelled&provider=dodo',true),'/billing?checkout=cancelled&provider=dodo');
assert.equal(billingNavigationUrl('/es/billing','checkout=paypal_return&token=order_123',true),'/es/billing?checkout=paypal_return&token=order_123');
assert.equal(billingNavigationUrl('/price','checkout=success',false),'/price?checkout=success');

const file='src/features/billing/billing-content.tsx',source=readFileSync(file,'utf8');
const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let checkout;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='startCheckout')checkout=node.getText(tree);ts.forEachChild(node,visit);}
visit(tree);assert.ok(checkout);
const pushes=[],requests=[],messages=[],logins=[];
globalThis.window={location:{pathname:'/studio',search:'?mode=image&workflow=text-to-image&view=billing',href:''}};
const dependencies=['accessToken','embedded','router','setLoadingPack','setMessage','trackEvent','CREDIT_PACKS','fetch','billingNavigationUrl','t','requestSignIn'];
const createCheckout = (...args) => new Function(...dependencies,compile(checkout)+';return startCheckout;')(...args);
const common=[true,{push:url=>pushes.push(url)},()=>{},message=>messages.push(message),()=>{},[{id:'starter',credits:800,amountCents:499}],async(url,options)=>{requests.push({url,...options});return {ok:false,json:async()=>({error:'Local rejected checkout'})};},billingNavigationUrl,key=>key,options=>logins.push(options)];
await createCheckout(null,...common)('starter','paypal');
assert.equal(requests.length,0,'Unauthenticated checkout must not make a payment request');
assert.equal(pushes.length,0,'Login opens in place');
const returnTo=new URL(logins[0].next,'https://dreamface.test');
assert.equal(returnTo.searchParams.get('view'),'billing');
assert.equal(returnTo.searchParams.get('mode'),'image');
logins[0].onSuccess({access_token:'resumed-session'});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(requests[0].headers.Authorization,'Bearer resumed-session');
requests.length=0;
await createCheckout('fixture-session',...common)('starter','paypal');
assert.equal(requests[0].url,'/api/billing/checkout');
assert.equal(requests[0].headers.Authorization,'Bearer fixture-session');
assert.deepEqual(JSON.parse(requests[0].body),{type:'credits',packId:'starter',provider:'paypal'});
assert.ok(messages.includes('Local rejected checkout'));
assert.equal(window.location.href,'','A rejected checkout must not navigate away');
assert.match(readFileSync('src/app/billing/page.tsx','utf8'),/initialView="billing"/);
assert.match(readFileSync('src/lib/search-url-policy.ts','utf8'),/view === "billing"/);
console.log('Studio billing passed: internal view URLs, legacy/localized payment returns, login preserves workspace state, authenticated server-owned checkout payload and rejected-checkout recovery. No network, payment or database writes.');
