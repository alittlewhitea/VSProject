// Disposable Chrome CDP :9766, local Next :3000. All business APIs and GTM mocked.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
const origin='http://127.0.0.1:3000';
const tab=await(await fetch('http://127.0.0.1:9766/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
const pending=new Map(),events=[],requests=[],errors=[],generated=[];let sequence=0,authenticated=true;
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}return;}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.method==='Fetch.requestPaused'){
 const {requestId,request}=message.params,url=new URL(request.url);let body={},responseCode=200,type='application/json';requests.push({path:url.pathname,method:request.method});
 if(url.hostname.includes('googletagmanager')){body='';type='text/javascript';}
 if(url.pathname==='/api/auth/session')body={session:authenticated?{access_token:'qa-only',expires_at:'2099-01-01',user:{id:'qa-user',email:'fixture@example.invalid'}}:null};
 if(url.pathname==='/api/analytics/track')events.push(JSON.parse(request.postData));
 if(url.pathname==='/api/credits')body={balance:10000,ledger:[],purchases:[],subscriptions:[]};
 if(url.pathname==='/api/tasks')body={tasks:[]};
 if(url.pathname==='/api/generate'){const payload=JSON.parse(request.postData);generated.push(payload);body={taskId:crypto.randomUUID(),status:'queued',transport:'real',mode:'audio',provider:'gemini-flash-tts',estimatedCredits:payload.expectedCredits,balance:9990};}
 if(url.pathname==='/api/model-pricing')body={rows:[]};
 if(url.pathname==='/api/model-availability')body={models:{dreamfaceIo:false}};
 if(url.pathname==='/api/referrals/availability')body={visible:false};
 if(url.pathname==='/api/gallery')body={items:[]};
 void send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)).toString('base64')}).catch(error=>{if(!/closed|Invalid InterceptionId/.test(error.message))errors.push(error.message);});
}});
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let n=0;n<220;n++){if(await evaluate(expression))return;await pause(150);}throw new Error(expression);}
async function navigate(path){await send('Page.navigate',{url:origin+path});}
async function screenshot(name){const value=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('outputs/gemini-tts/'+name+'.png',Buffer.from(value.data,'base64'));}
async function input(selector,value){await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});const prototype=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function select(selector,value){await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
async function submit(){const count=generated.length;await evaluate("document.querySelector('.df-audio-settings .df-composer-generate').click()");for(let n=0;n<100&&generated.length===count;n++)await pause(100);assert.equal(generated.length,count+1,'One isolated generation request');return generated.at(-1);}
try{
 mkdirSync('outputs/gemini-tts',{recursive:true});await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('dreamface_locale','en');localStorage.setItem('dreamface_studio_last_model_v1:text-to-audio','elevenlabs-tts')}catch{}"});
 await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/*'},{urlPattern:'*googletagmanager.com/*'}]});
 for(const width of [390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  await navigate('/studio?mode=audio&workflow=text-to-audio');await wait("!!document.querySelector('[data-gemini-tts-editor]')&&!!document.querySelector('.df-audio-settings .df-composer-generate')");
  assert.ok(await evaluate("document.querySelector('.df-audio-settings').textContent.includes('Gemini 3.8 Flash TTS')"),'New model replaces the old default preference');
  assert.equal(await evaluate("document.querySelector('[data-gemini-voice]').options.length"),30);assert.equal(await evaluate("document.querySelector('[data-gemini-voice]').value"),'Kore');
  assert.equal(await evaluate("!!document.querySelector('[data-audio-advanced-trigger]')"),false);assert.equal(await evaluate("document.querySelector('[data-speech-format]').textContent"),'WAV');
  await input('[data-gemini-tts-editor] [data-composer-prompt]','a'.repeat(1000));await input('[data-speech-style]','Warm and friendly.');await select('[data-gemini-voice]','Zephyr');
  await wait("document.querySelector('.df-audio-settings .df-composer-quote').textContent.startsWith('7 ')");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('single-'+width);
  let payload=await submit();assert.equal(payload.provider,'gemini-flash-tts');assert.equal(payload.geminiTts.voice,'Zephyr');assert.equal(payload.geminiTts.styleInstructions,'Warm and friendly.');assert.equal(payload.expectedCredits,7);assert.equal(payload.prompt.length,1000);assert.equal(payload.voice,undefined);assert.equal(payload.stability,undefined);assert.equal(payload.musicFormat,undefined);
  await navigate('/studio?mode=audio&workflow=text-to-audio&provider=gemini-flash-tts');await wait("!!document.querySelector('[data-gemini-tts-editor]')");
  await evaluate("document.querySelector('[data-speech-mode=dialogue]').click()");await wait("document.querySelectorAll('[data-speech-turn]').length===2");
  await evaluate("(()=>{const node=document.querySelectorAll('[data-speech-turn] textarea')[0];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,'b'.repeat(500));node.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await evaluate("(()=>{const node=document.querySelectorAll('[data-speech-turn] textarea')[1];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,'c'.repeat(500));node.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await input('[data-speaker-alias="0"]','Host');await input('[data-speaker-alias="1"]','Guest');await select('[data-speaker-voice="1"]','Puck');
  await evaluate("document.querySelector('[data-speech-turn] summary').click()");await input('[data-speech-turn] input','Curious.');
  await wait("!document.querySelector('.df-audio-settings .df-composer-generate').disabled&&document.querySelector('.df-audio-settings .df-composer-quote').textContent.startsWith('7 ')");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('dialogue-'+width);
  payload=await submit();assert.equal(payload.prompt,'');assert.equal(payload.geminiTts.mode,'dialogue');assert.equal(payload.geminiTts.turns[0].speaker_id,'Host');assert.equal(payload.geminiTts.turns[0].style_instructions,'Curious.');assert.equal(payload.geminiTts.turns[1].speaker_id,'Guest');assert.equal(payload.expectedCredits,7);
  await navigate('/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts');await wait("!!document.querySelector('[data-audio-advanced-trigger]')");assert.equal(await evaluate("!!document.querySelector('[data-gemini-tts-editor]')"),false);assert.ok(await evaluate("document.querySelector('.df-audio-settings').textContent.includes('Eleven')"));
  await navigate('/studio?mode=audio&workflow=text-to-music');await wait("document.querySelector('.df-audio-settings')?.textContent.includes('MiniMax')");assert.ok(await evaluate("[...document.querySelectorAll('.df-audio-settings select')].some(select=>select.value==='mp3')"));
  await evaluate("localStorage.removeItem('dreamface_studio_last_model_v1:text-to-audio:v2')");
 }
 // Exercise the real login-draft event, then reload as a signed-in user.
 authenticated=false;await navigate('/studio?mode=audio&workflow=text-to-audio');await wait("!!document.querySelector('[data-gemini-voice]')");
 await input('[data-gemini-tts-editor] [data-composer-prompt]','Restore this narration.');await select('[data-gemini-voice]','Leda');await input('[data-speech-style]','Calm.');
 assert.equal(await evaluate("window.dispatchEvent(new Event('dreamface-auth-before-redirect',{cancelable:true}))"),true);
 const draft=await evaluate("JSON.parse(localStorage.getItem('nova_studio_login_draft'))");assert.equal(draft.geminiTts.voice,'Leda');assert.equal(draft.geminiTts.styleInstructions,'Calm.');
 authenticated=true;await navigate('/studio?mode=audio&workflow=text-to-audio');await wait("document.querySelector('[data-gemini-voice]')?.value==='Leda'");assert.equal(await evaluate("document.querySelector('[data-speech-style]').value"),'Calm.');assert.equal(await evaluate("document.querySelector('[data-composer-prompt]').value"),'Restore this narration.');
 assert.deepEqual(errors,[]);assert.equal(requests.filter(request=>/checkout|magic-link/.test(request.path)).length,0);
 writeFileSync('outputs/gemini-tts/browser.json',JSON.stringify({passed:true,widths:[390,1440],requests:generated.length,voices:30,defaultMigration:true,singleDialogue:true,stylesExcluded:true,legacyModels:true,loginDraftRestored:true,allApisMocked:true,errors},null,2));
 console.log('Gemini TTS UI passed: desktop/mobile, migrated default, 30 voices, WAV controls, single and dialogue requests, billable text only, speaker styles, ElevenLabs/music preserved and login draft restored. All APIs and GTM mocked; no live speech generation, payment or database calls.');
}catch(error){console.log(await evaluate("JSON.stringify({url:location.href,body:document.body?.innerText.slice(-1800)})").catch(()=>''));throw error;}
finally{await send('Page.close').catch(()=>{});socket.close();}
