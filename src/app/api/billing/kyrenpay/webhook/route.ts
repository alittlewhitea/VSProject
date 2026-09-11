import { NextResponse } from "next/server";
import { verifyKyrenSignature, getKyrenOrder } from "../../../../../lib/kyrenpay";
import { applyKyrenOrder } from "../../../../../lib/kyrenpay-billing";
import { mysqlExecute } from "../../../../../lib/mysql";

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65536) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    if (!verifyKyrenSignature(raw, request.headers)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    const event = JSON.parse(raw);
    if (typeof event.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.id) || typeof event.type !== "string") return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    if (!["order.paid", "order.refunded", "order.closed"].includes(event.type)) return NextResponse.json({ ok: true, ignored: true });
    const orderId = event.data?.order_id;
    if (typeof orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    const order = await getKyrenOrder(orderId);
    if (order.id !== orderId) throw new Error("Order identity mismatch.");
    const result = await applyKyrenOrder(order, event.type === "order.refunded" ? event.id : undefined);
    // A pending API read after a paid event must retry, not acknowledge fulfillment.
    if (event.type === "order.paid" && !result.completed && !("ignored" in result) && !("review" in result)) throw new Error("Payment confirmation not yet available.");
    await mysqlExecute("INSERT INTO payment_webhook_events (payment_provider,event_id,event_type,processed_at) VALUES ('kyrenpay',?,?,NOW(6)) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)", [event.id,event.type]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("KyrenPay webhook processing failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed; please retry." }, { status: 500 });
  }
}
