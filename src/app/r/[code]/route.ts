import { NextResponse } from "next/server";
import { acceptReferralCode } from "../../../lib/referral-link";
import { trustedPublicOrigin, consumeRateLimit } from "../../../lib/request-security";
import { getRequestIp } from "../../../lib/credits";

export async function GET(request: Request,{params}:{params:Promise<{code:string}>}) {
  const url=new URL("/auth",trustedPublicOrigin(request.url));
  url.searchParams.set("next","/studio?view=referrals");
  try {
    const limit=await consumeRateLimit({scope:"referral_link",subject:getRequestIp(request.headers)||"unknown",limit:30,windowSeconds:60});
    const accepted=limit.allowed && await acceptReferralCode((await params).code,request.headers);
    url.searchParams.set("referral",accepted?"accepted":"unavailable");
  } catch { url.searchParams.set("referral","unavailable"); }
  const response=NextResponse.redirect(url);
  response.headers.set("Cache-Control","no-store");
  return response;
}
