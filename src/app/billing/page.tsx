"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";
import { CREDIT_LOW_BALANCE_THRESHOLD, MODEL_PRICING_ROWS } from "../../lib/model-pricing";
import { CreditPackGrid } from "../../components/credit-pack-grid";
import { TopNav } from "../../components/top-nav";
import { trackEvent, trackPurchaseEvent } from "../../lib/analytics";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";

type LedgerEntry = {
  id: number | string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type PurchaseEntry = {
  id: number | string;
  payment_provider: "stripe" | "paypal" | "kyrenpay";
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  provider_capture_id: string | null;
  stripe_checkout_id: string | null;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "cancelled" | "failed";
  created_at: string;
  updated_at: string;
};

type SubscriptionEntry = {
  id: number | string;
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

type PricingGuideRow = {
  provider: string;
  label: string;
  workflow: string;
  falBasis: string;
  typicalCredits: number;
  unitNote: string;
  source?: "live" | "fallback";
  liveUnitPriceUsd?: number | null;
  unit?: string | null;
  currency?: string;
  checkedAt?: string;
};

type TranslationFunction = ReturnType<typeof useTranslations>;
const cycleLabels: Record<BillingCycle, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

function creditPackName(packId: string) {
  return CREDIT_PACKS.find((pack) => pack.id === packId)?.name || packId;
}

function subscriptionFromPackId(packId: string) {
  if (!packId.startsWith("subscription:")) return null;
  const [, planId, rawCycle] = packId.split(":");
  const cycle = rawCycle as BillingCycle;
  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
  const price = plan?.prices[cycle];
  if (!plan || !price) return null;
  return { plan, cycle, price };
}

function purchaseReference(purchase: PurchaseEntry) {
  return purchase.provider_transaction_id || purchase.provider_order_id || purchase.stripe_checkout_id || String(purchase.id);
}

function formatReason(reason: string, t: TranslationFunction) {
  if (["referral_reward", "signup_bonus", "stripe_checkout", "stripe_subscription", "generation_task", "generation_refund", "manual_top_up_dev"].includes(reason)) {
    return t(`billing.reason.${reason}`);
  }
  return reason.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStatus(status: string, t: TranslationFunction) {
  if (["pending", "completed", "cancelled", "failed"].includes(status)) {
    return t(`billing.status.${status}`);
  }
  return status;
}

function PricingContent({ surface = "price" }: { surface?: "price" | "billing" }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [message, setMessage] = useState("");
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [pricingRows, setPricingRows] = useState<PricingGuideRow[]>(MODEL_PRICING_ROWS);
  const trackedLoginSuccessRef = useRef<string | null>(null);
  const trackedCheckoutSuccessRef = useRef<string | null>(null);
  const trackedSubscriptionSuccessRef = useRef<string | null>(null);
  const capturingPayPalOrderRef = useRef<string | null>(null);
  const syncingPayPalSubscriptionRef = useRef<string | null>(null);
  const checkoutState = searchParams.get("checkout");
  const kyrenReference = searchParams.get("reference");
  const checkoutProvider = searchParams.get("provider");
  const checkoutSessionId = searchParams.get("session_id");
  const paypalOrderId = searchParams.get("token");
  const checkoutPaymentId = searchParams.get("payment_id") || checkoutSessionId;
  const paypalSubscriptionId = searchParams.get("subscription_id");
  const revisedPlanId = searchParams.get("plan_id");
  const revisedCycle = searchParams.get("cycle");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      if (!token) {
        trackEvent("billing_view", { checkout: checkoutState || "none", authenticated: false });
        return;
      }
      const userId = data.session?.user.id || null;
      if (userId && trackedLoginSuccessRef.current !== userId) {
        trackedLoginSuccessRef.current = userId;
        trackEvent("login_success", { surface: "billing" }, token);
      }
      setAccessToken(token);
    });
  }, [checkoutState]);

  useEffect(() => {
    if (!accessToken || checkoutState !== "kyren_return" || !kyrenReference) return;
    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      if (stopped) return;
      setMessage(t("creditShop.confirming"));
      try {
        const response = await fetch("/api/billing/kyrenpay/sync", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ reference: kyrenReference })
        });
        const result = await response.json();
        if (stopped) return;
        if (response.ok && result.completed && result.transactionId) {
          router.replace(`${window.location.pathname}?checkout=success&provider=kyrenpay&payment_id=${encodeURIComponent(result.transactionId)}`);
          return;
        }
        if (result.review || response.status === 401 || response.status === 404) {
          setMessage(t("creditShop.checkLater")); return;
        }
      } catch { /* Webhook and cron can still complete the order. */ }
      if (!stopped && ++attempts < 24) timer = setTimeout(check, 5000);
      else if (!stopped) setMessage(t("creditShop.checkLater"));
    }
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [accessToken, checkoutState, kyrenReference, router, t]);

  async function loadCredits(token: string) {
    setRefreshingCredits(true);
    try {
      const response = await fetch("/api/credits", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = (await response.json()) as {
        balance?: number | null;
        ledger?: LedgerEntry[];
        purchases?: PurchaseEntry[];
        subscriptions?: SubscriptionEntry[];
        signupBonusBlockedByIp?: boolean;
        storageWarning?: string;
      };
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (Array.isArray(payload.ledger)) setLedger(payload.ledger);
      if (Array.isArray(payload.purchases)) setPurchases(payload.purchases);
      if (Array.isArray(payload.subscriptions)) setSubscriptions(payload.subscriptions);
      if (payload.storageWarning) setMessage(payload.storageWarning);
      else if (payload.signupBonusBlockedByIp) {
        setMessage(t("billing.message.trialUnavailable"));
      }
      return payload;
    } catch {
      setMessage(t("billing.message.balanceUnavailable"));
      return null;
    } finally {
      setRefreshingCredits(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    trackEvent("billing_view", { checkout: checkoutState || "none" }, accessToken);
    loadCredits(accessToken);
  }, [accessToken, checkoutState]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/model-pricing")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { rows?: PricingGuideRow[] } | null) => {
        if (!cancelled && Array.isArray(payload?.rows)) {
          setPricingRows(payload.rows);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return undefined;

    if (
      checkoutState === "subscription_revise_success" &&
      paypalSubscriptionId &&
      syncingPayPalSubscriptionRef.current !== paypalSubscriptionId
    ) {
      syncingPayPalSubscriptionRef.current = paypalSubscriptionId;
      setMessage(t("billing.message.subscriptionUpgradeSyncing"));
      let cancelled = false;
      const confirmSubscriptionChange = async () => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const response = await fetch("/api/billing/subscription/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              subscriptionId: paypalSubscriptionId,
              planId: revisedPlanId,
              cycle: revisedCycle
            })
          });
          const payload = (await response.json()) as { error?: string; code?: string };
          if (response.ok) {
            if (cancelled) return;
            await loadCredits(accessToken);
            if (cancelled) return;
            setMessage(t("billing.message.subscriptionUpgradeConfirmed"));
            router.replace(window.location.pathname);
            return;
          }
          if (payload.code === "subscription_change_not_confirmed" && attempt < 7) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
            if (cancelled) return;
            continue;
          }
          throw new Error(payload.error || t("billing.message.subscriptionChangeUnavailable"));
        }
      };
      confirmSubscriptionChange().catch((error) => {
        if (cancelled) return;
        syncingPayPalSubscriptionRef.current = null;
        setMessage(error instanceof Error ? error.message : t("billing.message.subscriptionChangeUnavailable"));
      });
      return () => {
        cancelled = true;
      };
    }

    if (checkoutState === "paypal_return" && paypalOrderId && capturingPayPalOrderRef.current !== paypalOrderId) {
      capturingPayPalOrderRef.current = paypalOrderId;
      setMessage(t("billing.success.paymentReceived"));
      fetch("/api/billing/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orderId: paypalOrderId })
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) throw new Error(payload.error || t("billing.message.paymentProcessing"));
          router.replace(`${window.location.pathname}?checkout=success&provider=paypal&payment_id=${encodeURIComponent(paypalOrderId)}`);
        })
        .catch((error) => {
          capturingPayPalOrderRef.current = null;
          setMessage(error instanceof Error ? error.message : t("billing.message.paymentProcessing"));
        });
      return undefined;
    }

    if (checkoutState === "subscription_success") {
      setMessage(checkoutProvider === "paypal" ? t("billing.subscriptionSuccess.title") : t("billing.message.subscriptionChecking"));
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        const payload = await loadCredits(accessToken);
        const matchingPurchase = payload?.purchases?.find(
          (purchase) =>
            purchase.pack_id.startsWith("subscription:") &&
            (!checkoutPaymentId || purchaseReference(purchase) === checkoutPaymentId)
        );
        if (matchingPurchase?.status === "completed") {
          const trackingKey = purchaseReference(matchingPurchase);
          if (trackedSubscriptionSuccessRef.current !== trackingKey) {
            trackedSubscriptionSuccessRef.current = trackingKey;
            const subscription = subscriptionFromPackId(matchingPurchase.pack_id);
            const value = matchingPurchase.amount_cents / 100;
            const currency = (matchingPurchase.currency || "usd").toUpperCase();
            const planId = subscription?.plan.id || matchingPurchase.pack_id;
            const cycle = subscription?.cycle || "unknown";
            const planName = subscription?.plan.name || "DreamFace subscription";

            trackEvent(
              "subscription_checkout_success",
              {
                payment_provider: matchingPurchase.payment_provider,
                provider_transaction_id: purchaseReference(matchingPurchase),
                plan_id: planId,
                cycle,
                credits: matchingPurchase.credits,
                amount_cents: matchingPurchase.amount_cents,
                value,
                currency
              },
              accessToken
            );
            trackPurchaseEvent(
              {
                transaction_id: purchaseReference(matchingPurchase),
                value,
                currency,
                item_id: matchingPurchase.pack_id,
                item_name: `${planName} ${cycleLabels[cycle as BillingCycle] || cycle}`,
                item_category: "subscription",
                plan_id: planId,
                cycle,
                credits: matchingPurchase.credits,
                amount_cents: matchingPurchase.amount_cents,
                payment_provider: matchingPurchase.payment_provider,
                items: [
                  {
                    item_id: matchingPurchase.pack_id,
                    item_name: `${planName} ${cycleLabels[cycle as BillingCycle] || cycle}`,
                    item_category: "subscription",
                    price: value,
                    quantity: 1
                  }
                ]
              },
              accessToken
            );
          }
        }
        if (matchingPurchase?.status === "completed" || attempts >= 8) {
          window.clearInterval(timer);
          setMessage(
            matchingPurchase?.status === "completed"
              ? t("billing.message.subscriptionConfirmed")
              : checkoutProvider === "paypal" ? t("billing.subscriptionSuccess.title") : t("billing.message.subscriptionProcessing")
          );
        }
      }, 1800);
      return () => window.clearInterval(timer);
    }

    if (checkoutState === "success") {
      setMessage(checkoutProvider === "paypal" ? t("billing.success.paymentReceived") : t("billing.message.paymentChecking"));
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        const payload = await loadCredits(accessToken);
        const matchingPurchase = payload?.purchases?.find(
          (purchase) => !checkoutPaymentId || purchaseReference(purchase) === checkoutPaymentId
        );
        if (matchingPurchase?.status === "completed") {
          const trackingKey = purchaseReference(matchingPurchase);
          if (trackedCheckoutSuccessRef.current !== trackingKey) {
            trackedCheckoutSuccessRef.current = trackingKey;
            trackEvent(
              "checkout_success",
              {
                payment_provider: matchingPurchase.payment_provider,
                provider_transaction_id: purchaseReference(matchingPurchase),
                pack_id: matchingPurchase.pack_id,
                credits: matchingPurchase.credits,
                amount_cents: matchingPurchase.amount_cents,
                value: matchingPurchase.amount_cents / 100,
                currency: (matchingPurchase.currency || "usd").toUpperCase()
              },
              accessToken
            );
            trackPurchaseEvent(
              {
                transaction_id: purchaseReference(matchingPurchase),
                value: matchingPurchase.amount_cents / 100,
                currency: (matchingPurchase.currency || "usd").toUpperCase(),
                item_id: matchingPurchase.pack_id,
                item_name: creditPackName(matchingPurchase.pack_id),
                item_category: "credit_pack",
                pack_id: matchingPurchase.pack_id,
                credits: matchingPurchase.credits,
                amount_cents: matchingPurchase.amount_cents,
                payment_provider: matchingPurchase.payment_provider,
                items: [
                  {
                    item_id: matchingPurchase.pack_id,
                    item_name: creditPackName(matchingPurchase.pack_id),
                    item_category: "credit_pack",
                    price: matchingPurchase.amount_cents / 100,
                    quantity: 1
                  }
                ]
              },
              accessToken
            );
          }
        }
        if (matchingPurchase?.status === "completed" || attempts >= 8) {
          window.clearInterval(timer);
          setMessage(
            matchingPurchase?.status === "completed"
              ? t("billing.message.paymentConfirmed")
              : checkoutProvider === "paypal" ? t("billing.success.paymentReceived") : t("billing.message.paymentProcessing")
          );
        }
      }, 1800);
      return () => window.clearInterval(timer);
    }

    if (checkoutState === "cancelled") {
      trackEvent("checkout_cancelled", {}, accessToken);
      setMessage(t("billing.message.checkoutCancelled"));
    }
    return undefined;
  }, [accessToken, checkoutPaymentId, checkoutProvider, checkoutState, paypalOrderId, paypalSubscriptionId, revisedCycle, revisedPlanId, router, t]);

  const matchingCheckoutPurchase = useMemo(
    () => purchases.find((purchase) => purchase.status === "completed" && Boolean(checkoutPaymentId) && purchaseReference(purchase) === checkoutPaymentId) || null,
    [checkoutPaymentId, purchases]
  );
  const currentSubscription = useMemo(
    () => subscriptions.find((subscription) => ["active", "trialing", "past_due", "approved", "approval_pending", "suspended"].includes(subscription.status.toLowerCase())) || subscriptions[0] || null,
    [subscriptions]
  );

  const lowBalance = typeof balance === "number" && balance < CREDIT_LOW_BALANCE_THRESHOLD;
  async function startCheckout(packId: string, paymentProvider: "paypal" | "kyrenpay") {
    if (!accessToken) {
      trackEvent("checkout_login_required", { pack_id: packId });
      const nextPath = typeof window !== "undefined" ? window.location.pathname : "/price";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    setLoadingPack(`${packId}:${paymentProvider}`);
    setMessage("");
    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    trackEvent(
      "checkout_started",
      { payment_provider: paymentProvider, pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
      accessToken
    );
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ type: "credits", packId, provider: paymentProvider })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || t("billing.message.unableCheckout"));
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("billing.message.unableCheckout"));
      setLoadingPack(null);
    }
  }

  async function openBillingPortal() {
    if (!accessToken) {
      router.push(`/auth?next=${encodeURIComponent("/billing")}`);
      return;
    }
    setMessage("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
        code?: string;
        provider?: string;
        canCancel?: boolean;
      };
      if (!response.ok) {
        if (payload.code === "legacy_stripe_customer_unavailable") {
          throw new Error(t("billing.message.legacyStripeUnavailable"));
        }
        throw new Error(payload.error || t("billing.message.unablePortal"));
      }
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      if (payload.provider === "paypal" && payload.canCancel) {
        if (!window.confirm(t("billing.subscription.cancelConfirm"))) return;
        const cancelResponse = await fetch("/api/billing/subscription/cancel", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const cancelPayload = (await cancelResponse.json()) as { error?: string };
        if (!cancelResponse.ok) throw new Error(cancelPayload.error || t("billing.message.unablePortal"));
        setMessage(t("billing.subscription.cancelled"));
        await loadCredits(accessToken);
        return;
      }
      throw new Error(payload.error || t("billing.message.unablePortal"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("billing.message.unablePortal"));
    }
  }

  if (surface === "billing") {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(1000px_420px_at_88%_-8%,rgba(106,90,249,0.08),transparent_48%),#fafafc] pb-24 text-[#171321]">
        <div className="mx-auto max-w-[1420px] px-3 pt-3 md:px-6 md:pt-4">
          <TopNav />
        </div>

        <section className="mx-auto max-w-[1280px] px-3 py-5 sm:px-5 md:py-8">
          <section className="relative overflow-hidden rounded-[24px] border border-white/15 bg-[radial-gradient(circle_at_84%_4%,rgba(170,111,255,0.45),transparent_34%),radial-gradient(circle_at_8%_110%,rgba(91,70,255,0.36),transparent_38%),linear-gradient(135deg,#171126,#2a184c_58%,#332064)] p-5 text-white shadow-[0_28px_80px_rgba(22,12,43,0.25)] sm:p-8 md:rounded-[30px]">
            <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_400px] lg:items-end">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#d6ccff]"><span>◆</span>{t("creditShop.eyebrow")}</p>
                <h1 className="mt-5 [overflow-wrap:anywhere] text-[clamp(2.4rem,6vw,4.6rem)] font-black leading-[0.95] tracking-[-0.055em]">{t("billing.title")}</h1>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-white/65 sm:text-base">{t("creditShop.subtitle")}</p>
                <a href="/studio?view=home" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/15">← Studio</a>
              </div>
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/55">{t("billing.currentBalance")}</p>
                <div className="mt-2 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <p className="text-[42px] font-black leading-none tracking-[-0.05em]">{balance === null ? "--" : balance.toLocaleString()} <span className="text-xs uppercase tracking-[0.1em] text-white/55">credits</span></p>
                  <button type="button" onClick={() => { trackEvent("balance_refreshed", { surface: "billing" }, accessToken); accessToken ? loadCredits(accessToken) : router.push(`/auth?next=${encodeURIComponent("/billing")}`); }} disabled={refreshingCredits} className="min-h-11 w-full shrink-0 rounded-xl bg-white px-4 text-xs font-black text-[#2b1c46] shadow-lg disabled:opacity-60 sm:w-auto">{refreshingCredits ? t("pricing.refreshing") : accessToken ? t("billing.refreshBalance") : t("billing.signInToView")}</button>
                </div>
                <p className="mt-2 text-xs font-semibold text-white/55">{t("billing.creditsAvailable")}</p>
              </div>
            </div>
          </section>

          {message ? (
            <p className="mt-8 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm font-semibold text-[#705d1d]">
              {message}
            </p>
          ) : null}

          {currentSubscription ? (
          <section className="mt-5 rounded-[22px] border border-[#e5e1eb] bg-white p-5 shadow-[0_12px_36px_rgba(31,20,54,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8a7cf5]">💳 {t("billing.subscription.eyebrow")}</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                  {currentSubscription ? `${currentSubscription.plan_id.replace("-", " ")} · ${currentSubscription.status}` : t("billing.subscription.noActive")}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#667084]">
                  {currentSubscription
                    ? t("billing.subscription.currentDescription", {
                        credits: currentSubscription.credits_per_cycle.toLocaleString(),
                        cycle: currentSubscription.cycle,
                        status: currentSubscription.cancel_at_period_end
                          ? t("billing.subscription.cancellationScheduled")
                          : t("billing.subscription.manageThroughProvider", { provider: currentSubscription.payment_provider === "paypal" ? "PayPal" : "Stripe" })
                      })
                    : t("billing.subscription.choosePlan")}
                </p>
                {currentSubscription?.current_period_end ? (
                  <p className="mt-2 text-sm font-semibold text-[#475569]">
                    {currentSubscription.cancel_at_period_end ? t("billing.subscription.accessUntil") : t("billing.subscription.renews")} {formatDate(currentSubscription.current_period_end)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={!currentSubscription?.provider_subscription_id && !currentSubscription?.stripe_customer_id}
                className="min-h-11 rounded-xl border border-[#ddd7ff] bg-[#f7f5ff] px-5 text-sm font-black text-[#6651ee] transition hover:bg-[#f0edff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("billing.subscription.manage")}
              </button>
            </div>
          </section>
          ) : null}

          {checkoutState === "success" ? (
            <section className="mt-6 rounded-[2rem] border border-[#197a46]/20 bg-[#eefaf3] p-6 shadow-[0_18px_44px_rgba(25,122,70,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#197a46]">{matchingCheckoutPurchase ? t("billing.success.title") : t("billing.message.paymentChecking")}</p>
              <h2 className="mt-2 text-3xl font-black">
                {matchingCheckoutPurchase ? t("billing.success.creditsAdded", { credits: matchingCheckoutPurchase.credits.toLocaleString() }) : t("creditShop.confirming")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#3f6b52]">
              {matchingCheckoutPurchase
                ? t("billing.success.purchaseSummary", {
                    packId: matchingCheckoutPurchase.pack_id,
                    amount: formatUsd(matchingCheckoutPurchase.amount_cents),
                    status: formatStatus(matchingCheckoutPurchase.status, t)
                  })
                : t("creditShop.checkLater")}
              </p>
            </section>
          ) : null}

          {checkoutState === "subscription_success" ? (
            <section className="mt-6 rounded-[2rem] border border-[#197a46]/20 bg-[#eefaf3] p-6 shadow-[0_18px_44px_rgba(25,122,70,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#197a46]">{t("billing.subscriptionSuccess.eyebrow")}</p>
              <h2 className="mt-2 text-3xl font-black">{t("billing.subscriptionSuccess.title")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#3f6b52]">
                {checkoutProvider === "paypal" ? t("billing.subscriptionSuccess.title") : t("billing.subscriptionSuccess.description")}
              </p>
            </section>
          ) : null}

          {lowBalance ? (
            <section className="mt-6 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm font-semibold text-[#705d1d]">
              {t("billing.lowBalance", { threshold: CREDIT_LOW_BALANCE_THRESHOLD })}
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="mb-3 text-2xl font-black">{t("creditShop.title")}</h2>
            <p className="mb-6 text-sm text-[#82748f]">{t("creditShop.subtitle")}</p>
            <CreditPackGrid t={t} loadingPack={loadingPack} onCheckout={startCheckout} />
            <p className="mt-5 text-xs text-[#82748f]">{t("creditShop.note")}</p>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[22px] border border-[#e5e1eb] bg-white p-5 shadow-[0_12px_36px_rgba(31,20,54,0.06)] sm:p-6">
              <h2 className="text-2xl font-black tracking-[-0.03em]">{t("billing.creditActivity")}</h2>
              <div className="mt-6 space-y-3">
                {ledger.length ? (
                  ledger.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#efedf2] bg-[#faf9fb] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black">{formatReason(entry.reason, t)}</p>
                        <p className="mt-1 text-xs font-medium text-[#667084]">{formatDate(entry.created_at)}</p>
                      </div>
                      <p className={`shrink-0 text-lg font-black ${entry.amount >= 0 ? "text-[#197a46]" : "text-[#b03439]"}`}>
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-sm font-semibold text-[#667084]">
                    {accessToken ? t("billing.noCreditActivity") : t("billing.signInCreditActivity")}
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-[22px] border border-[#e5e1eb] bg-white p-5 shadow-[0_12px_36px_rgba(31,20,54,0.06)] sm:p-6">
              <h2 className="text-2xl font-black tracking-[-0.03em]">{t("billing.stripePurchases")}</h2>
              <div className="mt-6 space-y-3">
                {purchases.length ? (
                  purchases.slice(0, 10).map((purchase) => (
                    <div key={purchase.id} className="rounded-xl border border-[#efedf2] bg-[#faf9fb] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-black">
                          {purchase.pack_id} - {purchase.credits.toLocaleString()} credits
                        </p>
                        <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-black">{formatStatus(purchase.status, t)}</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold capitalize text-[#4f5a6d]">{purchase.payment_provider}</p>
                      <p className="mt-1 break-all text-xs font-medium text-[#667084]">{t("billing.stripeCheckoutId")}: {purchaseReference(purchase)}</p>
                      <p className="mt-2 text-xs font-medium text-[#667084]">
                        {formatUsd(purchase.amount_cents)} - {formatDate(purchase.updated_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-sm font-semibold text-[#667084]">
                    {accessToken ? t("billing.noStripePurchases") : t("billing.signInStripePurchases")}
                  </p>
                )}
              </div>
            </article>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8ff] pb-16 text-[#20182e]">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-8"><TopNav /></div>
      <section className="mx-auto max-w-[1240px] px-4 pb-8 pt-12 text-center sm:px-8 sm:pt-20">
        <p className="text-xs font-black uppercase tracking-[.18em] text-[#896bbd]">{t("creditShop.eyebrow")}</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{t("creditShop.title")}</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#82748f]">{t("creditShop.subtitle")}</p>
        {accessToken ? <p className="mt-5 text-sm font-bold text-[#7554df]">{t("creditShop.balance")}: {balance === null ? "--" : balance.toLocaleString()} {t("creditShop.credits")} · <a className="underline" href="/billing">{t("billing.title")}</a></p> : null}
        {message ? <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{message}</p> : null}
        <div className="mt-10"><CreditPackGrid t={t} loadingPack={loadingPack} onCheckout={startCheckout} /></div>
        <p className="mt-5 text-xs leading-6 text-[#8b8096]">{t("creditShop.note")}</p>
      </section>
      <section className="mx-auto mt-6 max-w-[1176px] rounded-3xl border border-[#e7e1f0] bg-white p-6 sm:p-8">
        <h2 className="text-xl font-black">{t("creditShop.howTitle")}</h2>
        <div className="mt-5 grid gap-5 text-sm leading-6 text-[#80718c] sm:grid-cols-3">
          {["step1","step2","step3"].map((key,index) => <p key={key}><span className="me-2 font-black text-[#7655ed]">0{index+1}</span>{t(`creditShop.${key}`)}</p>)}
        </div>
      </section>
      <section className="mx-auto max-w-[1176px] px-4 pt-12 sm:px-0">
        <h2 className="text-2xl font-black">{t("pricing.modelGuide.title")}</h2>
        <p className="mt-3 text-sm leading-6 text-[#82748f]">{t("creditShop.modelNote")}</p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e7e1f0] bg-white">
          {pricingRows.slice(0,7).map(row => <div key={`${row.provider}-${row.workflow}`} className="flex flex-wrap justify-between gap-3 border-b border-[#eee9f4] p-5 last:border-0"><div><p className="font-bold">{row.label}</p><p className="text-xs text-[#82748f]">{row.workflow}</p></div><p className="text-sm font-bold text-[#7554df]">{row.unitNote}</p></div>)}
        </div>
      </section>
    </main>
  );
}

export default function BillingPage() {
  const pathname = usePathname();
  const surface = pathname.endsWith("/price") ? "price" : "billing";
  return (
    <Suspense fallback={null}>
      <PricingContent surface={surface} />
    </Suspense>
  );
}
