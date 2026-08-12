import { NextResponse } from "next/server";
import { getSubscriptionPlanPrice } from "../../../../../lib/billing";
import { addCredits } from "../../../../../lib/credits";
import { getPayPalSubscription, verifyPayPalWebhook } from "../../../../../lib/paypal";
import { recordPaymentIncident } from "../../../../../lib/payment-incidents";
import { createSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { upsertPayPalSubscription } from "../../../../../lib/subscriptions";

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, any>;
};

function moneyToCents(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

async function syncSubscription(admin: any, subscriptionId: string) {
  const { data: existing, error } = await admin.from("user_subscriptions")
    .select("user_id,plan_id,cycle,credits_per_cycle")
    .eq("payment_provider", "paypal")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) throw new Error("PayPal subscription is not linked to a Dreamface account.");
  const subscription = await getPayPalSubscription(subscriptionId);
  await upsertPayPalSubscription(admin, subscription, {
    userId: existing.user_id,
    planId: existing.plan_id,
    cycle: existing.cycle,
    credits: Number(existing.credits_per_cycle)
  });
}

async function processCapture(admin: any, resource: Record<string, any>, eventType: string, eventId: string) {
  const relatedIds = resource.supplementary_data?.related_ids || {};
  const orderId = String(relatedIds.order_id || "") || null;
  const captureId = String(
    relatedIds.capture_id || (eventType === "PAYMENT.CAPTURE.REVERSED" ? resource.id : "") || ""
  ) || null;
  const isRefundOrReversal = eventType === "PAYMENT.CAPTURE.REFUNDED" || eventType === "PAYMENT.CAPTURE.REVERSED";

  let purchase: Record<string, any> | null = null;
  if (orderId) {
    const result = await admin.from("credit_purchases")
      .select("id,user_id,credits,amount_cents,currency,status,provider_capture_id")
      .eq("payment_provider", "paypal")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (result.error) throw result.error;
    purchase = result.data;
  }
  if (!purchase && captureId) {
    const result = await admin.from("credit_purchases")
      .select("id,user_id,credits,amount_cents,currency,status,provider_capture_id")
      .eq("payment_provider", "paypal")
      .eq("provider_capture_id", captureId)
      .maybeSingle();
    if (result.error) throw result.error;
    purchase = result.data;
  }
  if (!purchase) {
    if (isRefundOrReversal) {
      await recordPaymentIncident(admin, {
        eventId,
        eventType,
        providerTransactionId: captureId,
        amountCents: moneyToCents(resource.amount?.value),
        currency: resource.amount?.currency_code,
        reason: "A PayPal refund or reversal could not be matched to a Dreamface purchase. Review the transaction manually."
      });
      return;
    }
    throw new Error("PayPal capture does not match a Dreamface order.");
  }

  const eventStatus = eventType === "PAYMENT.CAPTURE.COMPLETED"
    ? "completed"
    : eventType.toLowerCase().replaceAll(".", "_");
  if (eventStatus === "completed") {
    if (
      moneyToCents(resource.amount?.value) !== Number(purchase.amount_cents) ||
      String(resource.amount?.currency_code || "").toLowerCase() !== String(purchase.currency).toLowerCase()
    ) {
      throw new Error("PayPal capture amount does not match the Dreamface order.");
    }
  }

  const nextStatus = purchase.status === "completed" && !isRefundOrReversal ? "completed" : eventStatus;
  if (eventStatus === "completed" && resource.id) {
    await addCredits(admin, purchase.user_id, Number(purchase.credits), "payment_purchase", `paypal:capture:${resource.id}`);
  }
  await admin.from("credit_purchases").update({
    provider_capture_id: eventStatus === "completed" ? resource.id || purchase.provider_capture_id : purchase.provider_capture_id,
    status: nextStatus,
    updated_at: new Date().toISOString()
  }).eq("id", purchase.id).throwOnError();
  if (isRefundOrReversal) {
    await recordPaymentIncident(admin, {
      eventId,
      eventType,
      userId: purchase.user_id,
      purchaseId: purchase.id,
      providerTransactionId: captureId || purchase.provider_capture_id,
      amountCents: moneyToCents(resource.amount?.value),
      currency: resource.amount?.currency_code,
      reason: "A completed PayPal credit purchase was refunded or reversed. Review consumed credits before applying a manual adjustment."
    });
  }
}

