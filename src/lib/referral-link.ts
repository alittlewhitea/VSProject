import { cookies } from "next/headers";
import { mysqlExecute } from "./mysql";
import { referralConfigured, referralCodeValid, readReferralValue, REFERRAL_CODE_COOKIE, signReferralValue } from "./referral-policy";
import { referralDashboard, referralRegionAllowed } from "./referrals";

export async function acceptReferralCode(code: unknown, headers: Headers) {
  if(!referralConfigured() || !referralRegionAllowed(headers) || !referralCodeValid(code)) return false;
  const [owner]=await mysqlExecute<any[]>("SELECT user_id FROM referral_profiles WHERE code=?",[code]);
  if(!owner) return false;
  const data=await referralDashboard(owner.user_id);
  if(!data.enabled || !data.eligible || Number(data.usage.daily)>=data.settings.dailyLimit || Number(data.usage.monthly)>=data.settings.monthlyLimit) return false;
  const jar=await cookies();
  if(!readReferralValue(jar.get(REFERRAL_CODE_COOKIE)?.value)) {
    jar.set(REFERRAL_CODE_COOKIE,signReferralValue(code),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:30*86400});
  }
  return true;
}
