import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
let state,rollbackLedger=false,tail=Promise.resolve(),sqlCalls=[];
const initial=(status='queued',charge=-10)=>({task:{id:'task',user_id:'owner',status,estimated_credits:10,output_url:null},balance:90,ledger:charge?[{id:1,user_id:'owner',amount:charge,reason:'generation_task',reference_id:'task'}]:[]});
const conn={async execute(sql,args=[]){sqlCalls.push(sql);
 if(sql.startsWith('select * from generation_tasks')){assert.match(sql,/for update$/);return[[args[0]==='task'&&args[1]==='owner'?structuredClone(state.task):null].filter(Boolean)];}
 if(sql.startsWith('update generation_tasks set')){const keys=[...sql.slice(0,sql.indexOf(' where ')).matchAll(/`(\w+)` = \?/g)].map(match=>match[1]);keys.forEach((key,index)=>state.task[key]=args[index]);return[{affectedRows:1}];}
 if(sql.startsWith('select amount from credit_ledger'))return[state.ledger.filter(row=>row.reason==='generation_task')];
 if(sql.startsWith('select balance')){assert.match(sql,/for update/);return[[{balance:state.balance}]];}
 if(sql.startsWith('select id, amount from credit_ledger'))return[state.ledger.filter(row=>row.user_id===args[0]&&row.reason===args[1]&&row.reference_id===args[2])];
 if(sql.startsWith('update user_credit_accounts')){state.balance=args[0];return[{affectedRows:1}];}
 if(sql.startsWith('insert into credit_ledger')){if(rollbackLedger)throw new Error('Fixture ledger insert failed');const row={id:state.ledger.length+1,user_id:args[0],amount:args[1],reason:args[2],reference_id:args[3]};state.ledger.push(row);return[{insertId:row.id}];}
 throw new Error('Unexpected isolated SQL: '+sql);
}};
const mysql={toMysqlDate:value=>value instanceof Date?value.toISOString():value,fromMysqlRow:value=>value,
 mysqlExecute:async(sql)=>{sqlCalls.push(sql);return{affectedRows:1};},
 withMysqlTransaction(fn){const running=tail.then(async()=>{const snapshot=structuredClone(state);try{return await fn(conn);}catch(error){state=snapshot;throw error;}});tail=running.catch(()=>{});return running;}
};
function load(file){file=resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',source)(id=>id==='./mysql'?mysql:id.startsWith('.')?load(resolve(dirname(file),id+'.ts')):native(id),module,module.exports);return module.exports;}
const adapter=load('src/lib/mysql-supabase-adapter.ts').createMysqlSupabaseAdapter();
const settle=load('src/lib/generation-task-settlement.ts').settleGenerationTask;
state=initial();let outcomes=await Promise.all([settle(adapter,'owner','task',{status:'completed',output_url:'https://example.invalid/result.mp4'}),settle(adapter,'owner','task',{status:'failed'},10)]);
assert.equal(state.task.status,'completed');assert.equal(state.balance,90);assert.equal(state.ledger.length,1);assert.equal(outcomes[1].applied,false);
state=initial();outcomes=await Promise.all(Array.from({length:20},()=>settle(adapter,'owner','task',{status:'failed'},10)));
assert.equal(state.balance,100);assert.equal(state.ledger.filter(row=>row.reason==='generation_refund').length,1);assert.equal(outcomes.filter(row=>row.applied).length,1);
await settle(adapter,'owner','task',{status:'completed',output_url:'https://example.invalid/late.mp4'});assert.equal(state.task.status,'failed');assert.equal(state.task.output_url,null);
state=initial();rollbackLedger=true;await assert.rejects(settle(adapter,'owner','task',{status:'failed'},10));rollbackLedger=false;assert.deepEqual(state,initial(),'A failed refund rolls back both task status and account balance');
await assert.rejects(settle(adapter,'someone-else','task',{status:'failed'},10));assert.equal(state.balance,90);
state=initial('completed');await settle(adapter,'owner','task',{status:'failed'},10);assert.equal(state.balance,90);
await settle(adapter,'owner','task',{status:'failed'},10,true);assert.equal(state.balance,90,'Even explicit failed-refund repair cannot refund a completed task');
state=initial('failed');outcomes=await Promise.all(Array.from({length:12},()=>settle(adapter,'owner','task',{status:'failed'},10,true)));
assert.equal(state.balance,100);assert.equal(outcomes.reduce((sum,row)=>sum+row.refundedCredits,0),10,'Admin backfill refunds an already failed task once');
state=initial('queued',-5);assert.equal((await settle(adapter,'owner','task',{status:'failed'},100)).refundedCredits,5,'Refund cannot exceed the actual generation charge');
state=initial('queued',0);await settle(adapter,'owner','task',{status:'failed'},10);assert.equal(state.balance,90,'Uncharged tasks cannot create credits');
state=initial('running');await settle(adapter,'owner','task',{status:'queued'});assert.equal(state.task.status,'running','An older poll cannot regress running to queued');
await assert.rejects(settle(adapter,'owner','task',{status:'completed'},10));
const before=sqlCalls.length;assert.ok((await adapter.from('generation_tasks').update({status:'failed'})).error);assert.ok((await adapter.from('generation_tasks').delete()).error);assert.equal(sqlCalls.length,before,'Unfiltered mutations never execute SQL');
assert.equal((await adapter.from('generation_tasks').update({title:'Fixture'}).eq('id','task')).error,null);
assert.equal((await adapter.from('generation_tasks').delete().eq('id','task')).error,null);
assert.ok((await adapter.from('unknown_fixture').insert({value:'fixture'}).select('value').single()).error,'Inserted rows require a reliable lookup key');
console.log('Settlement passed: actual adapter RPC, terminal row locks, 20 competing refunds, completion/refund race, rollback, ownership, charge cap, uncharged tasks, monotonic state and filtered database writes. MySQL transactions and connections simulated; no database accessed.');
