import {readStudioSource} from './studio-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url);
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function loader(overrides={}) {
  const cache=new Map();
  function load(path) {
    path=resolve(path);if(cache.has(path))return cache.get(path).exports;
    const module={exports:{}};cache.set(path,module);
    new Function('require','module','exports',compile(readFileSync(path,'utf8')))(id=>{
      if(id in overrides)return overrides[id];
      return id.startsWith('.')?load(resolve(dirname(path),id+'.ts')):native(id);
    },module,module.exports);
    return module.exports;
  }
  return load;
}
const load=loader(),release=load('src/lib/model-release.ts'),models=load('src/features/studio/video-models.ts');
assert.equal(load("src/lib/retired-providers.ts").isRetiredProvider("dreamface-io-video"),true);
for(const [workflow,providers] of Object.entries(models.VIDEO_PROVIDERS_BY_WORKFLOW)) {
  assert.ok(!providers.includes('dreamface-io-video'));
  if(workflow==='reference-to-video') assert.deepEqual(providers,['heygen-video']);
  else assert.ok(providers.includes('minimax-h3-max-turbo-video'));
}
assert.ok(!load('src/lib/model-pricing.ts').MODEL_PRICING_ROWS.some(row=>row.provider==='dreamface-io-video'));
const studio=readStudioSource();
const ast=ts.createSourceFile('studio.tsx',studio,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function nodeMatching(predicate) {
  let found;function visit(node){if(predicate(node))found=node;if(!found)ts.forEachChild(node,visit);}visit(ast);
  assert.ok(found);return found;
}
const initializer=nodeMatching(n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='WORKFLOW_META').initializer.getText(ast);
const speech=load('src/lib/gemini-tts.ts');
const workflows=new Function('VIDEO_PROVIDERS_BY_WORKFLOW','GEMINI_TTS_PROVIDER',`return (${initializer});`)(models.VIDEO_PROVIDERS_BY_WORKFLOW,speech.GEMINI_TTS_PROVIDER);
const providerFor=nodeMatching(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='providerForWorkflow').getText(ast);
const allowed=nodeMatching(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='isProviderAllowedForMode').getText(ast);
const normalizeGptImageProvider=load('src/lib/gpt-image-models.ts').normalizeGptImageProvider;
const selectors=new Function('WORKFLOW_META','videoModelConfig','isAvatarProvider','normalizeGptImageProvider','GEMINI_TTS_PROVIDER',compile(providerFor+'\n'+allowed)+'\nreturn {providerForWorkflow,isProviderAllowedForMode};')(workflows,models.videoModelConfig,()=>false,normalizeGptImageProvider,speech.GEMINI_TTS_PROVIDER);
for(const workflow of Object.keys(workflows)) {
  assert.ok(!workflows[workflow].providers.includes('dreamface-io-video'));
  assert.equal(selectors.providerForWorkflow(workflow,'dreamface-io-video'),workflows[workflow].recommendedProvider);
  assert.ok(!workflows[workflow].providers.includes('mischief-video'));
  assert.equal(selectors.providerForWorkflow(workflow,'mischief-video'),workflows[workflow].recommendedProvider);
}
for(const mode of ['image','video','avatar','audio'])assert.equal(selectors.isProviderAllowedForMode('dreamface-io-video',mode),false);
for(const mode of ['image','video','avatar','audio'])assert.equal(selectors.isProviderAllowedForMode('mischief-video',mode),false);
const NextResponse={json:(body,options={})=>({status:options.status||200,body})};
const route=readFileSync('src/app/api/generate/route.ts','utf8');
const prefix=route.slice(route.indexOf('export async function POST'),route.indexOf('    const taskId = generationTaskId'));
const post=new Function('getUserFromBearerToken','isValidBody','isRetiredProvider','NextResponse','exports','normalizeGptImageProvider','MISCHIEF_PROVIDER','MISCHIEF_RETIRED','readRequestJson',
 compile(prefix+"throw new Error('Retired request reached generation processing'); } catch(error) { throw error; } }")+'\nreturn exports.POST;')(
 async()=>({id:'fixture'}),()=>true,load('src/lib/retired-providers.ts').isRetiredProvider,NextResponse,{},normalizeGptImageProvider,'mischief-video',true,async request=>request.json());
for(const provider of ['dreamface-io-video','mischief-video'])for(const mode of ['video','avatar','image','audio']) {
 const result=await post({headers:new Headers(),json:async()=>({mode,provider})});assert.equal(result.status,410);assert.equal(result.body.code,'model_retired');
}
assert.equal(native('node:fs').existsSync('src/lib/dreamface-io.ts'),false);
assert.equal(native('node:fs').existsSync('src/lib/studio-i18n-dreamface-io.ts'),false);
console.log('Retired models passed: unavailable in all workspaces, old-link fallback, no public prices, early 410 before any charge, and removed provider/free-allowance modules. No database or paid calls.');
