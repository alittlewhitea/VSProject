"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CREDIT_PACKS, formatUsd } from "../../lib/billing";
import { TopNav } from "../../components/top-nav";
import { AppButton } from "../../components/ui/button";
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
    loadCredits(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return undefined;

    if (checkoutState === "success") {
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
      setMessage("Checkout was cancelled. No credits were added.");
    }
    return undefined;
  }, [accessToken, checkoutSessionId, checkoutState]);

  const bestValuePack = useMemo(
    () => CREDIT_PACKS.reduce((best, pack) => (pack.credits / pack.amountCents > best.credits / best.amountCents ? pack : best), CREDIT_PACKS[0]),
    []
  );

  async function startCheckout(packId: string) {
    if (!accessToken) return;
    setLoadingPack(packId);
    setMessage("");
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
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-5">
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
                onClick={() => accessToken && loadCredits(accessToken)}
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
