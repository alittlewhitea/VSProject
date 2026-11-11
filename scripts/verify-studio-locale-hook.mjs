import assert from 'node:assert/strict';
import {projectLoader} from './load-project-ts.mjs';
let active;const requests=new Map();
const react={
 useRef(initial){const i=active.cursor++;return active.cells[i]??=( {current:initial} );},
 useState(initial){const runner=active,i=runner.cursor++;if(!(i in runner.cells))runner.cells[i]=typeof initial==='function'?initial():initial;return [runner.cells[i],value=>{runner.updates++;runner.cells[i]=typeof value==='function'?value(runner.cells[i]):value;}];},
 useMemo(factory,deps){const i=active.cursor++,old=active.cells[i];if(!old||deps.some((value,index)=>value!==old.deps[index]))active.cells[i]={deps,value:factory()};return active.cells[i].value;},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
 useEffect(effect,deps){const runner=active,i=runner.cursor++,old=runner.cells[i];if(!old||deps.some((value,index)=>value!==old.deps[index]))runner.effects.push(()=>{old?.cleanup?.();runner.cells[i]={deps,cleanup:effect()};});}
};
const saved={window:globalThis.window,document:globalThis.document};const storage=new Map();let blocked=false;
globalThis.window={localStorage:{getItem:key=>{if(blocked)throw new Error('Storage blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blocked)throw new Error('Storage blocked');storage.set(key,value);}},location:{protocol:'http:'},navigator:{languages:['en'],language:'en'}};
globalThis.document={cookie:'',documentElement:{lang:'en',dir:'ltr'}};
try {
 const load=projectLoader({react,'./studio-message-loader':{loadStudioMessages:locale=>new Promise((resolve,reject)=>requests.set(locale,{resolve,reject}))}}),hook=load('src/lib/studio-i18n.ts').useStudioI18n;
 const runner={cursor:0,cells:[],effects:[],updates:0,render(locale='en',messages={label:'English {count}'}){active=this;this.cursor=0;this.effects=[];const value=hook(locale,messages);this.effects.forEach(effect=>effect());return value;},unmount(){this.cells.forEach(cell=>cell?.cleanup?.());}};
 let current=runner.render();assert.equal(current.t('label',{count:2}),'English 2');const t=current.t,setLocale=current.setLocale;current=runner.render();assert.equal(current.t,t);assert.equal(current.setLocale,setLocale,'Unrelated renders keep stable callbacks');
 const french=current.setLocale('fr'),arabic=current.setLocale('ar');requests.get('ar').resolve({label:'Arabic'});await arabic;current=runner.render();assert.equal(current.locale,'ar');assert.equal(current.t('label'),'Arabic');assert.equal(document.documentElement.dir,'rtl');requests.get('fr').resolve({label:'French'});await french;current=runner.render();assert.equal(current.locale,'ar','A late French chunk cannot replace the newer Arabic selection');
 const failed=current.setLocale('de');requests.get('de').reject(new Error('Chunk unavailable'));await failed;current=runner.render();assert.equal(current.locale,'ar');assert.equal(current.t('label'),'Arabic');assert.equal(current.loading,false);
 blocked=true;await current.setLocale('ar');assert.match(document.cookie,/dreamface_locale=ar/,'Blocked localStorage does not prevent cookie preference persistence');
 const pending=current.setLocale('it');runner.unmount();const updates=runner.updates;requests.get('it').resolve({label:'Italian'});await pending;assert.equal(runner.updates,updates,'Unmounted hooks ignore late dictionary results');
 console.log('Studio locale hook passed: selected initial messages, interpolation, stable callbacks, rapid RTL language changes, stale responses, failed-chunk fallback, blocked storage and unmounted async work. No network.');
} finally {globalThis.window=saved.window;globalThis.document=saved.document;}
