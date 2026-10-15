import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native = createRequire(import.meta.url);
function loader(overrides = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(path);
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(id => overrides[id] || (id.startsWith('.') ? load(resolve(dirname(path), id + '.ts')) : native(id)), module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const core = load('src/lib/video-prompt-enhancement.ts');
const models = load('src/features/studio/video-models.ts').VIDEO_MODEL_CONFIGS;
const base = { mode: 'text-to-video', model: 'kling-video', prompt: 'An orange cat drinks coffee in a café.', duration: '5s', aspectRatio: '16:9' };
for (const config of Object.values(models)) for (const [mode, capabilities] of Object.entries(config.workflows)) {
  const context = { ...base, model: config.id, mode, duration: config.defaultDuration, aspectRatio: capabilities.ratios[0], resolution: config.resolutions[0], imageUrls: mode === 'image-to-video' ? ['https://example.com/start.png'] : undefined };
  const snapshot = JSON.stringify(context);
  const validated = core.validatePromptContext(context);
  const input = core.buildEnhancementInput(validated, 'google/gemini-3.8-flash');
  assert.equal(JSON.stringify(context), snapshot); // Model/frames/settings are never mutated.
  assert.equal(input.max_tokens, 1200); assert.equal(input.reasoning, true); assert.equal(input.temperature, .7); assert.equal(input.enable_web_search, false);
  assert.equal(input.image_urls?.[0], context.imageUrls?.[0]);
  assert.ok(input.system_prompt.includes(mode === 'image-to-video' ? 'primary visual source' : 'production-ready'));
}
for (const patch of [{ prompt: '' }, { prompt: 'x'.repeat(5001) }, { model: 'unknown' }, { mode: 'image-to-video' }, { duration: '999s' }, { imageUrls: ['a','b','c'] }]) assert.throws(() => core.validatePromptContext({ ...base, ...patch }));
const good = 'An orange cat sits at a café table, gently lifts a coffee cup and takes a sip. Warm window light and a slow push-in maintain a coherent continuous shot.';
assert.equal(core.parseEnhancementOutput({ data: { output: good, usage: { cost: .0001, secret: 'no' } } }).usage.cost, .0001);
assert.equal(core.parseEnhancementOutput({ output: '```text\n' + good + '\n```' }).output, good);
for (const output of ['', 'short', '# Enhanced Prompt\n'+good, 'Here is your prompt: '+good, '{"prompt":"test"}', '- '+good, 'I cannot help with that request.', 'x'.repeat(5001), 'A cat drinks coffee as the camera slowly']) assert.throws(() => core.parseEnhancementOutput({ output }));
assert.throws(() => core.parseEnhancementOutput({ output: good, partial: true }));
const detailed = `Create a 10-second Ozelle Minilab commercial. Exact first and last reference frames.
0–1 SECOND: Blue energy pulse; crash zoom within 0.5 seconds.
1–3 SECONDS: Hematology blood cells, Biochemistry molecules and Immunoassay particles converge on the same analyzer.
3–7 SECONDS: Pull back; transform into the clinical environment while preserving product geometry.
7–10 SECONDS: Reach the MEDICA poster by 8 seconds and hold for the last 2 seconds.
Preserve "Broader Testing. One Compact System." and "Explore More at MEDICA" from the reference. No voiceover. No product morphing. Avoid new readable text.
` + 'Preserve the original analyzer identity, screen position, proportions, branding and physical features throughout the controlled blue-white cinematic lighting. '.repeat(8);
assert.equal(core.buildEnhancementInput({ ...base, prompt: detailed }, 'test').max_tokens, 3000);
const preserved = detailed.trim();
assert.equal(core.parseEnhancementOutput({ output: preserved }, detailed).output, preserved);
assert.throws(() => core.parseEnhancementOutput({ output: good }, detailed));
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace('7–10 SECONDS', 'Later') }, detailed));
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace('Explore More at MEDICA', 'Visit us') }, detailed));
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace('No voiceover.', '') }, detailed));
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace('0.5 seconds', 'quickly') }, detailed));
assert.doesNotThrow(() => core.validateEnhancementFidelity(detailed, preserved.replaceAll('–', '-')));
assert.equal(core.enhancementUsage({ output: 'truncated', usage: { cost: .001 } }).cost, .001);

