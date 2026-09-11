import { NextResponse } from "next/server";
import { cronAuthorized } from "../../../../lib/cron-auth";
import { reconcileKyrenPayments } from "../../../../lib/kyrenpay-billing";

export const maxDuration = 300;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await reconcileKyrenPayments();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    console.error("KyrenPay reconciliation failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, error: "KyrenPay reconciliation failed." }, { status: 500 });
  }
}
