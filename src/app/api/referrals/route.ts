import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { observeReferralUser, referralDashboard, referralRegionAllowed } from "../../../lib/referrals";
import { referralConfigured } from "../../../lib/referral-policy";
import { consumeRateLimit, trustedPublicOrigin } from "../../../lib/request-security";

export async function GET(request: Request) {
  const user=await getUserFromBearerToken(request.headers.get("authorization"));
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!referralConfigured() || !referralRegionAllowed(request.headers)) return NextResponse.json({enabled:false},{headers:{"Cache-Control":"no-store"}});
  try {
    const data=await referralDashboard(user.id);
    if(!data.eligible) return NextResponse.json({enabled:false},{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({...data,url:`${trustedPublicOrigin(request.url)}/r/${data.code}`},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({enabled:false,error:"Referral service is temporarily unavailable."},{status:503}); }
}
export async function POST(request: Request) {
  const user=await getUserFromBearerToken(request.headers.get("authorization"));
  if(!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!referralConfigured()) return NextResponse.json({enabled:false});
  const limit=await consumeRateLimit({scope:"referral_observe",subject:user.id,limit:12,windowSeconds:60});
  if(!limit.allowed) return NextResponse.json({error:"Too many requests"},{status:429});
  try { await observeReferralUser(user.id,request.headers); return NextResponse.json({ok:true}); }
  catch { return NextResponse.json({error:"Referral service is temporarily unavailable."},{status:503}); }
}
