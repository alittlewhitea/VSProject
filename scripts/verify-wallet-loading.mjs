import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('src/lib/paypal-wallets-client.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const load = () => { const module = { exports: {} }; new Function('module', 'exports', source)(module, module.exports); return module.exports; };
const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, now: Date.now };
const scripts = [], timers = new Set(), paymentAmounts = [];
let configCalls = 0, failConfig = false, eligible = true, orders = 0, controller;
const config = { enabled: true, clientId: 'fixture-public-client', environment: 'TEST', merchantCountry: 'GB' };
class Element {
  constructor(tag) { this.tag = tag; this.dataset = {}; this.events = {}; this.children = []; this.style = { setProperty() {} }; }
  setAttribute() {}
  addEventListener(name, callback) { this.events[name] = callback; }
  replaceChildren(...nodes) { this.children = nodes; for (const node of nodes) node.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
class Apple {
  static canMakePayments() { return eligible; }
  constructor(_version, quote) { paymentAmounts.push(quote.total.amount); }
  begin() {}
}
class Google {
  async isReadyToPay() { return { result: eligible }; }
  createButton(options) { const node = new Element('button'); node.events.click = options.onClick; return node; }
  loadPaymentData(quote) { paymentAmounts.push(quote.transactionInfo.totalPrice); return Promise.reject({ statusCode: 'CANCELED' }); }
}
const callbacks = { createOrder: async () => { orders++; return 'ORDER-FIXTURE'; }, capture: async () => { throw new Error('Preloading cannot capture'); }, onBusy() {}, onAuthorized() {}, onSuccess() {}, onError() {} };
const settle = () => new Promise(resolve => setImmediate(resolve));
function containers() { return { appleContainer: new Element('div'), googleContainer: new Element('div') }; }
function finishScript(name, success = true) { const script = scripts.findLast(item => item.src.includes(name) && !item.finished); assert.ok(script, name); script.finished = true; (success ? script.onload : script.onerror)(); }
try {
  globalThis.window = {
    setTimeout(callback, ms) { const timer = setTimeout(callback, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
    ApplePaySession: Apple, google: { payments: { api: { PaymentsClient: Google } } },
    dreamfacePayPal: {
      Applepay: () => ({ config: async () => ({ isEligible: true, countryCode: 'GB', merchantCapabilities: [], supportedNetworks: [] }) }),
      Googlepay: () => ({ config: async () => ({ allowedPaymentMethods: [{ type: 'CARD' }], merchantInfo: {} }) })
    }
  };
  globalThis.document = { createElement: tag => new Element(tag), head: { appendChild: node => scripts.push(node) }, documentElement: { lang: 'en' } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/billing/paypal/wallet-config'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers, undefined, 'Public configuration cannot carry a bearer token');
    configCalls++; return failConfig ? new Response('', { status: 503 }) : Response.json(config);
  };
  const wallet = load();
  const warm = wallet.preloadPayPalWallets();
  const duplicateWarm = wallet.preloadPayPalWallets();
  await settle();
  assert.equal(configCalls, 1, 'Preload and concurrent consumers share the configuration request');
  assert.equal(scripts.length, 3, 'PayPal, Apple and Google scripts download concurrently before selection');
  assert.equal(orders, 0);
  const slots = containers(), states = [];
  const mounting = wallet.mountPayPalWallets(config, { ...slots, amountCents: 499, callbacks, onStatus: (wallet, status) => states.push([wallet, status]), onController: value => { controller = value; } });
  finishScript('pay.google.com'); finishScript('www.paypal.com');
  await settle();
  assert.ok(states.some(([wallet, status]) => wallet === 'googlepay' && status === 'ready'), 'Google is usable while Apple is still downloading');
  assert.equal(slots.googleContainer.children.length, 1);
  finishScript('applepay.cdn-apple.com', false);
  const mounted = await mounting; await Promise.all([warm, duplicateWarm]);
  assert.ok(states.some(([wallet, status]) => wallet === 'applepay' && status === 'error'));
  assert.equal(mounted.google, true); assert.equal(mounted.apple, false);
  const googleButton = slots.googleContainer.children[0];
  const retry = controller.retry('applepay');
  assert.equal(scripts.length, 4, 'Only the failed Apple SDK is downloaded again');
  finishScript('applepay.cdn-apple.com'); await retry;
  assert.equal(slots.googleContainer.children[0], googleButton, 'Reloading Apple cannot remove the working Google button');
  assert.equal(mounted.apple, true); assert.equal(orders, 0);
  assert.equal((await wallet.getPayPalWalletConfig()).clientId, config.clientId); assert.equal(configCalls, 1);
  mounted.destroy();

  const nextSlots = containers();
  const reopened = await wallet.mountPayPalWallets(config, { ...nextSlots, amountCents: 999, callbacks });
  assert.equal(scripts.length, 4, 'Reopening reuses already loaded SDKs');
  nextSlots.googleContainer.children[0].events.click();
  await settle(); assert.equal(paymentAmounts.at(-1), '9.99', 'Script reuse must not cache the previous package amount');
  reopened.destroy();
  eligible = false;
  const unsupportedStates = [], unsupportedSlots = containers();
  const unsupported = await wallet.mountPayPalWallets(config, { ...unsupportedSlots, amountCents: 499, callbacks, onStatus: (wallet, status) => unsupportedStates.push([wallet, status]) });
  assert.equal(unsupported.apple, false); assert.equal(unsupported.google, false);
  assert.equal(unsupportedStates.filter(([, status]) => status === 'unavailable').length, 2, 'Unsupported wallets are distinct from load failures');
  assert.equal(unsupportedSlots.appleContainer.children.length + unsupportedSlots.googleContainer.children.length, 0);
  unsupported.destroy(); eligible = true;

  let clock = saved.now(); Date.now = () => clock;
  clock += 5 * 60 * 1000 + 1000;
  await wallet.getPayPalWalletConfig(); assert.equal(configCalls, 2, 'Public settings expire after five minutes');
  failConfig = true; await assert.rejects(wallet.getPayPalWalletConfig(true));
  failConfig = false; await wallet.getPayPalWalletConfig(true); assert.equal(configCalls, 4, 'A failed refresh can be retried');
  Date.now = saved.now;

  const fresh = load(), aborted = new AbortController(), cancelledSlots = containers(), cancelledStates = [];
  const cancelled = fresh.mountPayPalWallets(config, { ...cancelledSlots, amountCents: 499, callbacks, signal: aborted.signal, onStatus: (wallet, status) => cancelledStates.push([wallet, status]) });
  aborted.abort();
  finishScript('www.paypal.com'); finishScript('applepay.cdn-apple.com'); finishScript('pay.google.com'); await cancelled;
  assert.equal(cancelledStates.length, 0); assert.equal(cancelledSlots.appleContainer.children.length + cancelledSlots.googleContainer.children.length, 0, 'Late SDK completion cannot update a closed dialog');
  assert.equal(orders, 0, 'All warm-up, readiness checks, retries and package switches remain order-free');
  console.log('Wallet loading passed: shared public configuration with TTL/retry, three parallel SDK downloads, independent wallet readiness, isolated load retry, cached reopen, current package amount, unsupported methods, closed-dialog cleanup and no pre-created orders. All SDK/network responses are fixtures.');
} finally {
  for (const timer of timers) clearTimeout(timer);
  globalThis.window = saved.window; globalThis.document = saved.document; globalThis.fetch = saved.fetch; Date.now = saved.now;
}
