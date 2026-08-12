import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { syncPayPalSubscription } from "../../../../../lib/subscriptions";

type SyncBody = {
  subscriptionId?: string;
  planId?: string;
  cycle?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });

    const body = (await request.json().catch(() => null)) as SyncBody | null;
    const subscriptionId = body?.subscriptionId?.trim();
    if (!subscriptionId || !/^I-[A-Z0-9]+$/i.test(subscriptionId)) {
      return NextResponse.json({ error: "Invalid PayPal subscription ID." }, { status: 400 });
    }

    const result = await syncPayPalSubscription(admin, subscriptionId, user.id);
    if (
      (body?.planId && body.planId !== result.configured.plan.id) ||
      (body?.cycle && body.cycle !== result.configured.cycle)
    ) {
      return NextResponse.json(
        { error: "PayPal has not confirmed the requested subscription change yet.", code: "subscription_change_not_confirmed" },
        { status: 409 }
      );
    }
    return NextResponse.json({
      synced: true,
      provider: "paypal",
      planId: result.configured.plan.id,
      cycle: result.configured.cycle,
      status: result.subscription.status.toLowerCase()
    });
  } catch (error) {
    console.error("Unable to sync PayPal subscription change.", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return NextResponse.json({ error: "Unable to confirm the PayPal subscription change." }, { status: 500 });
  }
}
