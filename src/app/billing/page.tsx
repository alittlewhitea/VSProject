"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CREDIT_PACKS, formatUsd } from "../../lib/billing";
import { CREDIT_LOW_BALANCE_THRESHOLD, MODEL_PRICING_ROWS } from "../../lib/model-pricing";
import { TopNav } from "../../components/top-nav";
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

const billingFaqs = [
  {
    q: "How can I test DreamFace?",
    a: "Create a free account and use the starting credits to try image generation, image editing, voice, and short video workflows before buying a pack."
  },
  {
    q: "How much does DreamFace cost?",
    a: "DreamFace uses one-time credit packs instead of a fixed subscription. Starter is $5, Creator is $10, and Studio is $25. Each pack adds credits to your wallet and can be spent across supported models."
  },
  {
    q: "What are credits?",
    a: "Credits are DreamFace's single balance for creative work. Different providers and models use different amounts, so the studio shows an estimated cost before you submit a generation."
  },
  {
    q: "Do credits roll over?",
    a: "Purchased credits stay in your wallet while your account is active. Generation charges and provider refunds are tracked in your ledger so you can audit every credit movement."
  },
  {
    q: "How can I get more credits?",
    a: "Open Billing, choose a pack, and complete Stripe checkout. Your balance refreshes automatically after Stripe confirms the payment."
  },
  {
    q: "What is the difference between packs?",
    a: "All packs unlock the same studio features. Larger packs simply give you more room for batches, iterations, upscale passes, audio, and short video experiments."
  },
  {
    q: "Can I use credits for video?",
    a: "Yes. Video models usually cost more than image models because pricing scales with duration, resolution, and provider rules. The estimate appears before generation."
  },
  {
    q: "What happens if a generation fails?",
    a: "When a provider failure is confirmed, DreamFace records a refund entry in your ledger and returns the related credits to your balance."
  }
];

const testimonials = [
  {
    title: "Campaigns feel faster",
    body: "We can test visual directions, voice options, and short motion ideas in one place without rebuilding the brief every time.",
    name: "Mia Chen",
    role: "Growth Lead",
    tone: "bg-[#e8f8e8] text-[#173d17]"
  },
  {
    title: "Simple enough for non-designers",
    body: "The team stopped asking where to start. They open the studio, pick a workflow, and know the credit cost before running it.",
    name: "Jordan Lee",
    role: "Creative Ops",
    tone: "bg-[#f4e8fb] text-[#3e2557]"
  },
  {
    title: "Great for iteration",
    body: "We use it for thumbnail rounds, product moodboards, upscale passes, and early video concepts before production begins.",
    name: "Avery Patel",
    role: "Brand Producer",
    tone: "bg-[#daf5fb] text-[#073f4a]"
  },
  {
    title: "No mystery billing",
    body: "The credit ledger makes internal approvals easier. We can see what was purchased, what was spent, and what was refunded.",
    name: "Sam Rivera",
    role: "Studio Manager",
    tone: "bg-[#e9f8e4] text-[#243f19]"
  },
  {
    title: "From prompt to polish",
    body: "The range is the win: fast drafts, premium image models, voice, enhancement, and video tests all share the same wallet.",
    name: "Noor Ahmed",
    role: "Content Director",
    tone: "bg-[#f7e8ff] text-[#402750]"
  },
  {
    title: "Built for repeat work",
    body: "Saved projects and predictable credit estimates make it practical for weekly content cycles, not just one-off experiments.",
    name: "Elena Brooks",
    role: "Marketing Lead",
    tone: "bg-[#e5f2ff] text-[#17334d]"
  }
];

