import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
};
globalThis.window = {
  localStorage: storage(), sessionStorage: storage(),
  location: { pathname: '/billing', search: '?checkout=success' },
  dataLayer: []
};
globalThis.document = { referrer: '' };
const mirrored = [];
globalThis.fetch = async (_url, options) => { mirrored.push(JSON.parse(options.body)); return Response.json({ ok: true }); };
const module = { exports: {} };
const transpile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', transpile(readFileSync('src/lib/analytics.ts', 'utf8')))(module, module.exports);
const { trackEvent, trackPurchaseEvent } = module.exports;

// Execute the real billing event payloads for both credit-pack and legacy
// subscription success. No checkout, network, credentials or database calls.
const source = ts.createSourceFile('billing.tsx', readFileSync('src/app/billing/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const calls = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'trackEvent' &&
    ['"checkout_success"', '"subscription_checkout_success"'].includes(node.arguments[0]?.getText(source))) calls.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(calls.length, 2);
for (const call of calls) {
  const matchingPurchase = { amount_cents: 499, currency: 'usd', pack_id: 'starter', credits: 800, payment_provider: 'paypal' };
  const code = transpile(call.getText(source));
  new Function('trackEvent', 'matchingPurchase', 'purchaseReference', 'planId', 'cycle', 'value', 'currency', 'accessToken', code)(
    trackEvent, matchingPurchase, () => 'TEST_ORDER', 'starter', 'monthly', 4.99, 'USD', null
  );
  const successEvent = window.dataLayer.at(-1);
  assert.equal(successEvent.value, null);
  assert.equal(successEvent.amount_cents, 499);
  assert.equal(mirrored.at(-1).properties.value, undefined);

  trackPurchaseEvent({ transaction_id: 'TEST_ORDER', value: 4.99, currency: 'USD', items: [{ item_id: 'starter', item_name: 'Starter', price: 4.99, quantity: 1 }] });
  const purchaseEvent = window.dataLayer.at(-1);
  assert.equal(purchaseEvent.ecommerce.value, 4.99);
  assert.equal(purchaseEvent.ecommerce.items[0].price, 4.99);
  assert.equal([successEvent, purchaseEvent].reduce((sum, event) => sum + (event.value || 0), 0), 4.99);
  assert.equal(mirrored.at(-1).properties.value, 4.99);

  // Approximate GTM's persisted data model: a later non-monetary event must
  // actively clear all former purchase fields, not merely omit them.
  const persisted = { ...purchaseEvent };
  trackEvent('nav_clicked', { target: 'studio' });
  Object.assign(persisted, window.dataLayer.at(-1));
  for (const key of ['value', 'currency', 'transaction_id', 'ecommerce']) assert.equal(persisted[key], null);
}
console.log('Analytics value checks passed: one payment contributes value once; both success funnels retain amounts without GA4 value; later events clear previous ecommerce fields.');
