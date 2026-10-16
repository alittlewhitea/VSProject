import { NextResponse } from "next/server";
import { capturePayPalOrder, getPayPalOrder } from "../../../../../lib/paypal";
import { addCredits } from "../../../../../lib/credits";
import { getUserFromBearerToken } from "../../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { consumeRateLimit } from "../../../../../lib/request-security";

function moneyToCents(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

type PurchaseRow = {
  id: number | string;
  user_id: string;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  provider_capture_id: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: string };
    if (!orderId || !/^[A-Z0-9-]{6,64}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid PayPal order id." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Credit storage is not configured." }, { status: 500 });
    const { data: purchase, error } = await admin.from("credit_purchases")
      .select("id,user_id,pack_id,credits,amount_cents,currency,status,provider_capture_id")
      .eq("user_id", user.id)
      .eq("payment_provider", "paypal")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!purchase) return NextResponse.json({ error: "PayPal order not found." }, { status: 404 });
    const purchaseRow = purchase as PurchaseRow;
    if (!["created", "processing", "completed"].includes(purchaseRow.status)) {
      return NextResponse.json({ error: "This order cannot be captured." }, { status: 409 });
    }
    const receipt = (captureId: string) => ({ completed: true, orderId, transactionId: captureId,
      packId: purchaseRow.pack_id, credits: Number(purchaseRow.credits), amountCents: Number(purchaseRow.amount_cents), currency: String(purchaseRow.currency).toUpperCase() });

    if (purchaseRow.status === "completed" && purchaseRow.provider_capture_id) {
      await addCredits(
        admin,
        user.id,
        Number(purchaseRow.credits),
        "payment_purchase",
        `paypal:capture:${purchaseRow.provider_capture_id}`
      );
      return NextResponse.json({ ...receipt(purchaseRow.provider_capture_id), duplicate: true });
    }

    const rate = await consumeRateLimit({ scope: "paypal_capture", subject: user.id, limit: 20, windowSeconds: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Please wait before confirming payment again." }, { status: 429 });

    let order;
    try {
      const approved = await getPayPalOrder(orderId);
      const unit = approved.purchase_units?.[0];
      if (approved.purchase_units?.length !== 1 || moneyToCents(unit?.amount?.value) !== Number(purchaseRow.amount_cents) ||
          unit?.amount?.currency_code?.toLowerCase() !== String(purchaseRow.currency).toLowerCase()) {
        return NextResponse.json({ error: "PayPal order amount does not match the purchase." }, { status: 400 });
      }
      if (!["APPROVED", "COMPLETED"].includes(approved.status)) return NextResponse.json({ error: "Payment authorization is not complete." }, { status: 409 });
      const authentication = approved.payment_source?.google_pay?.card?.authentication_result;
      if (authentication?.liability_shift === "UNKNOWN" ||
          (authentication?.three_d_secure?.enrollment_status === "Y" && !["POSSIBLE", "YES"].includes(authentication.liability_shift || ""))) {
        return NextResponse.json({ error: "Payment authentication was not successful." }, { status: 409 });
      }
      order = approved.status === "COMPLETED" ? approved : await capturePayPalOrder(orderId);
    } catch (captureError) {
      const existingOrder = await getPayPalOrder(orderId);
      if (existingOrder.status !== "COMPLETED") throw captureError;
      order = existingOrder;
    }
    const capture = order.purchase_units?.flatMap((unit) => unit.payments?.captures || [])[0];
    if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id) {
      return NextResponse.json({ error: "PayPal payment has not completed." }, { status: 409 });
    }
    if (
      moneyToCents(capture.amount?.value) !== Number(purchaseRow.amount_cents) ||
      capture.amount?.currency_code?.toLowerCase() !== String(purchaseRow.currency).toLowerCase()
    ) {
      return NextResponse.json({ error: "PayPal payment amount does not match the order." }, { status: 400 });
    }

    await addCredits(admin, user.id, Number(purchaseRow.credits), "payment_purchase", `paypal:capture:${capture.id}`);
    await admin.from("credit_purchases").update({
      provider_capture_id: capture.id,
      status: "completed",
      updated_at: new Date().toISOString()
    }).eq("id", purchaseRow.id).throwOnError();
    return NextResponse.json(receipt(capture.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to capture PayPal order." }, { status: 500 });
  }
}
