import { NextResponse } from "next/server";
import { paypalWalletConfiguration } from "../../../../../lib/paypal";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(paypalWalletConfiguration(),{headers:{"Cache-Control":"no-store"}});
}