// Execute the React hook with a small deterministic hook runner; no browser or paid calls.
let cells = [], cursor = 0, calls = 0;
const react = {
  useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
  useRef(initial) { const i = cursor++; if (!(i in cells)) cells[i] = { current: initial }; return cells[i]; }
};
const hook = loader({ react })('src/features/studio/use-video-prompt-enhancement.ts');
let context = { ...base }, state;
const render = () => { cursor = 0; state = hook.useVideoPromptEnhancement(context, value => { context = { ...context, prompt: value }; }, true); return state; };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { calls++; return Response.json({ originalPrompt: base.prompt, enhancedPrompt: good, model: 'google/gemini-3.8-flash', status: 'enhanced' }); };
render(); assert.equal(state.enabled, true);
state.setEnabled(false); render(); assert.equal((await state.optimize('token', true)).prompt, base.prompt); assert.equal(calls, 0);
state.setEnabled(true); render(); await state.optimize('token'); render(); assert.equal(context.prompt, good); assert.equal(calls, 1);
state.edit(good+' Keep the face stable.'); render(); await state.optimize('token', true); assert.equal(calls, 1);
const savedRecord = state.current;
state.restoreDraft(null); render(); assert.equal(state.current, null);
state.restoreDraft(savedRecord); render(); await state.optimize('token', true); assert.equal(calls, 1);
state.restore(); render(); assert.equal(context.prompt, base.prompt); assert.equal(state.current, null);
await state.optimize('token'); render(); context = { ...context, duration: '10s' }; render(); assert.equal(state.current, null);
globalThis.fetch = async () => { calls++; throw new Error('timeout'); };
assert.equal((await state.optimize('token', true)).prompt, context.prompt); render(); assert.equal(state.notice, 'fallback');
let release;
globalThis.fetch = () => new Promise(resolve => { release = () => resolve(Response.json({ originalPrompt: context.prompt, enhancedPrompt: good, model: 'test', status: 'enhanced' })); });
const inFlight = state.optimize('token');
await assert.rejects(state.optimize('token'), /already running/);
context = { ...context, prompt: 'A changed creative intent.' }; render(); release();
await assert.rejects(inFlight, /context changed/); render(); assert.equal(context.prompt, 'A changed creative intent.');
const staleContext = { ...context };
context = { ...context, duration: '5s' }; render();
const beforeStale = calls;
await assert.rejects(state.optimize('token', true, staleContext), /context changed/);
assert.equal(calls, beforeStale);
globalThis.fetch = realFetch;

