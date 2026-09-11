import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const pack = { id: 'starter', name: 'Starter Pack', credits: 800, amountCents: 499 };
const reference = '11111111-1111-4111-8111-111111111111';
const snapshot = () => ({ reference_id: reference, user_id: 'user-a', pack_id: 'starter', product_id: 'prod_test', credits: 800, amount_cents: 499, currency: 'USD', checkout_id: 'cs_test', order_id: null, status: 'pending' });
const order = () => ({ id: 'order_test', checkoutSessionId: 'cs_test', productId: 'prod_test', amount: '4.99', currency: 'USD', status: 'PAID', metadata: { referenceId: reference, userId: 'user-a', packId: 'starter' } });
let state; let failBalance = false; let queue = Promise.resolve(); let authenticated = true;
function reset() { state = { row: snapshot(), balance: 0, ledger: [], purchases: [], incidents: [] }; }
async function execute(sql, args) {
  if (sql.startsWith('INSERT INTO kyren_checkouts')) { state.row = { ...snapshot(), reference_id:args[0], user_id:args[1], pack_id:args[2], product_id:args[3], credits:args[4], amount_cents:args[5], checkout_id:null, status:'creating' }; return [{}]; }
  if (sql.startsWith('SELECT * FROM kyren_checkouts WHERE reference_id=')) return [[state.row].filter(row => row.reference_id === args[0] && (!sql.includes('AND user_id=') || row.user_id === args[1]))];
  if (sql.startsWith('INSERT INTO user_credit_accounts') || sql.startsWith('SELECT user_id FROM user_credit_accounts')) return [[]];
  if (sql.startsWith('INSERT INTO credit_purchases')) { assert.equal(state.purchases.length, 0); state.purchases.push(args); return [{}]; }
  if (sql.startsWith('INSERT INTO credit_ledger')) { state.ledger.push(args); return [{}]; }
  if (sql.startsWith('UPDATE user_credit_accounts')) { if (failBalance) throw new Error('simulated DB failure'); state.balance += args[0]; return [{}]; }
  if (sql.startsWith('UPDATE kyren_checkouts')) {
    if (sql.includes('SET checkout_id=?')) { state.row.checkout_id = args[0]; if(state.row.status==='creating')state.row.status='pending'; }
    if (sql.includes("status='completed'")) state.row.status = 'completed';
    if (sql.includes("status='refund_review'")) state.row.status = 'refund_review';
    if (sql.includes('order_id=?')) { state.row.order_id = args[0]; state.row.checkout_id = args[1]; }
    return [{}];
  }
  if (sql.startsWith('INSERT INTO payment_incidents')) { if (!state.incidents.some(x => x[0] === args[0])) state.incidents.push(args); return [{}]; }
  if (sql.startsWith('UPDATE credit_purchases') || sql.startsWith('INSERT INTO payment_webhook_events')) return [{}];
  throw new Error(`Unmocked SQL: ${sql}`);
}
const mysql = {
  mysqlExecute: async (sql, args) => (await execute(sql, args))[0],
  withMysqlTransaction: fn => {
    const pending = queue.then(async () => {
      const before = structuredClone(state);
      try { return await fn({ execute }); } catch (error) { state = before; throw error; }
    });
    queue = pending.catch(() => {}); return pending;
  }
};
function load(path, mocks = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('node:')) return require(name);
    throw new Error(`Unexpected dependency ${name}`);
  }, module, module.exports);
  return module.exports;
}
try {
  process.env.KYRENPAY_API_KEY = 'kyren_live_fixture_not_real';
  process.env.KYRENPAY_WEBHOOK_SECRET = 'fixture-webhook-secret';
  process.env.KYRENPAY_PRODUCT_STARTER = 'prod_test';
  process.env.KYRENPAY_CHECKOUT_ENABLED = 'true';
  let apiOrder = order();
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers['x-api-key'], 'kyren_live_fixture_not_real');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    if (url === 'https://api.kyrenpay.com/v1/orders/order_test') return Response.json({ code: 0, data: apiOrder });
    if (url === 'https://api.kyrenpay.com/v1/checkouts/cs_test') return Response.json({ code: 0, data: { id: 'cs_test', productId: 'prod_test', amount: '4.99', currency: 'USD', orderId: 'order_test' } });
    throw new Error(`No network permitted: ${url}`);
  };
  const api = load('src/lib/kyrenpay.ts');
  const billing = load('src/lib/kyrenpay-billing.ts', { './mysql': mysql, './billing': { getCreditPack: id => id === pack.id ? pack : null }, './kyrenpay': api });
  assert.equal(api.moneyCents('4.99'), 499);
  for (const value of ['4.999','-4.99','4e2','NaN',4.99,' 4.99']) assert.equal(api.moneyCents(value), null);
  assert.equal(api.kyrenCheckoutUrl('https://payment.kyren.io/checkout/cs_test'), 'https://payment.kyren.io/checkout/cs_test');
  for (const url of ['http://payment.kyren.io/x','https://evil.example/x','https://payment.kyren.io.evil.example/x','https://u:p@payment.kyren.io/x']) assert.throws(() => api.kyrenCheckoutUrl(url));
  reset();
  for (const changed of [{ amount: '0.01' }, { currency: 'EUR' }, { productId: 'prod_other' }, { checkoutSessionId: 'cs_other' }, { metadata: { ...order().metadata, userId: 'other' } }, { metadata: { ...order().metadata, packId: 'pro-topup' } }]) {
    await assert.rejects(() => billing.applyKyrenOrder({ ...order(), ...changed }));
    assert.equal(state.balance, 0);
  }
  await billing.applyKyrenOrder({ ...order(), status: 'PENDING' }); assert.equal(state.balance, 0);
  const results = await Promise.all(Array.from({ length: 12 }, () => billing.applyKyrenOrder(order())));
  assert.ok(results.every(x => x.completed)); assert.equal(state.balance,800); assert.equal(state.ledger.length,1); assert.equal(state.purchases.length,1);
  reset(); failBalance = true;
  await assert.rejects(() => billing.applyKyrenOrder(order()));
  assert.equal(state.balance,0); assert.equal(state.ledger.length,0); assert.equal(state.purchases.length,0); assert.equal(state.row.status,'pending');
  failBalance = false; await billing.applyKyrenOrder(order()); assert.equal(state.balance,800);
  await billing.applyKyrenOrder(order(),'evt_refund'); await billing.applyKyrenOrder(order(),'evt_refund');
  assert.equal(state.incidents.length,1); assert.equal(state.balance,800); assert.equal(state.row.status,'refund_review');
  assert.equal((await billing.applyKyrenOrder(order())).completed,false);
  reset(); await billing.applyKyrenOrder(order(),'evt_refund'); await billing.applyKyrenOrder(order()); assert.equal(state.balance,0);
  reset(); assert.equal(await billing.syncKyrenReference(reference,'other-user'),null);
  assert.equal((await billing.syncKyrenReference(reference,'user-a')).completed,true);
  const web = load('src/app/api/billing/kyrenpay/webhook/route.ts', { 'next/server': { NextResponse: Response }, '../../../../../lib/kyrenpay': api, '../../../../../lib/kyrenpay-billing': billing, '../../../../../lib/mysql': mysql });
  const raw = JSON.stringify({ id:'evt_test', type:'order.paid', data:{order_id:'order_test'} });
  const timestamp = String(Date.now());
  const signed = (text=raw, ts=timestamp) => ({ 'x-kyren-timestamp':ts, 'x-kyren-signature':'sha256='+createHmac('sha256',process.env.KYRENPAY_WEBHOOK_SECRET).update(`${ts}.${text}`).digest('hex') });
  assert.equal(api.verifyKyrenSignature(raw,new Headers(signed())),true);
  assert.equal(api.verifyKyrenSignature(raw+' ',new Headers(signed())),false);
  const stale = String(Date.now()-300001); assert.equal(api.verifyKyrenSignature(raw,new Headers(signed(raw,stale))),false);
  assert.equal(api.verifyKyrenSignature(raw,new Headers(signed(raw,'NaN'))),false);
  const req = headers => new Request('https://dreamface.invalid/api/billing/kyrenpay/webhook',{method:'POST',headers,body:raw});
  reset(); assert.equal((await web.POST(req({}))).status,401); assert.equal(state.balance,0);
  assert.equal((await web.POST(req(signed()))).status,200); assert.equal((await web.POST(req(signed()))).status,200); assert.equal(state.balance,800);
  reset(); apiOrder = {...order(),status:'PENDING'}; assert.equal((await web.POST(req(signed()))).status,500); assert.equal(state.balance,0); apiOrder=order();
  let paypalReady = true; const paypalRequests = [];
  const paypal = { isPayPalWebhookConfigured: () => paypalReady,
    createPayPalOrder: async input => { paypalRequests.push(input); return { id: 'PAYPAL_TEST_ORDER' }; },
    paypalApprovalUrl: () => 'https://www.paypal.com/checkoutnow?token=PAYPAL_TEST_ORDER' };
  const paypalBilling = load('src/lib/paypal-credit-checkout.ts', { './billing': { getCreditPack: id => id === pack.id ? pack : null }, './mysql': mysql, './paypal': paypal });
  const checkout = load('src/app/api/billing/checkout/route.ts', {
    '../../../../lib/paypal-credit-checkout': paypalBilling, '../../../../lib/paypal': paypal,
    'next/server':{NextResponse:Response}, '../../../../lib/billing':{getCreditPack:id=>id===pack.id?pack:null}, '../../../../lib/kyrenpay':api,
    '../../../../lib/kyrenpay-billing':billing, '../../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'user-a'}:null},
    '../../../../lib/request-security':{consumeRateLimit:async()=>({allowed:true}),trustedPublicOrigin:()=> 'https://dreamface.invalid'}
  });
  const checkoutReq=body=>new Request('https://dreamface.invalid/api/billing/checkout',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await checkout.POST(checkoutReq({type:'subscription',planId:'premium'}))).status,410);
  assert.equal((await checkout.POST(checkoutReq({packId:'unknown'}))).status,400);
  authenticated=false; assert.equal((await checkout.POST(checkoutReq({packId:'starter'}))).status,401); authenticated=true;
  process.env.KYRENPAY_CHECKOUT_ENABLED='false'; assert.equal((await checkout.POST(checkoutReq({packId:'starter'}))).status,503);
  reset();
  const paypalResponse = await checkout.POST(checkoutReq({type:'credits',packId:'starter',provider:'paypal',amountCents:1,credits:999999}));
  assert.equal(paypalResponse.status,200);assert.equal((await paypalResponse.json()).provider,'paypal');
  assert.equal(paypalRequests.length,1);assert.equal(paypalRequests[0].amountCents,499);assert.equal(paypalRequests[0].currency,'usd');
  assert.equal(paypalRequests[0].returnUrl,'https://dreamface.invalid/billing?checkout=paypal_return');
  assert.deepEqual(state.purchases[0],['user-a','PAYPAL_TEST_ORDER','PAYPAL_TEST_ORDER','starter',800,499]);assert.equal(state.balance,0);
  paypalReady=false;assert.equal((await checkout.POST(checkoutReq({packId:'starter',provider:'paypal'}))).status,503);
  assert.equal((await checkout.POST(checkoutReq({packId:'starter',provider:'stripe'}))).status,400);
  assert.equal((await checkout.POST(checkoutReq({type:'subscription',provider:'paypal'}))).status,410);
  process.env.KYRENPAY_CHECKOUT_ENABLED='true'; reset();
  let productPrice='4.99'; let created=0;
  globalThis.fetch=async(url,init)=>{
    if(url==='https://api.kyrenpay.com/v1/products/prod_test')return Response.json({code:0,data:{id:'prod_test',price:productPrice,currency:'USD',status:'ACTIVE'}});
    if(url==='https://api.kyrenpay.com/v1/checkouts'){
      created++; const body=JSON.parse(init.body);
      assert.equal(body.metadata.referenceId,state.row.reference_id); assert.equal(body.metadata.userId,'user-a'); assert.equal(body.metadata.packId,'starter');
      assert.equal(body.productId,'prod_test'); assert.equal('amount' in body,false); assert.equal('credits' in body,false);
      assert.equal(body.successUrl,'https://dreamface.invalid/billing?checkout=kyren_return&reference='+state.row.reference_id);
      return Response.json({code:0,data:{id:'cs_test',productId:'prod_test',amount:'4.99',currency:'USD',url:'https://payment.kyren.io/checkout/cs_test'}});
    }
    throw new Error('No network permitted: '+url);
  };
  const createdResponse=await checkout.POST(checkoutReq({type:'credits',packId:'starter',credits:999999,amountCents:1}));
  assert.equal(createdResponse.status,200);assert.equal((await createdResponse.json()).provider,'kyrenpay');
  assert.equal(state.row.credits,800);assert.equal(state.row.amount_cents,499);assert.equal(state.row.checkout_id,'cs_test');assert.equal(state.balance,0);
  productPrice='0.01';await assert.rejects(()=>billing.createKyrenCreditCheckout('user-a','starter','https://dreamface.invalid'));assert.equal(created,1);
  console.log('KyrenPay checks passed: signatures/replay/tampering, identity/amount/currency validation, pending payments, duplicate/concurrent fulfillment, atomic rollback, ownership, refund ordering and closed subscription checkout. Mock DB/API only; no paid calls.');
} finally { globalThis.fetch=originalFetch; process.env=savedEnv; }
