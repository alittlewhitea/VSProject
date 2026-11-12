import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server.js';
import { projectLoader } from './load-project-ts.mjs';

const settings = JSON.parse(readFileSync('src/lib/marketing-cache-settings.json', 'utf8'));
const load = projectLoader({ './marketing-cache-settings.json': settings });
const { locales } = load('src/i18n/routing.ts');
assert.deepEqual([...settings.localeHomes].sort(), [...locales].sort(), 'Header rules must cover exactly the supported locales');
const { canCacheMarketingRequest, PUBLIC_MARKETING_CACHE_CONTROL } = load('src/lib/marketing-cache-policy.ts');
const request = (path, options) => new NextRequest('https://fixture.invalid' + path, options);
for (const locale of locales) assert.equal(canCacheMarketingRequest(request('/' + locale)), true);
for (const path of ['/about', '/video/gemini-omni', '/video/seedance-2', '/video/seedance-2-5-flash', '/avatar/ai-avatar-generator', '/compare/dreamface-vs-heygen', '/es/video/text-to-video', '/pt-BR/image/text-to-image']) {
  assert.equal(canCacheMarketingRequest(request(path)), true, path);
  assert.equal(canCacheMarketingRequest(request(path + '?utm_source=google&gclid=fixture')), true);
}
for (const path of ['/', '/studio', '/en/auth', '/ar/billing', '/en/price', '/gallery', '/creations/fixture', '/admin', '/api/credits', '/video/mischief-1', '/compare/unknown', '/unknown', '/zh-CN/video/text-to-video', '/en?next=/admin', '/en?token=fixture', '/en?_rsc=fixture']) assert.equal(canCacheMarketingRequest(request(path)), false, path);
for (const key of settings.nonHtmlHeaders) assert.equal(canCacheMarketingRequest(request('/en', { headers: { [key]: 'fixture' } })), false, key);
assert.equal(canCacheMarketingRequest(request('/en', { headers: { accept: 'text/x-component' } })), false);
assert.equal(canCacheMarketingRequest(request('/en', { method: 'POST' })), false);
assert.equal(canCacheMarketingRequest(request('/en', { method: 'HEAD' })), true);

const originalEnvironment = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  const { middleware } = load('src/middleware.ts');
  const page = middleware(request('/zh-CN?utm_source=fixture'));
  assert.equal(page.headers.has('cache-control'), false, 'Middleware must not override the raw-header-aware config rules');
  const { default: config } = await import('../next.config.mjs?cache-fixture=production');
  const headerRules = await config.headers();
  for (const path of ['/en', '/zh-CN', '/video/text-to-video', '/es/video/image-to-video']) {
    const rule = headerRules.find(rule => rule.source === path);
    assert.ok(rule, path);
    assert.equal(rule.headers[0].value, PUBLIC_MARKETING_CACHE_CONTROL);
    for (const key of settings.nonHtmlHeaders) assert.ok(rule.missing.some(item => item.type === 'header' && item.key === key));
    assert.ok(rule.missing.some(item => item.key === 'accept' && new RegExp(item.value).test('text/x-component')));
  }
  assert.equal(page.headers.has('pragma'), false);
  assert.equal(page.headers.get('x-middleware-request-x-dreamface-locale'), 'zh-CN');
  for (const path of ['/en/auth', '/en/billing', '/en/price', '/video/unknown', '/en?_rsc=x']) assert.match(middleware(request(path)).headers.get('cache-control'), /no-store/);
  const redirect = middleware(request('/?utm_source=fixture'));
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get('location'), 'https://fixture.invalid/en?utm_source=fixture');
  assert.match(redirect.headers.get('cache-control'), /no-store/);
  process.env.NODE_ENV = 'development';
  assert.match(middleware(request('/en')).headers.get('cache-control'), /no-store/);
  const { default: developmentConfig } = await import('../next.config.mjs?cache-fixture=development');
  assert.equal((await developmentConfig.headers()).some(rule => rule.headers.some(header => header.value === PUBLIC_MARKETING_CACHE_CONTROL)), false);
} finally {
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
}

