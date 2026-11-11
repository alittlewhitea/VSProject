// Requires a local production build at :3000. Run the server with an isolated or
// disabled database connection. This checks HTTP only, without running page scripts.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = 'http://127.0.0.1:3000';
const observations = [];
async function get(path, headers = {}, method = 'GET') {
  const response = await fetch(origin + path, { method, headers, redirect: 'manual' });
  const body = await response.text();
  observations.push({ path, method, requestHeaders: headers, status: response.status, cacheControl: response.headers.get('cache-control'), vary: response.headers.get('vary'), locale: body.match(/<html[^>]*lang="([^"]+)"/)?.[1], location: response.headers.get('location') });
  return { response, body };
}

try {
  for (const path of ['/en', '/zh-CN', '/ar', '/about', '/avatar/ai-avatar-generator', '/video/text-to-video', '/video/image-to-video', '/video/gemini-omni', '/video/seedance-2', '/video/examples', '/image/text-to-image', '/es/video/text-to-video', '/pt-BR/image/text-to-image', '/compare', '/compare/dreamface-vs-heygen']) {
    const { response, body } = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('cache-control'), /public.*max-age=0.*s-maxage=300.*stale-while-revalidate=60/, path);
    assert.equal(response.headers.has('pragma'), false, path);
    assert.equal(response.headers.has('set-cookie'), false, 'Public HTML must not set account cookies');
    assert.ok(body.includes('<h1'), path + ' contains server-rendered marketing content');
    assert.match(response.headers.get('vary'), /RSC/i, 'Next navigation variants remain distinct');
  }
  for (const [path, locale] of [['/en', 'en'], ['/zh-CN', 'zh-CN'], ['/ar', 'ar']]) {
    const { body } = await get(path, { 'x-dreamface-locale': 'fr', cookie: 'dreamface_locale=fr; dreamface_session=unrelated-user' });
    assert.match(body, new RegExp('<html[^>]*lang="' + locale + '"'), 'URL locale wins over request headers and cookies');
    assert.equal(body.includes('unrelated-user'), false, 'Public response does not serialize cookies');
    if (locale === 'ar') assert.match(body, /<html[^>]*dir="rtl"/);
  }
  for (const path of ['/en/auth', '/en/billing', '/en/price', '/studio?view=home', '/api/auth/session', '/en?next=/admin', '/video/mischief-1', '/compare/unknown', '/missing-fixture-page']) {
    const { response } = await get(path);
    assert.match(response.headers.get('cache-control'), /no-store/, path);
  }
  // Next removes its internal _rsc query before middleware. The actual response
  // variant is identified by the RSC header, which must always bypass sharing.
  const { response: flight } = await get('/en?_rsc=fixture', { RSC: '1' });
  assert.match(flight.headers.get('cache-control'), /no-store/);
  assert.match(flight.headers.get('content-type'), /text\/x-component/);
  for (const headers of [{ RSC: '1', 'Next-Router-Prefetch': '1' }, { accept: 'text/x-component' }, { authorization: 'Bearer fixture-only' }]) {
    const { response } = await get('/en', headers);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  const { response: tracking } = await get('/en?utm_source=google&gclid=fixture');
  assert.match(tracking.headers.get('cache-control'), /s-maxage=300/);
  const { response: head } = await get('/video/text-to-video', {}, 'HEAD');
  assert.match(head.headers.get('cache-control'), /s-maxage=300/);
  const { response: redirect } = await get('/?utm_source=google&gclid=fixture');
  assert.equal(redirect.status, 307);
  assert.match(redirect.headers.get('cache-control'), /no-store/);
  assert.equal(new URL(redirect.headers.get('location')).pathname, '/en');
  assert.equal(new URL(redirect.headers.get('location')).searchParams.get('gclid'), 'fixture');
  console.log('Production HTTP cache passed: public HTML, real response headers, locale/RTL isolation, unmodified tracking, no account-cookie serialization, private and removed pages, RSC and redirects. No page JavaScript, payments or provider calls.');
} finally {
  mkdirSync('outputs/marketing-cache', { recursive: true });
  writeFileSync('outputs/marketing-cache/http-verification.json', JSON.stringify(observations, null, 2));
}
