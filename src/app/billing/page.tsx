"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  creditUsageCapacity,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";
import { CREDIT_LOW_BALANCE_THRESHOLD, MODEL_PRICING_ROWS } from "../../lib/model-pricing";
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
  payment_provider: "stripe" | "paypal";
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

const billingFaqKeys = ["test", "cost", "credits", "rollover", "cancel", "extra", "upgrade", "video", "failure"];

const cycleLabels: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly"
};

type TranslationFunction = ReturnType<typeof useTranslations>;

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

function CreditUsageExamples({ credits, compact = false }: { credits: number; compact?: boolean }) {
  const t = useTranslations();
  const capacity = creditUsageCapacity(credits);
  const examples = [
    { key: "images", value: capacity.images, label: t("billing.usage.images") },
    { key: "videos", value: capacity.videos, label: t("billing.usage.videos") },
    { key: "voiceovers", value: capacity.voiceovers, label: t("billing.usage.voiceovers") },
    { key: "avatars", value: capacity.avatars, label: t("billing.usage.avatars") }
  ];

  return (
    <div className={compact ? "mt-4" : "mt-5"}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#687386]">
        {t("billing.usage.title")}
      </p>
      <div className={`mt-3 grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
        {examples.map((example) => (
          <div key={example.key} className="rounded-xl border border-black/[0.07] bg-white/80 px-3 py-3">
            <p className={`${compact ? "text-xl" : "text-2xl"} font-black tracking-tight text-[#17191f]`}>
              {example.value.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-[#606b7c]">{example.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-medium leading-5 text-[#737d8d]">{t("billing.usage.note")}</p>
    </div>
  );
}

const testimonialMeta = [
  {
    name: "Mia Chen",
    tone: "bg-[#e8f8e8] text-[#173d17]"
  },
  {
    name: "Jordan Lee",
    tone: "bg-[#f4e8fb] text-[#3e2557]"
  },
  {
    name: "Avery Patel",
    tone: "bg-[#daf5fb] text-[#073f4a]"
  },
  {
    name: "Sam Rivera",
    tone: "bg-[#e9f8e4] text-[#243f19]"
  },
  {
    name: "Noor Ahmed",
    tone: "bg-[#f7e8ff] text-[#402750]"
  },
  {
    name: "Elena Brooks",
    tone: "bg-[#e5f2ff] text-[#17334d]"
  }
];
const testimonialKeys = ["campaigns", "simple", "iteration", "billing", "polish", "repeat"];

const comparisonPlanKeys = ["free", "premiumLite", "premium"];
const planComparisonSectionKeys = ["credits", "access", "benefits"];
const planComparisonRows: Record<string, string[]> = {
  credits: ["trialCredits", "monthlyCredits", "yearlyCredits", "extraCreditPacks"],
  access: ["textToImage", "imageEditing", "voiceGeneration", "videoGeneration", "premiumModelAccess", "promptHistory"],
  benefits: ["commercialUse", "watermark", "queue", "refunds", "bestFor"]
};

function CheckMark() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#08bff1] text-base font-black text-[#08bff1]">
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 8.2 6.6 11.1 12.8 4.9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function CrossMark() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center text-[#cfd3d6]">
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function formatReason(reason: string, t: TranslationFunction) {
  if (["signup_bonus", "stripe_checkout", "stripe_subscription", "generation_task", "generation_refund", "manual_top_up_dev"].includes(reason)) {
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

function planMessageId(planId: string) {
  return planId === "premium-lite" ? "premiumLite" : "premium";
}

function creditPackMessageId(packId: string) {
  return packId === "pro-topup" ? "proTopup" : packId;
}

const planFeatureKeys: Record<string, string[]> = {
  "premium-lite": [
    "fullImage",
    "fullEditing",
    "voice",
    "basicVideo",
    "commercial",
    "noWatermark",
    "refund",
    "queue",
    "history"
  ],
  premium: ["everything", "video", "queue", "models", "tests", "processing", "early"]
};

function SubscriptionPlanCard({
  plan,
  cycle,
  onCycleChange,
  onCheckout,
  loading
}: {
  plan: (typeof SUBSCRIPTION_PLANS)[number];
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  onCheckout: () => void;
  loading: boolean;
}) {
  const t = useTranslations();
  const price = plan.prices[cycle];
  const featured = Boolean(plan.highlight);
  const premium = plan.id === "premium";
  const planKey = planMessageId(plan.id);
  const features = planFeatureKeys[plan.id].map((key) => t(`pricing.plan.${planKey}.feature.${key}`));

  return (
    <article
      className={`relative flex min-h-[620px] flex-col overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-7 ${
        featured
          ? "border-[#08bff1] bg-white ring-4 ring-[#08bff1]/15"
          : premium
            ? "border-[#ccb4ff] bg-[linear-gradient(135deg,#ffffff_0%,#f5f1ff_55%,#eafaff_100%)]"
            : "border-black/10 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${featured ? "bg-[#08bff1] text-[#061215]" : "bg-[#f2f2f4] text-[#555963]"}`}>
            {t(`pricing.plan.${planKey}.badge`)}
          </p>
          <h3 className="mt-5 text-4xl font-black tracking-normal">{t(`pricing.plan.${planKey}.name`)}</h3>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 rounded-full bg-[#f3f4f6] p-1">
        {(Object.keys(cycleLabels) as BillingCycle[]).map((item) => (
          <button
            key={`${plan.id}-${item}`}
            type="button"
            onClick={() => onCycleChange(item)}
            className={`rounded-full px-3 py-2 text-xs font-black transition ${
              cycle === item ? "bg-white text-[#111318] shadow-sm" : "text-[#697181]"
            }`}
          >
            {t(`billing.cycle.${item}`)}
          </button>
        ))}
      </div>

      <div className="mt-7">
        <p className="text-5xl font-black tracking-normal">
          {formatUsd(price.amountCents).replace(".00", "")}
          <span className="text-xl font-bold text-[#5d6675]"> / {price.interval}</span>
        </p>
        {price.monthlyEquivalentCents ? (
          <p className="mt-2 text-sm font-bold text-[#475569]">
            {t("billing.onlyMonthly", { price: formatUsd(price.monthlyEquivalentCents).replace(".00", ""), savings: price.savingsText || "" })}
          </p>
        ) : (
          <p className="mt-2 text-sm font-bold text-[#475569]">{t("billing.creditsPerInterval", { credits: price.credits.toLocaleString(), interval: price.interval })}</p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-[#08bff1]/25 bg-[linear-gradient(135deg,#f0fbff_0%,#ffffff_55%,#f4f1ff_100%)] px-5 py-4 shadow-[0_12px_30px_rgba(8,191,241,0.08)]">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#487080]">{t("billing.includedCredits")}</p>
        <p className="mt-1 text-4xl font-black tracking-tight text-[#101318]">
          {price.credits.toLocaleString()}
          <span className="ml-2 text-base font-black uppercase tracking-[0.08em] text-[#536170]">{t("pricing.credits")}</span>
        </p>
        <p className="mt-1 text-sm font-semibold text-[#5d6675]">{t("billing.renewsEvery", { interval: price.interval })}</p>
        <CreditUsageExamples credits={price.credits} />
      </div>

      <p className="mt-5 min-h-[72px] text-sm font-semibold leading-6 text-[#4f5868]">{t(`pricing.plan.${planKey}.bestFor`)}</p>

      <button
        type="button"
        onClick={onCheckout}
        disabled={loading}
        className={`mt-6 rounded-xl px-5 py-3 text-base font-black transition active:scale-[0.98] disabled:opacity-60 ${
          featured ? "bg-[#08bff1] text-[#061215]" : "bg-[#16171a] text-white"
        }`}
      >
        {loading ? t("billing.openingCheckout") : t(`pricing.plan.${planKey}.cta`)}
      </button>

      <ul className="mt-6 space-y-3 text-sm font-semibold leading-6 text-[#313946]">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#08bff1] text-[10px] font-black text-[#061215]">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
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
  const [loadingSubscription, setLoadingSubscription] = useState<string | null>(null);
  const [selectedCycles, setSelectedCycles] = useState<Record<string, BillingCycle>>(() =>
    Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan.defaultCycle]))
  );
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [pricingRows, setPricingRows] = useState<PricingGuideRow[]>(MODEL_PRICING_ROWS);
  const trackedLoginSuccessRef = useRef<string | null>(null);
  const trackedCheckoutSuccessRef = useRef<string | null>(null);
  const trackedSubscriptionSuccessRef = useRef<string | null>(null);
  const capturingPayPalOrderRef = useRef<string | null>(null);
  const checkoutState = searchParams.get("checkout");
  const checkoutProvider = searchParams.get("provider");
  const checkoutSessionId = searchParams.get("session_id");
  const paypalOrderId = searchParams.get("token");
  const checkoutPaymentId = searchParams.get("payment_id") || checkoutSessionId;

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
  }, [accessToken, checkoutPaymentId, checkoutProvider, checkoutState, paypalOrderId, router, t]);

  const bestValuePack = useMemo(
    () => CREDIT_PACKS.reduce((best, pack) => (pack.credits / pack.amountCents > best.credits / best.amountCents ? pack : best), CREDIT_PACKS[0]),
    []
  );
  const matchingCheckoutPurchase = useMemo(
    () => purchases.find((purchase) => !checkoutPaymentId || purchaseReference(purchase) === checkoutPaymentId) || null,
    [checkoutPaymentId, purchases]
  );
  const currentSubscription = useMemo(
    () => subscriptions.find((subscription) => ["active", "trialing", "past_due"].includes(subscription.status)) || subscriptions[0] || null,
    [subscriptions]
  );
  const lowBalance = typeof balance === "number" && balance < CREDIT_LOW_BALANCE_THRESHOLD;
  const billingFaqs = billingFaqKeys.map((key) => ({
    q: t(`pricing.faq.items.${key}.q`),
    a: t(`pricing.faq.items.${key}.a`)
  }));
  const comparisonPlanNames = comparisonPlanKeys.map((key) => t(`pricing.comparison.plan.${key}`));
  const planComparisonSections = planComparisonSectionKeys.map((sectionKey) => ({
    title: t(`pricing.comparison.section.${sectionKey}.title`),
    rows: planComparisonRows[sectionKey].map((rowKey) => ({
      label: t(`pricing.comparison.section.${sectionKey}.row.${rowKey}.label`),
      values: [0, 1, 2].map((index) => t(`pricing.comparison.section.${sectionKey}.row.${rowKey}.value${index + 1}`))
    }))
  }));
  const testimonials = testimonialKeys.map((key, index) => ({
    title: t(`pricing.testimonials.items.${key}.title`),
    body: t(`pricing.testimonials.items.${key}.body`),
    role: t(`pricing.testimonials.items.${key}.role`),
    ...testimonialMeta[index]
  }));

  async function startCheckout(packId: string) {
    if (!accessToken) {
      trackEvent("checkout_login_required", { pack_id: packId });
      const nextPath = typeof window !== "undefined" ? window.location.pathname : "/price";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    setLoadingPack(packId);
    setMessage("");
    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    trackEvent(
      "checkout_started",
      { pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
      accessToken
    );
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ packId })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || t("billing.message.unableCheckout"));
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("billing.message.unableCheckout"));
      setLoadingPack(null);
    }
  }

  async function startSubscriptionCheckout(planId: string, cycle: BillingCycle) {
    const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
    const price = plan?.prices[cycle];
    if (!accessToken) {
      trackEvent("generate_login_required", { surface: "pricing", plan_id: planId, cycle });
      const nextPath = typeof window !== "undefined" ? window.location.pathname : "/price";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    setLoadingSubscription(`${planId}:${cycle}`);
    setMessage("");
    trackEvent(
      "subscription_checkout_started",
      {
        plan_id: planId,
        cycle,
        credits: price?.credits || null,
        amount_cents: price?.amountCents || null,
        value: price ? price.amountCents / 100 : null,
        currency: "USD"
      },
      accessToken
    );

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ type: "subscription", planId, cycle })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || t("billing.message.unableSubscriptionCheckout"));
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("billing.message.unableSubscriptionCheckout"));
      setLoadingSubscription(null);
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
      <main className="min-h-screen bg-[#f7f7f5] pb-24 text-[#141416]">
        <div className="mx-auto max-w-[1540px] px-4 pt-4 md:px-8 md:pt-5">
          <TopNav />
        </div>

        <section className="mx-auto max-w-[1360px] px-4 py-10 md:px-8 md:py-16">
          <div className="grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-black text-[#44444a] shadow-sm">
                {t("billing.eyebrow")}
              </p>
              <h1 className="mt-7 text-[clamp(3.5rem,8vw,7rem)] font-black leading-[0.92] tracking-normal">
                {t("billing.title")}
              </h1>
              <p className="mt-6 max-w-2xl text-xl font-medium leading-9 text-[#46464b]">
                {t("billing.subtitle")}
              </p>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_22px_60px_rgba(20,20,24,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6a6a72]">{t("billing.currentBalance")}</p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-5xl font-black">{balance === null ? "--" : balance.toLocaleString()}</p>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("balance_refreshed", { surface: "billing" }, accessToken);
                    accessToken ? loadCredits(accessToken) : router.push(`/auth?next=${encodeURIComponent("/billing")}`);
                  }}
                  disabled={refreshingCredits}
                  className="rounded-full bg-[#08bff1] px-5 py-3 text-sm font-black text-[#061215] disabled:opacity-60"
                >
                  {refreshingCredits ? t("pricing.refreshing") : accessToken ? t("billing.refreshBalance") : t("billing.signInToView")}
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold text-[#667084]">{t("billing.creditsAvailable")}</p>
            </div>
          </div>

          {message ? (
            <p className="mt-8 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm font-semibold text-[#705d1d]">
              {message}
            </p>
          ) : null}

          <section className="mt-8 rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("billing.subscription.eyebrow")}</p>
                <h2 className="mt-2 text-3xl font-black tracking-normal">
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
                className="rounded-full border border-black/10 bg-[#f0f2f5] px-5 py-3 text-sm font-black text-[#16171a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("billing.subscription.manage")}
              </button>
            </div>
          </section>

          {checkoutState === "success" ? (
            <section className="mt-6 rounded-[2rem] border border-[#197a46]/20 bg-[#eefaf3] p-6 shadow-[0_18px_44px_rgba(25,122,70,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#197a46]">{t("billing.success.title")}</p>
              <h2 className="mt-2 text-3xl font-black">
                {matchingCheckoutPurchase ? t("billing.success.creditsAdded", { credits: matchingCheckoutPurchase.credits.toLocaleString() }) : t("billing.success.paymentReceived")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#3f6b52]">
              {matchingCheckoutPurchase
                ? t("billing.success.purchaseSummary", {
                    packId: matchingCheckoutPurchase.pack_id,
                    amount: formatUsd(matchingCheckoutPurchase.amount_cents),
                    status: formatStatus(matchingCheckoutPurchase.status, t)
                  })
                : checkoutProvider === "paypal" ? t("billing.success.paymentReceived") : t("billing.success.description")}
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

          <section className="mt-10">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("billing.membership.eyebrow")}</p>
                <h2 className="mt-2 text-4xl font-black tracking-normal">{t("billing.membership.title")}</h2>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-[#667084]">
                {t("billing.membership.description")}
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <article className="flex min-h-[620px] flex-col rounded-[1.75rem] border border-black/10 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
                <p className="inline-flex w-fit rounded-full bg-[#f2f2f4] px-3 py-1 text-xs font-black text-[#555963]">{t("pricing.free.badge")}</p>
                <h3 className="mt-5 text-4xl font-black tracking-normal">{t("pricing.free.name")}</h3>
                <p className="mt-7 text-5xl font-black tracking-normal">$0<span className="text-xl font-bold text-[#5d6675]"> / {t("pricing.free.priceInterval")}</span></p>
                <div className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-3">
                  <p className="text-xl font-black">{t("pricing.free.credits")}</p>
                  <p className="mt-1 text-sm font-semibold text-[#5d6675]">{t("pricing.free.eligible")}</p>
                  <CreditUsageExamples credits={100} />
                </div>
                <p className="mt-5 min-h-[72px] text-sm font-semibold leading-6 text-[#4f5868]">
                  {t("pricing.free.description")}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(accessToken ? "/studio" : `/auth?next=${encodeURIComponent("/studio")}`)}
                  className="mt-6 rounded-xl bg-[#16171a] px-5 py-3 text-base font-black text-white transition active:scale-[0.98]"
                >
                  {t("pricing.free.cta")}
                </button>
                <ul className="mt-6 space-y-3 text-sm font-semibold leading-6 text-[#313946]">
                  {["image", "editing", "voice", "video", "watermark", "queue"].map((featureKey) => {
                    const feature = t(`pricing.freeFeatures.${featureKey}`);
                    return (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-black text-[#111318]">✓</span>
                        <span>{feature}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
              {SUBSCRIPTION_PLANS.map((plan) => {
                const selectedCycle = selectedCycles[plan.id] || plan.defaultCycle;
                return (
                  <SubscriptionPlanCard
                    key={plan.id}
                    plan={plan}
                    cycle={selectedCycle}
                    onCycleChange={(cycle) => setSelectedCycles((prev) => ({ ...prev, [plan.id]: cycle }))}
                    onCheckout={() => startSubscriptionCheckout(plan.id, selectedCycle)}
                    loading={loadingSubscription === `${plan.id}:${selectedCycle}`}
                  />
                );
              })}
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("billing.extraCredits.eyebrow")}</p>
                <h2 className="mt-2 text-3xl font-black tracking-normal">{t("billing.extraCredits.title")}</h2>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-[#667084]">
                {t("billing.extraCredits.description")}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {CREDIT_PACKS.map((pack) => (
                <article key={pack.id} className={`rounded-[1.4rem] border bg-white p-5 shadow-[0_14px_36px_rgba(10,16,30,0.05)] ${pack.id === bestValuePack.id ? "border-[#08bff1]" : "border-black/10"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-black tracking-normal">{t(`pricing.creditPack.${creditPackMessageId(pack.id)}.name`)}</h3>
                      <p className="mt-2 text-3xl font-black tracking-tight text-[#17191f]">
                        {pack.credits.toLocaleString()}
                        <span className="ml-1.5 text-xs uppercase tracking-[0.1em] text-[#667084]">{t("pricing.credits")}</span>
                      </p>
                    </div>
                    <p className="text-2xl font-black">{formatUsd(pack.amountCents).replace(".00", "")}</p>
                  </div>
                  <p className="mt-4 min-h-[54px] text-sm font-medium leading-6 text-[#4f5a67]">{t(`pricing.creditPack.${creditPackMessageId(pack.id)}.idealFor`)}</p>
                  <CreditUsageExamples credits={pack.credits} compact />
                  <button
                    type="button"
                    onClick={() => startCheckout(pack.id)}
                    disabled={Boolean(loadingPack)}
                    className="mt-5 w-full rounded-xl bg-[#f0f2f5] px-5 py-3 text-sm font-black text-[#16171a] transition active:scale-[0.98] disabled:opacity-60"
                  >
                    {loadingPack === pack.id ? t("billing.openingCheckout") : t("billing.recharge")}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-8 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
              <h2 className="text-3xl font-black tracking-normal">{t("billing.creditActivity")}</h2>
              <div className="mt-6 space-y-3">
                {ledger.length ? (
                  ledger.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f7f5] px-4 py-3">
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

            <article className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
              <h2 className="text-3xl font-black tracking-normal">{t("billing.stripePurchases")}</h2>
              <div className="mt-6 space-y-3">
                {purchases.length ? (
                  purchases.slice(0, 10).map((purchase) => (
                    <div key={purchase.id} className="rounded-2xl bg-[#f7f7f5] px-4 py-3">
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
    <main className="min-h-screen bg-[#f7f7f5] text-[#141416]">
      <div className="mx-auto max-w-[1540px] px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />
      </div>

      <section className="relative overflow-hidden bg-[#f8f8f6] pb-14 pt-4 md:pb-24">
        <div className="pointer-events-none absolute -right-[19rem] top-[-14rem] hidden h-[58rem] w-[58rem] rounded-full border-[20px] border-[#20e5d3] bg-[radial-gradient(circle_at_62%_38%,#ffd4fb_0,#a4a9ff_34%,#66cdf7_56%,#28e169_74%,transparent_75%)] shadow-[0_0_0_12px_rgba(255,126,244,0.55),inset_0_0_60px_rgba(255,255,255,0.55)] lg:block" />
        <div className="relative mx-auto max-w-[1320px] px-4 text-center md:px-8">
          <p className="mx-auto inline-flex rounded-full border border-black/10 bg-white/65 px-5 py-2 text-sm font-semibold text-[#414145] shadow-sm">
            {t("pricing.eyebrow")}
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-[clamp(3.25rem,8vw,7.6rem)] font-black leading-[0.95] tracking-normal">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-8 text-[#333338] md:text-xl">
            {t("pricing.subtitle")}
          </p>

          <div className="mx-auto mt-9 flex w-fit rounded-full bg-white p-1.5 shadow-[0_12px_35px_rgba(20,20,22,0.08)]">
            <span className="rounded-full bg-[#07bff2] px-7 py-3 text-sm font-black text-[#051216]">{t("pricing.forIndividuals")}</span>
          </div>

          {accessToken ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-[1.75rem] border border-black/10 bg-white/80 px-5 py-4 text-left shadow-[0_18px_48px_rgba(10,16,30,0.08)] sm:mx-auto sm:w-fit sm:flex-row">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6a6a72]">{t("pricing.currentBalance")}</p>
              <p className="mt-1 text-3xl font-black">{balance === null ? "--" : balance.toLocaleString()} {t("pricing.credits")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                trackEvent("balance_refreshed", { surface: "billing" }, accessToken);
                accessToken && loadCredits(accessToken);
              }}
              disabled={!accessToken || refreshingCredits}
              className="rounded-full border border-black/10 bg-[#f0f0f0] px-5 py-3 text-sm font-black text-[#171719] disabled:opacity-50"
            >
              {refreshingCredits ? t("pricing.refreshing") : t("pricing.refresh")}
            </button>
          </div>
          ) : null}
        </div>

        <div className="relative mx-auto mt-8 grid max-w-[1360px] gap-7 px-4 md:px-8 lg:grid-cols-3 lg:items-start">
          <article className="flex min-h-[620px] flex-col rounded-[1.75rem] border border-black/10 bg-white p-6 text-left shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
            <p className="inline-flex w-fit rounded-full bg-[#f2f2f4] px-3 py-1 text-xs font-black text-[#555963]">{t("pricing.free.badge")}</p>
            <h2 className="mt-5 text-4xl font-black tracking-normal">{t("pricing.free.name")}</h2>
            <p className="mt-7 text-5xl font-black tracking-normal">$0<span className="text-xl font-bold text-[#5d6675]"> / {t("pricing.free.priceInterval")}</span></p>
            <div className="mt-5 rounded-2xl border border-black/10 bg-[#fbfbfd] px-4 py-3">
              <p className="text-xl font-black">{t("pricing.free.credits")}</p>
              <p className="mt-1 text-sm font-semibold text-[#5d6675]">{t("pricing.free.eligible")}</p>
              <CreditUsageExamples credits={100} />
            </div>
            <p className="mt-5 min-h-[72px] text-sm font-semibold leading-6 text-[#4f5868]">
              {t("pricing.free.description")}
            </p>
            <button
              type="button"
              onClick={() => router.push(accessToken ? "/studio" : `/auth?next=${encodeURIComponent("/studio")}`)}
              className="mt-6 rounded-xl bg-[#16171a] px-5 py-3 text-base font-black text-white transition active:scale-[0.98]"
            >
              {t("pricing.free.cta")}
            </button>
            <ul className="mt-6 space-y-3 text-sm font-semibold leading-6 text-[#313946]">
              {["image", "editing", "voice", "video", "watermark", "queue"].map((featureKey) => {
                const feature = t(`pricing.freeFeatures.${featureKey}`);
                return (
                  <li key={feature} className="flex gap-3">
                    <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-black text-[#111318]">✓</span>
                    <span>{feature}</span>
                  </li>
                );
              })}
            </ul>
          </article>
          {SUBSCRIPTION_PLANS.map((plan) => {
            const selectedCycle = selectedCycles[plan.id] || plan.defaultCycle;
            return (
              <SubscriptionPlanCard
                key={plan.id}
                plan={plan}
                cycle={selectedCycle}
                onCycleChange={(cycle) => setSelectedCycles((prev) => ({ ...prev, [plan.id]: cycle }))}
                onCheckout={() => startSubscriptionCheckout(plan.id, selectedCycle)}
                loading={loadingSubscription === `${plan.id}:${selectedCycle}`}
              />
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-[1360px] px-4 md:px-8">
        {message ? (
          <p className="mt-8 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm font-semibold text-[#705d1d]">
            {message}
          </p>
        ) : null}

        {checkoutState === "success" ? (
          <section className="mt-6 rounded-[2rem] border border-[#197a46]/20 bg-[#eefaf3] p-6 shadow-[0_18px_44px_rgba(25,122,70,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#197a46]">{t("billing.success.title")}</p>
            <h2 className="mt-2 text-3xl font-black">
              {matchingCheckoutPurchase ? t("billing.success.creditsAdded", { credits: matchingCheckoutPurchase.credits.toLocaleString() }) : t("billing.success.paymentReceived")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#3f6b52]">
              {matchingCheckoutPurchase
                ? t("billing.success.purchaseSummary", {
                    packId: matchingCheckoutPurchase.pack_id,
                    amount: formatUsd(matchingCheckoutPurchase.amount_cents),
                    status: formatStatus(matchingCheckoutPurchase.status, t)
                  })
                : checkoutProvider === "paypal" ? t("billing.success.paymentReceived") : t("billing.success.description")}
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
      </div>

      <section className="mx-auto max-w-[1360px] px-4 py-20 md:px-8">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("pricing.extraCredits.eyebrow")}</p>
            <h2 className="mt-2 text-4xl font-black tracking-normal">{t("pricing.extraCredits.title")}</h2>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-6 text-[#667084]">
            {t("pricing.extraCredits.description")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <article key={`price-extra-${pack.id}`} className={`rounded-[1.4rem] border bg-white p-5 shadow-[0_14px_36px_rgba(10,16,30,0.05)] ${pack.id === bestValuePack.id ? "border-[#08bff1]" : "border-black/10"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-black tracking-normal">{t(`pricing.creditPack.${creditPackMessageId(pack.id)}.name`)}</h3>
                  <p className="mt-2 text-3xl font-black tracking-tight text-[#17191f]">
                    {pack.credits.toLocaleString()}
                    <span className="ml-1.5 text-xs uppercase tracking-[0.1em] text-[#667084]">{t("pricing.credits")}</span>
                  </p>
                </div>
                <p className="text-2xl font-black">{formatUsd(pack.amountCents).replace(".00", "")}</p>
              </div>
              <p className="mt-4 min-h-[54px] text-sm font-medium leading-6 text-[#4f5a67]">{t(`pricing.creditPack.${creditPackMessageId(pack.id)}.idealFor`)}</p>
              <CreditUsageExamples credits={pack.credits} compact />
              <button
                type="button"
                onClick={() => startCheckout(pack.id)}
                disabled={Boolean(loadingPack)}
                className="mt-5 w-full rounded-xl bg-[#f0f2f5] px-5 py-3 text-sm font-black text-[#16171a] transition active:scale-[0.98] disabled:opacity-60"
              >
                {loadingPack === pack.id ? t("pricing.extraCredits.opening") : t("pricing.extraCredits.buy")}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1360px] gap-16 px-4 py-24 md:grid-cols-[0.7fr_1.3fr] md:px-8">
        <h2 className="text-5xl font-black tracking-normal md:sticky md:top-28 md:h-fit md:text-6xl">{t("pricing.faq.title")}</h2>
        <div className="space-y-20">
          {billingFaqs.map((faq) => (
            <article key={faq.q}>
              <h3 className="text-2xl font-black tracking-normal">{faq.q}</h3>
              <p className="mt-7 max-w-3xl text-xl font-medium leading-9 text-[#46464b]">{faq.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-white py-24">
        <div className="pointer-events-none absolute -left-[15rem] top-[-10rem] hidden h-[38rem] w-[32rem] rotate-[-24deg] rounded-[8rem] bg-[radial-gradient(circle_at_30%_20%,#55ef6d_0,#f6a3ff_34%,#7bc9ff_70%,transparent_72%)] opacity-80 blur-[1px] lg:block" />
        <div className="relative mx-auto max-w-[1480px] px-4 md:px-8">
          <div className="text-center">
            <p className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2 text-lg font-medium">{t("pricing.features.eyebrow")}</p>
            <h2 className="mx-auto mt-10 max-w-5xl text-[clamp(3.5rem,7vw,6.8rem)] font-black leading-[0.95] tracking-normal">
              {t("pricing.features.title")}
            </h2>
            <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-[#46464b]">
              {t("pricing.features.description")}
            </p>
          </div>

          <div className="mt-14 overflow-x-auto pb-4">
            <div className="min-w-[980px]">
              <div className="sticky top-0 z-10 grid grid-cols-[1.15fr_repeat(3,1fr)] items-center rounded-[1.75rem] border border-[#dff7ff] bg-white/95 px-8 py-8 shadow-[0_16px_40px_rgba(10,16,30,0.05)] backdrop-blur">
                <div />
                {comparisonPlanNames.map((name, index) => (
                  <div key={`header-${name}`} className="text-center">
                    <h3 className="text-5xl font-black tracking-normal">{name}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (comparisonPlanKeys[index] === "free") {
                          router.push(accessToken ? "/studio" : `/auth?next=${encodeURIComponent("/studio")}`);
                          return;
                        }
                        const plan = SUBSCRIPTION_PLANS[index - 1];
                        if (plan) startSubscriptionCheckout(plan.id, selectedCycles[plan.id] || plan.defaultCycle);
                      }}
                      disabled={Boolean(loadingSubscription)}
                      className="mt-2 text-base font-medium text-[#333338] disabled:opacity-60"
                    >
                      {loadingSubscription ? t("pricing.extraCredits.opening") : `${t("pricing.comparison.getStarted")} ->`}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-12 space-y-16">
                {planComparisonSections.map((section) => (
                  <div key={section.title}>
                    <div className="flex items-center gap-3 border-b border-black/15 pb-4">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#9da3a6] text-xs font-black text-[#9da3a6]">^</span>
                      <h3 className="text-2xl font-black tracking-normal">{section.title}</h3>
                    </div>
                    <div className="mt-2">
                      {section.rows.map((row, rowIndex) => (
                        <div
                          key={`${section.title}-${row.label}`}
                          className={`grid grid-cols-[1.15fr_repeat(3,1fr)] items-center rounded-[1.2rem] px-6 py-4 text-xl ${
                            rowIndex % 2 === 0 ? "bg-[#fafafa]" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3 font-medium">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d4d8dc] text-[10px] font-black text-[#b5bbc0]">i</span>
                            <span>{row.label}</span>
                          </div>
                          {row.values.map((value, valueIndex) => (
                            <div key={`${row.label}-${valueIndex}`} className="px-4 text-center font-medium">
                              {value === t("pricing.comparison.value.included") ? <CheckMark /> : value === t("pricing.comparison.value.notIncluded") ? <CrossMark /> : value}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#f8f8f6] py-20">
        <div className="mx-auto max-w-[1360px] px-4 md:px-8">
          <p className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2 text-lg font-medium">{t("pricing.testimonials.eyebrow")}</p>
          <h2 className="mt-10 max-w-[760px] text-[clamp(4rem,8vw,7rem)] font-black leading-[0.95] tracking-normal">
            {t("pricing.testimonials.title")}
          </h2>
          <p className="mt-10 text-xl font-medium text-[#333338]">{t("pricing.testimonials.description")}</p>
        </div>

        <div className="mt-24 overflow-x-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-8 px-4 md:px-8">
            {testimonials.map((item, index) => (
              <article
                key={item.title}
                className={`h-[420px] w-[380px] shrink-0 snap-center rounded-[2rem] p-12 shadow-[0_16px_45px_rgba(15,15,18,0.08)] ${item.tone}`}
                style={{ transform: `rotate(${index % 2 === 0 ? "-3deg" : "3deg"})` }}
              >
                <p className="text-sm font-black">{t("pricing.testimonials.rating")}</p>
                <h3 className="mt-3 text-4xl font-black leading-none tracking-normal">"{item.title}"</h3>
                <p className="mt-10 text-lg font-medium leading-7">"{item.body}"</p>
                <p className="mt-8 text-base font-black">{item.name}</p>
                <p className="text-sm font-semibold opacity-75">{item.role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1360px] gap-8 px-4 py-20 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{t("pricing.modelGuide.eyebrow")}</p>
          <h2 className="mt-3 text-4xl font-black tracking-normal">{t("pricing.modelGuide.title")}</h2>
          <p className="mt-4 text-base font-medium leading-7 text-[#535d6e]">
            {t("pricing.modelGuide.description")}
          </p>
        </article>
        <article className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
          {pricingRows.slice(0, 7).map((row) => (
            <div key={`${row.provider}-${row.workflow}`} className="grid grid-cols-[1fr_auto] gap-4 border-b border-black/10 px-6 py-5 last:border-b-0">
              <div>
                <p className="text-base font-black">{row.label}</p>
                <p className="mt-1 text-sm font-medium text-[#667084]">{row.workflow}</p>
              </div>
              <p className="text-right text-base font-black">{row.unitNote}</p>
            </div>
          ))}
        </article>
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
