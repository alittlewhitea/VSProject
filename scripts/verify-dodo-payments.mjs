import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('node:') || !id.startsWith('.')) return native(id);
    throw new Error('Unmocked dependency: ' + id);
  }, module, module.exports);
  return module.exports;
}
process.env.DODO_PAYMENTS_API_KEY = 'isolated-test-key';
process.env.DODO_PAYMENTS_WEBHOOK_KEY = 'whsec_' + Buffer.alloc(32, 7).toString('base64');
process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
for (const key of ['STARTER','CREATOR','STUDIO','PRO_TOPUP']) process.env['DODO_PRODUCT_' + key] = 'pdt_' + key;
const dodo = load('src/lib/dodo.ts');
assert.equal(dodo.isDodoConfigured(), true);
process.env.DODO_PAYMENTS_ENVIRONMENT = 'invalid'; assert.equal(dodo.isDodoConfigured(), false);
process.env.DODO_PAYMENTS_ENVIRONMENT = 'test_mode';
const pack = { id: 'starter', name: 'Starter Pack', amountCents: 499, credits: 800 };
const product = { product_id: 'pdt_STARTER', is_recurring: false, price: { type: 'one_time_price', currency: 'USD', price: 499, tax_inclusive: false } };
dodo.validateDodoProduct(product, pack);
for (const pricePatch of [{ type: 'recurring_price' }, { currency: 'EUR' }, { price: 1 }, { tax_inclusive: true }, { discount_bps: 100 }, { pay_what_you_want: true }, { purchasing_power_parity: true }]) {
  assert.throws(() => dodo.validateDodoProduct({ ...product, price: { ...product.price, ...pricePatch } }, pack));
}
const checkoutId = '00000000-0000-4000-8000-000000000001';
const initial = () => ({
  row: { checkout_id: checkoutId, purchase_id: 1, session_id: 'cks_TEST', product_id: 'pdt_STARTER', environment: 'test_mode', user_id: 'user-test', credits: 800, amount_cents: 499, currency: 'usd', status: 'created', provider_transaction_id: null },
  balance: 100, ledger: [], receipts: [], incidents: []
});
let state = initial(), failCommit = false, chain = Promise.resolve(), operations = [];
const conn = { execute: async (sql, params = []) => {
  operations.push(sql);
  if (sql.startsWith('SELECT d.*,p.user_id')) { assert.match(sql, /FOR UPDATE$/); return [[state.row], []]; }
  if (sql.startsWith('SELECT id FROM credit_ledger')) return [state.ledger.filter(entry => entry.reference === params[1]), []];
  if (sql.startsWith('SELECT balance')) return [[{ balance: state.balance }], []];
  if (sql.startsWith('INSERT INTO user_credit_accounts')) return [{ affectedRows: 0 }, []];
  if (sql.startsWith('INSERT INTO credit_ledger')) { state.ledger.push({ id: state.ledger.length + 1, reference: params[2], amount: params[1] }); return [{ insertId: state.ledger.length }, []]; }
  if (sql.startsWith('UPDATE user_credit_accounts')) { state.balance += params[0]; return [{ affectedRows: 1 }, []]; }
  if (sql.startsWith('UPDATE dodo_credit_checkouts')) { state.row.session_id = params[0]; state.row.paid_total_cents = params[1]; state.row.paid_tax_cents = params[2]; return [{ affectedRows: 1 }, []]; }
  if (sql.startsWith('UPDATE credit_purchases SET provider_transaction_id')) {
    if (failCommit) throw new Error('simulated SQL failure');
    state.row.provider_transaction_id = params[0]; state.row.status = 'completed'; return [{ affectedRows: 1 }, []];
  }
  if (sql.startsWith("UPDATE credit_purchases SET status='review_required'")) { state.row.status = 'review_required'; return [{ affectedRows: 1 }, []]; }
  if (sql.startsWith('UPDATE credit_purchases SET status=?')) { state.row.status = params[0]; return [{ affectedRows: 1 }, []]; }
  if (sql.startsWith('INSERT INTO payment_incidents')) { state.incidents.push(params); return [{ affectedRows: 1 }, []]; }
  if (sql.startsWith('INSERT IGNORE INTO payment_webhook_events')) { if (!state.receipts.includes(params[0])) state.receipts.push(params[0]); return [{ affectedRows: 1 }, []]; }
  throw new Error('Unexpected SQL: ' + sql);
} };
const mysql = {
  withMysqlTransaction: fn => {
    const task = chain.then(async () => { const snapshot = structuredClone(state); try { return await fn(conn); } catch (error) { state = snapshot; throw error; } });
    chain = task.catch(() => {}); return task;
  },
  mysqlExecute: async (sql, params) => {
    assert.match(sql, /p.user_id=\?/);
    return params[0] === checkoutId && params[1] === 'user-test' ? [state.row] : [];
  }
};
const payment = () => ({ payment_id: 'pay_TEST', checkout_session_id: 'cks_TEST', metadata: { checkout_reference: checkoutId }, status: 'succeeded', currency: 'USD', total_amount: 599, tax: 100,
  product_cart: [{ product_id: 'pdt_STARTER', quantity: 1 }], subscription_ids: [], refunds: [], disputes: [], is_update_payment_method: false });
