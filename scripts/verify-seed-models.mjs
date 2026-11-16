import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { generationFixtureDependency } from './generation-runtime-fixture.mjs';

// Execute the real POST route. Storage, authentication and supplier transport
// use fixtures; an unmocked network request fails this verification.
const native = createRequire(import.meta.url), cache = new Map(), charges = [], submissions = [], records = {};
let authenticated = true;
const admin = { from(table) {
  assert.equal(table, 'generation_tasks');
  let inserted, updated, filters = {};
  const query = { select() { return query; }, eq(key, value) { filters[key] = value; return query; },
    maybeSingle: async () => ({ data: records[filters.id] || null }),
    insert(value) { inserted = value; return query; }, update(value) { updated = value; return query; },
    then(resolve) { if (inserted) records[inserted.id] = { ...inserted }; if (updated && records[filters.id]) Object.assign(records[filters.id], updated); return Promise.resolve({ error: null }).then(resolve); }
  }; return query;
} };
const overrides = {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, body }) } },
  '../../../lib/server-auth': { getUserFromBearerToken: async () => authenticated ? { id: 'fixture-user' } : null },
  '../../../lib/supabase-admin': { createSupabaseAdminClient: () => admin },
  '../../../lib/credits': { ensureSignupCreditAccount: async () => ({ balance: 100000 }), ensureCreditAccount: async () => ({ balance: 100000 }), spendCredits: async (_a, _u, amount) => { charges.push(amount); return { ok: true, balance: 100000 - amount }; }, refundCredits: async () => 100000 },
  '../../../lib/fal-pricing': { estimateGenerationCreditsWithLivePricing: async input => load('src/lib/model-pricing.ts').estimateGenerationCredits(input) },
  '../../../lib/fal-fetch': { fetchFal: async (url, options) => { submissions.push({ url, input: JSON.parse(options.body) }); return { ok: true, json: async () => ({ request_id: 'fixture-request', status: 'IN_QUEUE', status_url: 'https://queue.fal.run/fixture/status' }) }; } }
};
function load(file) {
  file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id in overrides ? overrides[id] : (generationFixtureDependency(id, overrides, load) ?? (id.startsWith('.') ? load(resolve(dirname(file), id + '.ts')) : native(id))), module, module.exports);
  return module.exports;
}
const oldKey = process.env.FAL_KEY, oldFetch = globalThis.fetch;
process.env.FAL_KEY = 'fixture-no-network'; globalThis.fetch = async () => { throw new Error('Unexpected network'); };
try {
  const { POST } = load('src/app/api/generate/route.ts');
  const price = load('src/lib/model-pricing.ts').estimateGenerationCredits;
  const image = 'https://fixture.invalid/start.png', video = 'https://fixture.invalid/reference.mp4', audio = 'https://fixture.invalid/reference.wav';
  const flash = { mode: 'video', provider: 'seedance-2.5-flash-video', videoWorkflow: 'text-to-video', duration: '5s', ratio: '16:9', prompt: 'A bird in flight', resolution: '720p' };
  const dream = { mode: 'image', provider: 'seedream-5.5-image', imageWorkflow: 'text-to-image', duration: 'single', ratio: 'auto', imageSize: 'auto_2K', outputFormat: 'png', prompt: 'A ceramic vase' };
  async function submit(body) { return POST({ headers: new Headers(), json: async () => ({ ...body, idempotencyKey: crypto.randomUUID() }) }); }
  for (const body of [flash, { ...flash, videoWorkflow: 'image-to-video', prompt: '', ratio: 'source', duration: '30s', imageUrls: [image, image + '?end=1'], generateAudio: false },
    { ...flash, videoWorkflow: 'reference-to-video', videoUrls: [video], imageUrls: [image], audioUrls: [audio], seedanceTask: 'editing', bitrateMode: 'high', codec: 'H265', seed: 7 },
    dream, { ...dream, imageWorkflow: 'image-to-image', imageUrls: [image, image], numImages: 6, imageSize: 'custom', imageWidth: 1280, imageHeight: 720, background: 'transparent' }]) {
    const expected = price({ ...body, hasReferences: Boolean(body.imageUrls?.length), referenceCount: body.imageUrls?.length || 0, referenceVideoCount: body.videoUrls?.length || 0, promptText: body.prompt });
    const response = await submit({ ...body, expectedCredits: expected });
    assert.equal(response.status, 200, JSON.stringify(response)); assert.equal(response.body.transport, 'real');
    assert.equal(response.body.estimatedCredits, expected); assert.equal(charges.at(-1), expected);
    const endpoint = body.mode === 'video' ? `bytedance/seedance-2.5/flash/${body.videoWorkflow}` : `bytedance/seedream/v5.5/${body.imageUrls?.length ? 'edit' : 'text-to-image'}`;
    const submitted = submissions.at(-1), stored = records[response.body.taskId].request_settings;
    assert.equal(submitted.url, 'https://queue.fal.run/' + endpoint); assert.equal(stored.model_id, endpoint);
    if (body.mode === 'video') {
      assert.equal(stored.workflow, body.videoWorkflow);
      assert.equal(submitted.input.end_user_id, 'fixture-user');
      if (body.videoWorkflow === 'image-to-video') { assert.equal(submitted.input.aspect_ratio, 'auto'); assert.equal(submitted.input.end_image_url, image + '?end=1'); }
      if (body.videoWorkflow === 'reference-to-video') { assert.equal(submitted.input.duration, 'auto'); assert.deepEqual(submitted.input.audio_urls, [audio]); assert.deepEqual(stored.audio_urls, [audio]); assert.equal(stored.seedance_task, 'editing'); }
    } else {
      assert.equal(submitted.input.enable_safety_checker, true);
      if (body.numImages === 6) { assert.equal(submitted.input.num_images, 6); assert.deepEqual(submitted.input.image_size, { width: 1280, height: 720 }); assert.equal(stored.background, 'transparent'); }
    }
  }
  assert.equal(submissions.length, 5);
  const count = submissions.length, charged = [...charges];
  for (const [body, oldCredits, newCredits] of [
    [{ ...flash, resolution: '480p' }, 109, 212],
    [flash, 279, 454],
    [{ ...dream, imageSize: 'auto_1.5K' }, 5, 9],
    [dream, 8, 12]
  ]) {
    const stale = await submit({ ...body, expectedCredits: oldCredits });
    assert.equal(stale.status, 409, 'Old browser quotes must be rejected before debit or supplier submission');
    assert.equal(stale.body.estimatedCredits, newCredits);
  }
  for (const body of [{ ...flash, duration: '31s' }, { ...flash, resolution: '1080p' }, { ...flash, mode: 'image' },
    { ...flash, videoWorkflow: 'image-to-video', imageUrls: [] }, { ...flash, videoWorkflow: 'reference-to-video', audioUrls: Array(6).fill(audio) },
    { ...flash, videoWorkflow: 'reference-to-video', videoUrls: ['http://127.0.0.1/private'] },
    { ...dream, imageWorkflow: 'image-to-image' }, { ...dream, imageUrls: Array(11).fill(image) },
    { ...dream, background: 'transparent', outputFormat: 'jpeg' }, { ...dream, imageSize: 'custom', imageWidth: 512, imageHeight: 512 }]) {
    assert.equal((await submit(body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await submit({ ...flash, expectedCredits: 1 })).status, 409);
  assert.equal((await submit({ ...dream, expectedCredits: 1 })).status, 409);
  authenticated = false; assert.equal((await submit(flash)).status, 401); authenticated = true;
  delete process.env.FAL_KEY; assert.equal((await submit(flash)).status, 503); assert.equal((await submit(dream)).status, 503);
  assert.equal(submissions.length, count); assert.deepEqual(charges, charged);
  console.log('Seed models passed: all five real POST paths, quotes/debits, multi-reference payloads, end frames, transparent six-image edits, stored settings, auth/config/price/validation guards. No paid API or database calls.');
} finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = oldKey; }
