import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const native = createRequire(import.meta.url);
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(id => {
      if (id in mocks) return mocks[id];
      if (!id.startsWith('.')) return native(id);
      const path = resolve(dirname(file), id);
      return load(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx');
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const navigation = load('src/lib/auth-navigation.ts');
for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil', null]) assert.equal(navigation.authReturnPath(path), '/studio?view=home');
const destination = '/studio?mode=avatar&workflow=avatar-video';
assert.equal(navigation.authReturnPath(destination), destination);
const completion = new URL(navigation.authCompletionPath(destination), 'https://fixture.invalid');
assert.equal(completion.searchParams.get('next'), destination);
const failure = new URL(navigation.authFailurePath(completion.pathname + completion.search, 'expired_link'), completion);
assert.equal(failure.pathname, '/auth/complete'); assert.equal(failure.searchParams.get('next'), destination);
assert.equal(failure.searchParams.get('error'), 'expired_link');

const saved = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
const env = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
try {
  let session = null, reads = 0;
  const writes = [];
  globalThis.window = new EventTarget();
  window.location = { pathname: '/studio', search: '?mode=avatar', hash: '', origin: 'https://fixture.invalid' };
  window.localStorage = { setItem: (key, value) => writes.push({ key, value }) };
  globalThis.document = new EventTarget(); document.visibilityState = 'visible';
  globalThis.fetch = async url => {
    if (url === '/api/auth/logout') { session = null; return Response.json({ ok: true }); }
    assert.equal(url, '/api/auth/session'); reads++; return Response.json({ session });
  };
  const browser = load('src/lib/supabase-client.ts');
  const client = browser.createBrowserSupabaseClient();
  const calls = [];
  const subscription = client.auth.onAuthStateChange((event, value) => calls.push({ event, value }));
  await client.auth.getSession();
  assert.equal(reads, 1, 'Concurrent subscribers share a session request');
  session = { access_token: 'server-session-fixture', expires_at: '2099-01-01', user: { id: 'owner', email: 'owner@example.invalid' } };
  const storageEvent = new Event('storage'); Object.defineProperty(storageEvent, 'key', { value: 'dreamface-auth-updated' });
  window.dispatchEvent(storageEvent); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls.at(-1).event, 'SIGNED_IN');
  browser.notifyAuthChange(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(writes.length); assert.ok(writes.every(item => !item.value.includes(session.access_token)), 'Cross-tab notifications carry no credentials');
  await client.auth.signOut(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls.at(-1).event, 'SIGNED_OUT');
  subscription.data.subscription.unsubscribe(); const before = reads;
  window.dispatchEvent(new Event('focus')); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, before);

  const requests = [];
  window.addEventListener(navigation.AUTH_DIALOG_EVENT, event => requests.push(event.detail));
  navigation.requestSignIn(); assert.equal(requests[0].next, '/studio?mode=avatar');
  assert.equal(requests[0].onBeforeRedirect(), true);
  window.addEventListener(navigation.AUTH_REDIRECT_EVENT, event => event.preventDefault());
  assert.equal(requests[0].onBeforeRedirect(), false, 'A failed draft save can cancel the redirect fallback');
  const googleSteps = [], googleWindow = { close() {} };
  Object.assign(window, { screenX: 0, screenY: 0, outerWidth: 1440, outerHeight: 1000, open: url => { googleSteps.push(url); return googleWindow; } });
  window.addEventListener(navigation.AUTH_DIALOG_EVENT, () => googleSteps.push('dialog'));
  navigation.requestGoogleSignIn();
  assert.ok(googleSteps[0].startsWith('/api/auth/google/start?'), 'Direct Google entry opens the OAuth window before dispatching the dialog event');
  assert.equal(googleSteps[1], 'dialog');
  assert.equal(requests.at(-1).googlePopup, googleWindow);
  assert.equal(new URL(googleSteps[0], window.location.origin).searchParams.get('next'), '/studio?mode=avatar');
  window.open = () => null;
  navigation.requestGoogleSignIn(); assert.equal(requests.at(-1).googlePopup, null, 'A blocked direct Google popup is passed to the fallback dialog');

  // Exercise the actual OAuth routes, with all upstream and database writes stubbed.
  const cookieValues = new Map(), cookiesWritten = [];
  const cookieStore = { get: key => cookieValues.has(key) ? { value: cookieValues.get(key) } : undefined,
    set(key, value, options) { cookieValues.set(key, value); cookiesWritten.push({ key, value, options }); },
    delete: key => cookieValues.delete(key) };
  let sessionsCreated = 0, consumed = 0;
  let emailRow = { id: 1, email: 'owner@example.invalid', expires_at: '2099-01-01 00:00:00', consumed_at: null };
  const security = { safeInternalPath: navigation.authReturnPath, trustedPublicOrigin: () => 'https://fixture.invalid' };
  const auth = { newAuthToken: () => 'csrf-fixture', SESSION_COOKIE_NAME: 'fixture-session', hashAuthToken: value => 'hash:' + value,
    createSession: async () => { sessionsCreated++; return { access_token: 'server-only-fixture', expires_at: '2099-01-01' }; },
    upsertGoogleUser: async () => ({ id: 'owner', isNew: true }), upsertEmailUser: async () => ({ id: 'owner', isNew: true }) };
  const mocks = { 'next/headers': { cookies: async () => cookieStore } };
  for (const prefix of ['../../../../../lib/', '../../../../lib/']) {
    mocks[prefix + 'request-security'] = security;
    mocks[prefix + 'server-auth'] = auth;
    mocks[prefix + 'credits'] = { ensureSignupCreditAccount: async () => {}, getRequestCountryCode: () => null };
    mocks[prefix + 'supabase-admin'] = { createSupabaseAdminClient: () => null };
    mocks[prefix + 'referrals'] = { captureReferralAuth: async () => {}, completeReferralAuth: async () => {} };
    mocks[prefix + 'mysql'] = { getMysqlPool: () => ({ execute: async sql => {
      if (sql.startsWith('select')) return [[emailRow]];
      consumed++; return [{ affectedRows: 1 }];
    } }), toMysqlDate: value => value };
  }
  const routes = loader(mocks), { NextRequest } = native('next/server');
  const start = routes('src/app/api/auth/google/start/route.ts');
  const callback = routes('src/app/api/auth/google/callback/route.ts');
  const loginReceipts = routes('src/lib/login-success-receipt.ts');
  const loginIds = new Set();
  process.env.GOOGLE_CLIENT_ID = 'client-fixture'; process.env.GOOGLE_CLIENT_SECRET = 'secret-fixture';
  for (const popup of [false, true]) {
    const response = await start.GET(new NextRequest(`https://fixture.invalid/api/auth/google/start?${new URLSearchParams({ next: destination, ...(popup ? { popup: '1' } : {}) })}`));
    const google = new URL(response.headers.get('location'));
    assert.equal(google.origin, 'https://accounts.google.com');
    const state = google.searchParams.get('state');
    assert.equal(JSON.parse(Buffer.from(state, 'base64url')).popup, popup);
    globalThis.fetch = async url => url.includes('/token') ? Response.json({ access_token: 'upstream-fixture' }) : Response.json({ sub: 'google-owner', email: 'owner@example.invalid', email_verified: true });
    const completed = await callback.GET(new NextRequest(`https://fixture.invalid/api/auth/google/callback?${new URLSearchParams({ state, code: 'code-fixture' })}`));
    const target = new URL(completed.headers.get('location'));
    assert.equal(target.pathname, popup ? '/auth/complete' : '/studio');
    if (popup) assert.equal(target.searchParams.get('next'), destination);
    assert.ok(!target.href.includes('server-only-fixture'), 'Session token must stay in the cookie');
    const cookie = cookiesWritten.findLast(item => item.key === 'fixture-session');
    assert.equal(cookie.options.httpOnly, true);
    const receipt = loginReceipts.readLoginSuccessReceipt(cookieValues.get(loginReceipts.LOGIN_SUCCESS_COOKIE), { access_token: 'server-only-fixture' });
    assert.equal(receipt.method, 'google');loginIds.add(receipt.id);
  }
  assert.equal(loginIds.size,2,'Separate successful Google authentications mint different login events');
  const priorSessions = sessionsCreated;
  const priorReceipt = cookieValues.get(loginReceipts.LOGIN_SUCCESS_COOKIE);
  const badState = Buffer.from(JSON.stringify({ csrf: 'invalid', next: destination, popup: true })).toString('base64url');
  const rejected = await callback.GET(new NextRequest(`https://fixture.invalid/api/auth/google/callback?code=x&state=${badState}`));
  assert.equal(new URL(rejected.headers.get('location')).searchParams.get('error'), 'google_state');
  assert.equal(sessionsCreated, priorSessions, 'Popup mode cannot bypass the state cookie');
  assert.equal(cookieValues.get(loginReceipts.LOGIN_SUCCESS_COOKIE),priorReceipt,'An unsuccessful OAuth attempt cannot mint login_success');
  const verify = routes('src/app/api/auth/verify/route.ts');
  const emailNext = navigation.authCompletionPath(destination);
  let emailResult = await verify.GET(new NextRequest(`https://fixture.invalid/api/auth/verify?${new URLSearchParams({ token: 'email-fixture', next: emailNext })}`));
  assert.equal(new URL(emailResult.headers.get('location')).pathname, '/auth/complete'); assert.equal(consumed, 1);
  const emailReceipt=loginReceipts.readLoginSuccessReceipt(cookieValues.get(loginReceipts.LOGIN_SUCCESS_COOKIE),{access_token:'server-only-fixture'});
  assert.equal(emailReceipt.method,'email');assert.equal(loginIds.has(emailReceipt.id),false);
  emailRow = { ...emailRow, consumed_at: '2026-01-01' };
  emailResult = await verify.GET(new NextRequest(`https://fixture.invalid/api/auth/verify?${new URLSearchParams({ token: 'email-fixture', next: emailNext })}`));
  assert.equal(new URL(emailResult.headers.get('location')).searchParams.get('error'), 'expired_link'); assert.equal(consumed, 1);
  assert.equal(loginReceipts.readLoginSuccessReceipt(cookieValues.get(loginReceipts.LOGIN_SUCCESS_COOKIE),{access_token:'server-only-fixture'}).id,emailReceipt.id,'An expired email link cannot mint another login event');

  const { authDialogCopy } = load('src/components/auth-dialog-copy.ts');
  for (const locale of load('src/i18n/routing.ts').locales) assert.ok(Object.values(authDialogCopy(locale)).every(value => typeof value === 'string' && value.length > 0), locale);
  console.log('Auth dialog passed: safe return URLs, in-place requests, shared session reads, cross-tab sign-in/out, redirect draft guard, Google popup/legacy callbacks, CSRF rejection, cookie-only tokens, email completion/expiry, and 16 locales. No live provider, email, payment or database calls.');
} finally {
  Object.assign(globalThis, saved);
  for (const [key, value] of Object.entries({ GOOGLE_CLIENT_ID: env.clientId, GOOGLE_CLIENT_SECRET: env.clientSecret })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
