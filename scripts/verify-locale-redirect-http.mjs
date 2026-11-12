// Requires a local production build on :3000 with an isolated/disabled database.
// No browser scripts run and no request follows through to authentication APIs.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

// Next normalizes loopback IP origins to localhost in development URLs.
const origin = 'http://localhost:3000', observations = [];
const cases = [
  ['/', {}, '/en'],
  ['/', { 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' }, '/fr'],
  ['/', { 'accept-language': 'en-US,en;q=0.9,fr;q=0.8' }, '/en'],
  ['/', { 'accept-language': 'en;q=0.2,fr-CA;q=0.9' }, '/fr'],
  ['/', { 'accept-language': 'fr', cookie: 'dreamface_locale=de' }, '/de'],
  ['/', { 'accept-language': 'fr', cookie: 'dreamface_locale=%E0%A4%A' }, '/fr'],
  ['/', { 'accept-language': 'zh-Hant-HK' }, '/zh-TW'],
  ['/', { 'accept-language': 'pt-PT' }, '/pt-BR'],
  ['/', { 'accept-language': 'xx-ZZ' }, '/en'],
  ['/price', { 'accept-language': 'fr' }, '/fr/price'],
  ['/auth', { 'accept-language': 'fr' }, '/fr/auth'],
  ['/billing', { 'accept-language': 'fr' }, '/fr/billing']
];
const query = '?utm_source=google&gclid=a%2Fb&tag=a&tag=b&next=%2Fstudio%3Fview%3Dhome';
try {
  for (const [path, headers, destination] of cases) {
    const response = await fetch(origin + path + query, { headers, redirect: 'manual' });
    await response.arrayBuffer();
    const location = new URL(response.headers.get('location'), origin);
    assert.equal(response.status, 307);
    assert.equal(location.origin, origin);
    assert.equal(location.pathname, destination);
    assert.equal(location.search, query);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-dreamface-locale-redirect'), 'origin');
    assert.match(response.headers.get('vary'), /Accept-Language/i);
    assert.match(response.headers.get('vary'), /Cookie/i);
    assert.equal(response.headers.has('set-cookie'), false);
    observations.push({ path, headers, status: response.status, location: location.href });
  }
  for (const locale of ['fr', 'en', 'zh-TW', 'ar']) {
    const response = await fetch(origin + '/' + locale, { headers: { 'accept-language': 'de', cookie: 'dreamface_locale=de' }, redirect: 'manual' });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.has('location'), false);
    assert.match(html, new RegExp('<html[^>]*lang="' + locale + '"'));
    if (locale === 'ar') assert.match(html, /<html[^>]*dir="rtl"/);
    assert.match(response.headers.get('cache-control'), /s-maxage=300/, 'An explicit locale page remains public and independent of saved preferences');
    observations.push({ path: '/' + locale, status: response.status, locale });
  }
  const head = await fetch(origin + '/', { method: 'HEAD', headers: { 'accept-language': 'fr' }, redirect: 'manual' });
  assert.equal(head.status, 307);
  assert.equal(new URL(head.headers.get('location')).pathname, '/fr');
  assert.equal(await head.text(), '');
  console.log('Locale redirect production HTTP passed: browser language, saved preference, malformed cookie, variants, tracking/next queries, auth/billing/price entry paths, HEAD, explicit language pages, RTL and public-page cache isolation. No provider or payment calls.');
} finally {
  mkdirSync('outputs/locale-redirect', { recursive: true });
  writeFileSync('outputs/locale-redirect/http-verification.json', JSON.stringify(observations, null, 2));
}
