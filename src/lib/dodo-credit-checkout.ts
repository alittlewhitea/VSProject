import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2/promise";
import { getCreditPack } from "./billing";
import { dodoEnvironment, dodoProductId, getDodoClient, validateDodoProduct } from "./dodo";
import { mysqlExecute, withMysqlTransaction } from "./mysql";

export async function createDodoCreditCheckout(user: { id: string; email: string | null }, packId: string, origin: string) {
  const pack = getCreditPack(packId), productId = dodoProductId(packId);
  if (!pack || !productId) throw new Error("Dodo credit pack is not configured.");
  const client = getDodoClient();
  const product = await client.products.retrieve(productId);
  validateDodoProduct(product, pack);
  const checkoutId = randomUUID();
  // Persist the immutable credit/price/product snapshot BEFORE exposing a payment
  // link. A very early webhook can then always find its local order.
  await withMysqlTransaction(async conn => {
    const [purchase] = await conn.execute<ResultSetHeader>(
      "INSERT INTO credit_purchases (user_id,payment_provider,provider_order_id,provider_transaction_id,pack_id,credits,amount_cents,currency,status,created_at,updated_at) VALUES (?,'dodo',?,NULL,?,?,?,'usd','created',NOW(6),NOW(6))",
      [user.id, checkoutId, pack.id, pack.credits, pack.amountCents]);
    await conn.execute("INSERT INTO dodo_credit_checkouts (checkout_id,purchase_id,product_id,environment,created_at,updated_at) VALUES (?,?,?,?,NOW(6),NOW(6))",
      [checkoutId, purchase.insertId, productId, dodoEnvironment()]);
  });
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    ...(user.email ? { customer: { email: user.email } } : {}),
    billing_currency: "USD",
    feature_flags: { allow_currency_selection: false, allow_discount_code: false },
    metadata: { checkout_reference: checkoutId },
    return_url: `${origin}/billing?checkout=dodo_return&provider=dodo&checkout_id=${checkoutId}`,
    cancel_url: `${origin}/billing?checkout=cancelled&provider=dodo`
  }, { idempotencyKey: `dreamface-credit-${checkoutId}` });
  if (!session.checkout_url) throw new Error("Dodo did not return a checkout URL.");
  const url = new URL(session.checkout_url);
  if (url.protocol !== "https:" || !(url.hostname === "checkout.dodopayments.com" || url.hostname === "test.checkout.dodopayments.com")) {
    throw new Error("Unexpected Dodo checkout host.");
  }
  // A webhook may already have bound the same session; never overwrite it.
  await mysqlExecute("UPDATE dodo_credit_checkouts SET session_id=?,updated_at=NOW(6) WHERE checkout_id=? AND (session_id IS NULL OR session_id=?)", [session.session_id, checkoutId, session.session_id]);
  return { url: session.checkout_url, provider: "dodo" as const };
}
