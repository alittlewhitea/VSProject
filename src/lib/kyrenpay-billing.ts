import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { getCreditPack } from "./billing";
import { mysqlExecute, withMysqlTransaction } from "./mysql";
import { getKyrenCheckout, getKyrenOrder, kyrenCheckoutUrl, kyrenProductId, kyrenRequest, moneyCents, type KyrenCheckout, type KyrenOrder } from "./kyrenpay";

type Snapshot = RowDataPacket & {
  reference_id: string; user_id: string; pack_id: string; product_id: string; credits: number;
  amount_cents: number; currency: string; checkout_id: string | null; order_id: string | null; status: string;
};
export function validateKyrenOrder(order: KyrenOrder, row: Pick<Snapshot, "reference_id" | "user_id" | "pack_id" | "product_id" | "amount_cents" | "currency" | "checkout_id" | "order_id">) {
  if (!order || !/^[a-zA-Z0-9_-]{1,128}$/.test(order.id || "") || !/^[a-zA-Z0-9_-]{1,128}$/.test(order.checkoutSessionId || "") ||
      order.productId !== row.product_id || moneyCents(order.amount) !== Number(row.amount_cents) || order.currency?.toUpperCase() !== row.currency.toUpperCase() ||
      order.metadata?.referenceId !== row.reference_id || order.metadata?.userId !== row.user_id || order.metadata?.packId !== row.pack_id ||
      (row.checkout_id && order.checkoutSessionId !== row.checkout_id) || (row.order_id && order.id !== row.order_id)) {
    throw new Error("KyrenPay order verification failed.");
  }
}
export async function createKyrenCreditCheckout(userId: string, packId: string, origin: string) {
  const pack = getCreditPack(packId);
  if (!pack) throw new Error("Invalid credit pack.");
  const productId = kyrenProductId(pack.id);
  const product = await kyrenRequest<{ id: string; price: string; currency: string; status: string }>(`/products/${encodeURIComponent(productId)}`);
  if (product.id !== productId || product.status !== "ACTIVE" || moneyCents(product.price) !== pack.amountCents || product.currency?.toUpperCase() !== "USD") {
    throw new Error("KyrenPay product must be active and match this pack's USD price.");
  }
  const referenceId = randomUUID();
  // Snapshot BEFORE the external request. Webhooks can race the HTTP response.
  await mysqlExecute("INSERT INTO kyren_checkouts (reference_id,user_id,pack_id,product_id,credits,amount_cents,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,'USD',NOW(6),NOW(6))", [referenceId,userId,pack.id,productId,pack.credits,pack.amountCents]);
  const checkout = await kyrenRequest<KyrenCheckout>("/checkouts", {
    productId, successUrl: `${origin}/billing?checkout=kyren_return&reference=${referenceId}`,
    cancelUrl: `${origin}/billing?checkout=cancelled`, displayMerchantName: "Dreamface",
    metadata: { referenceId, userId, packId: pack.id }
  });
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(checkout.id || "") || checkout.productId !== productId || moneyCents(checkout.amount) !== pack.amountCents || checkout.currency?.toUpperCase() !== "USD") {
    throw new Error("KyrenPay checkout does not match the requested pack.");
  }
  const url = kyrenCheckoutUrl(checkout.url);
  await mysqlExecute("UPDATE kyren_checkouts SET checkout_id=?,status=IF(status='creating','pending',status),updated_at=NOW(6) WHERE reference_id=? AND (checkout_id IS NULL OR checkout_id=?)", [checkout.id,referenceId,checkout.id]);
  return { url, provider: "kyrenpay" as const };
}

