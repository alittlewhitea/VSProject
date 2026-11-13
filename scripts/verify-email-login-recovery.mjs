import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// Run the actual route, session writer and MySQL transaction helper. Only the
// database transport, request cookies and unrelated signup services are fixtures.
const native = createRequire(import.meta.url), cache = new Map();
const token = 'a'.repeat(64), email = 'fixture@example.invalid';
const utc = value => value.toISOString().slice(0, 19).replace('T', ' ');
const link = { id: 1, email, expires_at: utc(new Date(Date.now() + 600000)), consumed_at: null };
const cookieValues = new Map(), sessions = new Map(), logs = [];
const store = {
  get: name => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
  set: (name, value) => cookieValues.set(name, value)
};
let transaction = false, snapshot, sessionFailure = false, creditFailure = false, loseRace = false;
let committed = 0, rolledBack = 0, released = 0;
async function execute(sql, values) {
  if (sql.startsWith('select id, email, expires_at')) return [[{ ...link }]];
  if (sql.startsWith('select id, email from users')) return [[{ id: 'fixture-user', email }]];
  if (sql.startsWith('update users')) return [{ affectedRows: 1 }];
  if (sql.startsWith('update email_otp_codes')) {
    assert.equal(transaction, true, 'Link consumption must use a transaction');
    if (loseRace || link.consumed_at || link.expires_at <= values[2]) return [{ affectedRows: 0 }];
    link.consumed_at = values[0];
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith('insert into sessions')) {
    assert.equal(transaction, true, 'Session creation must use the consuming connection');
    if (sessionFailure) throw Object.assign(new Error('fixture database failure'), { code: 'ER_FIXTURE_SESSION' });
    sessions.set(values[0], { id: values[1], email, expires_at: values[2] });
    return [{ affectedRows: 1 }];
  }
  if (sql.startsWith('select s.expires_at')) return [[...(sessions.has(values[0]) ? [sessions.get(values[0])] : [])]];
  throw new Error(`Unexpected fixture SQL: ${sql}`);
}
const connection = {
  execute,
  async beginTransaction() {
    assert.equal(transaction, false);
    transaction = true;
    snapshot = { consumed: link.consumed_at, sessions: new Map(sessions) };
  },
  async commit() { committed++; transaction = false; },
  async rollback() {
    rolledBack++; transaction = false; link.consumed_at = snapshot.consumed;
    sessions.clear(); for (const [key, value] of snapshot.sessions) sessions.set(key, value);
  },
  release() { released++; }
};
const mocks = {
  'mysql2/promise': { createPool: options => {
    assert.equal(options.host, '127.0.0.1'); assert.equal(options.port, 1);
    return { execute, getConnection: async () => connection };
  } },
  'next/headers': { cookies: async () => store },
  '../../../../lib/credits': { getRequestCountryCode: () => null, ensureSignupCreditAccount: async () => {
    if (creditFailure) throw Object.assign(new Error('fixture signup service failure'), { code: 'ER_FIXTURE_CREDITS' });
  } },
  '../../../../lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
  '../../../../lib/referrals': { completeReferralAuth: async () => {} },
  '../../../../lib/growth-attribution': { GROWTH_COOKIE: 'fixture-growth', recordSignupAttribution: async () => false }
};
function load(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : id.startsWith('.')
    ? load(resolve(dirname(file), id + '.ts')) : native(id), module, module.exports);
  return module.exports;
}
const envKeys = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_DATABASE', 'NEXT_PUBLIC_APP_URL'];
const saved = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const consoleError = console.error;
try {
  Object.assign(process.env, { MYSQL_HOST: '127.0.0.1', MYSQL_PORT: '1', MYSQL_USER: 'fixture', MYSQL_DATABASE: 'fixture', NEXT_PUBLIC_APP_URL: 'https://fixture.invalid' });
  console.error = (...args) => logs.push(JSON.stringify(args));
  const route = load('src/app/api/auth/verify/route.ts');
  const { NextRequest } = native('next/server');
  const post = (origin = 'https://fixture.invalid') => route.POST(new NextRequest('https://fixture.invalid/api/auth/verify', { method: 'POST', headers: { origin } }));
  cookieValues.set('dreamface_email_signin', token);
  assert.equal((await post('https://evil.invalid')).status, 403);
  assert.equal(committed + rolledBack, 0);

  creditFailure = true;
  let response = await post();
  assert.equal(response.status, 503); assert.equal((await response.json()).error, 'signin_failed');
  assert.equal(link.consumed_at, null); assert.equal(sessions.size, 0);
  assert.equal(cookieValues.get('dreamface_email_signin'), token, 'Signup failure keeps the browser handoff for a retry');
  assert.equal(committed + rolledBack, 0, 'Signup preparation precedes link consumption');

  creditFailure = false; sessionFailure = true;
  response = await post();
  assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '2');
  assert.equal(link.consumed_at, null, 'Failed session insertion rolls back consumption');
  assert.equal(sessions.size, 0); assert.equal(rolledBack, 1); assert.equal(released, 1);
  assert.equal(cookieValues.has('dreamface_session'), false);

  sessionFailure = false; loseRace = true;
  response = await post();
  assert.equal(response.status, 409); assert.equal((await response.json()).error, 'used_link');
  assert.equal(sessions.size, 0, 'A concurrent loser cannot create a session');

  loseRace = false;
  response = await post();
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  assert.ok(link.consumed_at); assert.equal(sessions.size, 1);
  assert.ok(cookieValues.get('dreamface_session')); assert.ok(cookieValues.get('dreamface_login_success'));
  assert.equal(cookieValues.get('dreamface_email_signin'), '');
  assert.equal(committed, 2); assert.equal(released, 3);

  cookieValues.set('dreamface_email_signin', token);
  response = await post();
  assert.equal((await response.json()).ok, true); assert.equal(sessions.size, 1, 'The same signed-in browser recovers without a duplicate session');
  cookieValues.set('dreamface_email_signin', token); cookieValues.delete('dreamface_session');
  response = await post(); assert.equal(response.status, 409, 'Another browser cannot replay a consumed link');
  link.expires_at = utc(new Date(Date.now() - 60000));
  response = await post(); assert.equal(response.status, 410);

  assert.ok(logs.some(line => line.includes('signup_credits') && line.includes('ER_FIXTURE_CREDITS')));
  assert.ok(logs.some(line => line.includes('create_session') && line.includes('ER_FIXTURE_SESSION')));
  assert.ok(logs.every(line => !line.includes(token) && !line.includes(email)), 'Diagnostics contain no sign-in credentials or email');
  console.log('Email recovery passed: actual transaction/session code, signup failure without consumption, session failure rollback and retry, race rejection, single session, replay protection, expiry, and redacted diagnostics. Database transport and signup services mocked; no live calls.');
} finally {
  console.error = consoleError;
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
