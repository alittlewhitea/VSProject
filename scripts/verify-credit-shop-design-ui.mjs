// Local preview :3000 and owned Chrome CDP :9353. Intercept all APIs/external
// resources; rendering, switching packs and rejected payments never charge.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='http://127.0.0.1:3000',output='outputs/credit-shop-design';
mkdirSync(output,{recursive:true});
const tab=await(await fetch('http://127.0.0.1:9353/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const waiting=new Map(),errors=[],checkout=[],unexpected=[];let sequence=0,authenticated=true;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){const pending=waiting.get(message.id);if(pending){waiting.delete(message.id);message.error?pending.reject(new Error(message.error.message)):pending.resolve(message.result);}return;}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  if(message.method!=='Fetch.requestPaused')return;
  const {requestId,request}=message.params,url=new URL(request.url);let body={},status=200;
  if(url.origin!==origin){status=204;body='';}
  else if(url.pathname==='/api/auth/session')body={session:authenticated?{access_token:'cookie:design-fixture',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}:null};
  else if(url.pathname==='/api/credits')body={balance:120,ledger:[],purchases:[],subscriptions:[]};
  else if(url.pathname==='/api/tasks')body={tasks:[]};
  else if(url.pathname==='/api/model-pricing')body={rows:[]};
  else if(url.pathname==='/api/referrals/availability')body={visible:false};
  else if(url.pathname==='/api/billing/paypal/wallet-config')body={enabled:false,clientId:null,environment:'TEST',merchantCountry:'GB'};
  else if(url.pathname==='/api/billing/checkout'){checkout.push(JSON.parse(request.postData));status=503;body={error:'Fixture checkout unavailable'};}
  else if(url.pathname.includes('/wallet-orders')||url.pathname.includes('/capture')){unexpected.push(url.pathname);status=500;}
  void send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>errors.push(error.message));
});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let n=0;n<200;n++){if(await evaluate(expression))return;await pause(150);}throw new Error('UI timeout: '+expression);}
async function shot(name){await evaluate('document.fonts.ready');const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${output}/${name}.png`,Buffer.from(result.data,'base64'));}
async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);}
async function loaded(){await until("Object.keys(document.querySelector('[data-credit-pack-select=creator]')||{}).some(key=>key.startsWith('__reactProps'))");await until("document.querySelector('[data-store-balance]')?.innerText.includes('120')");}
async function assertNoOverflow(){assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await evaluate("[...document.querySelectorAll('[data-credit-payment-dialog] [role=dialog],[aria-labelledby=credit-shop-title]')].every(node=>node.scrollWidth<=node.clientWidth+1)"),true);}
const packs=[['starter',800,'4.99'],['creator',1800,'9.99'],['studio',4800,'24.99'],['pro-topup',11000,'49.99']];
try{
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'https://*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en');sessionStorage.removeItem('dreamface_wallet_pending_order');}catch{}"});
  for(const [width,height] of [[1440,1000],[768,1024],[640,960],[390,844],[320,740]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await send('Page.navigate',{url:origin+'/en/price'});await loaded();
    assert.equal(await evaluate("document.querySelectorAll('[data-credit-packs] article').length"),4);
    assert.equal(await evaluate("document.querySelector('[data-recommended=true]').dataset.packId"),'creator');
    assert.equal(await evaluate("document.querySelector('[data-pack-id=creator]').textContent.includes('Most Popular')"),true);
    const columns=await evaluate("getComputedStyle(document.querySelector('[data-credit-packs]')).gridTemplateColumns.split(' ').length");
    assert.equal(columns,width>=1024?4:width>=768?2:1);
    const cardColors=await evaluate("[...document.querySelectorAll('[data-credit-pack-select]')].map(node=>getComputedStyle(node).backgroundColor)");
    assert.equal(cardColors[1],'rgb(124, 58, 237)');assert.notEqual(cardColors[0],cardColors[1]);
    await assertNoOverflow();await shot('price-'+width);
    for(const mode of ['video','image','avatar','all']){
      await click(`[role=tab][data-mode=${mode}]`);
      assert.equal(await evaluate(`document.querySelectorAll('[data-usage-estimate=${mode}]').length`),mode==='all'?0:4);
      assert.equal(await evaluate("document.querySelector('[role=tab][aria-selected=true]').dataset.mode"),mode);
      assert.equal(unexpected.length,0);await assertNoOverflow();
    }
    const before=checkout.length;
    for(const [packId,credits,price] of packs){
      await click(`[data-credit-pack-select="${packId}"]`);await until("!!document.querySelector('[data-credit-payment-dialog]')");
      assert.equal(await evaluate("document.querySelector('[data-order-credits]').innerText"),`+${credits.toLocaleString('en-US')} credits`);
      assert.equal(await evaluate("document.querySelector('[data-order-balance]').innerText"),`${(120+credits).toLocaleString('en-US')} credits`);
      assert.ok((await evaluate("document.querySelector('[data-order-total]').innerText")).includes(price));
      assert.equal(unexpected.length,0);await assertNoOverflow();
      if(packId==='creator')await shot('checkout-'+width);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until("!document.querySelector('[data-credit-payment-dialog]')");
    }
    assert.equal(checkout.length,before,'Opening/switching packs does not create a checkout');
    await click('[data-credit-pack-select=creator]');await until("!!document.querySelector('[data-payment-provider=paypal]')");
    await click('[data-payment-provider=paypal]');
    await until("document.querySelector('[data-credit-payment-dialog] [role=alert]')?.innerText==='Fixture checkout unavailable'");
    assert.deepEqual(checkout.at(-1),{type:'credits',packId:'creator',provider:'paypal'});
    assert.equal(await evaluate("document.querySelector('[data-payment-provider=paypal]').disabled"),false);
    assert.equal(await evaluate("document.querySelector('[data-store-balance]').innerText"),'120 credits','Rejected checkout cannot add credits');
    await click('[data-credit-payment-close]');
    await send('Page.navigate',{url:origin+'/studio?mode=image&workflow=text-to-image&provider=nano-banana-image'});
    await until("document.querySelector('[data-signed-in=true]') && Object.keys(document.querySelector('button[aria-label=\"Buy credits\"]')||{}).some(key=>key.startsWith('__reactProps'))");
    await click('button[aria-label="Buy credits"]');await until("!!document.querySelector('[aria-labelledby=credit-shop-title]')");
    await until("document.querySelector('[aria-labelledby=credit-shop-title] [data-store-balance]')?.innerText==='120 credits'");
    await assertNoOverflow();await shot('modal-'+width);
    await click('[aria-labelledby=credit-shop-title] [data-credit-pack-select=creator]');
    await until("!!document.querySelector('[data-credit-payment-dialog]')");
    assert.equal(await evaluate("document.querySelector('[data-order-balance]').innerText"),'1,920 credits','Studio loads the real balance before quoting the top-up');
    await shot('nested-checkout-'+width);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until("!document.querySelector('[data-credit-payment-dialog]')");
    assert.equal(await evaluate("!!document.querySelector('[aria-labelledby=credit-shop-title]')"),true,'First Escape returns to packs');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until("!document.querySelector('[aria-labelledby=credit-shop-title]')");
    assert.equal(await evaluate('document.body.style.overflow'),'', 'Closing both dialogs restores scrolling');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const locale of ['zh-CN','de','fr','es','ar']){
    await send('Page.navigate',{url:origin+`/${locale}/price`});await loaded();
    assert.doesNotMatch(await evaluate("document.querySelector('[data-credit-store]').innerText"),/creditShop\./);
    await click('[role=tab][data-mode=avatar]');await assertNoOverflow();await shot('localized-'+locale);
    await click('[data-credit-pack-select=creator]');await until("!!document.querySelector('[data-credit-payment-dialog]')");
    await assertNoOverflow();await shot('localized-checkout-'+locale);await click('[data-credit-payment-close]');
  }
  authenticated=false;
  await send('Page.navigate',{url:origin+'/en/price'});
  await until("Object.keys(document.querySelector('[data-credit-pack-select=creator]')||{}).some(key=>key.startsWith('__reactProps'))");
  await until("!document.querySelector('[data-store-balance]')");
  const before=checkout.length;await click('[data-credit-pack-select=creator]');
  await until("!!document.querySelector('[data-auth-dialog]')");
  assert.equal(await evaluate("!!document.querySelector('[data-credit-payment-dialog]')"),false);assert.equal(checkout.length,before);
  assert.equal(unexpected.length,0);assert.deepEqual(errors,[]);
  console.log('Credit shop design UI passed: four/two/one-column layout at 1440/768/640/390/320, shared price/modal design, real pack quotes, projected balance, four estimator modes, all four packs, rejected-checkout recovery, unchanged balance, nested Escape/focus/scroll, localized and RTL layouts, sign-in gate and no payment orders. All APIs mocked.');
}finally{
  await send('Page.navigate',{url:'about:blank'}).catch(()=>{});
  await new Promise(resolve=>{socket.addEventListener('close',resolve,{once:true});socket.close();});
  await fetch('http://127.0.0.1:9353/json/close/'+tab.id).catch(()=>{});
  await pause(150);
}
