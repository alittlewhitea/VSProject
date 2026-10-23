import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const selected=[]; const filters=[]; let authenticated=true; let providerCalls=0;
const settings={image_urls:['data:image/png;base64,'+'A'.repeat(2*1024*1024)],duration:'5s'};
const fixtures=[
 {id:'mine',user_id:'user-1',status:'completed',deleted_at:null,mode:'image',estimated_credits:6,output_url:'https://media.test/a.png',request_settings:settings,raw_result:{images:[{url:'https://media.test/a.png'}]}},
 {id:'other',user_id:'user-2',status:'completed',deleted_at:null,request_settings:settings},
 {id:'deleted',user_id:'user-1',status:'completed',deleted_at:'2026-10-01',request_settings:settings}
];
const admin={from(table){
 let columns='', predicates=[], maximum=Infinity;
 const query={
  select(value){columns=value;selected.push({table,columns});return query;},
  in(key,values){predicates.push(row=>values.includes(row[key]));filters.push({key,values});return query;},
  eq(key,value){predicates.push(row=>row[key]===value);return query;},
  is(key,value){predicates.push(row=>row[key]===value);return query;},
  order(){return query;},limit(n){maximum=n;return query;},
  then(resolve,reject){
   const rows=(table==='generation_tasks'?fixtures:[]).filter(row=>predicates.every(p=>p(row))).slice(0,maximum);
   return Promise.resolve({data:rows.map(row=>Object.fromEntries(columns.split(',').map(key=>key.trim()).filter(key=>key in row).map(key=>[key,row[key]]))),error:null}).then(resolve,reject);
  }
 };return query;
}};
const overrides={
 'next/server':{NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'},...init})}},
 '../../../lib/server-auth':{getUserFromBearerToken:async()=>authenticated?{id:'user-1'}:null,getUserIdsForAuthUser:async()=>['user-1']},
 '../../../lib/supabase-admin':{createSupabaseAdminClient:()=>admin},
 '../../../lib/fal-fetch':{fetchFal:()=>{providerCalls++;throw new Error('Provider call in read path');}},
 '../../../lib/credits':{refundCredits:()=>{throw new Error('Read must not refund');}},
 '../../../lib/fal-billing':{},'../../../lib/fal-errors':{},'../../../lib/dreamface-io':{DREAMFACE_IO_PROVIDER:'dreamface-io-video'}
};
const module={exports:{}};
const compiled=ts.transpileModule(readFileSync('src/app/api/tasks/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','module','exports',compiled)(id=>{assert.ok(id in overrides,`Unexpected dependency: ${id}`);return overrides[id];},module,module.exports);
const previousKey=process.env.FAL_KEY;process.env.FAL_KEY='fixture-no-network';
try {
 const response=await module.exports.GET(new Request('https://site.test/api/tasks'));
 const body=await response.json();
 assert.deepEqual(body.tasks.map(x=>x.id),['mine']);
 assert.ok(!('request_settings' in body.tasks[0]));assert.ok(!('raw_result' in body.tasks[0]));
 assert.ok(JSON.stringify(body).length<2000);
 assert.ok(selected.filter(x=>x.table==='generation_tasks').every(x=>!x.columns.includes('request_settings')&&!x.columns.includes('raw_result')));
 assert.equal(providerCalls,0);assert.ok(filters.some(x=>x.key==='user_id'));
 const detail=await (await module.exports.GET(new Request('https://site.test/api/tasks?id=mine'))).json();
 assert.deepEqual(detail.tasks[0].request_settings,settings);
 assert.ok(detail.tasks[0].raw_result);
 for(const id of ['other','deleted']) {
  const body=await (await module.exports.GET(new Request(`https://site.test/api/tasks?id=${id}`))).json();assert.deepEqual(body.tasks,[]);
 }
 authenticated=false;
 assert.equal((await module.exports.GET(new Request('https://site.test/api/tasks'))).status,401);
 assert.equal((await module.exports.POST(new Request('https://site.test/api/tasks',{method:'POST'}))).status,401);
 authenticated=true;
 assert.equal((await module.exports.POST(new Request('https://site.test/api/tasks',{method:'POST'}))).status,200);
 assert.equal(providerCalls,0);
} finally {if(previousKey===undefined)delete process.env.FAL_KEY;else process.env.FAL_KEY=previousKey;}
console.log('Task history passed: lightweight list with 2 MiB settings excluded at query time, detail on demand, user/deleted-row isolation, authentication, no provider calls/refunds on reads. No real database or network.');
