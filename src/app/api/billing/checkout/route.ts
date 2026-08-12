import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCreditPack, getSubscriptionPlanPrice } from "../../../../lib/billing";
import {
  createPayPalOrder,
  createPayPalSubscription,
  paypalApprovalUrl
} from "../../../../lib/paypal";
import { validatePayPalPlan } from "../../../../lib/paypal-billing";
import { trustedPublicOrigin } from "../../../../lib/request-security";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getManageableUserSubscription, upsertPayPalSubscription } from "../../../../lib/subscriptions";

type CheckoutBody = {
  type?: "credits" | "subscription";
  packId?: string;
  planId?: string;
  cycle?: string;
};

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

    const body = (await request.json().catch(() => null)) as CheckoutBody | null;
    const origin = trustedPublicOrigin(request.url);
    const provider = "paypal" as const;

    if (body?.type === "subscription") {
      const subscription = body.planId && body.cycle ? getSubscriptionPlanPrice(body.planId, body.cycle) : null;
      if (!subscription) {
        return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
      }

      const existingSubscription = await getManageableUserSubscription(admin, user.id);
      if (existingSubscription) {
        return NextResponse.json({ error: "You already have an active or pending subscription." }, { status: 409 });
      }

      const paypalPlanId = process.env[subscription.price.paypalPlanEnv]?.trim();
      const planValidation = await validatePayPalPlan(paypalPlanId, {
        amountCents: subscription.price.amountCents,
        currency: "usd",
        interval: subscription.price.interval
      });
      if (!planValidation.valid || !paypalPlanId) {
        return NextResponse.json({ error: planValidation.error || "PayPal subscription plan is not configured yet." }, { status: 503 });
      }

      const referenceId = randomUUID();
      const paypalSubscription = await createPayPalSubscription({
        planId: paypalPlanId,
        referenceId,
        returnUrl: `${origin}/billing?checkout=subscription_success&provider=paypal`,
        cancelUrl: `${origin}/billing?checkout=cancelled`
      });
      const approvalUrl = paypalApprovalUrl(paypalSubscription);
      if (!approvalUrl) throw new Error("PayPal did not return a subscription approval URL.");

      await upsertPayPalSubscription(admin, paypalSubscription, {
        userId: user.id,
        planId: subscription.plan.id,
        cycle: subscription.cycle,
        credits: subscription.price.credits
      });
      return NextResponse.json({ url: approvalUrl, provider });
    }

    const pack = body?.packId ? getCreditPack(body.packId) : null;
    if (!pack) {
      return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 });
    }

    const referenceId = randomUUID();
    const order = await createPayPalOrder({
      referenceId,
      description: `${pack.name} - ${pack.credits.toLocaleString()} credits`,
      amountCents: pack.amountCents,
      currency: "usd",
      returnUrl: `${origin}/billing?checkout=paypal_return`,
      cancelUrl: `${origin}/billing?checkout=cancelled`
    });
    const approvalUrl = paypalApprovalUrl(order);
    if (!approvalUrl) throw new Error("PayPal did not return an order approval URL.");

    await admin.from("credit_purchases").upsert({
      user_id: user.id,
      payment_provider: "paypal",
      provider_order_id: order.id,
      provider_transaction_id: order.id,
      provider_capture_id: null,
      stripe_checkout_id: null,
      pack_id: pack.id,
      credits: pack.credits,
      amount_cents: pack.amountCents,
      currency: "usd",
      status: "created",
      updated_at: new Date().toISOString()
    }, { onConflict: "payment_provider,provider_transaction_id" }).throwOnError();

    return NextResponse.json({ url: approvalUrl, provider });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 }
    );
  }
}
