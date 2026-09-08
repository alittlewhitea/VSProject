import { NextResponse } from "next/server";
import { acceptReferralCode } from "../../../../lib/referral-link";
import { consumeRateLimit, trustedPublicOrigin } from "../../../../lib/request-security";
import { getRequestIp } from "../../../../lib/credits";

export async function POST(request: Request) {
  if(request.headers.get("origin")!==trustedPublicOrigin(request.url)) return NextResponse.json({ok:false},{status:403});
  const limit=await consumeRateLimit({scope:"referral_code",subject:getRequestIp(request.headers)||"unknown",limit:15,windowSeconds:60});
  if(!limit.allowed) return NextResponse.json({ok:false},{status:429});
  try {
    const body=await request.json();
    const ok=await acceptReferralCode(body.code,request.headers);
    return NextResponse.json({ok},{status:ok?200:400});
  } catch { return NextResponse.json({ok:false},{status:503}); }
}