let serviceCalls = 0, rates = 0, rejectProvider = false, allowed = true;
process.env.FAL_KEY = 'isolated-test-key';
const service = loader({ './fal-fetch': { fetchFal: async () => { serviceCalls++; await new Promise(resolve => setTimeout(resolve, 5)); if (rejectProvider) throw new Error('provider failed'); return Response.json({ output: good, usage: { cost: .0001 } }); } }, './request-security': { consumeRateLimit: async () => { rates++; return { allowed }; } } })('src/lib/video-prompt-enhancer.ts');
const results = await Promise.all([service.enhanceVideoPrompt(base, 'test-user'), service.enhanceVideoPrompt(base, 'test-user')]);
assert.equal(serviceCalls, 1); assert.equal(rates, 1); assert.equal(results[0].status, 'enhanced');
await service.enhanceVideoPrompt(base, 'test-user'); assert.equal(serviceCalls, 1);
const summarized = await service.enhanceVideoPrompt({ ...base, prompt: detailed }, 'detailed-test-user');
assert.equal(summarized.status, 'fallback'); assert.equal(summarized.enhancedPrompt, detailed);
rejectProvider = true; assert.equal((await service.enhanceVideoPrompt({ ...base, prompt: 'new prompt' }, 'test-user')).status, 'fallback');
allowed = false; const before = serviceCalls; await service.enhanceVideoPrompt({ ...base, prompt: 'limited prompt' }, 'test-user'); assert.equal(serviceCalls, before);
process.env.AI_PROMPT_ENHANCEMENT_ENABLED = 'false'; assert.equal((await service.enhanceVideoPrompt(base, 'test-user')).status, 'disabled'); delete process.env.AI_PROMPT_ENHANCEMENT_ENABLED;
allowed = true; rejectProvider = false;
const concurrent = await Promise.all(Array.from({ length: 5 }, (_, i) => service.enhanceVideoPrompt(base, 'parallel-user-'+i)));
assert.equal(concurrent.filter(result => result.status === 'enhanced').length, 4);
assert.equal(concurrent.filter(result => result.status === 'fallback').length, 1);
for (const url of ['http://example.com/image.png', 'https://127.0.0.1/image.png', 'https://[::1]/image.png', 'https://user:password@example.com/x', 'data:image/png;base64,aGVsbG8=']) await assert.rejects(service.validateEnhancementImage(url));
let apiCalls = 0;
const api = loader({
  '../../../../lib/server-auth': { getUserFromBearerToken: async header => header === 'Bearer valid' ? { id: 'test-user' } : null },
  '../../../../lib/video-prompt-enhancer': { enhanceVideoPrompt: async context => { apiCalls++; return { originalPrompt: context.prompt, enhancedPrompt: good, model: 'test', status: 'enhanced' }; } }
})('src/app/api/ai/enhance-video-prompt/route.ts');
const request = (body, auth = 'Bearer valid') => new Request('http://localhost/api/ai/enhance-video-prompt', { method: 'POST', headers: { authorization: auth }, body: JSON.stringify(body) });
assert.equal((await api.POST(request(base, ''))).status, 401); assert.equal(apiCalls, 0);
assert.equal((await api.POST(request({ ...base, mode: 'image-to-video' }))).status, 400); assert.equal(apiCalls, 0);
const apiResponse = await api.POST(request(base)); assert.equal(apiResponse.status, 200); assert.equal((await apiResponse.json()).enhancedPrompt, good); assert.equal(apiCalls, 1);
const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
assert.match(route, /prompt_enhancement/); assert.match(route, /final_prompt: prompt/);
const studio = readFileSync('src/app/studio/studio-client.tsx', 'utf8').replaceAll('\r\n', '\n');
assert.match(studio, /STUDIO_SIGN_IN_URL = "\/en\/auth/);
const generation = studio.slice(studio.indexOf('  async function handleGenerate()'), studio.indexOf('  function handleGenerateClick()'));
const cleanupStart = generation.lastIndexOf('} finally {') + '} finally {'.length;
const cleanupEnd = generation.indexOf('\n    }\n  }', cleanupStart);
assert.ok(cleanupEnd > cleanupStart);
const cleanup = new Function('generationSubmitLock', 'submissionToken', 'setIsSubmitting', 'usesH3FreeAllowance', 'h3DailyFree', generation.slice(cleanupStart, cleanupEnd));
const older = Symbol('older'), newer = Symbol('newer'), submitLock = { current: newer };
let cleared = 0;
cleanup(submitLock, older, () => cleared++);
assert.equal(submitLock.current, newer); assert.equal(cleared, 0);
cleanup(submitLock, newer, () => cleared++);
assert.equal(submitLock.current, null); assert.equal(cleared, 1);
let freeRefreshes=0;submitLock.current=newer;
cleanup(submitLock,older,()=>cleared++,true,{refresh(){freeRefreshes++;}});
assert.equal(freeRefreshes,0);
cleanup(submitLock,newer,()=>cleared++,true,{refresh(){freeRefreshes++;}});
assert.equal(freeRefreshes,1);
assert.doesNotMatch(readFileSync('src/lib/video-prompt-enhancer.ts', 'utf8'), /deduct|chargeCredits|credit_ledger|generation_tasks/);
console.log('Video Prompt AI tests passed: all video model contexts, distinct strategies, output validation, OFF bypass, edited-result reuse, restore, context changes, timeout fallback, request coalescing/cache, rate limits, disable switch, unsafe images, metadata and no extra credit charging.');

if (process.argv.includes('--live')) {
  // Explicitly requested live smoke test; uses only public examples, never generates a video.
  native('@next/env').loadEnvConfig(process.cwd());
  // The fixture above must not override the real account key.
  const env = readFileSync('.env.local', 'utf8');
  const match = /^FAL_KEY\s*=\s*(.+)$/m.exec(env);
  const key = match?.[1]?.trim().replace(/^['"]|['"]$/g, '').replace(/^Key\s+/i, '');
  if (!key) throw new Error('FAL_KEY is unavailable for live validation');
  const transport = load('src/lib/fal-fetch.ts');
  const samples = [
    { ...base, prompt: '\u4e00\u53ea\u6a58\u732b\u5728\u5496\u5561\u9986\u559d\u5496\u5561' },
    { ...base, prompt: 'An orange tabby sits in a quiet café, slowly raises a ceramic cup and takes a small sip. Hold a medium close-up with a subtle five-second push-in, warm natural window light, shallow depth of field, realistic fur and physically plausible paw motion. Keep the subject and background consistent, with no cuts, new characters or text.' },
    { ...base, prompt: '\u4e00\u53ea\u6a58\u732b drinks coffee, slow camera push-in' },
    { ...base, mode: 'image-to-video', aspectRatio: 'source', prompt: '\u8ba9\u5979\u8f6c\u8eab\u5fae\u7b11', imageUrls: ['https://v3b.fal.media/files/b/0aa064f8/Ns1NaGtZjYY1FM8790JSo_rY21Z0TByUVwyJt0vYr74_GK97jl1Q.jpg'] }
  ];
  const report = [];
  for (const sample of samples) {
    const endpoint = sample.mode === 'image-to-video' ? 'openrouter/router/vision' : 'openrouter/router';
    const requestBody = JSON.stringify(core.buildEnhancementInput(sample, 'google/gemini-3.8-flash'));
    let status = 0, payload;
    try {
      const response = await transport.fetchFal('https://fal.run/'+endpoint, { method: 'POST', headers: { Authorization: 'Key '+key, 'Content-Type': 'application/json' }, body: requestBody, attempts: 1, timeoutMs: 20000, fallback: false });
      status = response.status; payload = await response.json();
    } catch { /* Retain a failed entry; never print credentials or request bodies. */ }
    const entry = { mode: sample.mode, input: sample.prompt, httpStatus: status };
    if (status === 200) { try { Object.assign(entry, core.parseEnhancementOutput(payload)); } catch { entry.failure = 'Response did not pass output validation'; } }
    else entry.failure = 'Provider rejected the request';
    report.push(entry);
    console.log(JSON.stringify({ mode: entry.mode, status: entry.httpStatus, usage: entry.usage, valid: Boolean(entry.output) }));
  }
  writeFileSync('docs/video-prompt-live-results.json', JSON.stringify({ model: 'google/gemini-3.8-flash', transport: 'project fetchFal', testedAt: new Date().toISOString(), results: report }, null, 2));
  assert.ok(report.every(entry => entry.output), 'Live account smoke tests did not all succeed; inspect the report');
}
