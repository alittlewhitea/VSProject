import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { mysqlExecute } from "../../../../lib/mysql";
import { processReferrals, referralAudit, referralTransaction } from "../../../../lib/referrals";
import { referralConfigured } from "../../../../lib/referral-policy";

export async function GET(request: Request) {
  const admin=await getAdminUserFromRequest(request);
  if(!admin) return NextResponse.json({error:"Forbidden"},{status:403});
  try {
    const [settings]=await mysqlExecute<any[]>("SELECT * FROM referral_settings WHERE id=1");
    const records=await mysqlExecute<any[]>("SELECT r.*,a.email AS inviter_email,b.email AS invitee_email FROM referrals r JOIN users a ON a.id=r.inviter_id JOIN users b ON b.id=r.invitee_id ORDER BY r.bound_at DESC LIMIT 200");
    const audit=await mysqlExecute<any[]>("SELECT * FROM referral_audit ORDER BY id DESC LIMIT 100");
    const summary=await mysqlExecute<any[]>("SELECT status,COUNT(*) AS count FROM referrals GROUP BY status");
    return NextResponse.json({configured:referralConfigured(),settings,records,audit,summary},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"Referral migration is required or storage is unavailable."},{status:503}); }
}
export async function POST(request: Request) {
  const admin=await getAdminUserFromRequest(request);
  if(!admin) return NextResponse.json({error:"Forbidden"},{status:403});
  try {
    const body=await request.json();
    if(body.action==="process") return NextResponse.json(await processReferrals());
    if(typeof body.note!=="string" || body.note.trim().length<3 || body.note.length>1000) return NextResponse.json({error:"An audit note is required."},{status:400});
    await referralTransaction(async(db)=>{
      if(body.action==="settings") {
        const s=body.settings;
        if(!s || typeof s.enabled!=="boolean" || (s.enabled && !referralConfigured())) throw new Error("Check the referral environment configuration before enabling.");
        for(const [key,max] of [["inviter_credits",10000],["invitee_credits",10000],["daily_limit",100],["monthly_limit",1000],["daily_budget",1000000]] as const) {
          if(!Number.isInteger(s[key]) || s[key]<1 || s[key]>max) throw new Error(`Invalid ${key}`);
        }
        if(s.daily_limit>s.monthly_limit || s.daily_budget<s.inviter_credits+s.invitee_credits) throw new Error("Inconsistent reward limits.");
        await db.execute("UPDATE referral_settings SET enabled=?,inviter_credits=?,invitee_credits=?,daily_limit=?,monthly_limit=?,daily_budget=? WHERE id=1",[s.enabled,s.inviter_credits,s.invitee_credits,s.daily_limit,s.monthly_limit,s.daily_budget]);
        await referralAudit(db,null,admin.email||admin.id,"settings",`${body.note}: ${JSON.stringify(s)}`);
      } else if(["approve_review","reject"].includes(body.action)) {
        if(typeof body.id!=="string") throw new Error("Invalid referral ID.");
        const [records]=await db.execute<any[]>("SELECT * FROM referrals WHERE id=? FOR UPDATE",[body.id]);
        const r=records[0];
        if(!r || r.status==="paid" || r.status==="rejected") throw new Error("This reward is already final.");
        if(body.action==="approve_review") {
          if(r.status!=="review") throw new Error("Only review cases can be approved.");
          // Approval waives the device-burst hold only. Hard exclusions, caps and generations are rechecked.
          await db.execute("UPDATE referrals SET status=?,reason=NULL,review_approved=1,due_at=IF(quota_day IS NULL,NULL,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 10 MINUTE)),checked_at=UTC_TIMESTAMP(6) WHERE id=?",[r.quota_day?"pending":"waiting",r.id]);
        } else await db.execute("UPDATE referrals SET status='rejected',reason='admin_rejected',checked_at=UTC_TIMESTAMP(6) WHERE id=?",[r.id]);
        await referralAudit(db,r.id,admin.email||admin.id,body.action,body.note);
      } else if(body.action==="user_policy") {
        if(typeof body.userId!=="string" || typeof body.blocked!=="boolean" || typeof body.clearIpExclusion!=="boolean") throw new Error("Invalid user policy.");
        await db.execute("UPDATE referral_profiles SET blocked=?,ip_excluded=IF(?,0,ip_excluded) WHERE user_id=?",[body.blocked,body.clearIpExclusion,body.userId]);
        await referralAudit(db,null,admin.email||admin.id,"user_policy",`${body.userId}: ${body.note}; blocked=${body.blocked}; clearIp=${body.clearIpExclusion}`);
      } else throw new Error("Unknown action.");
    });
    return NextResponse.json({ok:true});
  } catch(error) { return NextResponse.json({error:error instanceof Error && !('code' in error)?error.message:"Referral operation failed."},{status:400}); }
}
