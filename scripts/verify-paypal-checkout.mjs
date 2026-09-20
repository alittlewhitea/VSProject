import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const native = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('node:')) return native(id);
    throw new Error('Unmocked dependency: ' + id);
  }, module, module.exports);
  return module.exports;
}
const pack = { id: 'starter', name: 'Starter Pack', credits: 800, amountCents: 499 };
const catalog = { getCreditPack: id => id === pack.id ? pack : null };
let authenticated = true, ready = true, allowed = true;
const orders = [], purchases = [];
const paypal = {
  isPayPalWebhookConfigured: () => ready,
  createPayPalOrder: async input => { orders.push(input); return { id: 'TEST_ORDER' }; },
  paypalApprovalUrl: () => 'https://www.paypal.com/checkoutnow?token=TEST_ORDER'
};
const helper = load('src/lib/paypal-credit-checkout.ts', {
  './billing': catalog, './paypal': paypal,
  './mysql': { mysqlExecute: async (sql, params) => { assert.match(sql, /INSERT INTO credit_purchases/); purchases.push(params); } }
});
const checkout = load('src/app/api/billing/checkout/route.ts', {
  'next/server': { NextResponse: Response },
  '../../../../lib/billing': catalog,
  '../../../../lib/paypal': paypal,
  '../../../../lib/paypal-credit-checkout': helper,
  '../../../../lib/server-auth': { getUserFromBearerToken: async () => authenticated ? { id: 'user-test' } : null },
  '../../../../lib/request-security': { consumeRateLimit: async () => ({ allowed }), trustedPublicOrigin: () => 'https://dreamface.invalid' }
});
const request = body => new Request('https://untrusted.invalid/api/billing/checkout', { method: 'POST', body: JSON.stringify(body) });
for (const provider of [undefined, 'paypal']) {
  const response = await checkout.POST(request({ packId: 'starter', provider, amountCents: 1, credits: 999999 }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'paypal');
  assert.equal(orders.at(-1).amountCents, 499);
  assert.equal(orders.at(-1).currency, 'usd');
  assert.equal(orders.at(-1).returnUrl, 'https://dreamface.invalid/billing?checkout=paypal_return');
  assert.deepEqual(purchases.at(-1), ['user-test', 'TEST_ORDER', 'TEST_ORDER', 'starter', 800, 499]);
}
assert.equal((await checkout.POST(request({ packId: 'starter', provider: 'kyrenpay' }))).status, 400);
assert.equal((await checkout.POST(request({ packId: 'unknown' }))).status, 400);
assert.equal((await checkout.POST(request({ type: 'subscription' }))).status, 410);
authenticated = false;
assert.equal((await checkout.POST(request({ packId: 'starter' }))).status, 401);
authenticated = true; ready = false;
assert.equal((await checkout.POST(request({ packId: 'starter' }))).status, 503);
ready = true; allowed = false;
assert.equal((await checkout.POST(request({ packId: 'starter' }))).status, 429);
assert.equal(orders.length, 2);
assert.equal(existsSync('src/app/api/billing/kyrenpay/webhook/route.ts'), false);
assert.equal(existsSync('src/app/api/cron/reconcile-kyrenpay/route.ts'), false);
const page = readFileSync('src/app/billing/page.tsx', 'utf8');
assert.ok(page.includes('"checkout_success"') && page.includes('trackPurchaseEvent('));
assert.ok(readFileSync('src/lib/analytics.ts', 'utf8').includes('analyticsPayload("purchase"'));
assert.ok(existsSync('src/app/api/billing/paypal/capture/route.ts'));
console.log('PayPal-only checks passed: server-owned pricing, auth, disabled/rate limits, retired provider rejection, no new subscriptions. No network or real DB calls.');
