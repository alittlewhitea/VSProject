import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import type { PoolConnection } from "mysql2/promise";
import { getRequestIp, hashSignupIp } from "./credits";
import { mysqlExecute, withMysqlTransaction } from "./mysql";
import { H3_DAILY_FREE_PROGRAM, H3_DAILY_FREE_PROVIDER, h3DailyFreePeriod } from "./h3-daily-free-policy";

const COOKIE = "df_generation_device";
type Identity = { kind: "ip" | "device"; hash: string };
export type H3FreeContext = { ipHash: string; deviceHash: string } | null;
export type H3FreeStatus = { eligible: boolean; available: boolean; remaining: number; resetsAt: string; reason: string };
const unavailable = (reason: string): H3FreeStatus => ({eligible:false,available:false,remaining:0,resetsAt:h3DailyFreePeriod().resetsAt,reason});
function secret() {
  const value = process.env.SIGNUP_IP_SECRET || process.env.AUTH_SESSION_SECRET || process.env.MYSQL_PASSWORD;
  if (!value) throw new Error("Daily free device signing is not configured.");
  return value;
}
const hashDevice = (scope: string, value: string) => createHmac("sha256", secret()).update(`h3-free:${scope}:${value}`).digest("hex");
export function signH3Device(value: string) { return `${value}.${hashDevice("cookie",value)}`; }
export function readH3Device(value?: string) {
  if (!value || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null;
  const [device,signature]=value.split(".");
  return timingSafeEqual(Buffer.from(signature,"hex"),Buffer.from(hashDevice("cookie",device),"hex")) ? device : null;
}

export async function h3FreeContext(headers: Headers): Promise<H3FreeContext> {
  const rawIp=getRequestIp(headers);
  if (!rawIp || !isIP(rawIp)) return null;
  const ip=isIP(rawIp)===6 ? new URL(`http://[${rawIp}]`).hostname.slice(1,-1) : rawIp;
  const jar=await cookies();
  let device=readH3Device(jar.get(COOKIE)?.value);
  if (!device) {
    device=randomBytes(32).toString("hex");
    jar.set(COOKIE,signH3Device(device),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:365*86400});
  }
  return {ipHash:hashSignupIp(ip),deviceHash:hashDevice("device",device)};
}

async function rows<T = any>(db: PoolConnection, sql: string, args: unknown[] = []): Promise<T[]> {
  return (await db.execute(sql,args as any[]))[0] as T[];
}
async function signup(db: PoolConnection, userId: string) {
  const [record]=await rows(db,"SELECT amount,reference_id FROM credit_ledger WHERE user_id=? AND reason='signup_bonus' ORDER BY id ASC LIMIT 1",[userId]);
  return Number(record?.amount)===100 ? record : null;
}
function identities(context: NonNullable<H3FreeContext>, signupHash: unknown): Identity[] {
  const result: Identity[]=[{kind:"ip",hash:context.ipHash},{kind:"device",hash:context.deviceHash}];
  if (typeof signupHash==="string" && /^[a-f0-9]{64}$/.test(signupHash) && signupHash!==context.ipHash) result.push({kind:"ip",hash:signupHash});
  return result.sort((a,b)=>`${a.kind}:${a.hash}`.localeCompare(`${b.kind}:${b.hash}`));
}

// Preview never claims identities or consumes quota. Any storage error closes free access only.
export async function getH3DailyFreeStatus(userId: string, context: H3FreeContext): Promise<H3FreeStatus> {
  if (!context) return unavailable("identity_missing");
  try {
    const [record]=await mysqlExecute<any[]>("SELECT amount,reference_id FROM credit_ledger WHERE user_id=? AND reason='signup_bonus' ORDER BY id ASC LIMIT 1",[userId]);
    if (Number(record?.amount)!==100) return unavailable("signup_ineligible");
    for (const identity of identities(context,record.reference_id)) {
      const [owner]=await mysqlExecute<any[]>("SELECT owner_user_id FROM h3_daily_free_identities WHERE identity_kind=? AND identity_hash=?",[identity.kind,identity.hash]);
      if (owner && owner.owner_user_id!==userId) return unavailable("shared_identity");
    }
    const period=h3DailyFreePeriod();
    const [usage]=await mysqlExecute<any[]>("SELECT task_id FROM h3_daily_free_usage WHERE quota_day=? AND user_id=?",[period.day,userId]);
    return {eligible:true,available:!usage,remaining:usage?0:1,resetsAt:period.resetsAt,reason:usage?"used_today":"available"};
  } catch {
    console.error("H3 daily free status unavailable; no free quota was granted.");
    return unavailable("storage_unavailable");
  }
}

export type H3FreeTask = { id: string; userId: string; prompt: string; settings: Record<string,unknown>; mode: "video"; transport: "real" | "mock" };
// Task creation, identity ownership and daily usage commit together. No unpaid task on partial failure.
export async function createH3DailyFreeTask(task: H3FreeTask, context: H3FreeContext) {
  if (!context || task.transport!=="real") return {allowed:false,reason:"identity_or_provider_missing"};
  for (let attempt=0; ;attempt++) {
    try {
      return await withMysqlTransaction(async db=>{
        const [account]=await rows(db,"SELECT user_id FROM user_credit_accounts WHERE user_id=? FOR UPDATE",[task.userId]);
        if (!account) return {allowed:false,reason:"account_missing"};
        const record=await signup(db,task.userId);
        if (!record) return {allowed:false,reason:"signup_ineligible"};
        const keys=identities(context,record.reference_id);
        // Lock all identity rows in stable order across accounts and requests.
        for (const key of keys) {
          await db.execute("INSERT IGNORE INTO h3_daily_free_identities (identity_kind,identity_hash,owner_user_id) VALUES (?,?,?)",[key.kind,key.hash,task.userId]);
          const [owner]=await rows(db,"SELECT owner_user_id FROM h3_daily_free_identities WHERE identity_kind=? AND identity_hash=? FOR UPDATE",[key.kind,key.hash]);
          if (owner?.owner_user_id!==task.userId) throw new H3FreeDenied("shared_identity");
        }
        const period=h3DailyFreePeriod();
        const [used]=await rows(db,"SELECT task_id FROM h3_daily_free_usage WHERE quota_day=? AND user_id=? FOR UPDATE",[period.day,task.userId]);
        // Never resubmit an existing free task, including a retry after a network timeout.
        if (used) throw new H3FreeDenied("used_today");
        await db.execute("INSERT INTO generation_tasks (id,user_id,mode,provider,prompt,status,estimated_credits,transport,request_settings,created_at,updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))",[
          task.id,task.userId,task.mode,H3_DAILY_FREE_PROVIDER,task.prompt,task.transport,
          JSON.stringify({...task.settings,billing_source:"daily_free",free_units_used:1,free_program:H3_DAILY_FREE_PROGRAM})
        ]);
        await db.execute("INSERT INTO h3_daily_free_usage (quota_day,user_id,task_id) VALUES (?,?,?)",[period.day,task.userId,task.id]);
        return {allowed:true,reason:"reserved"};
      });
    } catch(error) {
      if (error instanceof H3FreeDenied) return {allowed:false,reason:error.message};
      if (attempt<2 && ["ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes((error as {code?:string}).code || "")) continue;
      throw error;
    }
  }
}
class H3FreeDenied extends Error {}