async function processSubscriptionPayment(admin: any, resource: Record<string, any>) {
  const subscriptionId = resource.billing_agreement_id;
  const transactionId = resource.id;
  if (!subscriptionId || !transactionId) throw new Error("PayPal subscription payment is missing identifiers.");
  const { data: subscription, error } = await admin.from("user_subscriptions")
    .select("user_id,plan_id,cycle,credits_per_cycle")
    .eq("payment_provider", "paypal")
    .eq("provider_subscription_id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!subscription) throw new Error("PayPal payment does not match a Dreamface subscription.");

  const configured = getSubscriptionPlanPrice(subscription.plan_id, subscription.cycle);
  if (!configured || configured.price.credits !== Number(subscription.credits_per_cycle)) {
    throw new Error("PayPal subscription configuration no longer matches the stored subscription.");
  }
  const amount = resource.amount || {};
  if (
    moneyToCents(amount.total ?? amount.value) !== configured.price.amountCents ||
    String(amount.currency ?? amount.currency_code ?? "").toLowerCase() !== "usd"
  ) {
    throw new Error("PayPal subscription payment amount does not match the configured plan.");
  }

  await admin.from("credit_purchases").upsert({
    user_id: subscription.user_id,
    payment_provider: "paypal",
    provider_order_id: subscriptionId,
    provider_transaction_id: transactionId,
    provider_capture_id: transactionId,
    stripe_checkout_id: null,
    pack_id: `subscription:${configured.plan.id}:${configured.cycle}`,
    credits: configured.price.credits,
    amount_cents: configured.price.amountCents,
    currency: "usd",
    status: "processing",
    updated_at: new Date().toISOString()
  }, { onConflict: "payment_provider,provider_transaction_id" }).throwOnError();
  await addCredits(
    admin,
    subscription.user_id,
    configured.price.credits,
    "payment_subscription",
    `paypal:sale:${transactionId}`
  );
  await admin.from("credit_purchases").update({
    status: "completed",
    updated_at: new Date().toISOString()
  }).eq("payment_provider", "paypal")
    .eq("provider_transaction_id", transactionId)
    .throwOnError();
  await syncSubscription(admin, subscriptionId);
}

async function processSubscriptionPaymentIncident(admin: any, resource: Record<string, any>, eventType: string, eventId: string) {
  const transactionId = String(resource.parent_payment || resource.sale_id || resource.id || "") || null;
  const subscriptionId = String(resource.billing_agreement_id || resource.supplementary_data?.related_ids?.billing_agreement_id || "") || null;
  let purchase: Record<string, any> | null = null;
  if (transactionId) {
    const result = await admin.from("credit_purchases")
      .select("id,user_id,provider_transaction_id")
      .eq("payment_provider", "paypal")
      .eq("provider_transaction_id", transactionId)
      .maybeSingle();
    if (result.error) throw result.error;
    purchase = result.data;
  }
  if (!purchase && subscriptionId) {
    const result = await admin.from("user_subscriptions")
      .select("user_id")
      .eq("payment_provider", "paypal")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) purchase = { user_id: result.data.user_id };
  }
  await recordPaymentIncident(admin, {
    eventId,
    eventType,
    userId: purchase?.user_id,
    purchaseId: purchase?.id,
    providerTransactionId: transactionId,
    amountCents: moneyToCents(resource.amount?.total ?? resource.amount?.value),
    currency: resource.amount?.currency ?? resource.amount?.currency_code,
    reason: "A PayPal subscription payment was refunded or reversed. Review the subscription cycle credits before applying a manual adjustment."
  });
}

async function processDispute(admin: any, resource: Record<string, any>, eventType: string, eventId: string) {
  const disputed = Array.isArray(resource.disputed_transactions) ? resource.disputed_transactions[0] : null;
  const transactionId = String(disputed?.seller_transaction_id || disputed?.buyer_transaction_id || "") || null;
  let purchase: Record<string, any> | null = null;
  if (transactionId) {
    const byCapture = await admin.from("credit_purchases")
      .select("id,user_id")
      .eq("payment_provider", "paypal")
      .eq("provider_capture_id", transactionId)
      .maybeSingle();
    if (byCapture.error) throw byCapture.error;
    purchase = byCapture.data;
    if (!purchase) {
      const byTransaction = await admin.from("credit_purchases")
        .select("id,user_id")
        .eq("payment_provider", "paypal")
        .eq("provider_transaction_id", transactionId)
        .maybeSingle();
      if (byTransaction.error) throw byTransaction.error;
      purchase = byTransaction.data;
    }
  }
  const disputedAmount = disputed?.seller_transaction_amount || resource.dispute_amount || {};
  await recordPaymentIncident(admin, {
    eventId,
    eventType,
    userId: purchase?.user_id,
    purchaseId: purchase?.id,
    providerTransactionId: transactionId,
    amountCents: moneyToCents(disputedAmount.value),
    currency: disputedAmount.currency_code,
    reason: `PayPal dispute status: ${String(resource.status || "unknown")}. Review the transaction and any granted credits manually.`
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event: PayPalEvent;
  try {
    event = JSON.parse(rawBody) as PayPalEvent;
  } catch {
    return NextResponse.json({ error: "Invalid PayPal webhook payload." }, { status: 400 });
  }

  try {
    if (!(await verifyPayPalWebhook(request.headers, rawBody))) {
      return NextResponse.json({ error: "Invalid PayPal webhook signature." }, { status: 400 });
    }
    if (!event.id || !event.event_type) {
      return NextResponse.json({ error: "PayPal webhook is missing event metadata." }, { status: 400 });
    }
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });

    const { data: processed, error: lookupError } = await admin.from("payment_webhook_events")
      .select("event_id")
      .eq("payment_provider", "paypal")
      .eq("event_id", event.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (processed) return NextResponse.json({ received: true, duplicate: true });

    const resource = event.resource || {};
    if (event.event_type.startsWith("PAYMENT.CAPTURE.")) {
      await processCapture(admin, resource, event.event_type, event.id);
    } else if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      await processSubscriptionPayment(admin, resource);
    } else if (event.event_type === "PAYMENT.SALE.REFUNDED" || event.event_type === "PAYMENT.SALE.REVERSED") {
      await processSubscriptionPaymentIncident(admin, resource, event.event_type, event.id);
    } else if (event.event_type.startsWith("CUSTOMER.DISPUTE.")) {
      await processDispute(admin, resource, event.event_type, event.id);
    } else if (event.event_type.startsWith("BILLING.SUBSCRIPTION.") && resource.id) {
      await syncSubscription(admin, String(resource.id));
    }

    await admin.from("payment_webhook_events").upsert({
      payment_provider: "paypal",
      event_id: event.id,
      event_type: event.event_type,
      processed_at: new Date().toISOString()
    }, { onConflict: "payment_provider,event_id", ignoreDuplicates: true }).throwOnError();
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process PayPal webhook." }, { status: 500 });
  }
}