let cachedOptions, cacheKeys, queryOptions, failing = false, invalidations = 0;
const publicRows = [{ id: 'public-fixture', is_published: true }];
const cacheLoad = projectLoader({
  'next/cache': {
    unstable_cache: (fn, keys, options) => { cachedOptions = options; cacheKeys = keys; return fn; },
    revalidateTag: tag => { assert.equal(tag, 'public-home-gallery'); invalidations++; }
  },
  './gallery-db': {
    listPublishedGalleryRows: async options => { queryOptions = options; if (failing) throw new Error('Fixture outage'); return publicRows; },
    getPublishedGalleryRow: async () => null
  }
});
const { fetchHomeGalleryItems } = cacheLoad('src/lib/gallery-server.ts');
assert.deepEqual(cacheKeys, ['public-home-gallery-v1']);
assert.deepEqual(cachedOptions, { revalidate: 300, tags: ['public-home-gallery'] });
assert.equal(await fetchHomeGalleryItems(), publicRows);
assert.deepEqual(queryOptions, { limit: 8, featuredFirst: true });
failing = true;
await assert.rejects(fetchHomeGalleryItems(), /Fixture outage/, 'A database outage must reject, not cache an empty fallback');
cacheLoad('src/lib/gallery-cache.ts').invalidateHomeGalleryCache();
assert.equal(invalidations, 1);

let authorized = true, duplicate = false, found = true, writesFail = false, invalidated = 0;
const result = async () => { if (writesFail) throw new Error('Fixture write failure'); return found ? publicRows[0] : null; };
const adminLoad = projectLoader({
  '../../../../lib/admin-auth': { getAdminUserFromRequest: async () => authorized ? { id: 'fixture-admin' } : null },
  '../../../../lib/gallery-cache': { invalidateHomeGalleryCache: () => { invalidated++; } },
  '../../../../lib/gallery': { GALLERY_CATEGORIES: ['All', 'Daily Life'], mapGalleryRow: row => row, toDbGalleryCategory: value => value },
  '../../../../lib/gallery-db': { findDuplicateGalleryRow: async () => duplicate ? publicRows[0] : null, insertAdminGalleryRow: result, updateAdminGalleryRow: result, deleteAdminGalleryRow: result, listAdminGalleryRows: async () => [] }
});
const route = adminLoad('src/app/api/admin/gallery/route.ts');
const payload = { id: 'fixture', title: 'Fixture public image', category: 'Daily Life', imageUrl: 'https://fixture.invalid/a.png', prompt: 'Fixture prompt', sourceUrl: 'https://fixture.invalid/source' };
const mutation = method => new Request('https://fixture.invalid/api/admin/gallery?id=fixture', { method, ...(method === 'DELETE' ? {} : { body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } }) });
for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await route[method](mutation(method))).status, 200);
assert.equal(invalidated, 3, 'All successful Admin mutations invalidate the public home cache');
authorized = false;
for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await route[method](mutation(method))).status, 403);
authorized = true; duplicate = true;
assert.equal((await route.POST(mutation('POST'))).status, 409);
duplicate = false; found = false;
assert.equal((await route.PUT(mutation('PUT'))).status, 404);
assert.equal((await route.DELETE(mutation('DELETE'))).status, 404);
found = true; writesFail = true;
assert.equal((await route.POST(mutation('POST'))).status, 500);
assert.equal(invalidated, 3, 'Rejected and failed writes must not invalidate a successful public cache');
console.log('Marketing cache passed: exact public routes and 16 locale homes, tracking parameters, private/RSC/action/unknown bypass, redirect attribution, development no-store, public-only query TTL, outage rejection and authenticated Admin invalidation. No database or network.');
