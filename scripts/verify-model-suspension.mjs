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
assert.equal(release.DREAMFACE_IO_SUSPENDED,true);
for(const providers of Object.values(models.VIDEO_PROVIDERS_BY_WORKFLOW)) {
  assert.ok(!providers.includes('dreamface-io-video'));
  assert.ok(providers.includes('minimax-h3-max-turbo-video'));
}
assert.ok(!load('src/lib/model-pricing.ts').MODEL_PRICING_ROWS.some(row=>row.provider==='dreamface-io-video'));
const studio=readFileSync('src/app/studio/studio-client.tsx','utf8');
const ast=ts.createSourceFile('studio.tsx',studio,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function nodeMatching(predicate) {
  let found;function visit(node){if(predicate(node))found=node;if(!found)ts.forEachChild(node,visit);}visit(ast);
  assert.ok(found);return found;
}
const initializer=nodeMatching(n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='WORKFLOW_META').initializer.getText(ast);
const workflows=new Function('VIDEO_PROVIDERS_BY_WORKFLOW',`return (${initializer});`)(models.VIDEO_PROVIDERS_BY_WORKFLOW);
const providerFor=nodeMatching(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='providerForWorkflow').getText(ast);
const allowed=nodeMatching(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='isProviderAllowedForMode').getText(ast);
const selectors=new Function('WORKFLOW_META','videoModelConfig','isAvatarProvider',compile(providerFor+'\n'+allowed)+'\nreturn {providerForWorkflow,isProviderAllowedForMode};')(workflows,models.videoModelConfig,()=>false);
for(const workflow of Object.keys(workflows)) {
  assert.ok(!workflows[workflow].providers.includes('dreamface-io-video'));
  assert.equal(selectors.providerForWorkflow(workflow,'dreamface-io-video'),workflows[workflow].recommendedProvider);
}
for(const mode of ['image','video','avatar','audio'])assert.equal(selectors.isProviderAllowedForMode('dreamface-io-video',mode),false);
const forbidden=new Proxy({}, {get(){throw new Error('No storage/provider calls are allowed during suspension checks');}});
assert.equal(await load('src/lib/runtime-config.ts').isDreamfaceIoEnabled(forbidden),false);
const NextResponse={json:(body,options={})=>({status:options.status||200,body})};
const availability=loader({
  'next/server':{NextResponse},
  '../../../lib/supabase-admin':{createSupabaseAdminClient(){throw new Error('Unexpected DB access');}},
  '../../../lib/dreamface-io':{isDreamfaceIoConfigured(){throw new Error('Unexpected provider access');}},
  '../../../lib/runtime-config':forbidden
})('src/app/api/model-availability/route.ts');
const originalEnv=process.env.NODE_ENV;
try {
  for(const environment of ['production','development']) {
    process.env.NODE_ENV=environment;
    assert.deepEqual(await availability.GET(),{status:200,body:{models:{dreamfaceIo:false}}});
  }
} finally {if(originalEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=originalEnv;}
// Execute the actual POST prefix through its suspension guard. Anything beyond it must be unreachable.
const route=readFileSync('src/app/api/generate/route.ts','utf8');
const prefix=route.slice(route.indexOf('export async function POST'),route.indexOf('    const isDreamfaceIoTalkingAvatar ='));
const post=new Function('getUserFromBearerToken','isValidBody','isAvatarRequest','isH3MaxAvatarRequest','DREAMFACE_IO_PROVIDER','DREAMFACE_IO_SUSPENDED','NextResponse','exports',
  compile(prefix+"throw new Error('Suspended request reached generation processing'); } catch(error) { throw error; } }")+'\nreturn exports.POST;')(
  async()=>({id:'fixture'}),()=>true,()=>false,()=>false,'dreamface-io-video',true,NextResponse,{}
);
for(const mode of ['video','avatar','image','audio']) {
  const result=await post({headers:new Headers(),json:async()=>({mode,provider:'dreamface-io-video'})});
  assert.equal(result.status,503);
}
console.log('Model suspension passed: all workspaces, old links, public pricing, development/production availability and early generation rejection. No DB or paid API calls.');
