import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectLoader } from './load-project-ts.mjs';

// Invoked only inside the generated, loopback-only integration database.
export async function verifyMysqlAuthSignup({ db, admin, store }) {
  const savedMode = process.env.NODE_ENV;
  const savedSecret = process.env.AUTH_SESSION_SECRET;
  const savedGoogle = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, fetch: globalThis.fetch };
  process.env.NODE_ENV = 'production'; // Do not let the development credit fallback hide SQL failures.
  process.env.AUTH_SESSION_SECRET = 'isolated-signup-fixture-secret';
  try {
    const user = randomUUID();
    await db.execute('INSERT INTO users(id,email) VALUES (?,?)', [user, 'signup-fixture@example.invalid']);
    const load = projectLoader({ './mysql': store });
    const credits = load('src/lib/credits.ts');
    const headers = new Headers({ 'cf-connecting-ip': '192.0.2.80', 'cf-ipcountry': 'US' });
    const account = await credits.ensureSignupCreditAccount(admin, user, headers);
    assert.deepEqual(account, { user_id: user, balance: 100, free_granted: true });
    const [grants] = await db.execute("SELECT amount,created_at FROM credit_ledger WHERE user_id=? AND reason='signup_bonus'", [user]);
    assert.equal(grants.length, 1, 'A first-login credit grant must also write its ledger entry');
    assert.equal(grants[0].amount, 100); assert.ok(grants[0].created_at);

    await db.execute('UPDATE user_credit_accounts SET balance=37 WHERE user_id=?', [user]);
    const repeated = await credits.ensureSignupCreditAccount(admin, user, headers);
    assert.equal(repeated.balance, 37, 'A repeated login must not reset the existing balance');
    assert.equal((await db.execute("SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id=? AND reason='signup_bonus'", [user]))[0][0].count, 1);

    for (const mode of ['single', 'maybeSingle', 'many']) {
      let query = admin.from('user_credit_accounts')
        .upsert({ user_id: user, balance: 999, free_granted: true }, { onConflict: 'user_id', ignoreDuplicates: true })
        .select('user_id, balance, free_granted');
      if (mode !== 'many') query = query[mode]();
      const { data, error } = await query;
      assert.equal(error, null, `Multi-column upsert readback: ${mode}`);
      assert.deepEqual(mode === 'many' ? data[0] : data, { user_id: user, balance: 37, free_granted: true });
    }
    const inserted = await admin.from('users').insert({ id: randomUUID(), email: 'readback-fixture@example.invalid' }).select('id, email').single();
    assert.equal(inserted.error, null); assert.equal(inserted.data.email, 'readback-fixture@example.invalid');
    const updated = await admin.from('users').update({ phone: 'fixture' }).eq('id', inserted.data.id).select('id, phone').single();
    assert.equal(updated.error, null); assert.equal(updated.data.phone, 'fixture');

    const cookieValues = new Map(), cookies = {
      get: name => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
      set: (name, value) => cookieValues.set(name, value),
      delete: name => cookieValues.delete(name)
    };
    const routeLoad = projectLoader({
      '../../../../lib/mysql': store, './mysql': store,
      '../../../../lib/supabase-admin': { createSupabaseAdminClient: () => admin },
      '../../../../lib/request-security': { trustedPublicOrigin: () => 'https://fixture.invalid' },
      '../../../../lib/referrals': { completeReferralAuth: async () => {} },
      '../../../../lib/growth-attribution': { GROWTH_COOKIE: 'fixture-growth', recordSignupAttribution: async () => false },
      '../../../../../lib/supabase-admin': { createSupabaseAdminClient: () => admin },
      '../../../../../lib/request-security': { trustedPublicOrigin: () => 'https://fixture.invalid', safeInternalPath: path => path || '/studio' },
      '../../../../../lib/referrals': { completeReferralAuth: async () => {} },
      '../../../../../lib/growth-attribution': { GROWTH_COOKIE: 'fixture-growth', recordSignupAttribution: async () => false },
      'next/headers': { cookies: async () => cookies }
    });
    const auth = routeLoad('src/lib/server-auth.ts');
    const token = auth.newAuthToken();
    await db.execute('INSERT INTO email_otp_codes(email,code_hash,expires_at,created_at) VALUES (?,?,?,?)', [
      'email-login-fixture@example.invalid', auth.hashAuthToken(token), store.toMysqlDate(new Date(Date.now() + 600000)), store.toMysqlDate(new Date())
    ]);
    cookieValues.set('dreamface_email_signin', token);
    const { NextRequest } = await import('next/server.js');
    const postEmail = () => routeLoad('src/app/api/auth/verify/route.ts').POST(new NextRequest('https://fixture.invalid/api/auth/verify', {
      method: 'POST', headers: { origin: 'https://fixture.invalid', 'cf-connecting-ip': '192.0.2.81', 'cf-ipcountry': 'US' }
    }));
    await db.query("CREATE TRIGGER fixture_session_failure BEFORE INSERT ON sessions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated login session fault'");
    const failed = await postEmail();
    assert.equal(failed.status, 503);
    assert.equal((await db.execute('SELECT consumed_at FROM email_otp_codes WHERE code_hash=?', [auth.hashAuthToken(token)]))[0][0].consumed_at, null, 'A real session INSERT error must roll back link consumption');
    assert.equal(cookieValues.has('dreamface_session'), false);
    await db.query('DROP TRIGGER fixture_session_failure');
    const response = await postEmail();
    assert.equal(response.status, 200, 'First email login must survive credit-account creation');
    assert.equal((await response.json()).ok, true);
    const session = await auth.getSessionFromToken(cookieValues.get('dreamface_session'));
    assert.equal(session.user.email, 'email-login-fixture@example.invalid');
    assert.ok(cookieValues.get('dreamface_login_success'));
    assert.equal((await db.execute('SELECT consumed_at FROM email_otp_codes WHERE code_hash=?', [auth.hashAuthToken(token)]))[0][0].consumed_at != null, true);
    assert.equal((await db.execute('SELECT balance FROM user_credit_accounts WHERE user_id=?', [session.user.id]))[0][0].balance, 100);

    process.env.GOOGLE_CLIENT_ID = 'fixture-google-client'; process.env.GOOGLE_CLIENT_SECRET = 'fixture-google-secret';
    globalThis.fetch = async url => {
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fixture-upstream-token' });
      assert.equal(url, 'https://www.googleapis.com/oauth2/v3/userinfo');
      return Response.json({ sub: 'fixture-google-sub', email: 'google-login-fixture@example.invalid', email_verified: true });
    };
    cookieValues.set('dreamface_google_state', 'fixture-csrf');
    const state = Buffer.from(JSON.stringify({ csrf: 'fixture-csrf', next: '/studio?view=home' })).toString('base64url');
    const google = await routeLoad('src/app/api/auth/google/callback/route.ts').GET(new NextRequest(
      `https://fixture.invalid/api/auth/google/callback?${new URLSearchParams({ code: 'fixture-code', state })}`,
      { headers: { 'cf-connecting-ip': '192.0.2.82', 'cf-ipcountry': 'US' } }
    ));
    assert.equal(new URL(google.headers.get('location')).pathname, '/studio');
    const googleSession = await auth.getSessionFromToken(cookieValues.get('dreamface_session'));
    assert.equal(googleSession.user.email, 'google-login-fixture@example.invalid');
    assert.equal((await db.execute('SELECT balance FROM user_credit_accounts WHERE user_id=?', [googleSession.user.id]))[0][0].balance, 100);
    assert.equal((await db.execute("SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id=? AND reason='signup_bonus'", [googleSession.user.id]))[0][0].count, 1);
    console.log('Real MySQL signup passed: multi-column insert/upsert/update readback, first-login account and ledger, repeat balance preservation, real session-trigger failure rollback/retry, and actual email/Google callbacks through session/receipt creation. Email sending and Google HTTP are fixtures.');
  } finally {
    if (savedMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedMode;
    if (savedSecret === undefined) delete process.env.AUTH_SESSION_SECRET; else process.env.AUTH_SESSION_SECRET = savedSecret;
    if (savedGoogle.id === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = savedGoogle.id;
    if (savedGoogle.secret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = savedGoogle.secret;
    globalThis.fetch = savedGoogle.fetch;
  }
}
