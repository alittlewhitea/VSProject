import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Payment } from "dodopayments/resources/payments";
import { dodoEnvironment, getDodoClient } from "./dodo";
import { mysqlExecute, withMysqlTransaction } from "./mysql";

export const DODO_CHECKOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CheckoutRow = RowDataPacket & {
  checkout_id: string; purchase_id: number; session_id: string | null; product_id: string; environment: string;
  user_id: string; credits: number; amount_cents: number; currency: string; status: string; provider_transaction_id: string | null;
};
type WebhookContext = { id: string; type: string };
export type DodoPaymentResult = { completed: boolean; status: string; duplicate?: boolean; ignored?: boolean };

export function dodoPaymentMismatch(payment: Payment, row: CheckoutRow) {
  if (payment.metadata?.checkout_reference !== row.checkout_id) return "Checkout reference mismatch.";
  if (!payment.checkout_session_id || (row.session_id && payment.checkout_session_id !== row.session_id)) return "Checkout session mismatch.";
  if (row.environment !== dodoEnvironment()) return "Payment environment mismatch.";
  if (row.provider_transaction_id && row.provider_transaction_id !== payment.payment_id) return "A different payment is already bound to this order.";
  if (payment.subscription_id || payment.subscription_ids?.length || payment.is_update_payment_method) return "Subscription payment cannot buy a credit pack.";
  if (payment.currency !== "USD" || row.currency !== "usd") return "Payment currency mismatch.";
  const cart = payment.product_cart;
  if (!cart || cart.length !== 1 || cart[0].product_id !== row.product_id || cart[0].quantity !== 1) return "Payment product or quantity mismatch.";
  const tax = payment.tax ?? 0;
  if (!Number.isSafeInteger(payment.total_amount) || !Number.isSafeInteger(tax) || tax < 0 ||
    payment.total_amount - tax !== Number(row.amount_cents)) return "Payment amount does not match the tax-exclusive order price.";
  return null;
}
async function eventProcessed(conn: PoolConnection, event?: WebhookContext) {
  if (event) await conn.execute("INSERT IGNORE INTO payment_webhook_events (payment_provider,event_id,event_type,processed_at) VALUES ('dodo',?,?,NOW(6))", [event.id, event.type]);
}
async function reviewPayment(conn: PoolConnection, payment: Payment, row: CheckoutRow, reason: string, event?: WebhookContext) {
  await conn.execute("INSERT INTO payment_incidents (payment_provider,event_id,event_type,user_id,purchase_id,provider_transaction_id,amount_cents,currency,status,reason,created_at,updated_at) VALUES ('dodo',?,?,?,?,?,?,?,'review_required',?,NOW(6),NOW(6)) ON DUPLICATE KEY UPDATE event_id=VALUES(event_id)",
    [event?.id || `payment:${payment.payment_id}:review`, event?.type || "payment.review", row.user_id, row.purchase_id, payment.payment_id, payment.total_amount, payment.currency.toLowerCase(), reason]);
  await conn.execute("UPDATE credit_purchases SET status='review_required',updated_at=NOW(6) WHERE id=?", [row.purchase_id]);
  await eventProcessed(conn, event);
  return { completed: false, status: "review_required" };
}