const planComparisonSections = [
  {
    title: "Pay-as-you-go generation capacity",
    rows: CREDIT_PACKS[0].examples.map((example) => ({
      label: example.label,
      values: CREDIT_PACKS.map((pack) => {
        const match = pack.examples.find((item) => item.label === example.label);
        return match ? `${match.count} ${match.note}` : "Not included";
      })
    }))
  },
  {
    title: "Studio access",
    rows: [
      { label: "Text to image", values: ["Full access", "Full access", "Full access"] },
      { label: "Image editing", values: ["Full access", "Full access", "Full access"] },
      { label: "Text to video", values: ["Short tests", "Creator batches", "Campaign batches"] },
      { label: "Image to video", values: ["Short tests", "Creator batches", "Campaign batches"] },
      { label: "Voice generation", values: ["Included", "Included", "Included"] },
      { label: "Prompt and creation history", values: ["Included", "Included", "Included"] }
    ]
  },
  {
    title: "Wallet & billing",
    rows: [
      { label: "Billing model", values: ["Pay as you go", "Pay as you go", "Pay as you go"] },
      { label: "Subscription required", values: ["No", "No", "No"] },
      { label: "Credits expire monthly", values: ["No", "No", "No"] },
      { label: "Failed provider job refunds", values: ["Included", "Included", "Included"] },
      { label: "Best for", values: ["Testing prompts", "Weekly creative work", "Campaign production"] }
    ]
  }
];

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
        signupBonusBlockedByIp?: boolean;
        storageWarning?: string;
      };
      if (typeof payload.balance === "number") setBalance(payload.balance);
      if (Array.isArray(payload.ledger)) setLedger(payload.ledger);
      if (Array.isArray(payload.purchases)) setPurchases(payload.purchases);
      if (payload.storageWarning) setMessage(payload.storageWarning);
      else if (payload.signupBonusBlockedByIp) {
        setMessage("This network has already used the free trial credits. Purchased credits can still be used normally.");
      }
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
    }

    if (checkoutState === "cancelled") {
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
      if (!response.ok || !payload.url) throw new Error(payload.error || "Unable to start checkout.");
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout.");
      setLoadingPack(null);
    }
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
            Price
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-[clamp(3.25rem,8vw,7.6rem)] font-black leading-[0.95] tracking-normal">
            Compare pay-as-you-go plans and features
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg font-medium leading-8 text-[#333338] md:text-xl">
            DreamFace currently offers individual credit packs only. There are no monthly or yearly subscriptions: buy credits when you need them, then spend them across images, video, editing, upscaling, and voice.
          </p>

          <div className="mx-auto mt-9 flex w-fit rounded-full bg-white p-1.5 shadow-[0_12px_35px_rgba(20,20,22,0.08)]">
            <span className="rounded-full bg-[#07bff2] px-7 py-3 text-sm font-black text-[#051216]">For Individuals</span>
          </div>

          {accessToken ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-[1.75rem] border border-black/10 bg-white/80 px-5 py-4 text-left shadow-[0_18px_48px_rgba(10,16,30,0.08)] sm:mx-auto sm:w-fit sm:flex-row">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6a6a72]">Current balance</p>
              <p className="mt-1 text-3xl font-black">{balance === null ? "--" : balance.toLocaleString()} credits</p>
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
              {refreshingCredits ? "Refreshing" : "Refresh"}
            </button>
          </div>
          ) : null}
        </div>

        <div className="relative mx-auto mt-8 grid max-w-[1360px] gap-7 px-4 md:px-8 lg:grid-cols-3 lg:items-start">
          {CREDIT_PACKS.map((pack, index) => {
            const isFeatured = pack.id === bestValuePack.id;
            const title = pack.name.replace(" Pack", "");
            const accent = index === 2 ? "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_80%_8%,rgba(171,225,255,0.92),transparent_24%),radial-gradient(circle_at_72%_38%,rgba(255,215,250,0.95),transparent_34%),radial-gradient(circle_at_88%_78%,rgba(127,233,164,0.72),transparent_34%)]" : "";

            return (
              <article
                key={pack.id}
                className={`relative isolate min-h-[720px] overflow-hidden rounded-[2.25rem] bg-white p-7 text-left shadow-[0_22px_60px_rgba(25,25,28,0.10)] md:p-9 ${
                  isFeatured ? "border-[3px] border-[#c984ff]" : "border border-white"
                } ${accent}`}
              >
                <div className="mb-8 inline-flex rounded-full bg-[#f1f1f1] px-4 py-2 text-xs font-black text-[#3d3d42]">Pay as you go</div>

                <h2 className="text-5xl font-black tracking-normal text-[#0d4d4f] md:text-6xl">{title}</h2>
                <p className="mt-8 text-3xl font-medium">
                  {formatUsd(pack.amountCents).replace(".00", "")}
                  <span className="text-2xl"> one-time</span>
                </p>
                <p className="mt-8 min-h-[96px] text-lg font-medium leading-8 text-[#40533b]">{pack.description}</p>

                <button
                  type="button"
                  onClick={() => startCheckout(pack.id)}
                  disabled={Boolean(loadingPack)}
                  className={`mt-8 rounded-xl px-5 py-3 text-2xl font-black text-[#151517] transition active:scale-[0.98] disabled:opacity-60 ${
                    isFeatured ? "bg-[#08bff1]" : "bg-[#d9d9d9]"
                  }`}
                >
                  {loadingPack === pack.id ? "Opening..." : "Get started"}
                </button>

                <div className={`mt-7 rounded-2xl border px-5 py-4 text-lg font-black ${isFeatured ? "border-black/60 bg-white" : "border-[#06bff2] bg-white/80"}`}>
                  {pack.credits.toLocaleString()} credits
                </div>
                <p className="mt-5 text-base font-black">See what you can get with {pack.credits.toLocaleString()} credits</p>

                <div className="mt-7 space-y-7 text-lg leading-8">
                  <div>
                    <p className="font-black">Generation:</p>
                    <ul className="mt-2 space-y-2">
                      {pack.examples.slice(0, 5).map((example) => (
                        <li key={`${pack.id}-${example.label}`} className="pl-2">
                          <span className="mr-2">.</span>
                          {example.count} {example.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-black">Plan notes:</p>
                    <ul className="mt-2 space-y-2">
                      {(index === 0
                        ? ["Starter room for image and short video tests", "No subscription or monthly commitment"]
                        : index === 1
                          ? ["More room for weekly batches", "Same model access with a bigger balance"]
                          : ["Best value per dollar", "Campaign-sized creative room", "More premium video experiments"]
                      ).map((feature) => (
                        <li key={feature} className="pl-2">
                          <span className="mr-2">.</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
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
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#197a46]">Checkout success</p>
            <h2 className="mt-2 text-3xl font-black">
              {matchingCheckoutPurchase ? `${matchingCheckoutPurchase.credits.toLocaleString()} credits added` : "Payment received"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#3f6b52]">
              {matchingCheckoutPurchase
                ? `${matchingCheckoutPurchase.pack_id} package - ${formatUsd(matchingCheckoutPurchase.amount_cents)} - ${formatStatus(matchingCheckoutPurchase.status)}`
                : "Stripe confirmation is still syncing. Your balance refreshes automatically on this page."}
            </p>
          </section>
        ) : null}

        {lowBalance ? (
          <section className="mt-6 rounded-2xl border border-[#d8b85d]/30 bg-[#fff8df] px-5 py-4 text-sm font-semibold text-[#705d1d]">
            Your balance is below {CREDIT_LOW_BALANCE_THRESHOLD} credits. Top up before larger video renders or high-quality image batches.
          </section>
        ) : null}
      </div>

      <section className="mx-auto grid max-w-[1360px] gap-16 px-4 py-24 md:grid-cols-[0.7fr_1.3fr] md:px-8">
        <h2 className="text-5xl font-black tracking-normal md:sticky md:top-28 md:h-fit md:text-6xl">Price FAQs</h2>
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
            <p className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2 text-lg font-medium">Plan features</p>
            <h2 className="mx-auto mt-10 max-w-5xl text-[clamp(3.5rem,7vw,6.8rem)] font-black leading-[0.95] tracking-normal">
              Compare credit packs and creation capacity
            </h2>
            <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-[#46464b]">
              Each pack uses the same DreamFace studio. The main difference is how many assets you can generate before topping up again.
            </p>
          </div>

          <div className="mt-14 overflow-x-auto pb-4">
            <div className="min-w-[980px]">
              <div className="sticky top-0 z-10 grid grid-cols-[1.15fr_repeat(3,1fr)] items-center rounded-[1.75rem] border border-[#dff7ff] bg-white/95 px-8 py-8 shadow-[0_16px_40px_rgba(10,16,30,0.05)] backdrop-blur">
                <div />
                {CREDIT_PACKS.map((pack) => (
                  <div key={`header-${pack.id}`} className="text-center">
                    <h3 className="text-5xl font-black tracking-normal">{pack.name.replace(" Pack", "")}</h3>
                    <button
                      type="button"
                      onClick={() => startCheckout(pack.id)}
                      disabled={Boolean(loadingPack)}
                      className="mt-2 text-base font-medium text-[#333338] disabled:opacity-60"
                    >
                      {loadingPack === pack.id ? "Opening..." : "Get started ->"}
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
                              {value === "Included" ? <CheckMark /> : value === "Not included" ? <CrossMark /> : value}
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
          <p className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2 text-lg font-medium">Testimonials</p>
          <h2 className="mt-10 max-w-[760px] text-[clamp(4rem,8vw,7rem)] font-black leading-[0.95] tracking-normal">
            What customers are saying about us
          </h2>
          <p className="mt-10 text-xl font-medium text-[#333338]">Spoiler, they have got some pretty nice things to say.</p>
        </div>

        <div className="mt-24 overflow-x-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-8 px-4 md:px-8">
            {testimonials.map((item, index) => (
              <article
                key={item.title}
                className={`h-[420px] w-[380px] shrink-0 snap-center rounded-[2rem] p-12 shadow-[0_16px_45px_rgba(15,15,18,0.08)] ${item.tone}`}
                style={{ transform: `rotate(${index % 2 === 0 ? "-3deg" : "3deg"})` }}
              >
                <p className="text-sm font-black">5 out of 5 Stars</p>
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
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">Model guide</p>
          <h2 className="mt-3 text-4xl font-black tracking-normal">Typical credit costs</h2>
          <p className="mt-4 text-base font-medium leading-7 text-[#535d6e]">
            Exact pricing appears next to the Generate button. Live fal pricing is used when available, with fallback estimates for continuity.
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

      <section className="mx-auto grid max-w-[1360px] gap-8 px-4 pb-24 md:px-8 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
          <h2 className="text-3xl font-black tracking-normal">Credit activity</h2>
          <div className="mt-6 space-y-3">
            {ledger.length ? (
              ledger.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl bg-[#f7f7f5] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black">{formatReason(entry.reason)}</p>
                    <p className="mt-1 text-xs font-medium text-[#667084]">{formatDate(entry.created_at)}</p>
                  </div>
                  <p className={`shrink-0 text-lg font-black ${entry.amount >= 0 ? "text-[#197a46]" : "text-[#b03439]"}`}>
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount.toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-sm font-semibold text-[#667084]">No credit activity yet.</p>
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_18px_48px_rgba(10,16,30,0.06)]">
          <h2 className="text-3xl font-black tracking-normal">Stripe purchases</h2>
          <div className="mt-6 space-y-3">
            {purchases.length ? (
              purchases.slice(0, 5).map((purchase) => (
                <div key={purchase.id} className="rounded-2xl bg-[#f7f7f5] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-black">
                      {purchase.pack_id} - {purchase.credits.toLocaleString()} credits
                    </p>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-black">{formatStatus(purchase.status)}</span>
                  </div>
                  <p className="mt-2 break-all text-xs font-medium text-[#667084]">Stripe checkout ID: {purchase.stripe_checkout_id}</p>
                  <p className="mt-2 text-xs font-medium text-[#667084]">
                    {formatUsd(purchase.amount_cents)} - {formatDate(purchase.updated_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-[#f7f7f5] px-4 py-3 text-sm font-semibold text-[#667084]">No Stripe purchases yet.</p>
            )}
          </div>
        </article>
      </section>
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