let canonical = payment(), apiReads = 0;
const client = { payments: { retrieve: async id => { apiReads++; assert.equal(id, 'pay_TEST'); return canonical; } }, checkoutSessions: { retrieve: async () => ({ payment_id: 'pay_TEST', payment_status: 'succeeded' }) } };
const service = load('src/lib/dodo-credit-payments.ts', { './mysql': mysql, './dodo': { ...dodo, getDodoClient: () => client } });

await Promise.all(Array.from({ length: 5 }, (_, i) => service.applyDodoPayment(payment(), { id: 'evt_' + i, type: 'payment.succeeded' })));
assert.equal(state.balance, 900); assert.equal(state.ledger.length, 1); assert.equal(state.receipts.length, 5);
assert.equal(state.row.paid_total_cents, 599); assert.equal(state.row.paid_tax_cents, 100);
await service.applyDodoPayment(payment(), { id: 'evt_0', type: 'payment.succeeded' });
assert.equal(state.balance, 900); assert.equal(state.receipts.length, 5);
state = initial(); failCommit = true;
await assert.rejects(service.applyDodoPayment(payment(), { id: 'evt_rollback', type: 'payment.succeeded' }));
assert.equal(state.balance, 100); assert.equal(state.ledger.length, 0); assert.equal(state.receipts.length, 0); assert.equal(state.row.status, 'created');
failCommit = false;
for (const patch of [{ total_amount: 101 }, { currency: 'EUR' }, { product_cart: [{ product_id: 'pdt_OTHER', quantity: 1 }] }, { product_cart: [{ product_id: 'pdt_STARTER', quantity: 2 }] }, { subscription_id: 'sub_TEST' }, { checkout_session_id: 'cks_OTHER' }, { tax: -1 }]) {
  state = initial(); const result = await service.applyDodoPayment({ ...payment(), ...patch });
  assert.equal(result.status, 'review_required'); assert.equal(state.balance, 100); assert.equal(state.ledger.length, 0); assert.equal(state.incidents.length, 1);
}
state = initial(); assert.equal((await service.applyDodoPayment({ ...payment(), status: 'failed' })).completed, false); assert.equal(state.balance, 100);
assert.equal((await service.applyDodoPayment(payment())).completed, true); assert.equal(state.balance, 900);
await service.applyDodoPayment({ ...payment(), status: 'failed' }); assert.equal(state.row.status, 'completed');
await service.applyDodoPayment({ ...payment(), refund_status: 'full' }, { id: 'evt_refund', type: 'refund.succeeded' });
assert.equal(state.row.status, 'review_required'); assert.equal(state.balance, 900);
state = initial(); await service.applyDodoPayment(payment(), { id: 'evt_dispute', type: 'dispute.opened' }); assert.equal(state.ledger.length, 0);
state = initial(); state.row.session_id = null; await service.applyDodoPayment(payment()); assert.equal(state.row.session_id, 'cks_TEST');
state = initial(); state.row.environment = 'live_mode'; assert.equal((await service.applyDodoPayment(payment())).status, 'review_required');
state = initial(); const before = apiReads; assert.equal(await service.syncDodoCheckout('other-user', checkoutId), null); assert.equal(apiReads, before);
assert.equal((await service.syncDodoCheckout('user-test', checkoutId)).completed, true);
assert.equal((await service.applyDodoPayment({ ...payment(), metadata: {} })).ignored, true);

// Exact-body, timestamp and signature verification uses the official SDK.
const webhook = load('src/app/api/billing/dodo/webhook/route.ts', { '../../../../../lib/dodo': dodo,
  '../../../../../lib/dodo-credit-payments': service });
