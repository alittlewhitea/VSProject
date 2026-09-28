// Run a production preview on 3010 and a disposable Chromium CDP browser on 9338.
// API calls are mocked: this test never submits generation or payment requests.
import assert from 'node:assert/strict';
const tab = (await (await fetch('http://127.0.0.1:9338/json/list')).json()).find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map(), requests = [], errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params;
    const path = new URL(request.url).pathname;
    let body = {};
    if (path === '/api/auth/session') body = { session: null };
    if (path === '/api/tasks') body = { tasks: [] };
    if (path === '/api/credits') body = { balance: 0, ledger: [], purchases: [], subscriptions: [] };
    if (path === '/api/model-pricing') body = { rows: [] };
    void send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  }
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  return r.result.value;
};
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setBlockedURLs', { urls: ['*google-analytics.com/*', '*googletagmanager.com/*', '*doubleclick.net/*', '*bing.com/*'] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://127.0.0.1:3010/api/*' }] });
  for (const width of [1440, 390]) for (const path of ['/en', '/studio?view=home']) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    requests.length = 0;
    await send('Page.navigate', { url: 'http://127.0.0.1:3010' + path });
    await pause(7000);
    const initial = await evaluate(`Array.from(document.querySelectorAll('video')).map(v=>({src:v.getAttribute('src'), top:v.getBoundingClientRect().top, bottom:v.getBoundingClientRect().bottom}))`);
    assert.ok(initial.length >= 4, path);
    assert.ok(initial.some(v => !v.src), 'offscreen videos must stay unloaded');
    assert.ok(initial.filter(v => v.top >= 900 || v.bottom <= 0).every(v => !v.src), 'offscreen src absent');
    assert.ok(!requests.some(u => u.includes('dreamface-favicon.svg')), 'heavy favicon not requested');
    if (path === '/en') assert.ok(!requests.some(u => /Text_to_Video|Image_to_Video/.test(u)), 'below-fold media not requested');
    const target = initial.findIndex(v => !v.src);
    await evaluate(`document.querySelectorAll('video')[${target}].scrollIntoView({block:'center',behavior:'instant'})`);
    await pause(4000);
    const after = await evaluate(`(() => {const v=document.querySelectorAll('video')[${target}];return {src:v.getAttribute('src'),paused:v.paused,error:v.error?.code}})()`);
    assert.ok(after.src, 'scroll loads video');
    assert.equal(after.paused, false, 'visible preview resumes autoplay');
    assert.equal(after.error, undefined, 'media has no playback error');
    if (path.includes('studio')) assert.ok(after.src.includes(width < 600 ? '/1x1/' : '/16x9/'), 'responsive source');
    await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);
    await pause(700);
    assert.equal(await evaluate(`document.querySelectorAll('video')[${target}].paused`), true, 'offscreen playback pauses');
    console.log(JSON.stringify({ width, path, initiallyLoaded: initial.filter(v => v.src).length, total: initial.length, scrollLoads: true, pausesOffscreen: true }));
  }
  assert.deepEqual(errors, []);
} finally {
  await send('Fetch.disable'); await send('Network.setBlockedURLs', { urls: [] });
  await send('Page.navigate', { url: 'about:blank' }); ws.close();
}
