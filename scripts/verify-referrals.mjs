import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Isolated tests: no .env loading, network requests or database connections.
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const native=createRequire(import.meta.url);
function loader(mocks={}) {
  const cache=new Map();
  function load(path) {
    const file=resolve(root,path);
    if(Object.hasOwn(mocks,file))return mocks[file];
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith(".")?load(resolve(dirname(file),`${id}.ts`)):native(id);
    new Function("require","module","exports",code)(require,module,module.exports);
    return module.exports;
  }
  return load;
}
process.env.REFERRAL_SECRET="test-referral-secret-32-characters-only";
process.env.REFERRAL_ENABLED="true";

process.env.REFERRAL_IP_HEADER="x-real-ip";
const policy=loader()("src/lib/referral-policy.ts");
assert.equal(policy.referralConfigured(),true);
assert.equal(policy.readReferralValue(policy.signReferralValue("abc")),"abc");
assert.equal(policy.readReferralValue(policy.signReferralValue("abc")+"a"),null);
assert.equal(policy.readReferralValue("bad.signature"),null);
assert.equal(policy.excludedReferralIp(null,""),true);
assert.equal(policy.excludedReferralIp("192.0.2.12","192.0.2.0/24"),true);
assert.equal(policy.excludedReferralIp("198.51.100.2","192.0.2.0/24"),false);
assert.equal(policy.excludedReferralIp("2001:db8::2","2001:db8::/32"),true);
assert.equal(policy.excludedReferralIp("::ffff:192.0.2.12","192.0.2.0/24"),true);
assert.throws(()=>policy.excludedReferralIp("192.0.2.2","invalid"));
assert.throws(()=>policy.excludedReferralIp("192.0.2.2","192.0.2.0/33"));
assert.equal(policy.isDisposableEmail("person@mailinator.com"),true);
assert.equal(policy.isDisposableEmail("person@gmail.com"),false);
assert.equal(policy.isDisposableEmail("person@sub.mailinator.com"),true);
assert.deepEqual(policy.referralQuotaPeriod(new Date("2026-09-30T16:00:00Z")),{day:"2026-10-01",month:"2026-10"});
assert.deepEqual(policy.referralQuotaPeriod(new Date("2026-09-30T15:59:59Z")),{day:"2026-09-30",month:"2026-09"});

let state;
let fault=false;
function reset(overrides={}) {
  state={r:{id:"r1",inviter_id:"a",invitee_id:"b",status:"waiting",reason:null,inviter_credits:100,invitee_credits:100,bound_at:"2026-09-01 00:00:00",expires_at:"2099-09-08 00:00:00",due_at:null,quota_day:null,review_approved:0,...overrides},settings:{enabled:1,inviter_credits:100,invitee_credits:100,daily_limit:3,monthly_limit:30,daily_budget:10000},people:[{user_id:"a",email:"a@gmail.com",email_verified:"a@gmail.com"},{user_id:"b",email:"b@gmail.com",email_verified:"b@gmail.com"}],daily:0,monthly:0,budget:0,generated:true,shared:false,used:false,burst:false,similar:false,velocity:false,balances:{a:0,b:0},ledger:[],claims:[],audit:[]};
}
async function execute(sql,args=[]) {
  const r=state.r;
  if(sql.includes("SELECT * FROM referral_settings"))return [[state.settings]];
  if(sql.includes("SELECT * FROM referrals WHERE id="))return [[structuredClone(r)]];
  if(sql.includes("SELECT p.*,u.email FROM referral_profiles"))return [state.people];
  if(sql.includes("SELECT a.device_hash"))return [state.shared?[{device_hash:"shared"}]:[]];
  if(sql.includes("SELECT c.referral_id"))return [state.used?[{referral_id:"other"}]:[]];
  if(sql.includes("SELECT DISTINCT user_id"))return [[{user_id:"a"},{user_id:"b"}]];
  if(sql.includes("SELECT d.device_hash"))return [state.burst?[{device_hash:"burst"}]:[]];
  if(sql.includes("SELECT a.client_hash"))return [state.similar?[{client_hash:"similar"}]:[]];
  if(sql.includes("SELECT s.client_hash"))return [state.velocity?[{client_hash:"velocity"}]:[]];
  if(sql.includes("SELECT g.id")) {
    assert.match(sql,/g.status='completed'/);assert.match(sql,/g.transport='real'/);
    assert.match(sql,/l.reason='generation_task' AND l.amount<0/);
    assert.match(sql,/NOT EXISTS[\s\S]+refund/);
    assert.match(sql,/g.output_url<>''/);
    return [state.generated?[{id:`task-${args[0]}`}]:[]];
  }
  if(sql.includes("AS daily,COUNT(*) AS monthly"))return [[{daily:state.daily,monthly:state.monthly}]];
  if(sql.includes("AS total FROM referrals"))return [[{total:state.budget}]];
  if(sql.includes("SELECT device_hash FROM referral_device_users"))return [[{device_hash:"device-b"}]];
  if(sql.startsWith("UPDATE referrals SET checked_at"))return [{affectedRows:1}];
  if(sql.startsWith("UPDATE referrals SET status=?,reason=?")){r.status=args[0];r.reason=args[1];return [{affectedRows:1}];}
  if(sql.startsWith("UPDATE referrals SET status='pending'")){
    assert.ok(args[0]>=600&&args[0]<=1800);
    r.status="pending";r.quota_day=args[1];r.due_at="2099-01-01 00:00:00";
    state.daily++;state.monthly++;state.budget+=r.inviter_credits+r.invitee_credits;
    return [{affectedRows:1}];
  }
  if(sql.startsWith("INSERT INTO referral_device_claims")){state.claims.push(args);return [{affectedRows:1}];}
  if(sql.startsWith("INSERT INTO user_credit_accounts"))return [{affectedRows:0}];
  if(sql.startsWith("INSERT IGNORE INTO credit_ledger")){
    const key=`${args[0]}:${args[2]}`;const added=!state.ledger.includes(key);if(added)state.ledger.push(key);
    return [{affectedRows:Number(added)}];
  }
  if(sql.startsWith("UPDATE user_credit_accounts")){
    if(fault&&args[1]==="b")throw new Error("simulated second-balance failure");
    state.balances[args[1]]+=args[0];return [{affectedRows:1}];
  }
  if(sql.startsWith("UPDATE referrals SET status='paid'")){r.status="paid";return [{affectedRows:1}];}
  if(sql.startsWith("INSERT INTO referral_audit")){state.audit.push(args);return [{affectedRows:1}];}
  throw new Error(`Unexpected SQL: ${sql}`);
}
let tail=Promise.resolve();
const service=loader({
  "next/headers":{cookies:async()=>({get:()=>undefined,set:()=>{},delete:()=>{}})},
  [resolve(root,"src/lib/mysql.ts")]:{
    withMysqlTransaction:fn=>{
      const run=tail.then(async()=>{const before=structuredClone(state);try{return await fn({execute});}catch(e){state=before;throw e;}});
      tail=run.catch(()=>{});return run;
    },
    mysqlExecute:async sql=>sql.startsWith("SELECT * FROM referrals")?[structuredClone(state.r)]:[]
  }
})("src/lib/referrals.ts");
for (const country of ["US","CN","GB","JP","DE"]) assert.equal(service.referralRegionAllowed(new Headers({"cf-ipcountry":country})),true,country);
for (const country of ["IN","ID","NG","PK","BD","XX",""]) assert.equal(service.referralRegionAllowed(new Headers({"cf-ipcountry":country})),false,country);
assert.equal(service.referralRegionAllowed(new Headers()),false,"Unknown region must not qualify");
async function runReward(){return service.referralTransaction(async(db,s)=>service.processReferral(db,s,structuredClone(state.r)));}
reset();await runReward();assert.equal(state.r.status,"pending");assert.equal(state.daily,1);assert.deepEqual(state.balances,{a:0,b:0});
await runReward();assert.equal(state.daily,1);assert.equal(state.ledger.length,0);
state.r.due_at="2020-01-01 00:00:00";
await Promise.all(Array.from({length:8},()=>runReward()));assert.equal(state.r.status,"paid");assert.deepEqual(state.balances,{a:100,b:100});assert.equal(state.ledger.length,2);
await runReward();assert.equal(state.ledger.length,2);

