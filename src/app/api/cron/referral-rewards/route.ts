import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processReferrals } from "../../../../lib/referrals";

export async function GET(request: Request) {
  const secret=process.env.CRON_SECRET;
  const expected=Buffer.from(`Bearer ${secret||""}`);
  const actual=Buffer.from(request.headers.get("authorization")||"");
  if(!secret || actual.length!==expected.length || !timingSafeEqual(actual,expected)) return NextResponse.json({error:"Unauthorized"},{status:401});
  try { const result=await processReferrals(); return NextResponse.json({ok:result.failed===0,...result}); }
  catch { return NextResponse.json({error:"Referral processing unavailable."},{status:503}); }
}
