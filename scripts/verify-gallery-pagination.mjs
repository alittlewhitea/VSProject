import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url), cache=new Map(), queries=[];
// More than both old limits (48 fetched, 12 displayed) and the API page cap.
const rows=Array.from({length:265},(_,i)=>({id:String(999-i),title:'Gallery '+i,category:'Daily Life',image_url:'https://fixture.invalid/'+i+'.png',prompt:'Prompt '+i,is_featured:0}));
function load(file){
 file=resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>{
  if(id==='next/server')return {NextResponse:{json:body=>({body})}};
  if(id==='./mysql')return {mysqlExecute:async(sql,params)=>{queries.push({sql,params});assert.match(sql,/where is_published = 1/);assert.match(sql,/id desc limit \? offset \?$/);return rows.slice(params.at(-1),params.at(-1)+params.at(-2));}};
  return id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id);
 },module,module.exports);return module.exports;
}
const route=load('src/app/api/gallery/route.ts'), db=load('src/lib/gallery-db.ts');
const collected=[];let offset=0;
for(let page=0;page<10;page++){
 const {body}=await route.GET(new Request('https://fixture.invalid/api/gallery?limit=120&offset='+offset));
 assert.equal(body.storageWarning,undefined);assert.ok(body.items.length<=120);
 collected.push(...body.items.map(item=>item.id));
 if(!body.hasMore){assert.equal(body.nextOffset,null);break;}
 assert.equal(body.nextOffset,offset+120);offset=body.nextOffset;
}
assert.deepEqual(collected,rows.map(row=>row.id));assert.equal(new Set(collected).size,265);
assert.deepEqual(queries.map(query=>query.params),[[121,0],[121,120],[121,240]]);
await route.GET(new Request('https://fixture.invalid/api/gallery?limit=1.8&offset=-9'));
assert.deepEqual(queries.at(-1).params,[2,0]);
await route.GET(new Request('https://fixture.invalid/api/gallery?limit=9999&offset=NaN'));
assert.deepEqual(queries.at(-1).params,[121,0]);
await db.listPublishedGalleryRows({category:'Daily Life',query:'portrait',sort:'latest',limit:20,offset:240});
assert.match(queries.at(-1).sql,/category = \?/);assert.match(queries.at(-1).sql,/title like \?/);
assert.match(queries.at(-1).sql,/order by published_at desc, created_at desc, id desc/);
assert.deepEqual(queries.at(-1).params,['Daily Life',...Array(5).fill('%portrait%'),20,240]);
console.log('Gallery pagination passed: all 265 published fixtures, stable order, no duplicate/missing page boundaries, input bounds and existing search/category filters. No network or database.');