const { Webhook } = native('standardwebhooks');
const signer = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY);
function signedRequest(body, { tampered = false, age = 0 } = {}) {
  const raw = JSON.stringify(body, null, 2), date = new Date(Date.now() - age);
  return new Request('https://dreamface.invalid/api/billing/dodo/webhook', { method: 'POST', body: tampered ? raw + ' ' : raw,
    headers: { 'webhook-id': 'evt_signed', 'webhook-timestamp': String(Math.floor(date.getTime() / 1000)), 'webhook-signature': signer.sign('evt_signed', date, raw) } });
}
state = initial(); canonical = payment();
const event = { business_id: 'bus_TEST', type: 'payment.succeeded', timestamp: new Date().toISOString(), data: payment() };
assert.equal((await webhook.POST(signedRequest(event, { tampered: true }))).status, 401);
assert.equal((await webhook.POST(signedRequest(event, { age: 3600000 }))).status, 401);
assert.equal(state.ledger.length, 0);
assert.equal((await webhook.POST(signedRequest(event))).status, 200); assert.equal(state.balance, 900);
assert.equal((await webhook.POST(signedRequest(event))).status, 200); assert.equal(state.ledger.length, 1);
state = initial(); failCommit = true;
assert.equal((await webhook.POST(signedRequest(event))).status, 500); assert.equal(state.balance, 100); failCommit = false;

