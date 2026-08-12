import { NextResponse } from "next/server";
import { addCredits } from "../../../../lib/credits";
import { getCreditPack, getSubscriptionPlanPrice } from "../../../../lib/billing";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStripe } from "../../../../lib/stripe";
import { subscriptionMetadata, upsertUserSubscription } from "../../../../lib/subscriptions";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid Stripe webhook signature."
      },
      { status: 400 }
    );
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }
    await upsertUserSubscription(admin, event.data.object);
    return NextResponse.json({ received: true, subscription_synced: true });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object;
    const invoiceRecord = invoice as unknown as Record<string, unknown>;
    if (invoice.billing_reason === "subscription_create") {
      return NextResponse.json({ received: true, skipped_initial_invoice: true });
    }

    const subscriptionValue = invoiceRecord.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue && typeof subscriptionValue === "object" && "id" in subscriptionValue
          ? String((subscriptionValue as { id: unknown }).id)
          : null;
    if (!subscriptionId) {
      return NextResponse.json({ received: true, skipped: "missing_subscription_id" });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscriptionMetadata(subscription);
    if (!metadata) {
      return NextResponse.json({ error: "Stripe subscription metadata is missing credit details." }, { status: 400 });
    }
    await upsertUserSubscription(admin, subscription);

    const referenceId = invoice.id;
    const subscriptionPackId = `subscription:${metadata.plan.plan.id}:${metadata.cycle}`;
    await admin
      .from("credit_purchases")
      .upsert(
        {
          user_id: metadata.userId,
          payment_provider: "stripe",
          provider_order_id: referenceId,
          provider_transaction_id: referenceId,
          provider_capture_id: typeof invoiceRecord.payment_intent === "string" ? invoiceRecord.payment_intent : null,
          stripe_checkout_id: referenceId,
          pack_id: subscriptionPackId,
          credits: metadata.credits,
          amount_cents: typeof invoice.amount_paid === "number" ? invoice.amount_paid : metadata.plan.price.amountCents,
          currency: invoice.currency || "usd",
          status: "completed",
          updated_at: new Date().toISOString()
        },
        { onConflict: "payment_provider,provider_transaction_id" }
      )
      .throwOnError();

    const { data: existingLedger, error: ledgerError } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("reference_id", referenceId)
      .maybeSingle();

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }
    if (existingLedger) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await addCredits(admin, metadata.userId, metadata.credits, "stripe_subscription", referenceId);
    return NextResponse.json({ received: true, subscription_invoice: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const userId = session.metadata?.userId;
  const checkoutType = session.metadata?.checkoutType;
  const packId = session.metadata?.packId || "unknown";
  const planId = session.metadata?.planId || "";
  const cycle = session.metadata?.cycle || "";
  const credits = Number(session.metadata?.credits || 0);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, payment_status: session.payment_status });
  }

  if (!userId || !Number.isInteger(credits) || credits <= 0) {
    return NextResponse.json({ error: "Stripe session metadata is missing credit details." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
  }

  if (checkoutType === "subscription") {
    const subscription = getSubscriptionPlanPrice(planId, cycle);
    if (!subscription) {
      return NextResponse.json({ error: "Stripe session references an unknown subscription plan." }, { status: 400 });
    }
    if (credits !== subscription.price.credits) {
      return NextResponse.json({ error: "Stripe session credit metadata does not match the configured subscription plan." }, { status: 400 });
    }

    if (typeof session.subscription === "string") {
      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
      await upsertUserSubscription(admin, stripeSubscription);
    }

    const subscriptionPackId = `subscription:${subscription.plan.id}:${subscription.cycle}`;
    await admin
      .from("credit_purchases")
      .upsert(
        {
          user_id: userId,
          payment_provider: "stripe",
          provider_order_id: session.id,
          provider_transaction_id: session.id,
          provider_capture_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          stripe_checkout_id: session.id,
          pack_id: subscriptionPackId,
          credits,
          amount_cents: typeof session.amount_total === "number" ? session.amount_total : subscription.price.amountCents,
          currency: session.currency || "usd",
          status: "completed",
          updated_at: new Date().toISOString()
        },
        { onConflict: "payment_provider,provider_transaction_id" }
      )
      .throwOnError();

    const { data: existingLedger, error: ledgerError } = await admin
      .from("credit_ledger")
      .select("id")
      .eq("reference_id", session.id)
      .maybeSingle();

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }
    if (existingLedger) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await addCredits(admin, userId, credits, "stripe_subscription", session.id);
    return NextResponse.json({ received: true, subscription: true });
  }

  const pack = getCreditPack(packId);
  if (!pack) {
    return NextResponse.json({ error: "Stripe session references an unknown credit pack." }, { status: 400 });
  }
  if (credits !== pack.credits) {
    return NextResponse.json({ error: "Stripe session credit metadata does not match the configured pack." }, { status: 400 });
  }

  const purchase = {
    user_id: userId,
    payment_provider: "stripe",
    provider_order_id: session.id,
    provider_transaction_id: session.id,
    provider_capture_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    stripe_checkout_id: session.id,
    pack_id: packId,
    credits,
    amount_cents: typeof session.amount_total === "number" ? session.amount_total : pack.amountCents,
    currency: session.currency || "usd",
    status: "completed",
    updated_at: new Date().toISOString()
  };

  await admin.from("credit_purchases").upsert(purchase, { onConflict: "payment_provider,provider_transaction_id" }).throwOnError();

  const { data: existingLedger, error: ledgerError } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("reference_id", session.id)
    .maybeSingle();

  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }
  if (existingLedger) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await addCredits(admin, userId, credits, "stripe_checkout", session.id);
  return NextResponse.json({ received: true });
}
