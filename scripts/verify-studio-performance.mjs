import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require','module','exports',compiled)(id => overrides[id] || (id.startsWith('.') ? load(resolve(dirname(path), id+'.ts')) : native(id)), module, module.exports);
    return module.exports;
  }
  return load;
}

let scrolls = 0, networkCalls = 0;
const oldWindow = globalThis.window, oldFetch = globalThis.fetch;
const entries = [{ url: 'https://dreamface.test/studio?view=home', state: { __NA: true } }];
let index = 0;
function updateLocation() { const url = new URL(entries[index].url); globalThis.window.location = { href: url.href, pathname: url.pathname, search: url.search }; }
globalThis.window = { history: {
  pushState(_state,_title,url) { entries.splice(index+1); entries.push({ url: new URL(url, entries[index].url).href, state: entries[index].state }); index++; updateLocation(); },
  replaceState(_state,_title,url) { entries[index].url = new URL(url, entries[index].url).href; updateLocation(); },
  back() { if(index) index--; updateLocation(); }, forward() { if(index < entries.length-1) index++; updateLocation(); }
}, scrollTo() { scrolls++; } };
globalThis.fetch = () => { networkCalls++; throw new Error('Workspace navigation must not fetch'); };
updateLocation();
const load = loader({ 'next/link': { default: () => null } });
const nav = load('src/lib/studio-navigation.ts');
const Link = load('src/features/studio/studio-link.tsx').default;
for(const href of ['/studio?mode=image&workflow=text-to-image','/studio?mode=video&workflow=text-to-video','/studio?mode=audio&workflow=text-to-audio','/studio?view=projects','/studio?view=home']) {
  const element = Link({ href });
  assert.equal(element.props.prefetch,false);
  const event = { button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;} };
  element.props.onClick(event);
  assert.equal(event.defaultPrevented,true); assert.equal(window.location.pathname+window.location.search,href);
}
assert.equal(networkCalls,0); assert.equal(scrolls,5);
window.history.back(); assert.equal(window.location.search,'?view=projects');
window.history.forward(); assert.equal(window.location.search,'?view=home');
const historyLength=entries.length;
nav.navigateStudio('/studio?mode=video&workflow=image-to-video',{replace:true,scroll:false});
assert.equal(entries.length,historyLength); assert.equal(scrolls,5);
nav.navigateStudio('/studio?mode=video&workflow=image-to-video',{scroll:false}); assert.equal(entries.length,historyLength);
for(const changes of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]) {
  const event={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...changes};
  Link({href:'/studio?mode=image'}).props.onClick(event); assert.equal(event.defaultPrevented,false);
}
for(const props of [{target:'_blank'},{download:true},{download:''}]) {
  const event={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  Link({href:'/studio?mode=image',...props}).props.onClick(event); assert.equal(event.defaultPrevented,false);
}
const prevented={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
Link({href:'/studio?mode=image',onClick:e=>e.preventDefault()}).props.onClick(prevented);
assert.equal(window.location.search,'?mode=video&workflow=image-to-video');
for(const href of ['/billing','https://other.test/studio?mode=image','javascript:alert(1)','/studio?view=home#examples']) assert.equal(nav.studioNavigationTarget(href,window.location.href),null);
assert.equal(nav.studioNavigationTarget('/studio?mode=image','https://dreamface.test/gallery'),null);
assert.equal(Link({href:'/billing',prefetch:true}).props.prefetch,true);
for(const name of ['studio-navigation','studio-home','studio-header','studio-projects','video-settings']) assert.match(readFileSync(`src/features/studio/${name}.tsx`,'utf8'),/import Link from "\.\/studio-link"/);
const studio = readFileSync('src/app/studio/studio-client.tsx','utf8');
assert.doesNotMatch(studio,/router\.replace\(`/);
assert.match(studio,/navigateStudio\(studioProjectHref/);
globalThis.fetch=oldFetch;

// Hook simulation executes actual video lifecycle/grouping, not browser automation.
let currentRunner;
const observers=[],videos=[],listeners=new Set();
const react={
  useRef(initial){const r=currentRunner,i=r.cursor++; if(!(i in r.cells))r.cells[i]={current:initial};return r.cells[i];},
  useState(initial){const r=currentRunner,i=r.cursor++;if(!(i in r.cells))r.cells[i]=initial;return [r.cells[i],v=>r.cells[i]=v];},
  useEffect(effect,deps){const r=currentRunner,i=r.cursor++;const old=r.cells[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))r.queue.push(()=>{old?.cleanup?.();r.cells[i]={deps,cleanup:effect()};});}
};
const oldDocument=globalThis.document, oldObserver=globalThis.IntersectionObserver;
globalThis.document={hidden:false,addEventListener(_name,cb){listeners.add(cb);},removeEventListener(_name,cb){listeners.delete(cb);}};
globalThis.IntersectionObserver=class {constructor(cb){this.cb=cb;observers.push(this);}observe(video){this.video=video;}disconnect(){this.disconnected=true;}notify(value){this.cb([{isIntersecting:value}]);}};
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
let maxPlaying=0;
function fakeVideo(){const attrs=new Map(),events=new Map();const video={playing:false,getAttribute:key=>attrs.get(key)||null,load(){},pause(){this.playing=false;},play(){this.playing=true;maxPlaying=Math.max(maxPlaying,videos.filter(v=>v.playing).length);return Promise.resolve();},addEventListener(name,cb){events.set(name,cb);},removeEventListener(name){events.delete(name);}};Object.defineProperty(video,'src',{set(value){attrs.set('src',value);}});videos.push(video);return video;}
const Preview=loader({react})('src/components/viewport-video.tsx').ViewportVideo;
function runner(props){const r={cells:[],cursor:0,queue:[],video:fakeVideo(),render(){this.cursor=0;this.queue=[];currentRunner=this;const element=Preview(props);element.props.ref.current=this.video;for(const effect of this.queue)effect();return element;},cleanup(){for(const cell of this.cells)cell?.cleanup?.();}};r.render();return r;}
const previews=Array.from({length:5},(_,i)=>runner({src:`https://media.test/${i}.mp4`,playbackGroup:'studio-home'}));
for(let i=0;i<previews.length;i++){assert.equal(previews[i].video.getAttribute('src'),null);observers[i].notify(true);previews[i].render();}
assert.equal(videos.filter(v=>v.playing).length,1);assert.equal(previews[0].video.playing,true);assert.equal(maxPlaying,1);
observers[0].notify(false);assert.equal(previews[0].video.playing,false);assert.equal(previews[1].video.playing,true);
document.hidden=true;for(const cb of listeners)cb();assert.equal(videos.filter(v=>v.playing).length,0);
document.hidden=false;for(const cb of listeners)cb();assert.equal(videos.filter(v=>v.playing).length,1);
for(const preview of previews)preview.cleanup();assert.equal(videos.filter(v=>v.playing).length,0);assert.equal(listeners.size,0);
globalThis.window=oldWindow;globalThis.document=oldDocument;globalThis.IntersectionObserver=oldObserver;
console.log('Studio performance regression passed: desktop/mobile links share no-fetch navigation, replace/back/forward/scroll semantics, modified clicks/external links preserved, workflow actions covered, only one home preview plays, offscreen/hidden/unmounted videos pause. No database or paid API calls.');
