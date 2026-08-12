import { NextResponse } from "next/server";
import { cancelPayPalSubscription } from "../../../../../lib/paypal";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { getManageableUserSubscription } from "../../../../../lib/subscriptions";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    const subscription = await getManageableUserSubscription(admin, user.id);
    if (!subscription?.provider_subscription_id || subscription.payment_provider !== "paypal") {
      return NextResponse.json({ error: "No cancellable PayPal subscription found." }, { status: 400 });
    }

    await cancelPayPalSubscription(subscription.provider_subscription_id, "Cancelled by the subscriber");
    await admin.from("user_subscriptions").update({
      status: "cancelled",
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("payment_provider", "paypal")
      .eq("provider_subscription_id", subscription.provider_subscription_id)
      .throwOnError();
    return NextResponse.json({ cancelled: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to cancel subscription." }, { status: 500 });
  }
}
