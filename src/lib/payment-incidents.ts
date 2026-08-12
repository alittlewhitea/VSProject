export type PaymentIncidentStatus = "review_required" | "resolved" | "ignored";

export async function recordPaymentIncident(admin: any, input: {
  eventId: string;
  eventType: string;
  userId?: string | null;
  purchaseId?: number | string | null;
  providerTransactionId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  reason: string;
}) {
  await admin.from("payment_incidents").upsert({
    payment_provider: "paypal",
    event_id: input.eventId,
    event_type: input.eventType,
    user_id: input.userId || null,
    purchase_id: input.purchaseId || null,
    provider_transaction_id: input.providerTransactionId || null,
    amount_cents: input.amountCents ?? null,
    currency: input.currency?.toLowerCase() || null,
    status: "review_required",
    reason: input.reason.slice(0, 500),
    updated_at: new Date().toISOString()
  }, { onConflict: "payment_provider,event_id", ignoreDuplicates: true }).throwOnError();
}
