import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { PoolConnection } from "mysql2/promise";
import { mysqlExecute, toMysqlDate, withMysqlTransaction } from "./mysql";
import { signupBonusCreditsForCountry, SIGNUP_BONUS_CREDITS } from "./credits";
import { excludedReferralIp, isDisposableEmail, newReferralDevice, readReferralValue, referralCodeValid, referralConfigured, referralHash, referralQuotaPeriod, REFERRAL_CODE_COOKIE, REFERRAL_DEVICE_COOKIE, signReferralValue } from "./referral-policy";

type Db = PoolConnection;
export type ReferralSettings = { enabled: number; inviter_credits: number; invitee_credits: number; daily_limit: number; monthly_limit: number; daily_budget: number; launched_at: string };
export type Referral = { id: string; inviter_id: string; invitee_id: string; status: string; reason: string | null; inviter_credits: number; invitee_credits: number; bound_at: string; expires_at: string; due_at: string | null; quota_day: string | null; review_approved: number };
async function rows<T = any>(db: Db, sql: string, args: any[] = []): Promise<T[]> { return (await db.execute(sql, args))[0] as T[]; }
export async function referralTransaction<T>(fn: (db: Db, settings: ReferralSettings) => Promise<T>) {
  return withMysqlTransaction(async db => {
    // All referral writes serialize on this row, including quota, devices and admin decisions.
    const [settings] = await rows<ReferralSettings>(db, "SELECT * FROM referral_settings WHERE id=1 FOR UPDATE");
    if (!settings) throw new Error("Referral migration is required.");
    return fn(db, settings);
  });
}
const utc = (s: string) => new Date(s.replace(" ", "T").replace(/Z$/, "") + "Z").getTime();
export async function referralAudit(db: Db, id: string | null, actor: string, action: string, note = "") {
  await db.execute("INSERT INTO referral_audit (referral_id,actor,action,note,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP(6))", [id,actor,action,note.slice(0,1000)]);
}
async function profile(db: Db, userId: string) {
  await db.execute("INSERT IGNORE INTO referral_profiles (user_id,code,created_at) VALUES (?,?,UTC_TIMESTAMP(6))", [userId,randomBytes(12).toString("hex")]);
  return (await rows(db,"SELECT p.*,u.email,u.created_at AS registered_at FROM referral_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?",[userId]))[0];
}
async function cookieDevice() {
  const jar = await cookies();
  let device = readReferralValue(jar.get(REFERRAL_DEVICE_COOKIE)?.value);
  if (!device || !/^[a-f0-9]{64}$/.test(device)) {
    device = newReferralDevice();
    jar.set(REFERRAL_DEVICE_COOKIE,signReferralValue(device),{httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",path:"/",maxAge:365*86400});
  }
  return referralHash("device",device);
}
export function referralRegionAllowed(headers: Headers) {
  const country = headers.get(process.env.REFERRAL_COUNTRY_HEADER || "cf-ipcountry")?.trim().toUpperCase();
  return Boolean(country && /^[A-Z]{2}$/.test(country) && country !== "XX" && signupBonusCreditsForCountry(country) === SIGNUP_BONUS_CREDITS);
}
async function excluded(headers: Headers, _userId?: string) {
  const ip = headers.get(process.env.REFERRAL_IP_HEADER || "")?.trim() || null;
  if (excludedReferralIp(ip)) return true;
  return !referralRegionAllowed(headers);
}
function clientSignal(headers: Headers) {
  const ip=headers.get(process.env.REFERRAL_IP_HEADER||"");
  const agent=headers.get("user-agent");
  return ip && agent ? referralHash("client",`${ip}|${agent.slice(0,512)}|${(headers.get("accept-language")||"").slice(0,128)}`) : null;
}
async function observe(db: Db, userId: string, device: string, clientHash?: string | null) {
  if(clientHash) await db.execute("INSERT INTO referral_client_signals (client_hash,user_id,last_seen_at) VALUES (?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE last_seen_at=UTC_TIMESTAMP(6)",[clientHash,userId]);
  await db.execute("INSERT IGNORE INTO referral_devices (device_hash) VALUES (?)",[device]);
  await db.execute("INSERT INTO referral_device_users (device_hash,user_id,last_seen_at) VALUES (?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE last_seen_at=UTC_TIMESTAMP(6)",[device,userId]);
  const [count] = await rows(db,"SELECT COUNT(*) AS n FROM referral_device_users WHERE device_hash=? AND last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 24 HOUR)",[device]);
  if (Number(count.n)>2) await db.execute("UPDATE referral_devices SET blocked_until=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 24 HOUR) WHERE device_hash=?",[device]);
}

// Captured before authentication and keyed to the OTP / OAuth nonce, not a caller-supplied user ID.
export async function captureReferralAuth(authKey: string, headers: Headers) {
  if (!referralConfigured()) return;
  try {
    const device = await cookieDevice();
    const code = readReferralValue((await cookies()).get(REFERRAL_CODE_COOKIE)?.value);
    await mysqlExecute("INSERT INTO referral_auth_contexts (auth_key,code,device_hash,client_hash,ip_excluded,expires_at) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 15 MINUTE))",[referralHash("auth",authKey),referralCodeValid(code)?code:null,device,clientSignal(headers),await excluded(headers)]);
  } catch { console.error("Referral auth context unavailable; authentication remains available."); }
}
export async function completeReferralAuth(user: {id:string;email:string|null}, isNew: boolean, verified: boolean, authKey: string, headers: Headers) {
  if (!referralConfigured()) return;
  try {
    const device = await cookieDevice();
    const ipExcluded = await excluded(headers,user.id);
    await referralTransaction(async (db,settings) => {
      await profile(db,user.id);
      if (verified && user.email) await db.execute("UPDATE referral_profiles SET email_verified=? WHERE user_id=?",[user.email.toLowerCase(),user.id]);
      const [context] = await rows(db,"SELECT * FROM referral_auth_contexts WHERE auth_key=? AND expires_at>UTC_TIMESTAMP(6)",[referralHash("auth",authKey)]);
      await db.execute("DELETE FROM referral_auth_contexts WHERE auth_key=?",[referralHash("auth",authKey)]);
      await observe(db,user.id,device,clientSignal(headers));
      if (context) await observe(db,user.id,context.device_hash,context.client_hash);
      if (ipExcluded || context?.ip_excluded) await db.execute("UPDATE referral_profiles SET ip_excluded=1 WHERE user_id=?",[user.id]);
      // Login to an old account can never bind or replace an inviter.
      if (!isNew || !settings.enabled || !context?.code) return;
      const invitee = await profile(db,user.id);
      if (utc(invitee.registered_at)<utc(settings.launched_at)) return;
      const [inviter] = await rows(db,"SELECT user_id FROM referral_profiles WHERE code=?",[context.code]);
      if (!inviter || inviter.user_id===user.id) return;
      const id=randomUUID();
      await db.execute("INSERT IGNORE INTO referrals (id,inviter_id,invitee_id,inviter_credits,invitee_credits,bound_at,expires_at,checked_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(6),DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 7 DAY),UTC_TIMESTAMP(6))",[id,inviter.user_id,user.id,settings.inviter_credits,settings.invitee_credits]);
      await referralAudit(db,id,"system","bound");
    });
    (await cookies()).delete(REFERRAL_CODE_COOKIE);
  } catch { console.error("Referral registration processing failed; reward requires review. Authentication remains available."); }
}

export async function observeReferralUser(userId: string, headers: Headers) {
  if (!referralConfigured()) return;
  const device=await cookieDevice();
  const ipExcluded=await excluded(headers,userId);
  await referralTransaction(async db => {
    await profile(db,userId);
    await observe(db,userId,device,clientSignal(headers));
    if (ipExcluded) await db.execute("UPDATE referral_profiles SET ip_excluded=1 WHERE user_id=?",[userId]);
  });
}

async function effectiveGeneration(db: Db, userId: string, from?: string, until?: string) {
  const result=await rows(db,`SELECT g.id FROM generation_tasks g WHERE g.user_id=? AND g.status='completed' AND g.transport='real'
    AND g.output_url IS NOT NULL AND g.output_url<>''
    ${from ? "AND g.created_at>=?" : ""} ${until ? "AND g.updated_at<=?" : ""}
    AND EXISTS (SELECT 1 FROM credit_ledger l WHERE l.user_id=g.user_id AND l.reference_id=g.id AND l.reason='generation_task' AND l.amount<0)
    AND NOT EXISTS (SELECT 1 FROM credit_ledger l WHERE l.user_id=g.user_id AND l.reference_id=g.id AND l.amount>0 AND l.reason LIKE '%refund%') LIMIT 1`,[userId,...(from?[from]:[]),...(until?[until]:[])]);
  return result.length>0;
}
async function risk(db: Db, r: Referral) {
  const people=await rows(db,"SELECT p.*,u.email FROM referral_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id IN (?,?)",[r.inviter_id,r.invitee_id]);
  if (people.length!==2) return "review:missing_profile";
  if (people.some(p=>p.blocked || p.ip_excluded)) return "reject:excluded";
  if (people.some(p=>!p.email || isDisposableEmail(p.email))) return "reject:disposable_email";
  if (people.some(p=>!p.email_verified || p.email_verified.toLowerCase()!==p.email.toLowerCase())) return "wait:email";
  const [shared]=await rows(db,"SELECT a.device_hash FROM referral_device_users a JOIN referral_device_users b ON a.device_hash=b.device_hash WHERE a.user_id=? AND b.user_id=? LIMIT 1",[r.inviter_id,r.invitee_id]);
  if (shared) return "reject:same_device";
  const [used]=await rows(db,"SELECT c.referral_id FROM referral_device_claims c JOIN referral_device_users d ON d.device_hash=c.device_hash WHERE d.user_id=? AND c.referral_id<>? LIMIT 1",[r.invitee_id,r.id]);
  if (used) return "reject:device_reward_used";
  const devices=await rows(db,"SELECT DISTINCT user_id FROM referral_device_users WHERE user_id IN (?,?)",[r.inviter_id,r.invitee_id]);
  if (devices.length!==2) return "review:missing_device";
  const [burst]=await rows(db,"SELECT d.device_hash FROM referral_devices d JOIN referral_device_users u ON u.device_hash=d.device_hash WHERE u.user_id IN (?,?) AND d.blocked_until>UTC_TIMESTAMP(6) LIMIT 1",[r.inviter_id,r.invitee_id]);
  if (burst && !r.review_approved) return "review:device_burst";
  // Same network/browser is weak evidence, never a hard same-device denial.
  if(!r.review_approved) {
    const [similar]=await rows(db,"SELECT a.client_hash FROM referral_client_signals a JOIN referral_client_signals b ON a.client_hash=b.client_hash WHERE a.user_id=? AND b.user_id=? LIMIT 1",[r.inviter_id,r.invitee_id]);
    if(similar) return "review:similar_client";
    const [velocity]=await rows(db,"SELECT s.client_hash FROM referral_client_signals s JOIN referral_client_signals all_users ON all_users.client_hash=s.client_hash WHERE s.user_id IN (?,?) AND all_users.last_seen_at>DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 24 HOUR) GROUP BY s.client_hash HAVING COUNT(DISTINCT all_users.user_id)>2 LIMIT 1",[r.inviter_id,r.invitee_id]);
    if(velocity) return "review:client_burst";
  }
  return null;
}
async function setStatus(db: Db, r: Referral, status: string, reason: string) {
  await db.execute("UPDATE referrals SET status=?,reason=?,checked_at=UTC_TIMESTAMP(6) WHERE id=?",[status,reason,r.id]);
  if(status!==r.status || reason!==r.reason) await referralAudit(db,r.id,"system",status,reason);
}
export async function processReferral(db: Db, settings: ReferralSettings, r: Referral) {
  if (!settings.enabled || !["waiting","pending"].includes(r.status)) return;
  await db.execute("UPDATE referrals SET checked_at=UTC_TIMESTAMP(6) WHERE id=?",[r.id]);
  const issue=await risk(db,r);
  if(issue) {
    const [action,reason]=issue.split(":");
    if(action==="reject") return setStatus(db,r,"rejected",reason);
    if(action==="review") return setStatus(db,r,"review",reason);
    if(Date.now()>utc(r.expires_at) && !r.quota_day) return setStatus(db,r,"rejected","expired");
    return;
  }
  const [inviterGenerated,inviteeGenerated]=await Promise.all([
    effectiveGeneration(db,r.inviter_id),effectiveGeneration(db,r.invitee_id,r.bound_at,r.quota_day?undefined:r.expires_at)
  ]);
  if(!inviterGenerated || !inviteeGenerated) {
    if(Date.now()>utc(r.expires_at) && !r.quota_day) return setStatus(db,r,"rejected","expired");
    if(r.status==="pending") return setStatus(db,r,"review","generation_no_longer_valid");
    return;
  }
  if(!r.quota_day) {
    const {day,month}=referralQuotaPeriod();
    const [usage]=await rows(db,"SELECT COALESCE(SUM(quota_day=?),0) AS daily,COUNT(*) AS monthly FROM referrals WHERE inviter_id=? AND quota_month=? AND status IN ('pending','review','paid')",[day,r.inviter_id,month]);
    const [budget]=await rows(db,"SELECT COALESCE(SUM(inviter_credits+invitee_credits),0) AS total FROM referrals WHERE quota_day=? AND status IN ('pending','review','paid')",[day]);
    if(Number(usage.daily)>=settings.daily_limit || Number(usage.monthly)>=settings.monthly_limit) return setStatus(db,r,"rejected","quota_exceeded");
    if(Number(budget.total)+r.inviter_credits+r.invitee_credits>settings.daily_budget) return setStatus(db,r,"rejected","campaign_budget");
    await db.execute("UPDATE referrals SET status='pending',reason=NULL,eligible_at=UTC_TIMESTAMP(6),due_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL ? SECOND),quota_day=?,quota_month=? WHERE id=?",[randomInt(600,1801),day,month,r.id]);
    await referralAudit(db,r.id,"system","reserved");
    return;
  }
  if(!r.due_at || utc(r.due_at)>Date.now()) return;
  const devices=await rows(db,"SELECT device_hash FROM referral_device_users WHERE user_id=?",[r.invitee_id]);
  for(const d of devices) await db.execute("INSERT INTO referral_device_claims (device_hash,referral_id,created_at) VALUES (?,?,UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE device_hash=VALUES(device_hash)",[d.device_hash,r.id]);
  // Both balances, both ledger entries and the reward status commit together.
  for(const [userId,amount,role] of [[r.inviter_id,r.inviter_credits,"inviter"],[r.invitee_id,r.invitee_credits,"invitee"]] as const) {
    await db.execute("INSERT INTO user_credit_accounts (user_id,balance,free_granted,created_at,updated_at) VALUES (?,0,0,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)",[userId]);
    const [grant]=await db.execute<any>("INSERT IGNORE INTO credit_ledger (user_id,amount,reason,reference_id,created_at) VALUES (?,?,'referral_reward',?,UTC_TIMESTAMP(6))",[userId,amount,`${r.id}:${role}`]);
    if(grant.affectedRows===1) await db.execute("UPDATE user_credit_accounts SET balance=balance+?,updated_at=UTC_TIMESTAMP(6) WHERE user_id=?",[amount,userId]);
  }
  await db.execute("UPDATE referrals SET status='paid',reason=NULL,paid_at=UTC_TIMESTAMP(6) WHERE id=?",[r.id]);
  await referralAudit(db,r.id,"system","paid");
}
export async function processReferrals(limit=50) {
  if(!referralConfigured()) return {processed:0,failed:0,disabled:true};
  const candidates=await mysqlExecute<Referral[]>("SELECT * FROM referrals WHERE status IN ('waiting','pending') ORDER BY checked_at LIMIT ?",[limit]);
  const result={processed:0,failed:0,disabled:false};
  for(const candidate of candidates) {
    try {
      await referralTransaction(async(db,settings)=>{
        const [r]=await rows<Referral>(db,"SELECT * FROM referrals WHERE id=? FOR UPDATE",[candidate.id]);
        if(r) await processReferral(db,settings,r);
      });
      result.processed++;
    } catch { result.failed++; console.error("Referral processing failed",candidate.id); }
  }
  await mysqlExecute("DELETE FROM referral_auth_contexts WHERE expires_at<UTC_TIMESTAMP(6) LIMIT 500");
  return result;
}
export async function referralDashboard(userId: string) {
  return referralTransaction(async(db,settings)=>{
    const p=await profile(db,userId);
    const {day,month}=referralQuotaPeriod();
    const [usage]=await rows(db,"SELECT COALESCE(SUM(quota_day=? AND status IN ('pending','review','paid')),0) AS daily,COALESCE(SUM(quota_month=? AND status IN ('pending','review','paid')),0) AS monthly,COALESCE(SUM(IF(status='paid',inviter_credits,0)),0) AS earned,COALESCE(SUM(IF(status IN ('pending','review') AND quota_day IS NOT NULL,inviter_credits,0)),0) AS pending FROM referrals WHERE inviter_id=?",[day,month,userId]);
    const history=await rows(db,"SELECT id,status,bound_at,paid_at,inviter_credits FROM referrals WHERE inviter_id=? ORDER BY bound_at DESC LIMIT 50",[userId]);
    const [incoming]=await rows(db,"SELECT status,invitee_credits,bound_at FROM referrals WHERE invitee_id=?",[userId]);
    return {enabled:Boolean(settings.enabled),code:p.code,verified:Boolean(p.email_verified && p.email_verified===p.email?.toLowerCase()),eligible:!p.blocked && !p.ip_excluded && Boolean(p.email) && !isDisposableEmail(p.email||""),generated:await effectiveGeneration(db,userId),settings:{inviterCredits:settings.inviter_credits,inviteeCredits:settings.invitee_credits,dailyLimit:settings.daily_limit,monthlyLimit:settings.monthly_limit},usage,history,incoming:incoming||null};
  });
}
