import { randomUUID } from "node:crypto";
import { getCreditPack } from "./billing";
import { mysqlExecute } from "./mysql";
import { createPayPalOrder, paypalApprovalUrl } from "./paypal";

// Keep the same purchase shape and return URL used by the existing capture,
// webhook and reconciliation handlers. Subscription creation is not restored.
export async function createPayPalCreditCheckout(userId: string, packId: string, origin: string) {
  const pack = getCreditPack(packId);
  if (!pack) throw new Error("Invalid credit pack.");
  const order = await createPayPalOrder({
    referenceId: randomUUID(), description: `${pack.name} - ${pack.credits} credits`,
    amountCents: pack.amountCents, currency: "usd",
    returnUrl: `${origin}/billing?checkout=paypal_return`,
    cancelUrl: `${origin}/billing?checkout=cancelled`
  });
  const url = paypalApprovalUrl(order);
  if (!url) throw new Error("PayPal did not return an approval URL.");
  await mysqlExecute(
    "INSERT INTO credit_purchases (user_id,payment_provider,provider_order_id,provider_transaction_id,provider_capture_id,stripe_checkout_id,pack_id,credits,amount_cents,currency,status,created_at,updated_at) VALUES (?,'paypal',?,?,NULL,NULL,?,?,?,'usd','created',NOW(6),NOW(6))",
    [userId, order.id, order.id, pack.id, pack.credits, pack.amountCents]
  );
  return { url, provider: "paypal" as const };
}
