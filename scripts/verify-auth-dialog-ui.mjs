// Isolated Chrome CDP at :9338 and local Next dev at :3000. All browser API requests are mocked.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const origin = 'http://127.0.0.1:3000';
const version = await (await fetch('http://127.0.0.1:9338/json/version')).json();
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0, authenticated = false, googleFailure = false;
let loginEvent = null;
const claimedLoginIds = new Set(), loginClaims = [], loginEvents = [], analyticsMirrors = [];
const pending = new Map(), sessions = new Map(), errors = [], generations = [], emails = [], checkouts = [];
const authTrace = [];
const favoriteWrites = [];
const avatar = { id: 'fixture-look', kind: 'look', name: 'Fixture Presenter', groupId: null, previewImageUrl: null, previewVideoUrl: null, looksCount: null, gender: null, tags: [], avatarType: null };
const fixture = { access_token: 'ui-fixture', expires_at: '2099-01-01T00:00:00Z', user: { id: 'fixture-owner', email: 'owner@example.invalid' } };
function send(method, params = {}, sessionId) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); } return; }
  if (message.method === 'Target.attachedToTarget') {
    const { sessionId, targetInfo } = message.params;
    const boot = (async () => {
      if (targetInfo.type === 'page') {
        await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
        await send('Network.enable', {}, sessionId); await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
        await send('Runtime.addBinding', { name: '__qaLoginEvent' }, sessionId);
        await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('dreamface_locale','en')}catch{};window.dataLayer=[];window.dataLayer.push=function(...values){for(const value of values)if(value?.event==='login_success')window.__qaLoginEvent(JSON.stringify(value));return Array.prototype.push.apply(this,values)}" }, sessionId);
        await send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/api/*` }, { urlPattern: '*googletagmanager.com/*' }] }, sessionId);
      }
      await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
      return sessionId;
    })();
    sessions.set(targetInfo.targetId, boot); boot.catch(error => errors.push(error.message));
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Runtime.bindingCalled' && message.params.name === '__qaLoginEvent') loginEvents.push(JSON.parse(message.params.payload));
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params, url = new URL(request.url), path = url.pathname;
    let body = {}, responseCode = 200, headers = [{ name: 'Content-Type', value: 'application/json' }];
    if (url.hostname.includes('googletagmanager')) { body = ''; headers = [{ name: 'Content-Type', value: 'text/javascript' }]; }
    if (path === '/api/auth/session') { body = { session: authenticated ? fixture : null, ...(authenticated && loginEvent ? { loginEvent } : {}) }; authTrace.push({ path, authenticated, session: message.sessionId }); }
    if (path === '/api/auth/logout') { authenticated = false; loginEvent = null; }
    if (path === '/api/analytics/track') analyticsMirrors.push(JSON.parse(request.postData));
    if (path === '/api/analytics/login-success') {
      const claim=JSON.parse(request.postData);loginClaims.push(claim);
      if (!authenticated || !loginEvent) body={claimed:false,event:null};
      else if(claim.loginEventId!==loginEvent.id){responseCode=409;body={error:'Stale login receipt'};}
      else {const claimed=!claimedLoginIds.has(loginEvent.id);claimedLoginIds.add(loginEvent.id);body={claimed,event:{...loginEvent,surface:'fixture'}};}
    }
    if (path === '/api/auth/email/start') { emails.push(JSON.parse(request.postData)); body = { ok: true }; }
    if (path === '/api/auth/google/start') {
      authTrace.push({ path, next: url.searchParams.get('next') });
      if (!googleFailure) { authenticated = true; loginEvent = { id: randomUUID(), method: 'google' }; }
      const complete = new URL('/auth/complete', origin); complete.searchParams.set('next', url.searchParams.get('next') || '/studio');
      if (googleFailure) complete.searchParams.set('error', 'google_state');
      responseCode = 302; headers.push({ name: 'Location', value: complete.href });
    }
    if (path === '/api/credits') body = { balance: 10000, ledger: [], purchases: [], subscriptions: [] };
    if (path === '/api/tasks') body = { tasks: [] };
    if (path === '/api/model-pricing') body = { rows: [] };
    if (path === '/api/model-availability') body = { models: { dreamfaceIo: false } };
    if (path.includes('/api/avatars')) body = { items: [], nextCursor: null };
    if (path === '/api/avatars/heygen') body = { items: [avatar], hasMore: false, nextToken: null };
    if (path === '/api/avatars/favorites') {
      if (request.method === 'POST') favoriteWrites.push(JSON.parse(request.postData));
      body = { items: favoriteWrites.length ? [avatar] : [] };
    }
    if (path === '/api/referrals/availability') body = { visible: false };
    if (path === '/api/generate') { generations.push(JSON.parse(request.postData)); responseCode = 503; body = { error: 'Mock generation stopped' }; }
    if (path === '/api/billing/checkout') { checkouts.push(JSON.parse(request.postData)); responseCode = 503; body = { error: 'Mock checkout stopped' }; }
    void send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: headers, body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64') }, message.sessionId).catch(error => { if (!/closed|not found|Invalid InterceptionId/.test(error.message)) errors.push(error.message); });
  }
});
async function target(url = 'about:blank') {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  for (let i = 0; !sessions.has(targetId) && i < 100; i++) await pause(50);
  const sessionId = await sessions.get(targetId); assert.ok(sessionId);
  if (url !== 'about:blank') await send('Page.navigate', { url }, sessionId);
  return { targetId, sessionId };
}
let page;
async function evaluate(expression, id = page.sessionId) { const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }, id); if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text); return value.result.value; }
async function waitFor(expression) { for (let i = 0; i < 180; i++) { if (await evaluate(expression)) return; await pause(150); } throw new Error('UI condition failed: ' + expression); }
async function navigate(path) { await send('Page.navigate', { url: origin + path }, page.sessionId); }
async function field(selector, value) { await evaluate(`(() => {const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
async function openLogin() { await evaluate("document.querySelector('a.df-sign-in').click()"); await waitFor("!!document.querySelector('[data-auth-dialog]')"); }
async function screenshot(name) { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, page.sessionId); writeFileSync(`outputs/auth-dialog/${name}.png`, Buffer.from(shot.data, 'base64')); }
async function waitLoginCount(count) {for(let i=0;i<100&&loginEvents.length<count;i++)await pause(100);assert.equal(loginEvents.length,count);assert.equal(claimedLoginIds.size,count);}
try {
  mkdirSync('outputs/auth-dialog', { recursive: true });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  page = await target();
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  authenticated=true;
  await navigate('/studio?view=billing');
  await waitFor("Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))&&!document.querySelector('a.df-sign-in')");
  await pause(200);assert.equal(loginEvents.length,0);assert.equal(loginClaims.length,0,'Restoring an existing session cannot claim a login event');
  authenticated=false;
  const workspace = '/studio?mode=avatar&workflow=avatar-video&provider=minimax-h3-max-turbo-video';
  await navigate(workspace); await waitFor("Object.keys(document.querySelector('#avatar-spoken-script')||{}).some(key=>key.startsWith('__reactProps'))");
  await field('#avatar-spoken-script', 'Welcome! This script must stay exactly where I left it.');
  await evaluate(`(() => {const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='),x=>x.charCodeAt(0))],'portrait.png',{type:'image/png'}));const input=document.querySelector('.df-avatar-upload input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor("!!document.querySelector('.df-avatar-subject img')");
  const portrait = await evaluate("document.querySelector('.df-avatar-subject img').src");
  const initialUrl = await evaluate('location.href');
  await openLogin();
  assert.equal(await evaluate("document.querySelector('#auth-dialog-title').textContent"), 'Welcome to Dreamface');
  assert.equal(await evaluate("document.querySelector('#auth-dialog-description').textContent"), 'Sign up and generate for free');
  assert.equal(await evaluate('location.href'), initialUrl);
  await screenshot('desktop');
  await evaluate("document.querySelector('#auth-dialog-email').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' }, page.sessionId);
  assert.equal(await evaluate("!!document.activeElement.closest('[data-auth-dialog]')"), true);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, page.sessionId);
  await waitFor("!document.querySelector('[data-auth-dialog]')");
  assert.equal(await evaluate("document.querySelector('.df-avatar-subject img').src"), portrait);
  assert.equal(generations.length, 0);

  googleFailure = true;
  await openLogin();
  await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog] [role=alert]')");
  assert.equal(await evaluate('location.href'), initialUrl);
  await evaluate("document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
  googleFailure = false;

  // Popup blocked: stay in place and expose an explicit redirect fallback.
  await openLogin(); await evaluate("window.originalOpen=window.open;window.open=()=>null;[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("document.querySelector('[data-auth-dialog]').textContent.includes('blocked')");
  assert.equal(await evaluate('location.href'), initialUrl);
  await evaluate("window.open=window.originalOpen;document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");

  // Email waits in the dialog; a second tab confirms the session and wakes the original.
  await openLogin(); await field('#auth-dialog-email', 'creator@example.invalid');
  await evaluate("document.querySelector('[data-auth-dialog] form').requestSubmit()");
  await waitFor("document.querySelector('#auth-dialog-title').textContent==='Check your inbox'");
  assert.equal(emails.length, 1); assert.ok(emails[0].next.startsWith('/auth/complete?'));
  assert.equal(await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText.includes('Resend')).disabled"), true);
  authenticated = true; loginEvent = { id: randomUUID(), method: 'email' };
  const emailTab = await target(origin + emails[0].next);
  await waitFor("!document.querySelector('[data-auth-dialog]') && !document.querySelector('a.df-sign-in')");
  assert.equal(await evaluate('location.href'), initialUrl);
  assert.equal(await evaluate("document.querySelector('.df-avatar-subject img').src"), portrait);
  assert.equal(await evaluate("document.querySelector('#avatar-spoken-script').value"), 'Welcome! This script must stay exactly where I left it.');
  assert.equal(generations.length, 0, 'Ordinary login cannot start generation');
  await waitLoginCount(1);
  await send('Target.closeTarget', { targetId: emailTab.targetId });

  // Generation-triggered login resumes exactly once after Google popup authentication.
  authenticated = false;
  await evaluate("window.dispatchEvent(new Event('dreamface-auth-change'))");
  await waitFor("!!document.querySelector('a.df-sign-in')");
  await evaluate("document.querySelector('[data-avatar-generate]').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog]')");
  await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("!document.querySelector('[data-auth-dialog]')");
  for (let i = 0; i < 100 && !generations.length; i++) await pause(100);
  assert.equal(generations.length, 1); assert.equal(generations[0].prompt, 'Welcome! This script must stay exactly where I left it.');
  assert.deepEqual(generations[0].imageUrls, [portrait]);
  await pause(500); assert.equal(generations.length, 1);
  await waitLoginCount(2);

  // Mobile layout, close behavior, and payment selection continuation.
  authenticated = false; await evaluate("window.dispatchEvent(new Event('dreamface-auth-change'))");
  await waitFor("!!document.querySelector('a.df-sign-in')");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, page.sessionId);
  for (const width of [320, 390, 430]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }, page.sessionId);
    assert.equal(await evaluate("(() => {const el=document.querySelector('a.df-sign-in'),r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth&&getComputedStyle(el).display!=='none'&&document.documentElement.scrollWidth<=innerWidth})()"), true, `Visible mobile login at ${width}px`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, page.sessionId);
  await pause(200);
  await screenshot('mobile-header');
  await openLogin(); await screenshot('mobile');
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('[data-auth-dialog]').getBoundingClientRect().right<=innerWidth"), true);
  await evaluate("document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
  await navigate('/studio?view=billing'); await waitFor("Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))");
  await evaluate("document.querySelector('[data-credit-pack-select=starter]').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog]')");
  await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("!!document.querySelector('[data-credit-payment-dialog]') && !document.querySelector('[data-auth-dialog]')");
  assert.equal(checkouts.length, 0, 'Login restores the payment chooser without creating an order');
  assert.equal(await evaluate('location.pathname+location.search'), '/studio?view=billing');
  await waitLoginCount(3);

  authenticated = false;
  await navigate(workspace);
  await waitFor("Object.keys(document.querySelector('[data-avatar-card] button[aria-pressed]')||{}).some(key=>key.startsWith('__reactProps'))");
  await evaluate("document.querySelector('[data-avatar-card] button[aria-pressed]').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog]')");
  await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("!!document.querySelector('[data-avatar-card] button[aria-pressed=true]') && !document.querySelector('[data-auth-dialog]')");
  assert.equal(favoriteWrites.length, 1); assert.equal(favoriteWrites[0].favorite, true);
  await waitLoginCount(4);

  authenticated = false;
  for (const mode of ['video', 'image', 'audio', 'avatar']) {
    const workflow = { video: 'text-to-video', image: 'text-to-image', audio: 'text-to-audio', avatar: 'avatar-video' }[mode];
    await navigate(`/studio?mode=${mode}&workflow=${workflow}`);
    await waitFor("Object.keys(document.querySelector('a.df-sign-in')||{}).some(key=>key.startsWith('__reactProps'))");
    assert.equal(await evaluate("document.querySelector('a.df-sign-in').getBoundingClientRect().width>=44"), true, `Mobile ${mode} login must be visible`);
  }

  // Website navigation also opens the shared dialog without leaving the page.
  authenticated = false;
  await navigate('/en');
  await waitFor("Object.keys(document.querySelector('a[href*=\"/auth?next\"]')||{}).some(key=>key.startsWith('__reactProps'))");
  await evaluate("document.querySelector('a[href*=\"/auth?next\"]').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog]')");
  assert.equal(await evaluate('location.pathname'), '/en');
  const matchingGoogleStyle = await evaluate("(() => {const home=document.querySelector('[data-home-google-sign-in]'),modal=[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google');const a=getComputedStyle(home),b=getComputedStyle(modal);return ['borderRadius','borderColor','backgroundColor','color','fontSize','fontWeight','minHeight'].every(key=>a[key]===b[key])&&home.querySelectorAll('svg path').length===4})()");
  assert.equal(matchingGoogleStyle, true, 'Homepage and dialog share the Google button style and multicolor icon');
  await evaluate("document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
  const googleBeforeTry = authTrace.filter(entry=>entry.path==='/api/auth/google/start').length;
  await evaluate("document.querySelector('[data-home-google-sign-in]').parentElement.querySelector('a:not([data-home-google-sign-in])').click()");
  await waitFor("!!document.querySelector('[data-auth-dialog]')");
  assert.equal(authTrace.filter(entry=>entry.path==='/api/auth/google/start').length, googleBeforeTry, 'Try DreamFace keeps the login method chooser');
  await evaluate("document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
  await evaluate("window.originalOpen=window.open;window.open=()=>null;document.querySelector('[data-home-google-sign-in]').click()");
  await waitFor("document.querySelector('[data-auth-dialog]')?.textContent.includes('blocked')");
  await evaluate("window.open=window.originalOpen;document.querySelector('[data-auth-dialog] button[aria-label=Close]').click()");
  await screenshot('home-google-button');
  await evaluate("document.querySelector('[data-home-google-sign-in]').click()");
  await waitFor("!document.querySelector('[data-auth-dialog]')&&!document.querySelector('header a[href*=\"/auth?next\"]')");
  assert.equal(authTrace.filter(entry=>entry.path==='/api/auth/google/start').length, googleBeforeTry + 1, 'Homepage Google action starts OAuth on its first click');
  assert.equal(await evaluate('location.pathname'), '/en');
  await waitLoginCount(5);
  await navigate('/studio?view=billing');
  await waitFor("Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))&&!document.querySelector('a.df-sign-in')");
  await send('Page.reload', {}, page.sessionId);
  await waitFor("Object.keys(document.querySelector('[data-credit-pack-select]')||{}).some(key=>key.startsWith('__reactProps'))&&!document.querySelector('a.df-sign-in')");
  await evaluate("window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('dreamface-auth-change'))");
  await pause(250);await waitLoginCount(5);
  authenticated=false;
  await evaluate("window.dispatchEvent(new Event('dreamface-auth-change'))");await waitFor("!!document.querySelector('a.df-sign-in')");
  await openLogin();
  await evaluate("[...document.querySelectorAll('[data-auth-dialog] button')].find(x=>x.innerText==='Continue with Google').click()");
  await waitFor("!document.querySelector('[data-auth-dialog]')&&!document.querySelector('a.df-sign-in')");
  await waitLoginCount(6);
  assert.equal(loginEvents.filter(event=>event.method==='email').length,1);
  assert.equal(new Set(loginEvents.map(event=>event.login_event_id)).size,6);
  assert.equal(analyticsMirrors.filter(event=>event.eventName==='login_success').length,0,'No duplicate generic login mirror');
  assert.ok(loginEvents.every(event=>!JSON.stringify(event).includes(fixture.access_token)));
  assert.deepEqual(errors, []);
  writeFileSync('outputs/auth-dialog/browser-regression.json', JSON.stringify({ passed: true, loginSuccessEvents:loginEvents.length, uniqueLoginRecords:claimedLoginIds.size, loginMethods:loginEvents.map(event=>event.method), emails: emails.length, generations: generations.length, favorites: favoriteWrites.length, checkouts: checkouts.length, assertions: ['existing session produces no login event', 'six real authentications produce six login events', 'homepage success counted', 'reload/focus/embedded billing cannot duplicate', 'same account can log in again', 'no generic login mirror', 'desktop/mobile', 'visible mobile login at 320/390/430px', 'four mobile workspaces', 'shared Google button style', 'homepage one-click Google OAuth', 'homepage Google blocked fallback', 'Try DreamFace chooser preserved', 'exact copy', 'same-page URL', 'keyboard close', 'portrait/script preserved', 'popup blocked fallback', 'Google error recovery', 'email cross-tab sync', 'one generation after Google login', 'payment chooser resumes', 'Avatar favorite resumes', 'website login opens in place'], errors }, null, 2));
  console.log('Auth UI passed: six Google/email authentications produce six login_success events; restoration, reload, focus and embedded billing do not add events. Homepage, popup and email tabs count correctly; all previous desktop/mobile auth flows remain intact. All APIs and GTM delivery mocked.');
} catch (error) {
  if (page) { await screenshot('failure').catch(() => {}); console.log(await evaluate("JSON.stringify({url:location.href,body:document.body.innerText.slice(-1600)})").catch(() => 'No diagnostic page')); }
  console.log('Browser errors:', errors, 'Auth trace:', authTrace.slice(-15));
  throw error;
} finally {
  if (page) await send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  socket.close();
}
