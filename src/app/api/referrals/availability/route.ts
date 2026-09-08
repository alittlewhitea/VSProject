import { NextResponse } from "next/server";
import { referralConfigured } from "../../../../lib/referral-policy";
import { referralRegionAllowed } from "../../../../lib/referrals";
import { mysqlExecute } from "../../../../lib/mysql";

export async function GET(request: Request) {
  let visible = false;
  if (referralConfigured() && referralRegionAllowed(request.headers)) {
    try {
      const [settings] = await mysqlExecute<Array<{enabled:number}>>("SELECT enabled FROM referral_settings WHERE id=1");
      visible = Boolean(settings?.enabled);
    } catch { /* Hide unavailable campaigns without breaking registration. */ }
  }
  return NextResponse.json({visible},{headers:{"Cache-Control":"no-store"}});
}
