import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStripe } from "../../../../lib/stripe";
import { getLatestUserSubscription } from "../../../../lib/subscriptions";
import { trustedPublicOrigin } from "../../../../lib/request-security";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }

    const subscription = await getLatestUserSubscription(admin, user.id);
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe subscription customer found for this account." }, { status: 400 });
    }

    const origin = trustedPublicOrigin(request.url);
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/billing`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing portal." },
      { status: 500 }
    );
  }
}