// Every entry point uses the same transaction: row lock + ledger + balance + purchase.
// Neither a browser success URL nor webhook amount/metadata is sufficient to grant credits.
export async function applyKyrenOrder(order: KyrenOrder, refundEventId?: string) {
  const reference = order.metadata?.referenceId;
  if (typeof reference !== "string") return { ignored: true, completed: false };
  return withMysqlTransaction(async (conn) => {
    const [rows] = await conn.execute<Snapshot[]>("SELECT * FROM kyren_checkouts WHERE reference_id=? FOR UPDATE", [reference]);
    const row = rows[0];
    if (!row) return { ignored: true, completed: false };
    validateKyrenOrder(order, row);
    const status = String(order.status).toUpperCase();
    const refund = Boolean(refundEventId) || status.includes("REFUND");
    if (refund) {
      await conn.execute("INSERT INTO payment_incidents (payment_provider,event_id,event_type,user_id,provider_transaction_id,amount_cents,currency,status,reason,created_at,updated_at) VALUES ('kyrenpay',?,'order.refunded',?,?,?,?,'review_required','Refund requires manual credit review; no automatic balance deduction.',NOW(6),NOW(6)) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)", [refundEventId || `refund:${order.id}`,row.user_id,order.id,row.amount_cents,row.currency]);
      await conn.execute("UPDATE kyren_checkouts SET status='refund_review',order_id=?,checkout_id=?,checked_at=NOW(6),updated_at=NOW(6) WHERE reference_id=?", [order.id,order.checkoutSessionId,reference]);
      await conn.execute("UPDATE credit_purchases SET status='refund_review',updated_at=NOW(6) WHERE payment_provider='kyrenpay' AND provider_transaction_id=?", [order.id]);
      return { completed: false, review: true };
    }
    if (row.status === "refund_review") return { completed: false, review: true };
    if (row.status === "completed") return { completed: true, duplicate: true, transactionId: order.id };
    if (status !== "PAID") {
      await conn.execute("UPDATE kyren_checkouts SET order_id=?,checkout_id=?,checked_at=NOW(6),updated_at=NOW(6) WHERE reference_id=?", [order.id,order.checkoutSessionId,reference]);
      if (["CLOSED", "FAILED", "EXPIRED", "CANCELLED"].includes(status)) {
        await conn.execute("UPDATE kyren_checkouts SET status='closed' WHERE reference_id=?", [reference]);
      }
      return { completed: false };
    }
    // Existing credit account creation and grant never award an extra signup bonus.
    await conn.execute("INSERT INTO user_credit_accounts (user_id,balance,free_granted,created_at,updated_at) VALUES (?,0,0,NOW(6),NOW(6)) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)", [row.user_id]);
    await conn.execute("SELECT user_id FROM user_credit_accounts WHERE user_id=? FOR UPDATE", [row.user_id]);
    await conn.execute("INSERT INTO credit_purchases (user_id,payment_provider,provider_order_id,provider_transaction_id,provider_capture_id,pack_id,credits,amount_cents,currency,status,created_at,updated_at) VALUES (?,'kyrenpay',?,?,?, ?,?,?,?,'completed',NOW(6),NOW(6))", [row.user_id,order.id,order.id,order.id,row.pack_id,row.credits,row.amount_cents,row.currency.toLowerCase()]);
    await conn.execute("INSERT INTO credit_ledger (user_id,amount,reason,reference_id,created_at) VALUES (?,?,'payment_purchase',?,NOW(6))", [row.user_id,row.credits,`kyrenpay:order:${order.id}`]);
    await conn.execute("UPDATE user_credit_accounts SET balance=balance+?,updated_at=NOW(6) WHERE user_id=?", [row.credits,row.user_id]);
    await conn.execute("UPDATE kyren_checkouts SET status='completed',order_id=?,checkout_id=?,checked_at=NOW(6),updated_at=NOW(6) WHERE reference_id=?", [order.id,order.checkoutSessionId,reference]);
    return { completed: true, transactionId: order.id };
  });
}
export async function syncKyrenReference(reference: string, userId?: string) {
  const rows = await mysqlExecute<Snapshot[]>(`SELECT * FROM kyren_checkouts WHERE reference_id=?${userId ? " AND user_id=?" : ""}`, userId ? [reference,userId] : [reference]);
  const row = rows[0];
  if (!row) return null;
  if (row.status === "refund_review") return { completed: false, review: true };
  if (row.status === "completed") return { completed: true, transactionId: row.order_id };
  if (!row.checkout_id) return { completed: false };
  await mysqlExecute("UPDATE kyren_checkouts SET checked_at=NOW(6) WHERE reference_id=?", [reference]);
  const checkout = await getKyrenCheckout(row.checkout_id);
  if (checkout.id !== row.checkout_id || checkout.productId !== row.product_id || moneyCents(checkout.amount) !== Number(row.amount_cents) || checkout.currency?.toUpperCase() !== row.currency) throw new Error("KyrenPay checkout verification failed.");
  if (!checkout.orderId) {
    // Leave a grace period for delayed gateway confirmation; a later signed paid
    // event can still fulfill this snapshot even after cron stops polling it.
    if (typeof checkout.expiresAt === "number" && checkout.expiresAt < Date.now() - 7 * 86400000) {
      await mysqlExecute("UPDATE kyren_checkouts SET status='expired' WHERE reference_id=? AND status='pending'", [reference]);
    }
    return { completed: false };
  }
  const order = await getKyrenOrder(checkout.orderId);
  if (order.id !== checkout.orderId) throw new Error("KyrenPay order identity mismatch.");
  validateKyrenOrder(order, row);
  return applyKyrenOrder(order);
}
export async function reconcileKyrenPayments() {
  const rows = await mysqlExecute<Snapshot[]>("SELECT * FROM kyren_checkouts WHERE status IN ('creating','pending') AND checkout_id IS NOT NULL ORDER BY COALESCE(checked_at,created_at) ASC LIMIT 20");
  let completed = 0; let failed = 0;
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      try { if ((await syncKyrenReference(row.reference_id))?.completed) completed++; }
      catch (error) {
        failed++;
        console.error("KyrenPay reconciliation failed for reference", row.reference_id, error instanceof Error ? error.message : "Unknown error");
      }
    }
  }));
  return { ok: failed === 0, processed: rows.length, completed, failed };
}