// Checkout price and metadata come from the server, and the pending order exists
// before Dodo is called; a changed product is rejected before creating any order.
let stored = false, sessionInput, snapshotCredits, snapshotPrice, checkoutProduct = product;
const checkoutClient = { products: { retrieve: async () => checkoutProduct }, checkoutSessions: { create: async (input, options) => {
  assert.equal(stored, true); sessionInput = input; assert.match(options.idempotencyKey, /^dreamface-credit-/);
  return { session_id: 'cks_TEST', checkout_url: 'https://test.checkout.dodopayments.com/session/cks_TEST' };
} } };
const checkoutHelper = load('src/lib/dodo-credit-checkout.ts', {
  './billing': { getCreditPack: id => id === 'starter' ? pack : null }, './dodo': { ...dodo, getDodoClient: () => checkoutClient },
  './mysql': { withMysqlTransaction: async fn => fn({ execute: async (sql, params) => {
    if (sql.startsWith('INSERT INTO credit_purchases')) { snapshotCredits = params[3]; snapshotPrice = params[4]; return [{ insertId: 42 }]; }
    assert.match(sql, /INSERT INTO dodo_credit_checkouts/); stored = true; return [{}];
  } }), mysqlExecute: async () => ({ affectedRows: 1 }) }
});
await checkoutHelper.createDodoCreditCheckout({ id: 'user-test', email: 'test@example.invalid' }, 'starter', 'https://dreamface.invalid');
assert.equal(snapshotCredits, 800); assert.equal(snapshotPrice, 499);
assert.deepEqual(sessionInput.product_cart, [{ product_id: 'pdt_STARTER', quantity: 1 }]);
assert.equal(sessionInput.billing_currency, 'USD'); assert.equal(sessionInput.feature_flags.allow_discount_code, false);
assert.equal(sessionInput.feature_flags.allow_currency_selection, false);
assert.match(sessionInput.return_url, /^https:\/\/dreamface.invalid\/billing\?checkout=dodo_return&provider=dodo&checkout_id=/);
checkoutProduct = { ...product, is_recurring: true }; stored = false;
await assert.rejects(checkoutHelper.createDodoCreditCheckout({ id: 'user-test', email: null }, 'starter', 'https://dreamface.invalid'));
assert.equal(stored, false);
let authenticated = true, configured = true, allowed = true;
const checkoutRoute = load('src/app/api/billing/checkout/route.ts', {
  '../../../../lib/server-auth': { getUserFromBearerToken: async () => authenticated ? { id: 'user-test', email: null } : null },
  '../../../../lib/billing': { getCreditPack: id => id === 'starter' ? pack : null },
  '../../../../lib/paypal': { isPayPalWebhookConfigured: () => true },
  '../../../../lib/paypal-credit-checkout': { createPayPalCreditCheckout: async () => ({ provider: 'paypal' }) },
  '../../../../lib/dodo': { isDodoConfigured: () => configured },
  '../../../../lib/dodo-credit-checkout': { createDodoCreditCheckout: async (_user, id, origin) => { assert.equal(id, 'starter'); assert.equal(origin, 'https://dreamface.invalid'); return { provider: 'dodo' }; } },
  '../../../../lib/request-security': { consumeRateLimit: async () => ({ allowed }), trustedPublicOrigin: () => 'https://dreamface.invalid' }
});
const request = body => new Request('https://untrusted.invalid/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) });
const body = { type: 'credits', packId: 'starter', provider: 'dodo', amountCents: 1, credits: 999999, productId: 'pdt_EVIL' };
assert.equal((await checkoutRoute.POST(request(body))).status, 200);
authenticated = false; assert.equal((await checkoutRoute.POST(request(body))).status, 401); authenticated = true;
configured = false; assert.equal((await checkoutRoute.POST(request(body))).status, 503); configured = true;
allowed = false; assert.equal((await checkoutRoute.POST(request(body))).status, 429); allowed = true;
assert.equal((await checkoutRoute.POST(request({ ...body, type: 'subscription' }))).status, 410);
assert.equal((await checkoutRoute.POST(request({ ...body, packId: 'unknown' }))).status, 400);

// Shared pack selection opens one payment dialog; Dodo remains its Credit Card action.
let cells = [], cursor = 0, selected;
const react = {useState(initialValue){const i=cursor++;if(!(i in cells))cells[i]=initialValue;return[cells[i],value=>cells[i]=value];}};
const PaymentDialog=()=>null;
const grid=load('src/components/credit-pack-grid.tsx',{
 react,'next/dynamic':{default:()=>PaymentDialog},'../lib/billing':{
 CREDIT_PACKS:[pack],CREDIT_USAGE_REFERENCE:{video:{model:'Test',seconds:5,resolution:'480p'}},
 creditUsageCapacity:()=>({images:1,videos:1}),formatUsd:amount=>'$'+(amount/100).toFixed(2)
 }});
const renderGrid=loadingPack=>{cursor=0;return grid.CreditPackGrid({t:key=>key,loadingPack,accessToken:'fixture-token',onCheckout:(id,provider)=>selected=[id,provider]});};
function elements(node,result=[]){if(Array.isArray(node))node.forEach(child=>elements(child,result));else if(node?.props){result.push(node);elements(node.props.children,result);}return result;}
let nodes=elements(renderGrid('starter:dodo'));
assert.equal(nodes.find(node=>node.props['data-credit-pack-select']).props.disabled,true);
nodes=elements(renderGrid(null));nodes.find(node=>node.props['data-credit-pack-select']).props.onClick();
const dialog=elements(renderGrid(null)).find(node=>node.type===PaymentDialog);
assert.equal(dialog.props.pack.id,'starter');
dialog.props.onCheckout('starter','dodo');assert.deepEqual(selected,['starter','dodo']);
const dialogSource=readFileSync('src/components/credit-payment-dialog.tsx','utf8');
assert.match(dialogSource,/Credit Card/);assert.doesNotMatch(dialogSource,/VISA|Mastercard|Dodo Payments/);

const syncRoute = load('src/app/api/billing/dodo/sync/route.ts', {
  '../../../../../lib/server-auth': { getUserFromBearerToken: async () => authenticated ? { id: 'user-test' } : null },
  '../../../../../lib/request-security': { consumeRateLimit: async () => ({ allowed }) },
  '../../../../../lib/dodo-credit-payments': service
});
const syncRequest = checkoutId => new Request('https://dreamface.invalid/api/billing/dodo/sync', { method: 'POST', body: JSON.stringify({ checkoutId }) });
state = initial(); assert.equal((await syncRoute.POST(syncRequest(checkoutId))).status, 200);
assert.equal((await syncRoute.POST(syncRequest('pay_untrusted'))).status, 400);
authenticated = false; assert.equal((await syncRoute.POST(syncRequest(checkoutId))).status, 401); authenticated = true;
const methods = load('src/app/api/billing/payment-methods/route.ts', { '../../../../lib/dodo': dodo });
assert.deepEqual((await methods.GET().json()).providers, ['paypal', 'dodo']);
delete process.env.DODO_PRODUCT_STUDIO;
assert.deepEqual((await methods.GET().json()).providers, ['paypal']);

console.log('Dodo checks passed: server-owned one-time pricing, signed/timestamped webhooks, canonical payment lookup, tax/product/currency validation, atomic rollback, duplicate notifications, concurrent fulfillment, owner-only recovery, failure ordering, early webhook, refund/dispute review, and environment isolation. No real Dodo or database writes.');
