import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { getH3DailyFreeStatus, h3FreeContext } from "../../../../lib/h3-daily-free";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user=await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const status=await getH3DailyFreeStatus(user.id,await h3FreeContext(request.headers));
    return NextResponse.json(status,{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({eligible:false,available:false,remaining:0,reason:"identity_unavailable"},{headers:{"Cache-Control":"private, no-store"}});
  }
}
