import { addCredits } from "./credits";
import { getSubscriptionPlanPrice } from "./billing";
import { getPayPalOrder, getPayPalSubscription, listPayPalSubscriptionTransactions } from "./paypal";
import { recordPaymentIncident } from "./payment-incidents";
import { upsertPayPalSubscription } from "./subscriptions";

type PendingPurchase = {
  id: number | string;
  user_id: string;
  provider_order_id: string | null;
  provider_capture_id: string | null;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
};

type PayPalSubscriptionRow = {
  user_id: string;
  provider_subscription_id: string | null;
  plan_id: string;
  cycle: string;
  credits_per_cycle: number;
  status: string;
};

function moneyToCents(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export async function reconcilePayPalBilling(admin: any, limit = 100) {
  const purchaseResult = await admin.from("credit_purchases")
    .select("id,user_id,provider_order_id,provider_capture_id,credits,amount_cents,currency,status")
    .eq("payment_provider", "paypal")
    .in("status", ["created", "pending", "payment_capture_pending"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (purchaseResult.error) throw purchaseResult.error;

  const subscriptionResult = await admin.from("user_subscriptions")
    .select("user_id,provider_subscription_id,plan_id,cycle,credits_per_cycle,status")
    .eq("payment_provider", "paypal")
    .in("status", ["approval_pending", "approved", "active", "suspended", "past_due"])
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (subscriptionResult.error) throw subscriptionResult.error;

  const summary = {
    purchasesScanned: 0,
    purchasesCompleted: 0,
    subscriptionsScanned: 0,
    subscriptionsUpdated: 0,
    subscriptionPaymentsCompleted: 0,
    errors: [] as Array<{ resource: string; error: string }>
  };

  for (const purchase of (purchaseResult.data || []) as PendingPurchase[]) {
    if (!purchase.provider_order_id) continue;
    summary.purchasesScanned += 1;
    try {
      const order = await getPayPalOrder(purchase.provider_order_id);
      const capture = order.purchase_units?.flatMap((unit) => unit.payments?.captures || [])[0];
      if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED") continue;
      const amountMatches = moneyToCents(capture.amount?.value) === Number(purchase.amount_cents);
      const currencyMatches = capture.amount?.currency_code?.toLowerCase() === String(purchase.currency).toLowerCase();
      if (!amountMatches || !currencyMatches) {
        await recordPaymentIncident(admin, {
          eventId: `reconcile-order-${order.id}-amount-mismatch`,
          eventType: "PAYPAL.RECONCILIATION.AMOUNT_MISMATCH",
          userId: purchase.user_id,
          purchaseId: purchase.id,
          providerTransactionId: capture.id,
          amountCents: moneyToCents(capture.amount?.value),
          currency: capture.amount?.currency_code,
          reason: "A completed PayPal order does not match the stored Dreamface amount or currency. Credits were not granted."
        });
        continue;
      }
      await addCredits(admin, purchase.user_id, Number(purchase.credits), "payment_purchase", `paypal:capture:${capture.id}`);
      await admin.from("credit_purchases").update({
        provider_capture_id: capture.id,
        status: "completed",
        updated_at: new Date().toISOString()
      }).eq("id", purchase.id).throwOnError();
      summary.purchasesCompleted += 1;
    } catch (error) {
      summary.errors.push({
        resource: `order:${purchase.provider_order_id.slice(-8)}`,
        error: error instanceof Error ? error.message : "Unknown PayPal reconciliation error"
      });
    }
  }

  for (const row of (subscriptionResult.data || []) as PayPalSubscriptionRow[]) {
    if (!row.provider_subscription_id) continue;
    summary.subscriptionsScanned += 1;
    try {
      const subscription = await getPayPalSubscription(row.provider_subscription_id);
      await upsertPayPalSubscription(admin, subscription, {
        userId: row.user_id,
        planId: row.plan_id,
        cycle: row.cycle,
        credits: Number(row.credits_per_cycle)
      });
      summary.subscriptionsUpdated += 1;

      const configured = getSubscriptionPlanPrice(row.plan_id, row.cycle);
      if (!configured || configured.price.credits !== Number(row.credits_per_cycle)) {
        throw new Error("Stored PayPal subscription no longer matches Dreamface billing configuration.");
      }
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
      const transactions = await listPayPalSubscriptionTransactions(
        row.provider_subscription_id,
        startTime.toISOString(),
        endTime.toISOString()
      );
      for (const transaction of transactions.filter((item) => item.status === "COMPLETED")) {
        const amount = transaction.amount_with_breakdown?.gross_amount;
        if (moneyToCents(amount?.value) !== configured.price.amountCents || amount?.currency_code?.toLowerCase() !== "usd") {
          await recordPaymentIncident(admin, {
            eventId: `reconcile-subscription-${transaction.id}-amount-mismatch`,
            eventType: "PAYPAL.RECONCILIATION.SUBSCRIPTION_AMOUNT_MISMATCH",
            userId: row.user_id,
            providerTransactionId: transaction.id,
            amountCents: moneyToCents(amount?.value),
            currency: amount?.currency_code,
            reason: "A completed PayPal subscription transaction does not match the configured plan. Credits were not granted."
          });
          continue;
        }
        await admin.from("credit_purchases").upsert({
          user_id: row.user_id,
          payment_provider: "paypal",
          provider_order_id: row.provider_subscription_id,
          provider_transaction_id: transaction.id,
          provider_capture_id: transaction.id,
          stripe_checkout_id: null,
          pack_id: `subscription:${configured.plan.id}:${configured.cycle}`,
          credits: configured.price.credits,
          amount_cents: configured.price.amountCents,
          currency: "usd",
          status: "processing",
          updated_at: new Date().toISOString()
        }, { onConflict: "payment_provider,provider_transaction_id" }).throwOnError();
        const before = await admin.from("credit_ledger")
          .select("id")
          .eq("user_id", row.user_id)
          .eq("reason", "payment_subscription")
          .eq("reference_id", `paypal:sale:${transaction.id}`)
          .maybeSingle();
        if (before.error) throw before.error;
        await addCredits(admin, row.user_id, configured.price.credits, "payment_subscription", `paypal:sale:${transaction.id}`);
        await admin.from("credit_purchases").update({
          status: "completed",
          updated_at: new Date().toISOString()
        }).eq("payment_provider", "paypal")
          .eq("provider_transaction_id", transaction.id)
          .throwOnError();
        if (!before.data) summary.subscriptionPaymentsCompleted += 1;
      }
    } catch (error) {
      summary.errors.push({
        resource: `subscription:${row.provider_subscription_id.slice(-8)}`,
        error: error instanceof Error ? error.message : "Unknown PayPal reconciliation error"
      });
    }
  }

  return summary;
}
