import { NextResponse } from "next/server";
import { addCredits } from "../../../../lib/credits";
import { getCreditPack } from "../../../../lib/billing";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStripe } from "../../../../lib/stripe";

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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const userId = session.metadata?.userId;
  const packId = session.metadata?.packId || "unknown";
  const credits = Number(session.metadata?.credits || 0);
  if (!userId || !Number.isInteger(credits) || credits <= 0) {
    return NextResponse.json({ error: "Stripe session metadata is missing credit details." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
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
    stripe_checkout_id: session.id,
    pack_id: packId,
    credits,
    amount_cents: typeof session.amount_total === "number" ? session.amount_total : pack.amountCents,
    currency: session.currency || "usd",
    status: "completed",
    updated_at: new Date().toISOString()
  };

  await admin.from("credit_purchases").upsert(purchase, { onConflict: "stripe_checkout_id" }).throwOnError();

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
