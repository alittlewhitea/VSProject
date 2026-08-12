import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCreditPack, getSubscriptionPlanPrice, isSubscriptionUpgrade } from "../../../../lib/billing";
import {
  createPayPalOrder,
  createPayPalSubscription,
  getPayPalSubscription,
  revisePayPalSubscription,
  paypalApprovalUrl
} from "../../../../lib/paypal";
import { getConfiguredSubscriptionForPayPalPlan, validatePayPalPlan } from "../../../../lib/paypal-billing";
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
      const existingSubscription = await getManageableUserSubscription(admin, user.id);
      if (existingSubscription) {
        if (existingSubscription.payment_provider !== "paypal" || !existingSubscription.provider_subscription_id) {
          return NextResponse.json(
            { error: "This subscription must be managed through its original payment provider.", code: "subscription_provider_change_unsupported" },
            { status: 409 }
          );
        }
        if (!["active", "suspended"].includes(existingSubscription.status.toLowerCase())) {
          return NextResponse.json(
            { error: "This PayPal subscription cannot be changed in its current state.", code: "subscription_change_unavailable" },
            { status: 409 }
          );
        }

        const paypalSubscription = await getPayPalSubscription(existingSubscription.provider_subscription_id);
        const current = getConfiguredSubscriptionForPayPalPlan(paypalSubscription.plan_id);
        if (!current) {
          return NextResponse.json(
            { error: "The current PayPal plan is not configured in Dreamface.", code: "subscription_change_unavailable" },
            { status: 409 }
          );
        }
        if (current.plan.id === subscription.plan.id && current.cycle === subscription.cycle) {
          return NextResponse.json(
            { error: "This is already your current subscription plan.", code: "subscription_plan_unchanged" },
            { status: 409 }
          );
        }
        if (!isSubscriptionUpgrade(current.plan.id, current.cycle, subscription.plan.id, subscription.cycle)) {
          return NextResponse.json(
            { error: "Only upgrades are currently supported. Contact support for downgrades.", code: "subscription_downgrade_unsupported" },
            { status: 409 }
          );
        }

        const currentValidation = await validatePayPalPlan(current.paypalPlanId, {
          amountCents: current.price.amountCents,
          currency: "usd",
          interval: current.price.interval
        });
        if (!currentValidation.valid) {
          return NextResponse.json(
            { error: currentValidation.error || "The current PayPal plan is unavailable.", code: "subscription_change_unavailable" },
            { status: 503 }
          );
        }
        if (!currentValidation.productId || currentValidation.productId !== planValidation.productId) {
          return NextResponse.json(
            { error: "PayPal upgrades require the current and target plans to belong to the same PayPal product.", code: "paypal_plan_product_mismatch" },
            { status: 409 }
          );
        }

        const reviseReturnUrl = `${origin}/billing?checkout=subscription_revise_success&provider=paypal&subscription_id=${encodeURIComponent(existingSubscription.provider_subscription_id)}&plan_id=${encodeURIComponent(subscription.plan.id)}&cycle=${encodeURIComponent(subscription.cycle)}`;
        const revisedSubscription = await revisePayPalSubscription({
          subscriptionId: existingSubscription.provider_subscription_id,
          planId: paypalPlanId,
          referenceId,
          returnUrl: reviseReturnUrl,
          cancelUrl: `${origin}/billing?checkout=cancelled`
        });
        const approvalUrl = paypalApprovalUrl(revisedSubscription) || reviseReturnUrl;
        return NextResponse.json({ url: approvalUrl, provider, action: "revise" });
      }

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
