import type Stripe from "stripe";
import { getSubscriptionPlanPrice } from "./billing";

export type UserSubscriptionRow = {
  id: number | string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
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

  await admin.from("user_subscriptions").upsert(row, { onConflict: "stripe_subscription_id" }).throwOnError();
  return row;
}

export async function listUserSubscriptions(admin: any, userId: string, limit = 10) {
  const { data, error } = await admin
    .from("user_subscriptions")
    .select(
      "id,user_id,stripe_customer_id,stripe_subscription_id,plan_id,cycle,credits_per_cycle,status,cancel_at_period_end,current_period_start,current_period_end,canceled_at,created_at,updated_at"
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
