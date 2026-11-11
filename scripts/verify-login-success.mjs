import assert from 'node:assert/strict';
import { readStudioSource } from './studio-source.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native = createRequire(import.meta.url);
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', compiled)(id => {
      if (id in mocks) return mocks[id];if(/\/lib\/request-security$/.test(id))return {...load('src/lib/request-security.ts'),consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})};
      if (!id.startsWith('.')) return native(id);
      const path = resolve(dirname(file), id); return load(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx');
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, now: Date.now, secret: process.env.AUTH_SESSION_SECRET };
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };
try {
  process.env.AUTH_SESSION_SECRET = 'isolated-login-test-secret';
  let session = { access_token: 'private-session-token-fixture', expires_at: '2099-01-01', user: { id: 'fixture-owner', email: 'fixture@example.invalid' } };
  const cookies = new Map(), cookieOptions = new Map(), rows = new Map();
  let failedStorage = false, requests = 0, genericMirrors = 0;
  const store = { get: key => cookies.has(key) ? { value: cookies.get(key) } : undefined,
    set(key, value, options) { cookies.set(key, value); cookieOptions.set(key, options); }, delete: key => cookies.delete(key) };
  cookies.set('fixture-session', session.access_token);
  const auth = { SESSION_COOKIE_NAME: 'fixture-session', getSessionFromToken: async token => token === session?.access_token ? session : null, deleteSession: async () => { session = null; } };
  const admin = { from(table) { assert.equal(table, 'analytics_events'); return { async insert(row) {
    await Promise.resolve();
    if (failedStorage) return { error: { code: 'ECONNREFUSED' } };
    if (rows.has(row.id)) return { error: { code: '23505' } };
    rows.set(row.id, row); return { error: null };
  } }; } };
  const mocks = { 'next/headers': { cookies: async () => store }, '../../../../lib/server-auth': auth, '../../../../lib/supabase-admin': { createSupabaseAdminClient: () => admin } };
  const load = loader(mocks), receipts = load('src/lib/login-success-receipt.ts');
  const sessionRoute = load('src/app/api/auth/session/route.ts'), claimRoute = load('src/app/api/analytics/login-success/route.ts'), genericRoute = load('src/app/api/analytics/track/route.ts');
  const claim = (id, extra = {}) => claimRoute.POST(new Request('https://fixture.invalid/api/analytics/login-success', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-ipcountry': 'GB' }, body: JSON.stringify({ loginEventId: id, pagePath: '/studio?view=billing', ...extra }) }));
  let payload = await (await sessionRoute.GET()).json();
  assert.equal(payload.loginEvent, undefined, 'An existing session without a new-auth receipt is only a restoration');
  assert.equal((await (await claim('made-up-event')).json()).claimed, false); assert.equal(rows.size, 0);
  function authenticate(method = 'google') {
    receipts.setLoginSuccessReceipt(store, session, method);
    return receipts.readLoginSuccessReceipt(cookies.get(receipts.LOGIN_SUCCESS_COOKIE), session);
  }
  const first = authenticate(); assert.ok(first);
  assert.equal(cookieOptions.get(receipts.LOGIN_SUCCESS_COOKIE).httpOnly, true);
  assert.equal(cookieOptions.get(receipts.LOGIN_SUCCESS_COOKIE).sameSite, 'lax');
  payload = await (await sessionRoute.GET()).json();
  assert.deepEqual(payload.loginEvent, { id: first.id, method: 'google' });
  assert.ok(!JSON.stringify(payload.loginEvent).includes(first.binding));
  const receiptValue = cookies.get(receipts.LOGIN_SUCCESS_COOKIE);
  assert.equal(receipts.readLoginSuccessReceipt(receiptValue.slice(0, -1) + (receiptValue.endsWith('a') ? 'b' : 'a'), session), null);
  assert.equal(receipts.readLoginSuccessReceipt(receiptValue, { ...session, access_token: 'different-session' }), null);
  Date.now = () => first.expires + 1; assert.equal(receipts.readLoginSuccessReceipt(receiptValue, session), null); Date.now = saved.now;
  assert.equal((await claim('wrong-id')).status, 409);
  const concurrent = await Promise.all(Array.from({ length: 8 }, async () => (await claim(first.id)).json()));
  assert.equal(concurrent.filter(result => result.claimed).length, 1, 'The unique row accepts one of eight concurrent tabs');
  assert.equal(rows.size, 1); assert.equal(rows.get(first.id).user_id, session.user.id);
  assert.equal(rows.get(first.id).properties.countryCode, 'GB');
  assert.equal(rows.get(first.id).properties.method, 'google');
  assert.equal((await (await claim(first.id)).json()).claimed, false, 'Refresh cannot claim the same authentication again');
  const ignored = await genericRoute.POST(new Request('https://fixture.invalid/api/analytics/track', { method: 'POST', body: JSON.stringify({ eventName: 'login_success' }) }));
  assert.equal((await ignored.json()).ignored, true); assert.equal(rows.size, 1, 'Cached legacy bundles cannot mirror extra login rows');

  // The same account's next real authentication must count again.
  session = { ...session, access_token: 'new-private-session-fixture' }; cookies.set('fixture-session', session.access_token);
  const second = authenticate('email'); assert.notEqual(second.id, first.id);
  assert.equal((await (await claim(second.id)).json()).claimed, true); assert.equal(rows.size, 2);

  globalThis.window = new EventTarget();
  Object.assign(window, { localStorage: storage(), sessionStorage: storage(), location: { pathname: '/studio', search: '?view=billing' }, dataLayer: [], name: '', opener: null });
  globalThis.document = new EventTarget(); document.referrer = ''; document.visibilityState = 'visible';
  globalThis.fetch = async (url, options) => {
    if (url === '/api/auth/session') return sessionRoute.GET();
    if (url === '/api/analytics/track') { genericMirrors++; return Response.json({ ok: true }); }
    assert.equal(url, '/api/analytics/login-success'); requests++;
    assert.equal(options.credentials, 'include');
    assert.ok(!options.body.includes(session.access_token), 'A login token must never enter analytics metadata');
    return claimRoute.POST(new Request('https://fixture.invalid/api/analytics/login-success', options));
  };
  const analytics = loader()('src/lib/analytics.ts');
  const clientEvent = authenticate('google');
  await Promise.all([analytics.trackLoginSuccess(clientEvent), analytics.trackLoginSuccess(clientEvent)]);
  assert.equal(requests, 1); assert.equal(window.dataLayer.filter(event => event.event === 'login_success').length, 1);
  assert.equal(genericMirrors, 0, 'The dedicated atomic write replaces the generic login mirror');
  assert.equal(window.dataLayer.at(-1).value, null); assert.equal(window.dataLayer.at(-1).method, 'google');
  const before = requests;
  await loader()('src/lib/analytics.ts').trackLoginSuccess(clientEvent);
  assert.equal(requests, before, 'A reloaded module can reuse the browser completion marker');
  analytics.trackEvent('login_success', { surface: 'studio' });
  assert.equal(window.dataLayer.filter(event => event.event === 'login_success').length, 1, 'Generic tracking cannot reintroduce scattered login producers');

  // With storage blocked, distinct browser instances still rely on server uniqueness.
  window.localStorage = window.sessionStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  const blockedEvent = authenticate('email'), tabA = loader()('src/lib/analytics.ts'), tabB = loader()('src/lib/analytics.ts');
  const pushes = window.dataLayer.length;
  await Promise.all([tabA.trackLoginSuccess(blockedEvent), tabB.trackLoginSuccess(blockedEvent)]);
  assert.equal(window.dataLayer.length, pushes + 1);
  await loader()('src/lib/analytics.ts').trackLoginSuccess(blockedEvent); assert.equal(window.dataLayer.length, pushes + 1);
  const retryEvent = authenticate(); failedStorage = true;
  await analytics.trackLoginSuccess(retryEvent); assert.equal(rows.has(retryEvent.id), false);
  failedStorage = false; await analytics.trackLoginSuccess(retryEvent); assert.equal(rows.has(retryEvent.id), true, 'Transient failures leave the receipt retryable');

  // The auth bridge reports only callback receipts, and a live Google popup leaves it to its parent.
  cookies.delete(receipts.LOGIN_SUCCESS_COOKIE);
  const bridge = loader({ './analytics': analytics })('src/lib/supabase-client.ts').createBrowserSupabaseClient();
  const restoredBefore = requests;
  await bridge.auth.getSession(); await analytics.flushLoginSuccessTracking(); assert.equal(requests, restoredBefore);
  const popupEvent = authenticate('google'); window.name = 'dreamface-google-login'; window.opener = { closed: false };
  await bridge.auth.getSession(); await analytics.flushLoginSuccessTracking(); assert.equal(rows.has(popupEvent.id), false);
  window.name = ''; window.opener = null;
  await bridge.auth.getSession(); await analytics.flushLoginSuccessTracking(); assert.equal(rows.has(popupEvent.id), true);
  await bridge.auth.getSession(); await analytics.flushLoginSuccessTracking();
  assert.equal(window.dataLayer.filter(event => event.login_event_id === popupEvent.id).length, 1);
  const logout = load('src/app/api/auth/logout/route.ts'); await logout.POST(new Request('https://fixture.invalid/api/auth/logout', {method:'POST'}));
  assert.equal(cookies.has(receipts.LOGIN_SUCCESS_COOKIE), false);
  for (const source of [readStudioSource(), readFileSync('src/features/billing/billing-content.tsx', 'utf8')]) assert.doesNotMatch(source, /trackEvent\(\s*["']login_success["']/);
  console.log('Login success passed: signed callback-only receipts, restored-session exclusion, eight concurrent claims produce one row, legacy mirror suppressed, repeat real logins counted, browser reload/storage-blocked deduplication, transient retry, popup-parent ownership and logout cleanup. No live authentication, GTM, or database calls.');
} finally {
  globalThis.window = saved.window; globalThis.document = saved.document; globalThis.fetch = saved.fetch; Date.now = saved.now;
  if (saved.secret === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = saved.secret;
}
