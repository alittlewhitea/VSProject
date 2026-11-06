import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map(),upstream=[],sql=[],saved=new Map();
let user={id:'account-a'},upstreamStatus=200,imageFailure=null;
function OptimizedImage(){}
const database={mysqlExecute:async(query,params=[])=>{
 sql.push({query,params});
 if(query.startsWith('create table'))return [];
 if(query.startsWith('insert')){saved.set(params.slice(0,3).join(':'),params[3]);return [];}
 if(query.startsWith('delete')){saved.delete(params.join(':'));return [];}
 if(query.startsWith('select'))return [...saved].filter(([key])=>key.startsWith(params[0]+':')).map(([,value])=>({item_json:value}));
 throw new Error('Unexpected SQL');
}};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>{
  if(id==='next/server')return {NextResponse:{json:(body,init={})=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json',...init.headers},status:init.status||200})}};
  if(id==='./mysql')return database;
  if(id==='react')return {useState:()=>[imageFailure,value=>{imageFailure=value;}]};
  if(id==='next/image')return {default:OptimizedImage};
  if(id.endsWith('/server-auth'))return {getUserFromBearerToken:async()=>user};
  return id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id);
 },module,module.exports);return module.exports;}
const oldKey=process.env.HEYGEN_API_KEY,oldFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const parsed=new URL(url);upstream.push({url:parsed,init});
 assert.equal(parsed.origin,'https://api.heygen.com');assert.equal(parsed.searchParams.get('ownership'),'public');assert.equal(init.method,'GET');assert.equal(init.headers['X-Api-Key'],process.env.HEYGEN_API_KEY);
 if(upstreamStatus!==200)return new Response(JSON.stringify({error:'Secret '+process.env.HEYGEN_API_KEY}),{status:upstreamStatus});
 const look=parsed.pathname.endsWith('/looks');
 return new Response(JSON.stringify({data:[{id:look?'lk_1':'ag_1',name:'Annie',preview_image_url:'https://files.heygen.ai/annie.jpg',preview_video_url:'https://files.heygen.ai/annie.mp4',group_id:look?'ag_1':undefined,looks_count:look?undefined:57,tags:look?['business']:undefined}],has_more:true,next_token:'opaque-next-cursor'}));
};
try {
 const route=load('src/app/api/avatars/heygen/route.ts');
 delete process.env.HEYGEN_API_KEY;
 let response=await route.GET(new Request('https://fixture.invalid/api/avatars/heygen'));assert.equal(response.status,503);assert.equal(upstream.length,0);
 process.env.HEYGEN_API_KEY='fixture-key';
 const requests=await Promise.all(Array.from({length:3},()=>route.GET(new Request('https://fixture.invalid/api/avatars/heygen?ownership=private'))));
 assert.equal(upstream.length,1,'Share in-flight read-only discovery');
 const group=(await requests[0].json()).items[0];assert.equal(group.kind,'group');assert.equal(group.looksCount,57);
 response=await route.GET(new Request('https://fixture.invalid/api/avatars/heygen?kind=look&groupId=ag_1&token=opaque%2Bcursor'));
 const page=await response.json(),look=page.items[0];assert.equal(look.kind,'look');assert.equal(look.groupId,'ag_1');assert.equal(page.nextToken,'opaque-next-cursor');assert.equal(upstream.at(-1).url.searchParams.get('token'),'opaque+cursor');assert.equal(upstream.at(-1).url.searchParams.get('group_id'),'ag_1');
 await route.GET(new Request('https://fixture.invalid/api/avatars/heygen?kind=look&groupId=ag_1&preview=1'));assert.equal(upstream.at(-1).url.searchParams.get('limit'),'3');
 const count=upstream.length;
 response=await route.GET(new Request('https://fixture.invalid/api/avatars/heygen?kind=group&groupId=private'));assert.equal(response.status,400);assert.equal(upstream.length,count);
 upstreamStatus=401;
 response=await route.GET(new Request('https://fixture.invalid/api/avatars/heygen?token=error'));assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/fixture-key|Secret/);
 upstreamStatus=200;await route.GET(new Request('https://fixture.invalid/api/avatars/heygen?token=error'));assert.equal(upstream.length,count+2,'Failed responses never cached');
 process.env.HEYGEN_API_KEY='rotated-fixture';await route.GET(new Request('https://fixture.invalid/api/avatars/heygen'));assert.equal(upstream.length,count+3,'Key rotation cannot reuse old cache');
 const favorites=load('src/app/api/avatars/favorites/route.ts');
 const req=(item,favorite=true)=>new Request('https://fixture.invalid/api/avatars/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item,favorite,userId:'account-a'})});
 response=await favorites.POST(req(group));assert.equal(response.status,200);
 response=await favorites.POST(req(look));assert.equal(response.status,200);
 assert.equal((await (await favorites.GET(new Request('https://fixture.invalid'))).json()).items.length,2);
 user={id:'account-b'};assert.equal((await (await favorites.GET(new Request('https://fixture.invalid'))).json()).items.length,0);
 await favorites.POST(req(look));assert.equal(saved.size,3,'Client userId cannot overwrite another account');
 user={id:'account-a'};await favorites.POST(req(group,false));assert.equal(saved.size,2);assert.equal((await (await favorites.GET(new Request('https://fixture.invalid'))).json()).items[0].kind,'look');
 user=null;const writes=sql.length;assert.equal((await favorites.POST(req(look))).status,401);assert.equal((await favorites.GET(new Request('https://fixture.invalid'))).status,401);assert.equal(sql.length,writes);
 user={id:'account-a'};assert.equal((await favorites.POST(req({...look,id:'../../private'}))).status,400);
 const {favoriteAvatar}=load('src/lib/avatar-favorites.ts');assert.equal(favoriteAvatar({...look,previewImageUrl:'javascript:bad'}).previewImageUrl,null);
 const {avatarLibraryCopy}=load('src/features/studio/studio-avatar-library-copy.ts');
 for(const locale of ['en','zh-CN','zh-TW','pt-BR','ru','vi','de','fr','ja','th','nl','he','ko','es','it','ar'])assert.ok(Object.values(avatarLibraryCopy(locale)).every(value=>typeof value==='string'&&value.length));
 const filters=load('src/lib/avatar-catalog-filters.ts');
 const {normalizeHeygenAvatar}=load('src/lib/heygen-avatar-types.ts');
 const metadata=normalizeHeygenAvatar({id:'explicit_metadata',name:'Presenter',gender:'female',age_group:'young_adult',ethnicity:'south_asian',tags:['professional']},'look');
 assert.deepEqual(filters.avatarCategories,['all','favorites']);
 assert.deepEqual(Object.keys(filters.avatarFilterOptions),['gender']);
 assert.equal(filters.matchesAvatarFilters(metadata,{gender:['woman','man']}),true);
 assert.equal(filters.matchesAvatarFilters(metadata,{gender:['man']}),false);
 const unknown={...look,name:'Woman Young Adult Asian',gender:null,ageGroup:null,ethnicity:null};
 assert.equal(filters.avatarFilterValue(unknown,'gender'),null,'Never infer gender from names or previews');
 assert.equal(filters.matchesAvatarFilters(unknown,{gender:['woman']}),false);
 assert.equal(filters.matchesAvatarFilters(unknown,filters.emptyAvatarFilters()),true);
 assert.equal(filters.matchesAvatarCategory({...group,previewImageUrl:'https://resource2.heygen.ai/avatar/office118_p1.jpg'},'all',new Set()),true);
 assert.equal(filters.matchesAvatarCategory(look,'favorites',new Set(['look:'+look.id])),true);
 assert.equal(filters.matchesAvatarCategory(look,'favorites',new Set(['group:'+look.id])),false,'Favorite kinds are distinct');
 assert.equal(favoriteAvatar(metadata).ageGroup,'young_adult');assert.equal(favoriteAvatar(metadata).ethnicity,'south_asian');
 const {avatarFilterCopy}=load('src/features/studio/avatar-filter-copy.ts');
 for(const locale of ['en','zh-CN','zh-TW','pt-BR','ru','vi','de','fr','ja','th','nl','he','ko','es','it','ar'])assert.ok(Object.values(avatarFilterCopy(locale)).every(value=>typeof value==='string'&&value.length));
 const {GalleryImage}=load('src/components/gallery-image.tsx');
 const imageProps={src:'https://resource2.heygen.ai/public/avatar.jpg',alt:'Avatar',sizes:'22vw',width:640,height:480};
 let rendered=GalleryImage(imageProps);assert.equal(rendered.type,OptimizedImage);assert.equal(rendered.props.quality,75);assert.equal(rendered.props.loading,'lazy');
 rendered.props.onError();rendered=GalleryImage(imageProps);assert.equal(rendered.type,'img','Optimizer failure must fall back to the original');
 for(const src of ['https://unrecognized.invalid/avatar.jpg','https://resource2.heygen.ai:999/avatar.jpg','https://user:password@resource2.heygen.ai/avatar.jpg'])assert.equal(GalleryImage({...imageProps,src}).type,'img','Unknown or credentialed hosts are never proxied');
 assert.match(readFileSync('next.config.mjs','utf8'),/hostname: "resource2\.heygen\.ai"/);
 assert.match(readFileSync('migration/add-avatar-favorites.sql','utf8'),/primary key \(user_id, avatar_kind, avatar_id\)/);
 console.log('Avatar library passed: both public GET endpoints, opaque pagination, preview limits, private ownership blocked, missing/rejected key, cache/coalescing/rotation, credential redaction, account-isolated persistent favorites, no unauthenticated writes and 16 locale copies. No live API, DB or generation.');
}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.HEYGEN_API_KEY;else process.env.HEYGEN_API_KEY=oldKey;}
