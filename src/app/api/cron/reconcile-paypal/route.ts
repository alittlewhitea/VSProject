import { NextResponse } from "next/server";
import { cronAuthorized } from "../../../../lib/cron-auth";
import { reconcilePayPalBilling } from "../../../../lib/paypal-reconciliation";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });

  try {
    const result = await reconcilePayPalBilling(admin);
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reconcile PayPal billing." },
      { status: 500 }
    );
  }
}
