import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import mysql from 'mysql2/promise';
import {projectLoader} from './load-project-ts.mjs';
import {verifyMysqlRecovery} from './verify-mysql-recovery.mjs';
import {verifyMysqlModelSubmission} from './verify-mysql-model-submission.mjs';

// Explicit isolated endpoint only: never load .env, reuse an application database,
// or let an environment typo turn this destructive fixture into a production test.
const host=process.env.TEST_MYSQL_HOST,port=Number(process.env.TEST_MYSQL_PORT);
if(process.env.RUN_MYSQL_INTEGRATION!=='1'||!['127.0.0.1','localhost','::1'].includes(host)||!Number.isInteger(port)||port<1024||port===3306)throw new Error('Use RUN_MYSQL_INTEGRATION=1 and an isolated loopback TEST_MYSQL_HOST/TEST_MYSQL_PORT (non-3306).');
const database=`dreamface_test_${process.pid}_${randomBytes(5).toString('hex')}`;
assert.match(database,/^dreamface_test_\d+_[a-f0-9]{10}$/);
const config={host,port,user:process.env.TEST_MYSQL_USER||'root',password:process.env.TEST_MYSQL_PASSWORD||'',multipleStatements:true};
const control=await mysql.createConnection(config);let db,pool;
try {
 await control.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 db=await mysql.createConnection({...config,database});
 await db.query(readFileSync('migration/mysql-schema.sql','utf8'));
 Object.assign(process.env,{MYSQL_HOST:host,MYSQL_PORT:String(port),MYSQL_USER:config.user,MYSQL_PASSWORD:config.password,MYSQL_DATABASE:database,MYSQL_SSL:'false',MYSQL_CONNECTION_LIMIT:'20'});
 const load=projectLoader(),store=load('src/lib/mysql.ts');pool=store.getMysqlPool();
 const admin=load('src/lib/mysql-supabase-adapter.ts').createMysqlSupabaseAdapter(),settle=load('src/lib/generation-task-settlement.ts').settleGenerationTask,reserve=load('src/lib/generation-capacity.ts').reserveGenerationTask;
 const [engines]=await db.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('generation_tasks','user_credit_accounts','credit_ledger')");
 assert.equal(engines.length,3);assert.ok(engines.every(row=>row.ENGINE==='InnoDB'));
 const [version]=await db.query('SELECT VERSION() AS version');
 const user=randomUUID(),other=randomUUID();
 for(const id of [user,other]){await db.execute('INSERT INTO users(id) VALUES (?)',[id]);await db.execute('INSERT INTO user_credit_accounts(user_id,balance,created_at,updated_at) VALUES (?,1000,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))',[id]);}
 const task=(id,uid=user)=>({id,user_id:uid,mode:'video',provider:'grok-video',prompt:'Isolated fixture',estimated_credits:10,transport:'real',request_settings:{model_id:'x/test'}});
 const balance=async uid=>Number((await db.execute('SELECT balance FROM user_credit_accounts WHERE user_id=?',[uid]))[0][0].balance);
 let outcomes=await Promise.allSettled(Array.from({length:20},(_,i)=>reserve(admin,task('capacity-'+i))));
 assert.equal(outcomes.filter(row=>row.status==='fulfilled'&&row.value.allowed).length,5,'Twenty simultaneous submissions admit exactly five: '+JSON.stringify(outcomes.filter(row=>row.status==='rejected').slice(0,2).map(row=>({code:row.reason.code,message:row.reason.message}))));assert.equal(await balance(user),950);
 assert.equal(outcomes.filter(row=>row.status==='rejected'&&row.reason.name==='GenerationCapacityError').length,15);
 const accepted=outcomes.filter(row=>row.status==='fulfilled').map(row=>row.value.task.id);
 // Hiding or aging a still-pending task must not free a paid-work slot.
 await db.execute("UPDATE generation_tasks SET deleted_at=UTC_TIMESTAMP(6),created_at='2020-01-01' WHERE id=?",[accepted[0]]);
 await assert.rejects(reserve(admin,task('aged-hidden-bypass')),error=>error.name==='GenerationCapacityError');
 await settle(admin,user,accepted[0],{status:'completed',output_url:'https://example.invalid/done.mp4'});
 await reserve(admin,task('replacement'));assert.equal(await balance(user),940);
 outcomes=await Promise.all(Array.from({length:20},()=>settle(admin,user,accepted[1],{status:'failed'},10)));
 assert.equal(outcomes.reduce((n,row)=>n+row.refundedCredits,0),10);assert.equal(await balance(user),950);
 outcomes=await Promise.all([settle(admin,user,accepted[2],{status:'completed'}),settle(admin,user,accepted[2],{status:'failed'},10)]);
 const [race]=await db.execute('SELECT status FROM generation_tasks WHERE id=?',[accepted[2]]);
 assert.equal(outcomes.filter(row=>row.applied).length,1);assert.equal(await balance(user),race[0].status==='completed'?950:960);
 // A real trigger simulates a ledger failure after the task UPDATE; both must roll back.
 const before=await balance(user);await db.query("CREATE TRIGGER fixture_refund_failure BEFORE INSERT ON credit_ledger FOR EACH ROW BEGIN IF NEW.reason='generation_refund' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated refund fault'; END IF; END");
 await assert.rejects(settle(admin,user,accepted[3],{status:'failed'},10));
 assert.equal((await db.execute('SELECT status FROM generation_tasks WHERE id=?',[accepted[3]]))[0][0].status,'queued');assert.equal(await balance(user),before);
 await db.query('DROP TRIGGER fixture_refund_failure');await settle(admin,user,accepted[3],{status:'failed'},10);
 await assert.rejects(settle(admin,other,accepted[4],{status:'failed'},10));
 await db.query("CREATE TRIGGER fixture_charge_failure BEFORE INSERT ON credit_ledger FOR EACH ROW BEGIN IF NEW.reason='generation_task' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated charge fault'; END IF; END");
 await assert.rejects(reserve(admin,task('rollback-reservation',other)));assert.equal((await db.execute('SELECT COUNT(*) AS count FROM generation_tasks WHERE id=?',['rollback-reservation']))[0][0].count,0);assert.equal(await balance(other),1000);
 await db.query('DROP TRIGGER fixture_charge_failure');
 outcomes=await Promise.all(Array.from({length:12},()=>reserve(admin,task('duplicate',other))));assert.equal(outcomes.filter(row=>!row.duplicate).length,1);assert.equal(await balance(other),990);
 await settle(admin,other,'duplicate',{status:'completed'});await settle(admin,other,'duplicate',{status:'failed'},10,true);assert.equal(await balance(other),990);
 const denied=await reserve(admin,{...task('insufficient',other),estimated_credits:1001});assert.equal(denied.allowed,false);assert.equal((await db.execute('SELECT COUNT(*) AS count FROM generation_tasks WHERE id=?',['insufficient']))[0][0].count,0);
 const raw=await admin.from('generation_tasks').update({status:'failed'});assert.ok(raw.error);assert.ok((await admin.from('generation_tasks').delete()).error);
 await verifyMysqlRecovery({db,admin,store});
 await verifyMysqlModelSubmission({db,admin,store});
 console.log(`Real MySQL ${version[0].version} passed: InnoDB engines, 20-way atomic admission/charge, hidden/expired pending work, capacity release, 20-way refund, completion race, real trigger rollback for refunds and charges, ownership, idempotency, insufficient funds and guarded writes. Only generated ${database} used; providers never called.`);
} finally {
 if(pool)await pool.end();if(db)await db.end();
 // The generated name is validated above and never comes from application config.
 await control.query(`DROP DATABASE IF EXISTS \`${database}\``);await control.end();
}
