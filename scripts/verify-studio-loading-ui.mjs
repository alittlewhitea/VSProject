// Run against a local production build (:3000) and task-owned headless Chrome (:9353).
// All API requests and external resources are mocked; no provider or payment is called.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const origin = 'http://127.0.0.1:3000';
const debuggerOrigin = 'http://127.0.0.1:9353';
const output = 'outputs/studio-performance';
const manifest = JSON.parse(readFileSync('.next/react-loadable-manifest.json', 'utf8'));
const chunksFor = name => new Set(Object.entries(manifest).filter(([key]) => key.includes(name)).flatMap(([, value]) => value.files.map(file => '/_next/' + file)));
const creationChunks = chunksFor('-> ./studio-creation-workspace');
const paymentChunks = chunksFor('-> ./studio-billing-modal');
const speechChunks = chunksFor('-> ./gemini-tts-editor');
assert.ok(creationChunks.size && paymentChunks.size && speechChunks.size, 'Production build exposes separate feature chunks');
const tab = await (await fetch(debuggerOrigin + '/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
const waiting = new Map(), errors = [], resources = new Set(), generated = [];
let sequence = 0;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    waiting.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', async event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const pending = waiting.get(message.id);
    if (pending) {
      waiting.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    }
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
  if (message.method === 'Network.requestWillBeSent') resources.add(new URL(message.params.request.url).pathname);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params, url = new URL(request.url);
  try {
    if (url.origin !== origin) {
      await send('Fetch.fulfillRequest', { requestId, responseCode: 204, body: '' });
      return;
    }
    let body = {};
    if (url.pathname === '/api/auth/session') body = { session: { access_token: 'cookie:qa-placeholder', expires_at: '2099-01-01', user: { id: 'qa-user', email: 'fixture@example.invalid' } } };
    else if (url.pathname === '/api/credits') body = { balance: 1000, ledger: [], purchases: [], subscriptions: [] };
    else if (url.pathname === '/api/tasks') body = { tasks: [] };
    else if (url.pathname === '/api/model-pricing') body = { rows: [] };
    else if (url.pathname === '/api/referrals/availability') body = { visible: false };
    else if (url.pathname === '/api/avatar-library') body = { items: [] };
    else if (url.pathname === '/api/generate' && request.method === 'POST') {
      generated.push(JSON.parse(request.postData));
      body = { taskId: 'qa-split-task', status: 'queued', transport: 'mock', estimatedCredits: 15, balance: 985 };
    } else if (url.pathname === '/api/generate/status') body = { balance: 985, status: 'completed' };
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) {
    errors.push(error.message);
    await send('Fetch.failRequest', { requestId, errorReason: 'Aborted' }).catch(() => {});
  }
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
async function until(expression) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('UI timeout: ' + expression);
}
async function navigate(href) {
  await evaluate(`(() => { const link = document.querySelector('a[href=' + CSS.escape(${JSON.stringify(href)}) + ']'); if (!link) throw new Error('Missing navigation link'); link.click(); })()`);
  await until(`location.pathname + location.search === ${JSON.stringify(href)}`);
}
async function language(locale) {
  await evaluate(`(() => { const input = document.querySelector('select:has(option[value="zh-CN"])'); input.value = ${JSON.stringify(locale)}; input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await until(`document.documentElement.lang === ${JSON.stringify(locale)}`);
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(output + '/' + name + '.png', Buffer.from(result.data, 'base64'));
}
async function setVideoPrompt(value) {
  await evaluate(`(() => { const input = document.querySelector('[data-premium-workspace="video"] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
}
async function setVideoDuration(value) {
  await evaluate(`(() => { const input = document.querySelector('[data-video-config] select:has(option[value="15s"])'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function setVideoOption(anchor, value) {
  await evaluate(`(() => { const input = document.querySelector('[data-video-config] select:has(option[value="' + ${JSON.stringify(anchor)} + '"])'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
try {
  mkdirSync(output, { recursive: true });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }, { urlPattern: 'https://*' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('dreamface_locale','en'); document.cookie='dreamface_locale=en;path=/';` });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin + '/studio?view=home' });
  await until(`Boolean(document.querySelector('textarea') && document.querySelector('select:has(option[value="zh-CN"])'))`);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-creation-workspace], [data-video-workspace]'))`), false, 'Home has no hidden creation workspace');
  for (const chunk of [...creationChunks, ...paymentChunks, ...speechChunks]) assert.equal(resources.has(chunk), false, 'Home must defer feature chunk: ' + chunk);
  const homeScripts = [...resources].filter(file => file.startsWith('/_next/') && file.endsWith('.js'));
  await screenshot('home-mobile');

  await navigate('/studio?mode=video&workflow=text-to-video');
  await until(`Boolean(document.querySelector('[data-premium-workspace="video"] textarea'))`);
  await until(`Boolean(document.querySelector('[data-signed-in="true"]'))`);
  const longSpeech = "Hello my love how are you doing today? How was work today I hope you have a wonderful day today I just want to know what's wrong with you but I'm really worried about you";
  await setVideoPrompt(longSpeech);
  await until(`Boolean(document.querySelector('[data-video-dialogue-warning]') && document.querySelector('.df-composer-generate').disabled)`);
  assert.equal(await evaluate(`document.querySelector('[data-video-dialogue-warning]').textContent.includes('16')`), true);
  await language('zh-CN');
  await until(`document.querySelector('[data-video-dialogue-warning]').textContent.includes('台词')`);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Speech warning fits the mobile viewport');
  await screenshot('dialogue-warning-mobile-zh');
  const mediumSpeech = 'Hello my love, how are you doing today?';
  await setVideoPrompt(mediumSpeech);
  await until(`Boolean(document.querySelector('[data-video-dialogue-warning]') && document.querySelector('.df-composer-generate').disabled)`);
  await setVideoDuration('10s');
  await until(`!document.querySelector('[data-video-dialogue-warning]') && !document.querySelector('.df-composer-generate').disabled`);
  assert.equal(await evaluate(`document.querySelector('[data-premium-workspace="video"] textarea').value`), mediumSpeech, 'Selecting a fitting duration never shortens the spoken words');
  assert.equal(generated.length, 0, 'Checking or adjusting a script cannot submit or charge a generation');
  await setVideoDuration('5s');
  await language('en');
  await evaluate(`(() => { const input = document.querySelector('[data-premium-workspace="video"] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'A paper boat sailing across a quiet lake'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await setVideoOption('16:9', '1:1');
  await setVideoOption('1080p', '1080p');
  await until(`(() => { const input = document.querySelector('[data-video-config] select:has(option[value="16:9"])'); return input.value === '16:9' && Array.from(input.options).map(option=>option.value).join(',') === '16:9,9:16' && Boolean(document.querySelector('[data-heygen-hd-ratios]')); })()`);
  await language('zh-CN');
  await until(`document.querySelector('[data-heygen-hd-ratios]').textContent.includes('仅支持')`);
  await screenshot('heygen-hd-mobile-zh');
  await setVideoOption('1080p', '480p');
  await until(`!document.querySelector('[data-heygen-hd-ratios]') && Boolean(document.querySelector('[data-video-config] option[value="1:1"]'))`);
  await setVideoOption('16:9', '3:4');
  await setVideoOption('1080p', '2k');
  await until(`document.querySelector('[data-video-config] select:has(option[value="16:9"])').value === '9:16'`);
  assert.equal(await evaluate(`document.querySelector('[data-premium-workspace="video"] textarea').value`), 'A paper boat sailing across a quiet lake', 'HD normalization preserves prompt text');
  await evaluate(`history.pushState(null, '', '/studio?mode=video&workflow=text-to-video&provider=heygen-video&resolution=2k&ratio=1:1&duration=5s')`);
  await until(`document.querySelector('[data-video-config] select:has(option[value="16:9"])').value === '16:9' && document.querySelector('[data-video-config] select:has(option[value="1080p"])').value === '2k'`);
  await setVideoOption('1080p', '480p');
  await setVideoOption('16:9', '16:9');
  await language('zh-CN');
  assert.equal(await evaluate(`document.querySelector('[data-premium-workspace="video"] textarea').value`), 'A paper boat sailing across a quiet lake', 'Language switching retains the creation draft');
  await screenshot('video-mobile-zh');
  await navigate('/studio?view=projects');
  await until(`!document.querySelector('[data-creation-workspace]')`);
  await navigate('/studio?mode=video&workflow=text-to-video');
  await until(`Boolean(document.querySelector('[data-premium-workspace="video"] textarea'))`);
  assert.equal(await evaluate(`document.querySelector('[data-premium-workspace="video"] textarea').value`), 'A paper boat sailing across a quiet lake', 'Unmounting the creation view retains the controller draft');
  await language('ar');
  assert.equal(await evaluate('document.documentElement.dir'), 'rtl');
  await language('en');
  assert.equal(await evaluate('document.documentElement.dir'), 'ltr');
  for (const chunk of [...paymentChunks, ...speechChunks]) assert.equal(resources.has(chunk), false, 'Video must defer unrelated feature chunk: ' + chunk);

  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Generate') && !button.disabled).click()`);
  await until(`location.search.includes('view=projects')`);
  assert.equal(generated.length, 1, 'Generation submits once after lazy view and language transitions');
  assert.equal(generated[0].prompt, 'A paper boat sailing across a quiet lake');
  await until(`Boolean(document.body?.innerText.includes('Completed'))`);
  await navigate('/studio?view=home');
  await until(`Boolean(document.querySelector('textarea'))`);
  await navigate('/studio?view=projects');
  await until(`Boolean(document.body?.innerText.includes('Completed'))`);

  await navigate('/studio?mode=image&workflow=text-to-image');
  await until(`Boolean(document.querySelector('[data-creation-workspace="image"] textarea'))`);
  await navigate('/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts');
  await until(`Boolean(document.querySelector('[data-creation-workspace="audio"] textarea'))`);
  await navigate('/studio?mode=avatar&workflow=avatar-video&provider=heygen-video');
  await until(`Boolean(document.querySelector('[data-creation-workspace="avatar"] textarea'))`);
  await screenshot('avatar-mobile');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await screenshot('avatar-desktop');
  await evaluate(`document.querySelector('.df-credit-balance').click()`);
  await until(`Boolean(document.querySelector('[role=dialog][aria-labelledby="credit-shop-title"]'))`);
  assert.ok([...paymentChunks].some(chunk => resources.has(chunk)), 'Opening the credit shop loads the deferred payment view');
  await screenshot('credit-shop-desktop');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  writeFileSync(output + '/browser-verification.json', JSON.stringify({ homeScripts, generatedRequests: generated.length, exceptions: errors, checks: ['mobile home excludes creation/payment/speech chunks', 'video editor loads on navigation', 'draft survives language and project transitions', 'Arabic RTL and English LTR', 'single generation request and task completion across navigation', 'image/audio/avatar workspaces', 'deferred credit shop opens'], resources: [...resources] }, null, 2));
  console.log('Studio loading UI passed: mobile/desktop, HD ratio filtering and landscape/portrait normalization, incompatible deep links, localized speech-length warnings, unchanged prompt/duration, lazy chunks, draft/language/RTL, one mock generation and credit shop. No live APIs or payments.');
} catch (error) {
  await screenshot('failure');
  console.error(JSON.stringify({ errors, page: await evaluate('({url:location.href,text:document.body?.innerText.slice(0,1700),workspaces:Array.from(document.querySelectorAll("[data-creation-workspace]")).map(node=>node.outerHTML.slice(0,250))})') }, null, 2));
  throw error;
} finally {
  await send('Page.navigate', { url: 'about:blank' }).catch(() => {});
  const closed = new Promise(resolve => { socket.addEventListener('close', resolve, { once: true }); setTimeout(resolve, 1500); });
  socket.close();
  await closed;
  await fetch(debuggerOrigin + '/json/close/' + tab.id).catch(() => {});
}
