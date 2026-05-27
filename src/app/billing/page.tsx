"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CREDIT_PACKS, formatUsd } from "../../lib/billing";
import { CREDIT_LOW_BALANCE_THRESHOLD, MODEL_PRICING_ROWS } from "../../lib/model-pricing";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";
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
  stripe_checkout_id: string;
  pack_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: "pending" | "completed" | "cancelled" | "failed";
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

function formatReason(reason: string) {
  const labels: Record<string, string> = {
    signup_bonus: "Signup bonus",
    stripe_checkout: "Credit purchase",
    generation_task: "Generation",
    generation_refund: "Failed generation refund",
    manual_top_up_dev: "Development top-up"
  };
  return labels[reason] || reason.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    completed: "Completed",
    cancelled: "Cancelled",
    failed: "Failed"
  };
  return labels[status] || status;
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>([]);
  const [message, setMessage] = useState("");
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [pricingRows, setPricingRows] = useState<PricingGuideRow[]>(MODEL_PRICING_ROWS);
  const trackedLoginSuccessRef = useRef<string | null>(null);
  const checkoutState = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      if (!token) {
        router.replace("/auth?next=/billing");
        return;
      }
      const userId = data.session?.user.id || null;
      if (userId && trackedLoginSuccessRef.current !== userId) {
        trackedLoginSuccessRef.current = userId;
        trackEvent("login_success", { surface: "billing" }, token);
      }
      setAccessToken(token);
    });
  }, [router]);

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
        storageWarning?: string;
      };
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (Array.isArray(payload.ledger)) setLedger(payload.ledger);
      if (Array.isArray(payload.purchases)) setPurchases(payload.purchases);
      if (payload.storageWarning) setMessage(payload.storageWarning);
      return payload;
    } catch {
      setMessage("Credit balance is temporarily unavailable.");
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

    if (checkoutState === "success") {
      trackEvent("checkout_success", { stripe_checkout_id: checkoutSessionId || null }, accessToken);
      setMessage("Payment completed. Refreshing your balance from Stripe confirmation...");
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        const payload = await loadCredits(accessToken);
        const matchingPurchase = payload?.purchases?.find(
          (purchase) => !checkoutSessionId || purchase.stripe_checkout_id === checkoutSessionId
        );
        if (matchingPurchase?.status === "completed" || attempts >= 8) {
          window.clearInterval(timer);
          setMessage(
            matchingPurchase?.status === "completed"
              ? "Payment confirmed. Credits have been added to your balance."
              : "Payment completed. Stripe confirmation may still be processing; refresh again in a moment."
          );
        }
      }, 1800);
      return () => window.clearInterval(timer);
    } else if (checkoutState === "cancelled") {
      trackEvent("checkout_cancelled", {}, accessToken);
      setMessage("Checkout was cancelled. No credits were added.");
    }
    return undefined;
  }, [accessToken, checkoutSessionId, checkoutState]);

  const bestValuePack = useMemo(
    () => CREDIT_PACKS.reduce((best, pack) => (pack.credits / pack.amountCents > best.credits / best.amountCents ? pack : best), CREDIT_PACKS[0]),
    []
  );
  const matchingCheckoutPurchase = useMemo(
    () => purchases.find((purchase) => !checkoutSessionId || purchase.stripe_checkout_id === checkoutSessionId) || null,
    [checkoutSessionId, purchases]
  );
  const lowBalance = typeof balance === "number" && balance < CREDIT_LOW_BALANCE_THRESHOLD;

  async function startCheckout(packId: string) {
    if (!accessToken) return;
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
      if (!response.ok || !payload.url) throw new Error(payload.error || "Unable to start checkout.");
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout.");
      setLoadingPack(null);
    }
  }

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-[1540px] px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="hero-sheen rounded-[2rem] border border-black/5 bg-gradient-to-b from-white to-[#f7f9fd] p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">Credit Wallet</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Top up when you need it.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c6374]">
                No subscription. Buy credits once and spend them across image and video generation.
              </p>
            </div>
            <div className="glass rounded-2xl px-5 py-4 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[#637084]">Current balance</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{balance === null ? "--" : balance.toLocaleString()}</p>
              <button
                type="button"
                onClick={() => {
                  trackEvent("balance_refreshed", { surface: "billing" }, accessToken);
                  accessToken && loadCredits(accessToken);
                }}
                disabled={!accessToken || refreshingCredits}
                className="mt-3 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#1d1d1f] disabled:opacity-50"
              >
                {refreshingCredits ? "Refreshing" : "Refresh balance"}
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <p className="mt-5 rounded-xl border border-[#d8b85d]/30 bg-[#fff8df] px-4 py-3 text-sm text-[#705d1d]">
            {message}
          </p>
        ) : null}

        {checkoutState === "success" ? (
          <section className="mt-5 rounded-3xl border border-[#197a46]/20 bg-[#eefaf3] p-5 shadow-[0_18px_44px_rgba(25,122,70,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#197a46]">Checkout success</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {matchingCheckoutPurchase
                    ? `${matchingCheckoutPurchase.credits.toLocaleString()} credits added`
                    : "Payment received"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#3f6b52]">
                  {matchingCheckoutPurchase
                    ? `${matchingCheckoutPurchase.pack_id} package · ${formatUsd(matchingCheckoutPurchase.amount_cents)} · ${formatStatus(matchingCheckoutPurchase.status)}`
                    : "Stripe confirmation is still syncing. Your balance refreshes automatically on this page."}
                </p>
              </div>
              <div className="rounded-2xl border border-[#197a46]/15 bg-white/80 px-4 py-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-[#667084]">Checkout ID</p>
                <p className="mt-1 max-w-[360px] break-all font-mono text-xs text-[#1d1d1f]">
                  {checkoutSessionId || matchingCheckoutPurchase?.stripe_checkout_id || "Waiting for Stripe"}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {lowBalance ? (
          <section className="mt-5 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm text-[#705d1d]">
            Your balance is below {CREDIT_LOW_BALANCE_THRESHOLD} credits. Top up before larger video renders or high-quality image batches.
          </section>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <article key={pack.id} className={`card rounded-3xl p-6 ${pack.id === bestValuePack.id ? "tone-mint" : "bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">{pack.id === bestValuePack.id ? "Best value" : "Credit pack"}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{pack.name}</h2>
                </div>
                <p className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold">{formatUsd(pack.amountCents)}</p>
              </div>
              <p className="mt-5 text-4xl font-semibold tracking-tight">{pack.credits.toLocaleString()}</p>
              <p className="mt-1 text-sm text-[#667084]">credits</p>
              <p className="mt-4 min-h-[56px] text-sm leading-7 text-[#535d6e]">{pack.description}</p>
              <p className="mt-3 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs leading-5 text-[#5f6779]">{pack.idealFor}</p>
              <div className="mt-6">
                <AppButton
                  variant="dark"
                  className="w-full"
                  onClick={() => startCheckout(pack.id)}
                  disabled={Boolean(loadingPack)}
                >
                  {loadingPack === pack.id ? "Opening checkout..." : "Buy credits"}
                </AppButton>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="card tone-blue rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Pricing clarity</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Know the credit cost before checkout.</h2>
            <p className="mt-3 text-sm leading-7 text-[#535d6e]">
              DreamFace credits are estimated from fal.ai model pricing, with room for provider variance, retries, storage, and payment fees.
              Final task charges are visible in your ledger and refunded automatically when a provider failure is confirmed.
            </p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#667084]">Image floor</p>
                <p className="mt-1 text-2xl font-semibold">4 credits</p>
                <p className="mt-1 text-xs leading-5 text-[#667084]">Fast FLUX drafts can stay very low cost.</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#667084]">Video rule</p>
                <p className="mt-1 text-2xl font-semibold">per second</p>
                <p className="mt-1 text-xs leading-5 text-[#667084]">Longer video generations scale with duration.</p>
              </div>
            </div>
          </article>

          <article className="card rounded-3xl p-5 md:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Model credit guide</h2>
                <p className="mt-1 text-sm text-[#667084]">Typical estimates. Exact cost appears beside Generate.</p>
              </div>
              <p className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#4f596b]">
                Live fal pricing + fallback
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
              <div className="grid grid-cols-[1fr_0.8fr_0.65fr] border-b border-black/10 bg-[#f7f9fd] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#667084]">
                <p>Model</p>
                <p>Workflow</p>
                <p className="text-right">Credits</p>
              </div>
              {pricingRows.map((row) => (
                <div key={`${row.provider}-${row.workflow}`} className="grid grid-cols-[1fr_0.8fr_0.65fr] gap-3 border-b border-black/5 px-4 py-3 last:border-b-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#1d1d1f]">{row.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          row.source === "live" ? "bg-[#eefaf3] text-[#197a46]" : "bg-[#fff8df] text-[#705d1d]"
                        }`}
                      >
                        {row.source === "live" ? "live" : "fallback"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#667084]">
                      {row.source === "live" && typeof row.liveUnitPriceUsd === "number"
                        ? `fal API: $${row.liveUnitPriceUsd.toFixed(4)} / ${row.unit || "unit"}`
                        : row.falBasis}
                    </p>
                  </div>
                  <p className="text-sm text-[#4f596b]">{row.workflow}</p>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1d1d1f]">{row.unitNote}</p>
                    <p className="mt-1 text-xs text-[#667084]">typ. {row.typicalCredits}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="card rounded-3xl p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Credit activity</h2>
            <p className="mt-2 text-sm leading-7 text-[#667084]">
              Purchases, signup credits, generation charges, and refunds appear here.
            </p>
          </article>

          <article className="card rounded-3xl p-5 md:p-6">
            {ledger.length ? (
              <div className="space-y-3">
                {ledger.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{formatReason(entry.reason)}</p>
                      <p className="mt-1 text-xs text-[#667084]">
                        {formatDate(entry.created_at)}
                        {entry.reference_id ? ` · ${entry.reference_id}` : ""}
                      </p>
                    </div>
                    <p className={`shrink-0 text-lg font-semibold ${entry.amount >= 0 ? "text-[#197a46]" : "text-[#b03439]"}`}>
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                No credit activity yet.
              </p>
            )}
          </article>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="card rounded-3xl p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Stripe purchases</h2>
            <p className="mt-2 text-sm leading-7 text-[#667084]">
              Checkout ID, package, credits, payment time, and confirmation status are shown for payment traceability.
            </p>
          </article>

          <article className="card rounded-3xl p-5 md:p-6">
            {purchases.length ? (
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div key={purchase.id} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {purchase.pack_id} · {purchase.credits.toLocaleString()} credits
                        </p>
                        <p className="mt-1 break-all text-xs text-[#667084]">
                          Stripe checkout ID: {purchase.stripe_checkout_id}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          purchase.status === "completed"
                            ? "border-[#197a46]/20 bg-[#eefaf3] text-[#197a46]"
                            : "border-[#d8b85d]/30 bg-[#fff8df] text-[#705d1d]"
                        }`}
                      >
                        {formatStatus(purchase.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[#667084] sm:grid-cols-3">
                      <p>Amount: {formatUsd(purchase.amount_cents)}</p>
                      <p>Created: {formatDate(purchase.created_at)}</p>
                      <p>Updated: {formatDate(purchase.updated_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                No Stripe purchases yet.
              </p>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