reset({status:"pending",quota_day:"2026-09-08",due_at:"2020-01-01 00:00:00"});fault=true;
await assert.rejects(runReward(),/simulated/);assert.deepEqual(state.balances,{a:0,b:0});assert.equal(state.ledger.length,0);assert.equal(state.claims.length,0);assert.equal(state.r.status,"pending");
fault=false;await runReward();assert.deepEqual(state.balances,{a:100,b:100});

for(const [key,reason] of [["shared","same_device"],["used","device_reward_used"],["burst","device_burst"],["similar","similar_client"],["velocity","client_burst"]]){
  reset();state[key]=true;await runReward();assert.equal(state.r.reason,reason);assert.equal(state.ledger.length,0);
}
reset();state.people[1].email_verified=null;await runReward();assert.equal(state.r.status,"waiting");
reset();state.people[1].email="changed@gmail.com";await runReward();assert.equal(state.r.status,"waiting");
reset();state.people[1].email="person@mailinator.com";await runReward();assert.equal(state.r.reason,"disposable_email");
reset();state.people[0].ip_excluded=1;await runReward();assert.equal(state.r.reason,"excluded");
reset();state.generated=false;await runReward();assert.equal(state.r.status,"waiting");assert.equal(state.daily,0);
reset({expires_at:"2020-01-01 00:00:00"});state.generated=false;await runReward();assert.equal(state.r.reason,"expired");
reset();state.daily=3;await runReward();assert.equal(state.r.reason,"quota_exceeded");
reset();state.monthly=30;await runReward();assert.equal(state.r.reason,"quota_exceeded");
reset();state.budget=9950;await runReward();assert.equal(state.r.reason,"campaign_budget");
reset();state.settings.enabled=0;await runReward();assert.equal(state.r.status,"waiting");
reset({review_approved:1});state.burst=true;state.similar=true;await runReward();assert.equal(state.r.status,"pending");
reset({review_approved:1});state.shared=true;await runReward();assert.equal(state.r.reason,"same_device");
reset({status:"pending",quota_day:"2026-09-08",due_at:"2020-01-01 00:00:00"});state.generated=false;await runReward();assert.equal(state.r.status,"review");assert.equal(state.ledger.length,0);

const source=readFileSync(resolve(root,"src/lib/referrals.ts"),"utf8");
assert.match(source,/if \(!isNew \|\| !settings.enabled \|\| !context\?\.code\) return/);
assert.match(source,/referral_auth_contexts WHERE auth_key=\? AND expires_at>UTC_TIMESTAMP/);
assert.match(source,/COUNT\(\*\) AS n[\s\S]+INTERVAL 24 HOUR/);
assert.match(source,/Number\(count.n\)>2/);
assert.match(readFileSync(resolve(root,"migration/add-referrals.sql"),"utf8"),/invitee_id CHAR\(36\) NOT NULL UNIQUE/);
console.log("Referral tests passed: signature/IP/email policy, Beijing quotas, reservation, delayed grants, concurrency, transaction rollback/retry, exclusions, device reuse/burst, soft review, expiry, hard checks after approval. Isolated fixtures only; no live DB or network.");
