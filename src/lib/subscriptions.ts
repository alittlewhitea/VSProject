import type Stripe from "stripe";
import { getSubscriptionPlanPrice } from "./billing";
import type { PayPalSubscription } from "./paypal";

export type UserSubscriptionRow = {
  id: number | string;
  user_id: string;
  payment_provider: "stripe" | "paypal";
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string;
  cycle: string;
  credits_per_cycle: number;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

function epochToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function subscriptionField(subscription: Stripe.Subscription, key: string) {
  return (subscription as unknown as Record<string, unknown>)[key];
}

export function subscriptionMetadata(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId || "";
  const planId = subscription.metadata?.planId || "";
  const cycle = subscription.metadata?.cycle || "";
  const plan = getSubscriptionPlanPrice(planId, cycle);

  if (!userId || !plan) {
    return null;
  }

  return { userId, planId, cycle, credits: plan.price.credits, plan };
}

export async function upsertUserSubscription(admin: any, subscription: Stripe.Subscription) {
  const metadata = subscriptionMetadata(subscription);
  if (!metadata) {
    throw new Error("Stripe subscription metadata is missing credit details.");
  }

  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer && typeof subscription.customer === "object" && "id" in subscription.customer
        ? String(subscription.customer.id)
        : null;

  const row = {
    user_id: metadata.userId,
    payment_provider: "stripe",
    provider_customer_id: customer,
    provider_subscription_id: subscription.id,
    stripe_customer_id: customer,
    stripe_subscription_id: subscription.id,
    plan_id: metadata.planId,
    cycle: metadata.cycle,
    credits_per_cycle: metadata.credits,
    status: subscription.status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_start: epochToIso(subscriptionField(subscription, "current_period_start")),
    current_period_end: epochToIso(subscriptionField(subscription, "current_period_end")),
    canceled_at: epochToIso(subscriptionField(subscription, "canceled_at")),
    updated_at: new Date().toISOString()
  };

  await admin.from("user_subscriptions").upsert(row, { onConflict: "payment_provider,provider_subscription_id" }).throwOnError();
  return row;
}

export async function upsertPayPalSubscription(
  admin: any,
  subscription: PayPalSubscription,
  metadata: { userId: string; planId: string; cycle: string; credits: number }
) {
  const status = subscription.status.toLowerCase();
  const row = {
    user_id: metadata.userId,
    payment_provider: "paypal",
    provider_customer_id: subscription.subscriber?.payer_id || null,
    provider_subscription_id: subscription.id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    plan_id: metadata.planId,
    cycle: metadata.cycle,
    credits_per_cycle: metadata.credits,
    status,
    cancel_at_period_end: status === "cancelled" || status === "expired",
    current_period_start: subscription.billing_info?.last_payment?.time || subscription.start_time || null,
    current_period_end: subscription.billing_info?.next_billing_time || null,
    canceled_at: status === "cancelled" ? subscription.status_update_time || new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  await admin.from("user_subscriptions").upsert(row, { onConflict: "payment_provider,provider_subscription_id" }).throwOnError();
  return row;
}

export async function listUserSubscriptions(admin: any, userId: string, limit = 10) {
  const { data, error } = await admin
    .from("user_subscriptions")
    .select(
      "id,user_id,payment_provider,provider_customer_id,provider_subscription_id,stripe_customer_id,stripe_subscription_id,plan_id,cycle,credits_per_cycle,status,cancel_at_period_end,current_period_start,current_period_end,canceled_at,created_at,updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as UserSubscriptionRow[];
}

export async function getLatestUserSubscription(admin: any, userId: string) {
  const subscriptions = await listUserSubscriptions(admin, userId, 1);
  return subscriptions[0] || null;
}

const MANAGEABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "approved",
  "approval_pending",
  "suspended"
]);

export async function getManageableUserSubscription(admin: any, userId: string) {
  const subscriptions = await listUserSubscriptions(admin, userId, 20);
  return subscriptions.find((subscription) => MANAGEABLE_SUBSCRIPTION_STATUSES.has(subscription.status.toLowerCase())) || null;
}
