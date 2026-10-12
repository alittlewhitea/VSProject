import { NextResponse } from "next/server";
import { getDodoClient } from "../../../../../lib/dodo";
import { processDodoWebhook } from "../../../../../lib/dodo-credit-payments";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim()) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const headers = Object.fromEntries(["webhook-id", "webhook-signature", "webhook-timestamp"].map(key => [key, request.headers.get(key) || ""]));
  if (!headers["webhook-id"] || headers["webhook-id"].length > 255) return NextResponse.json({ error: "Invalid webhook headers." }, { status: 401 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Missing webhook payload." }, { status: 400 });
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 1_000_000) { await reader.cancel(); return NextResponse.json({ error: "Payload too large." }, { status: 413 }); }
    chunks.push(value);
  }
  let event;
  try { event = getDodoClient().webhooks.unwrap(Buffer.concat(chunks).toString("utf8"), { headers }); }
  catch { return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 }); }
  try {
    await processDodoWebhook(event, headers["webhook-id"]);
    return NextResponse.json({ received: true });
  } catch {
    // Non-2xx causes Dodo to retry. Do not acknowledge before the SQL commit.
    console.error("Dodo webhook processing failed", { eventId: headers["webhook-id"], type: event.type });
    return NextResponse.json({ error: "Unable to process webhook." }, { status: 500 });
  }
}