// Webhooks and authenticated return-page recovery share this atomic operation.
// Never call the development credit fallback or trust a browser-supplied status.
export async function applyDodoPayment(payment: Payment, event?: WebhookContext): Promise<DodoPaymentResult> {
  const reference = payment.metadata?.checkout_reference;
  if (typeof reference !== "string" || !DODO_CHECKOUT_ID.test(reference)) return { completed: false, status: "ignored", ignored: true };
  return withMysqlTransaction(async conn => {
    const [rows] = await conn.execute<CheckoutRow[]>(
      "SELECT d.*,p.user_id,p.credits,p.amount_cents,p.currency,p.status,p.provider_transaction_id FROM dodo_credit_checkouts d JOIN credit_purchases p ON p.id=d.purchase_id WHERE d.checkout_id=? AND p.payment_provider='dodo' FOR UPDATE", [reference]);
    const row = rows[0];
    if (!row) throw new Error("Dodo local checkout is not available yet.");
    const mismatch = dodoPaymentMismatch(payment, row);
    if (mismatch) return reviewPayment(conn, payment, row, mismatch, event);
    if (payment.refund_status || payment.refunds?.some(refund => refund.status === "succeeded") || payment.disputes?.length ||
      event?.type.startsWith("refund.") || event?.type.startsWith("dispute.")) {
      return reviewPayment(conn, payment, row, "Dodo refund or dispute requires review of consumed credits before a manual adjustment.", event);
    }
    if (row.status === "review_required") { await eventProcessed(conn, event); return { completed: false, status: row.status }; }
    if (row.status === "completed") { await eventProcessed(conn, event); return { completed: true, status: "completed", duplicate: true }; }
    if (payment.status !== "succeeded") {
      if (event?.type === "payment.succeeded" && !["failed", "cancelled"].includes(payment.status || "")) throw new Error("Payment success is not readable yet.");
      if (["failed", "cancelled"].includes(payment.status || "")) await conn.execute("UPDATE credit_purchases SET status=?,updated_at=NOW(6) WHERE id=?", [payment.status!, row.purchase_id]);
      await eventProcessed(conn, event);
      return { completed: false, status: payment.status || "processing" };
    }
    // Serialize balance changes with generation charges through the same account
    // lock used by apply_credit_ledger_once. Order, ledger and receipt commit once.
    await conn.execute("INSERT INTO user_credit_accounts (user_id,balance,free_granted,created_at,updated_at) VALUES (?,0,0,NOW(6),NOW(6)) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)", [row.user_id]);
    await conn.execute("SELECT balance FROM user_credit_accounts WHERE user_id=? FOR UPDATE", [row.user_id]);
    const ledgerReference = `dodo:payment:${payment.payment_id}`;
    const [ledger] = await conn.execute<RowDataPacket[]>("SELECT id FROM credit_ledger WHERE user_id=? AND reason='payment_purchase' AND reference_id=? LIMIT 1", [row.user_id, ledgerReference]);
    if (!ledger.length) {
      await conn.execute("INSERT INTO credit_ledger (user_id,amount,reason,reference_id,created_at) VALUES (?,?,'payment_purchase',?,NOW(6))", [row.user_id, row.credits, ledgerReference]);
      await conn.execute("UPDATE user_credit_accounts SET balance=balance+?,updated_at=NOW(6) WHERE user_id=?", [row.credits, row.user_id]);
    }
    await conn.execute("UPDATE dodo_credit_checkouts SET session_id=?,paid_total_cents=?,paid_tax_cents=?,updated_at=NOW(6) WHERE checkout_id=?", [payment.checkout_session_id!, payment.total_amount, payment.tax ?? 0, reference]);
    await conn.execute("UPDATE credit_purchases SET provider_transaction_id=?,provider_capture_id=?,status='completed',updated_at=NOW(6) WHERE id=?", [payment.payment_id, payment.payment_id, row.purchase_id]);
    await eventProcessed(conn, event);
    return { completed: true, status: "completed", duplicate: ledger.length > 0 };
  });
}

export async function syncDodoCheckout(userId: string, checkoutId: string): Promise<DodoPaymentResult | null> {
  const rows = await mysqlExecute<RowDataPacket[]>("SELECT d.session_id,d.environment,p.status FROM dodo_credit_checkouts d JOIN credit_purchases p ON p.id=d.purchase_id WHERE d.checkout_id=? AND p.user_id=? AND p.payment_provider='dodo' LIMIT 1", [checkoutId, userId]);
  if (!rows.length) return null;
  const row = rows[0];
  if (row.environment !== dodoEnvironment()) throw new Error("Checkout environment mismatch.");
  if (row.status === "completed") return { completed: true, status: "completed", duplicate: true };
  if (!row.session_id) return { completed: false, status: "processing" };
  const client = getDodoClient();
  const session = await client.checkoutSessions.retrieve(row.session_id);
  if (!session.payment_id) return { completed: false, status: session.payment_status || "processing" };
  const payment = await client.payments.retrieve(session.payment_id);
  if (payment.metadata?.checkout_reference !== checkoutId || payment.checkout_session_id !== row.session_id) throw new Error("Dodo payment does not belong to this checkout.");
  return applyDodoPayment(payment);
}

export async function processDodoWebhook(event: { type: string; data: unknown }, eventId: string) {
  if (!event.type.startsWith("payment.") && !event.type.startsWith("refund.") && !event.type.startsWith("dispute.")) return { ignored: true };
  const paymentId = (event.data as { payment_id?: unknown })?.payment_id;
  if (typeof paymentId !== "string" || !/^pay_[A-Za-z0-9_-]{1,200}$/.test(paymentId)) throw new Error("Webhook payment identifier is invalid.");
  // Retrieve the current canonical payment, including product, currency, tax and
  // metadata, so late/partial notifications cannot change order attribution.
  return applyDodoPayment(await getDodoClient().payments.retrieve(paymentId), { id: eventId, type: event.type });
}
