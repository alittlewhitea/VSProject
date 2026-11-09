// Next at :3000; disposable Chrome CDP at :9358. Catalog/APIs are fixtures; videos use an existing local sample.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:3000';
const tabs = await (await fetch('http://127.0.0.1:9358/json/list')).json();
const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map(), errors = [], media = new Set(), previewRequests = [], paidRequests = [];
const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const avatar = (kind, id, index) => ({ id, kind, name: `Presenter ${index + 1}`, groupId: kind === 'look' ? 'group-3' : null,
  previewImageUrl: origin + '/icons/favicon-48x48.png', previewVideoUrl: kind === 'group' ? null : origin + (index === 0 ? '/fixture-broken-preview.mp4' : `/videos/Text_to_Video.webm?avatar=${id}`), looksCount: kind === 'group' ? 12 : null, gender: null, tags: [], avatarType: null });
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); } return; }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('avatar=')) media.add(message.params.request.url);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
  let body = {}, status = 200;
  if (path === '/api/auth/session') body = { session: null };
  if (path === '/api/credits') body = { balance: 0, ledger: [], purchases: [], subscriptions: [] };
  if (path === '/api/tasks') body = { tasks: [] };
  if (path === '/api/model-pricing') body = { rows: [] };
  if (path === '/api/model-availability') body = { models: { dreamfaceIo: false } };
  if (path === '/api/referrals/availability') body = { visible: false };
  if (path === '/api/avatars/heygen') {
    if (url.searchParams.has('preview')) { previewRequests.push(url.searchParams.get('groupId')); body = { items: [avatar('look', url.searchParams.get('groupId') + '-clip', 1)], hasMore: false, nextToken: null }; }
    else body = { items: Array.from({ length: url.searchParams.get('kind') === 'look' ? 12 : 8 }, (_, index) => avatar(url.searchParams.get('kind') || 'group', `${url.searchParams.get('kind') || 'group'}-${index}`, index)), hasMore: false, nextToken: null };
  }
  if (path === '/api/generate' || path.startsWith('/api/billing/')) { paidRequests.push(path); status = 503; }
  if (path === '/fixture-broken-preview.mp4') status = 404;
  void send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(body)).toString('base64') }).catch(error => { if (!/closed|not found|Invalid InterceptionId/.test(error.message)) errors.push(error.message); });
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
async function wait(expression) { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(150); } throw new Error('Timed out: ' + expression); }
const playingPair = "document.querySelectorAll('[data-avatar-library] video').length===2 && [...document.querySelectorAll('[data-avatar-library] video')].every(v=>!v.paused&&v.currentTime>.1&&v.muted&&v.playsInline)";
async function center(id) { await evaluate(`document.querySelector('[data-avatar-card="${id}"] [data-avatar-preview-media]').scrollIntoView({block:'center',behavior:'instant'})`); }
async function shot(name) { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(`outputs/avatar-mobile-previews/${name}.png`, Buffer.from(result.data, 'base64')); }
try {
  mkdirSync('outputs/avatar-mobile-previews', { recursive: true });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }, { urlPattern: `${origin}/fixture-broken-preview.mp4` }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('dreamface_locale','en')}catch{}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await send('Page.navigate', { url: origin + '/studio?mode=avatar&workflow=avatar-video' });
  await wait("document.querySelectorAll('[data-avatar-card]').length===8 && Object.keys(document.querySelector('[data-avatar-card]')||{}).some(key=>key.startsWith('__reactProps'))");
  assert.equal(await evaluate("document.querySelectorAll('[data-avatar-library] video').length"), 0);
  assert.equal(media.size, 0, 'No avatar media downloads while the library is below the fold');
  await evaluate("window.avatarPeak=0;new MutationObserver(()=>window.avatarPeak=Math.max(window.avatarPeak,document.querySelectorAll('[data-avatar-library] video').length)).observe(document.querySelector('[data-avatar-library]'),{childList:true,subtree:true})");
  await center('group-3'); await wait(playingPair);
  assert.ok(previewRequests.length, 'Groups lazily resolve their preview videos');
  assert.ok(media.size <= 2, 'Only the two selected groups download video');
  const firstKeys = await evaluate("[...document.querySelectorAll('[data-avatar-library] video')].map(v=>v.closest('[data-avatar-card]').dataset.avatarCard)");
  await shot('mobile-groups');
  await evaluate("window.oldAvatarVideos=[...document.querySelectorAll('[data-avatar-library] video')];true");
  await center('group-6'); await wait(playingPair+" && !!document.querySelector('[data-avatar-card=\"group-6\"] video')");
  const nextKeys = await evaluate("[...document.querySelectorAll('[data-avatar-library] video')].map(v=>v.closest('[data-avatar-card]').dataset.avatarCard)");
  assert.notDeepEqual(nextKeys, firstKeys);
  assert.equal(await evaluate("window.oldAvatarVideos.filter(v=>!v.isConnected).every(v=>v.paused&&!v.getAttribute('src'))"), true, 'Replaced previews release playback and media sources');
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");
  await wait("document.querySelectorAll('[data-avatar-library] video').length===0");
  await evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))"); await wait(playingPair);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait("document.querySelectorAll('[data-avatar-library] video').length===0");
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }); await wait(playingPair);

  // Group navigation keeps two central previews in the existing two-column look grid.
  await evaluate("document.querySelector('[data-avatar-card=\"group-6\"] button[aria-label=\"Presenter 7\"]').click()");
  await wait("document.querySelectorAll('[data-avatar-card]').length===12");
  await center('look-0');
  await wait("document.querySelector('[data-avatar-card=\"look-0\"]').dataset.avatarPreviewAvailable==='false'");
  await wait(playingPair);
  assert.equal(await evaluate("!!document.querySelector('[data-avatar-card=\"look-0\"] img')"), true, 'A broken video keeps its image and frees a preview slot');
  await center('look-4'); await wait(playingPair+" && !!document.querySelector('[data-avatar-card=\"look-4\"] video')"); await shot('mobile-looks');
  const activeId = await evaluate("document.querySelector('[data-avatar-library] video').closest('[data-avatar-card]').dataset.avatarCard");
  await evaluate(`document.querySelector('[data-avatar-card="${activeId}"] button[aria-label]').click()`);
  await wait("document.querySelectorAll('[data-avatar-library] video').length===1");
  await evaluate(`document.querySelector('[data-avatar-card="${activeId}"] button[aria-label]').click()`); await wait(playingPair);
  await evaluate("document.querySelector('[data-avatar-card=\"look-6\"] button[aria-label]').click()");
  await wait(playingPair+" && !!document.querySelector('[data-avatar-card=\"look-6\"] video')");
  assert.equal(await evaluate('window.avatarPeak<=2'), true, 'Autoplay and taps must not create a third player');
  await evaluate("window.scrollTo({top:0,behavior:'instant'})");
  await wait("document.querySelectorAll('[data-avatar-library] video').length===0");

  // Desktop retains exclusive hover preview, and leaving the workspace releases it.
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await center('look-4'); await pause(300);
  assert.equal(await evaluate("document.querySelectorAll('[data-avatar-library] video').length"), 0);
  const target = await evaluate("(() => {const r=document.querySelector('[data-avatar-card=\"look-4\"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...target });
  await wait("document.querySelectorAll('[data-avatar-library] video').length===1 && !document.querySelector('[data-avatar-library] video').paused");
  await evaluate("window.departingAvatarVideo=document.querySelector('[data-avatar-library] video');document.querySelector('a[href=\"/studio?mode=image&workflow=text-to-image\"]').click()");
  await wait("!document.querySelector('[data-avatar-library]')");
  assert.equal(await evaluate("window.departingAvatarVideo.paused&&!window.departingAvatarVideo.getAttribute('src')"), true);
  assert.deepEqual(errors, []); assert.deepEqual(paidRequests, []);
  writeFileSync('outputs/avatar-mobile-previews/browser-regression.json', JSON.stringify({ passed: true, firstKeys, nextKeys, previewMetadataRequests: previewRequests.length, downloadedClips: media.size, checks: ['no below-fold video fetch', 'two native muted inline players', 'lazy group preview lookup', 'scroll swaps central cards', 'old players paused/released', 'hidden tab pauses', 'reduced motion respected', 'two-column looks', 'broken video image fallback', 'tap pause/resume', 'two-player limit', 'desktop hover', 'workspace cleanup'], errors, paidRequests }, null, 2));
  console.log('Avatar mobile previews passed with real local video playback: two central muted inline previews, scroll/visibility/motion handling, lazy group videos, image fallback, tap control, desktop hover and cleanup. APIs mocked; no paid calls.');
} catch (error) {
  await shot('failure').catch(() => {});
  console.log(await evaluate("JSON.stringify({url:location.href,videos:[...document.querySelectorAll('[data-avatar-library] video')].map(v=>({id:v.closest('[data-avatar-card]').dataset.avatarCard,paused:v.paused,time:v.currentTime,error:v.error?.code})),peak:window.avatarPeak})").catch(() => 'No page'));
  console.log(errors); throw error;
} finally {
  await send('Page.navigate', { url: 'about:blank' }).catch(() => {}); socket.close();
}
