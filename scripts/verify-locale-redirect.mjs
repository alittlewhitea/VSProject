import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server.js';
import { projectLoader } from './load-project-ts.mjs';
import worker from '../cloudflare/locale-redirect-worker.mjs';

const cacheSettings = JSON.parse(readFileSync('src/lib/marketing-cache-settings.json', 'utf8'));
const load = projectLoader({ './marketing-cache-settings.json': cacheSettings });
const { resolveRequestLocale } = load('src/i18n/locale-preference.ts');
const { locales } = load('src/i18n/routing.ts');
const { middleware } = load('src/middleware.ts');
const cases = [
  [{}, 'en'],
  [{ 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' }, 'fr'],
  [{ 'accept-language': 'en-US,en;q=0.9,fr;q=0.8' }, 'en'],
  [{ 'accept-language': 'de;q=0.5,fr-CA;q=0.9,en;q=0.1' }, 'fr'],
  [{ 'accept-language': 'de;q=0.8,fr;q=0.8' }, 'de'],
  [{ 'accept-language': 'zz-ZZ,fr;q=0.5' }, 'fr'],
  [{ 'accept-language': 'enx,de;q=0.5' }, 'de'],
  [{ 'accept-language': 'fr;q=0,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;q=bad,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;q=1.1,de;q=.8' }, 'de'],
  [{ 'accept-language': 'fr;q=-1,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;q=0.1234,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;q=0.8;q=1,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;invalid,de;q=0.8' }, 'de'],
  [{ 'accept-language': 'fr;q=1.000,de;q=0.8' }, 'fr'],
  [{ 'accept-language': 'FR-ca;Q=0.9,en;q=0.5' }, 'fr'],
  [{ 'accept-language': 'fr;q=0,*;q=0.8' }, 'en'],
  [{ 'accept-language': 'zz-ZZ' }, 'en'],
  [{ 'accept-language': 'zh-HK' }, 'zh-TW'],
  [{ 'accept-language': 'zh-MO' }, 'zh-TW'],
  [{ 'accept-language': 'zh-Hant-CN' }, 'zh-TW'],
  [{ 'accept-language': 'zh-Hans-HK' }, 'zh-CN'],
  [{ 'accept-language': 'zh-SG' }, 'zh-CN'],
  [{ 'accept-language': 'zh' }, 'zh-CN'],
  [{ 'accept-language': 'pt-PT' }, 'pt-BR'],
  [{ 'accept-language': 'iw-IL' }, 'he'],
  [{ 'accept-language': 'fr', cookie: 'dreamface_locale=en' }, 'en'],
  [{ 'accept-language': 'en', cookie: 'other=a=b; dreamface_locale=fr; other2=z' }, 'fr'],
  [{ 'accept-language': 'en', cookie: 'dreamface_locale=FR' }, 'fr'],
  [{ 'accept-language': 'en', cookie: 'dreamface_locale=%66%72' }, 'fr'],
  [{ 'accept-language': 'fr', cookie: 'dreamface_locale=%E0%A4%A' }, 'fr'],
  [{ 'accept-language': 'fr', cookie: 'dreamface_locale=unsupported' }, 'fr'],
  [{ 'accept-language': 'fr', cookie: 'other_dreamface_locale=en' }, 'fr'],
  [{ 'accept-language': 'fr', cookie: 'dreamface_locale=https%3A%2F%2Fevil.invalid' }, 'fr'],
  [{ 'accept-language': 'fr', cookie: 'dreamface_locale=..%2Fadmin' }, 'fr']
];
for (const locale of locales) {
  cases.push([{ 'accept-language': locale }, locale]);
  cases.push([{ 'accept-language': 'en', cookie: `dreamface_locale=${locale}` }, locale]);
}

let upstreamCalls = 0, upstreamResponse, upstreamError;
const upstreamRequests = [], originalFetch = globalThis.fetch;
globalThis.fetch = async request => {
  upstreamCalls++;
  upstreamRequests.push(request);
  if (upstreamError) throw upstreamError;
  return upstreamResponse;
};
try {
  const query = '?utm_source=google&gclid=a%2Fb&tag=one&tag=two&next=%2Fstudio%3Fview%3Dhome&empty=&plus=a+b';
  for (const [headers, locale] of cases) {
    assert.equal(resolveRequestLocale(new Headers(headers)), locale, JSON.stringify(headers));
    const url = 'https://dreamface.io/' + query;
    const before = upstreamCalls;
    let fallbackEnabled = false;
    const edge = await worker.fetch(new Request(url, { headers }), {}, { passThroughOnException() { fallbackEnabled = true; } });
    const origin = middleware(new NextRequest(url, { headers }));
    for (const response of [edge, origin]) {
      assert.equal(response.status, 307);
      assert.equal(response.headers.get('location'), 'https://dreamface.io/' + locale + query, 'Redirect preserves the complete query and stays on the supported locale allowlist');
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.has('set-cookie'), false, 'Automatic selection must not overwrite the user preference');
    }
    assert.equal(edge.headers.get('vary'), 'Accept-Language, Cookie');
    assert.equal(edge.headers.get('x-dreamface-locale-redirect'), 'edge');
    assert.equal(origin.headers.get('x-dreamface-locale-redirect'), 'origin');
    assert.equal(upstreamCalls, before, 'A root edge redirect never reaches the origin');
    assert.equal(fallbackEnabled, true);
  }

  for (const path of ['/price', '/auth', '/billing']) {
    const response = middleware(new NextRequest('https://dreamface.io' + path + '?next=%2Fstudio', { headers: { 'accept-language': 'fr', cookie: 'dreamface_locale=de' } }));
    assert.equal(response.headers.get('location'), 'https://dreamface.io/de' + path + '?next=%2Fstudio');
  }
  const head = await worker.fetch(new Request('http://dreamface.io/?gclid=fixture', { method: 'HEAD', headers: { 'accept-language': 'fr' } }));
  assert.equal(head.headers.get('location'), 'https://dreamface.io/fr?gclid=fixture');
  assert.equal(await head.text(), '');

  upstreamResponse = new Response('origin fixture', { headers: { 'Cache-Control': 'private, no-store', 'Set-Cookie': 'fixture=value; HttpOnly', ETag: 'fixture-etag' } });
  for (const path of ['/en', '/fr', '/es/video/text-to-video', '/studio?view=projects', '/api/auth/session', '/api/billing/checkout', '/_next/static/fixture.js', '/gallery', '/unknown']) {
    const request = new Request('https://dreamface.io' + path, { headers: { 'accept-language': 'fr', cookie: 'dreamface_locale=de', RSC: '1' } });
    let fallbackEnabled = false;
    const response = await worker.fetch(request, {}, { passThroughOnException() { fallbackEnabled = true; } });
    assert.equal(response, upstreamResponse, 'Non-root responses and their cache/cookie headers pass through unchanged');
    assert.equal(upstreamRequests.at(-1), request, 'The original Request is forwarded without reconstructing it');
    assert.equal(fallbackEnabled, false, 'Never enable exception replay for origin requests');
  }
  for (const path of ['/fr', '/en', '/zh-TW', '/es/video/text-to-video']) {
    const response = middleware(new NextRequest('https://dreamface.io' + path, { headers: { 'accept-language': 'de', cookie: 'dreamface_locale=de' } }));
    assert.equal(response.headers.has('location'), false, 'An explicit language URL always wins');
  }
  const post = new Request('https://dreamface.io/', { method: 'POST', body: 'original body' });
  assert.equal(await worker.fetch(post), upstreamResponse);
  assert.equal(await upstreamRequests.at(-1).text(), 'original body');
  assert.equal(middleware(new NextRequest('https://dreamface.io/', { method: 'POST', body: 'fixture' })).headers.has('location'), false);
  upstreamError = new Error('Fixture origin failure');
  const before = upstreamCalls;
  await assert.rejects(worker.fetch(new Request('https://dreamface.io/api/generate', { method: 'POST', body: 'fixture' })), error => error === upstreamError);
  assert.equal(upstreamCalls, before + 1, 'An origin failure must not cause a second paid submission');
  const otherHost = await worker.fetch(new Request('https://unrelated.invalid/'));
  assert.equal(otherHost.status, 404);
  const config = JSON.parse(readFileSync('cloudflare/wrangler.jsonc', 'utf8'));
  assert.equal(config.routes[0].pattern, 'dreamface.io/*');
  assert.equal(config.routes[0].zone_name, 'dreamface.io');
  assert.equal(config.workers_dev, false);
  assert.doesNotMatch(readFileSync('cloudflare/locale-redirect-worker.mjs', 'utf8'), /^import\s/m, 'The dashboard script must be self-contained');
} finally {
  globalThis.fetch = originalFetch;
}
console.log(`Locale redirect passed: ${cases.length} shared resolver/Next/Worker cases, all 16 languages, cookie precedence, weighted browser preferences, Chinese/Portuguese/Hebrew variants, malformed inputs, tracking parameters, HEAD, explicit locale URLs, untouched origin responses and no POST retries. All fetches mocked; no network or database.`);
