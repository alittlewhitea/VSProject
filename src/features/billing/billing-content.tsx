"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { billingNavigationUrl } from "./billing-navigation";
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
import { requestSignIn } from "../../lib/auth-navigation";

type LedgerEntry = {
  id: number | string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type PurchaseEntry = {
  id: number | string;
  payment_provider: "stripe" | "paypal" | "kyrenpay" | "dodo";
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
  referenceDuration?: string;
  referenceResolution?: string;
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

export function PricingContent({ surface = "price", embedded = false, onBalanceChange }: { surface?: "price" | "billing"; embedded?: boolean; onBalanceChange?: (balance: number) => void }) {
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
  const trackedCheckoutSuccessRef = useRef<string | null>(null);
  const trackedSubscriptionSuccessRef = useRef<string | null>(null);
  const capturingPayPalOrderRef = useRef<string | null>(null);
  const syncingPayPalSubscriptionRef = useRef<string | null>(null);
  const checkoutState = searchParams.get("checkout");
  const checkoutProvider = searchParams.get("provider");
  const checkoutSessionId = searchParams.get("session_id");
  const paypalOrderId = searchParams.get("token");
  const dodoCheckoutId = searchParams.get("checkout_id");
  const checkoutPaymentId = searchParams.get("payment_id") || checkoutSessionId;
  const paypalSubscriptionId = searchParams.get("subscription_id");
  const revisedPlanId = searchParams.get("plan_id");
  const revisedCycle = searchParams.get("cycle");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token || null;
      if (!token) {
        setAccessToken(null);
        setBalance(null);
        setLedger([]);
        setPurchases([]);
        setSubscriptions([]);
        trackEvent("billing_view", { checkout: checkoutState || "none", authenticated: false });
        return;
      }
      setAccessToken(token);
    });
    return () => data.subscription.unsubscribe();
  }, [checkoutState]);


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
    if (!accessToken) return;
    const refresh = () => { void loadCredits(accessToken); };
    window.addEventListener("dreamface:credits-updated", refresh);
    return () => window.removeEventListener("dreamface:credits-updated", refresh);
  }, [accessToken]);

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
            router.replace(billingNavigationUrl(window.location.pathname, "", embedded));
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
          router.replace(billingNavigationUrl(window.location.pathname, `checkout=success&provider=paypal&payment_id=${encodeURIComponent(paypalOrderId)}`, embedded));
        })
        .catch((error) => {
          capturingPayPalOrderRef.current = null;
          setMessage(error instanceof Error ? error.message : t("billing.message.paymentProcessing"));
        });
      return undefined;
    }

    if (checkoutState === "dodo_return" && dodoCheckoutId) {
      setMessage(t("billing.message.paymentChecking"));
      let cancelled = false, attempts = 0;
      let timer: ReturnType<typeof setTimeout>;
      const check = async () => {
        attempts++;
        try {
          const response = await fetch("/api/billing/dodo/sync", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ checkoutId: dodoCheckoutId })
          });
          const result = await response.json();
          if (cancelled) return;
          if (response.ok && result.completed) {
            router.replace(billingNavigationUrl(window.location.pathname, `checkout=success&provider=dodo&payment_id=${encodeURIComponent(dodoCheckoutId)}`, embedded));
            return;
          }
          if (response.status === 404 || result.status === "failed" || result.status === "cancelled" || result.status === "review_required") {
            setMessage(t("billing.message.paymentProcessing")); return;
          }
        } catch { /* Webhook can still fulfill while the confirmation API retries. */ }
        if (cancelled) return;
        if (attempts < 12) timer = setTimeout(check, 2200);
        else setMessage(t("billing.message.paymentProcessing"));
      };
      void check();
      return () => { cancelled = true; clearTimeout(timer); };
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
          (purchase) => Boolean(checkoutPaymentId) &&
            (!checkoutProvider || purchase.payment_provider === checkoutProvider) &&
            (purchaseReference(purchase) === checkoutPaymentId || purchase.provider_order_id === checkoutPaymentId)
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
  }, [accessToken, checkoutPaymentId, checkoutProvider, checkoutState, dodoCheckoutId, paypalOrderId, paypalSubscriptionId, revisedCycle, revisedPlanId, router, t]);

  const matchingCheckoutPurchase = useMemo(
    () => purchases.find((purchase) => purchase.status === "completed" && Boolean(checkoutPaymentId) &&
      (!checkoutProvider || purchase.payment_provider === checkoutProvider) &&
      (purchaseReference(purchase) === checkoutPaymentId || purchase.provider_order_id === checkoutPaymentId)) || null,
    [checkoutPaymentId, checkoutProvider, purchases]
  );
  const currentSubscription = useMemo(
    () => subscriptions.find((subscription) => ["active", "trialing", "past_due", "approved", "approval_pending", "suspended"].includes(subscription.status.toLowerCase())) || subscriptions[0] || null,
    [subscriptions]
  );

  useEffect(() => { if (embedded && accessToken && typeof balance === "number") onBalanceChange?.(balance); }, [accessToken, balance, embedded, onBalanceChange]);

  const lowBalance = typeof balance === "number" && balance < CREDIT_LOW_BALANCE_THRESHOLD;
  async function startCheckout(packId: string, paymentProvider: "paypal" | "dodo", loginToken?: string) {
    const checkoutToken = loginToken || accessToken;
    if (!checkoutToken) {
      trackEvent("checkout_login_required", { pack_id: packId });
      const nextPath = typeof window !== "undefined" ? billingNavigationUrl(window.location.pathname, embedded ? window.location.search : "", embedded) : "/price";
      requestSignIn({ next: nextPath, onSuccess: session => { void startCheckout(packId, paymentProvider, session.access_token); } });
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
          Authorization: `Bearer ${checkoutToken}`
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

  async function openBillingPortal(loginToken?: string) {
    const portalToken = loginToken || accessToken;
    if (!portalToken) {
      requestSignIn({ onSuccess: session => { void openBillingPortal(session.access_token); } });
      return;
    }
    setMessage("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${portalToken}`
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
          headers: { Authorization: `Bearer ${portalToken}` }
        });
        const cancelPayload = (await cancelResponse.json()) as { error?: string };
        if (!cancelResponse.ok) throw new Error(cancelPayload.error || t("billing.message.unablePortal"));
        setMessage(t("billing.subscription.cancelled"));
        await loadCredits(portalToken);
        return;
      }
      throw new Error(payload.error || t("billing.message.unablePortal"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("billing.message.unablePortal"));
    }
  }

  const BillingContainer = embedded ? "div" : "main";
  if (surface === "billing") {
    return (
      <BillingContainer data-studio-billing={embedded || undefined} className={embedded ? "df-billing-workspace" : "min-h-screen bg-[var(--df-bg)] text-[var(--df-ink)]"}>
        <div className="mx-auto max-w-[1420px] px-3 pt-3 md:px-6 md:pt-4">
          {!embedded ? <TopNav /> : null}
        </div>

        <section className="mx-auto max-w-[1280px] px-3 py-5 sm:px-5 md:py-8">
          <section className="df-billing-summary">
            <div><p className="df-eyebrow">{t("creditShop.eyebrow")}</p><h2>{t("billing.title")}</h2><p>{t("creditShop.subtitle")}</p></div>
            <div className="df-balance-card"><span>{t("billing.currentBalance")}</span><strong>{balance === null ? "--" : balance.toLocaleString()} <small>{t("creditShop.credits")}</small></strong><p>{t("billing.creditsAvailable")}</p>
              <button type="button" onClick={() => { trackEvent("balance_refreshed", { surface: "billing" }, accessToken); accessToken ? loadCredits(accessToken) : requestSignIn({ onSuccess: session => { void loadCredits(session.access_token); } }); }} disabled={refreshingCredits} className="df-button df-button--secondary">{refreshingCredits ? t("pricing.refreshing") : accessToken ? t("billing.refreshBalance") : t("billing.signInToView")}</button>
            </div>
          </section>

          {message ? (
            <p className="mt-8 rounded-2xl border border-[var(--df-warning)] bg-[var(--df-warning-soft)] px-5 py-4 text-sm font-semibold text-[var(--df-warning)]">
              {message}
            </p>
          ) : null}

          {currentSubscription ? (
          <section className="mt-5 rounded-[14px] border border-[var(--df-border)] bg-[var(--df-surface)] p-5 shadow-none sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-accent)]">💳 {t("billing.subscription.eyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  {currentSubscription ? `${currentSubscription.plan_id.replace("-", " ")} · ${currentSubscription.status}` : t("billing.subscription.noActive")}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--df-muted)]">
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
                  <p className="mt-2 text-sm font-semibold text-[var(--df-muted)]">
                    {currentSubscription.cancel_at_period_end ? t("billing.subscription.accessUntil") : t("billing.subscription.renews")} {formatDate(currentSubscription.current_period_end)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void openBillingPortal()}
                disabled={!currentSubscription?.provider_subscription_id && !currentSubscription?.stripe_customer_id}
                className="min-h-11 rounded-xl border border-[var(--df-primary-border)] bg-[var(--df-primary-soft)] px-5 text-sm font-semibold text-[var(--studio-accent)] transition hover:bg-[var(--df-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("billing.subscription.manage")}
              </button>
            </div>
          </section>
          ) : null}

          {checkoutState === "success" ? (
            <section className="mt-6 rounded-[14px] border border-[var(--df-success)] bg-[var(--df-success-soft)] p-6 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--df-success)]">{matchingCheckoutPurchase ? t("billing.success.title") : t("billing.message.paymentChecking")}</p>
              <h2 className="mt-2 text-3xl font-semibold">
                {matchingCheckoutPurchase ? t("billing.success.creditsAdded", { credits: matchingCheckoutPurchase.credits.toLocaleString() }) : t("creditShop.confirming")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--df-success)]">
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
            <section className="mt-6 rounded-[14px] border border-[var(--df-success)] bg-[var(--df-success-soft)] p-6 shadow-none">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--df-success)]">{t("billing.subscriptionSuccess.eyebrow")}</p>
              <h2 className="mt-2 text-3xl font-semibold">{t("billing.subscriptionSuccess.title")}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--df-success)]">
                {checkoutProvider === "paypal" ? t("billing.subscriptionSuccess.title") : t("billing.subscriptionSuccess.description")}
              </p>
            </section>
          ) : null}

          {lowBalance ? (
            <section className="mt-6 rounded-2xl border border-[var(--df-warning)] bg-[var(--df-warning-soft)] px-5 py-4 text-sm font-semibold text-[var(--df-warning)]">
              {t("billing.lowBalance", { threshold: CREDIT_LOW_BALANCE_THRESHOLD })}
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="mb-3 text-2xl font-semibold">{t("creditShop.title")}</h2>
            <p className="mb-6 text-sm text-[var(--df-muted)]">{t("creditShop.subtitle")}</p>
            <CreditPackGrid appearance={embedded ? "studio" : "default"} t={t} loadingPack={loadingPack} onCheckout={startCheckout} accessToken={accessToken} message={message} />
            <p className="mt-5 text-xs text-[var(--df-muted)]">{t("creditShop.note")}</p>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[14px] border border-[var(--df-border)] bg-[var(--df-surface)] p-5 shadow-none sm:p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">{t("billing.creditActivity")}</h2>
              <div className="mt-6 space-y-3">
                {ledger.length ? (
                  ledger.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--df-border)] bg-[var(--df-surface-soft)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{formatReason(entry.reason, t)}</p>
                        <p className="mt-1 text-xs font-medium text-[var(--df-muted)]">{formatDate(entry.created_at)}</p>
                      </div>
                      <p className={`shrink-0 text-lg font-semibold ${entry.amount >= 0 ? "text-[var(--df-success)]" : "text-[var(--df-error)]"}`}>
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount.toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[var(--df-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--df-muted)]">
                    {accessToken ? t("billing.noCreditActivity") : t("billing.signInCreditActivity")}
                  </p>
                )}
              </div>
            </article>

            <article className="rounded-[14px] border border-[var(--df-border)] bg-[var(--df-surface)] p-5 shadow-none sm:p-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">{t("billing.stripePurchases")}</h2>
              <div className="mt-6 space-y-3">
                {purchases.length ? (
                  purchases.slice(0, 10).map((purchase) => (
                    <div key={purchase.id} className="rounded-xl border border-[var(--df-border)] bg-[var(--df-surface-soft)] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {purchase.pack_id} - {purchase.credits.toLocaleString()} credits
                        </p>
                        <span className="rounded-full border border-[var(--df-border)] bg-[var(--df-surface)] px-3 py-1 text-xs font-semibold">{formatStatus(purchase.status, t)}</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold capitalize text-[#4f5a6d]">{purchase.payment_provider}</p>
                      <p className="mt-1 break-all text-xs font-medium text-[var(--df-muted)]">{t("billing.stripeCheckoutId")}: {purchaseReference(purchase)}</p>
                      <p className="mt-2 text-xs font-medium text-[var(--df-muted)]">
                        {formatUsd(purchase.amount_cents)} - {formatDate(purchase.updated_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-[var(--df-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--df-muted)]">
                    {accessToken ? t("billing.noStripePurchases") : t("billing.signInStripePurchases")}
                  </p>
                )}
              </div>
            </article>
          </section>
        </section>
      </BillingContainer>
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
        <div className="mt-10"><CreditPackGrid t={t} loadingPack={loadingPack} onCheckout={startCheckout} accessToken={accessToken} message={message} /></div>
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
          {pricingRows.slice(0,7).map(row => <div key={`${row.provider}-${row.workflow}`} className="flex flex-wrap justify-between gap-3 border-b border-[#eee9f4] p-5 last:border-0"><div><p className="font-bold">{row.label}</p><p className="text-xs text-[#82748f]">{t(row.workflow === "Image to Video" ? "nav.imageToVideo" : "nav.textToVideo")} &middot; {row.referenceResolution} &middot; {t("pricing.modelGuide.duration", {seconds: Number.parseInt(row.referenceDuration || "5s", 10)})}</p></div><p className="text-sm font-bold text-[#7554df]">{t("pricing.modelGuide.estimatedCredits", {credits: row.typicalCredits})}</p></div>)}
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
