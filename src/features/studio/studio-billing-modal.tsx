"use client";

import type { RefObject } from "react";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  creditUsageCapacity,
  formatApproximateCreditValue,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;
const BILLING_CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"];

export type GenerationBillingContext = {
  requiredCredits: number;
  balance: number;
  providerLabel: string;
};

function yearlyDiscount(plan: (typeof SUBSCRIPTION_PLANS)[number]) {
  return Math.round((1 - plan.prices.yearly.amountCents / (plan.prices.monthly.amountCents * 12)) * 100);
}

function CreditUsageExamples({ credits, t, compact = false }: { credits: number; t: Translate; compact?: boolean }) {
  const capacity = creditUsageCapacity(credits);
  const examples = [
    { key: "images", value: capacity.images, label: t("studio.billing.usage.images"), icon: "🖼️" },
    { key: "videos", value: capacity.videos, label: t("studio.billing.usage.videos"), icon: "🎞️" },
    { key: "voiceovers", value: capacity.voiceovers, label: t("studio.billing.usage.voiceovers"), icon: "🎙️" },
    { key: "avatars", value: capacity.avatars, label: t("studio.billing.usage.avatars"), icon: "💬" }
  ];

  return (
    <div className={compact ? "mt-3 grid grid-cols-2 gap-1.5" : "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"}>
      {examples.map((example) => (
        <div key={example.key} className={compact ? "rounded-[10px] bg-[#f7f7fa] px-2 py-2" : "rounded-xl border border-[#ebe8ff] bg-white/80 px-2.5 py-2.5"}>
          <p className="flex items-start gap-1.5 text-[10px] font-bold text-[#7b8492]"><span aria-hidden="true">{example.icon}</span><span className="line-clamp-2 min-h-[28px] leading-[14px]">{example.label}</span></p>
          <p className={`mt-1 font-black leading-none tracking-tight text-[#171321] ${compact ? "text-base" : "text-lg"}`}>{example.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

type StudioBillingModalProps = {
  open: boolean;
  t: Translate;
  loadingItem: string | null;
  message: string;
  creditBalance: number | null;
  generationContext: GenerationBillingContext | null;
  selectedCycles: Record<string, BillingCycle>;
  scrollRef: RefObject<HTMLDivElement | null>;
  premiumLitePlanRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onAllCyclesChange: (cycle: BillingCycle) => void;
  onPlanCycleChange: (planId: string, cycle: BillingCycle) => void;
  onSubscriptionCheckout: (planId: string, cycle: BillingCycle) => void;
  onCreditCheckout: (packId: string) => void;
};

export function StudioBillingModal({
  open,
  t,
  loadingItem,
  message,
  creditBalance,
  generationContext,
  selectedCycles,
  scrollRef,
  premiumLitePlanRef,
  onClose,
  onAllCyclesChange,
  onSubscriptionCheckout,
  onCreditCheckout
}: StudioBillingModalProps) {
  if (!open) return null;

  const closeIfIdle = () => {
    if (!loadingItem) onClose();
  };
  const commonCycle = BILLING_CYCLES.find((cycle) => SUBSCRIPTION_PLANS.every((plan) => selectedCycles[plan.id] === cycle)) || "monthly";
  const recommendedPlan = generationContext
    ? SUBSCRIPTION_PLANS.find((plan) => {
        const cycle = selectedCycles[plan.id] || "monthly";
        return plan.prices[cycle].credits >= generationContext.requiredCredits;
      }) || SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1]
    : SUBSCRIPTION_PLANS.find((plan) => plan.id === "premium-lite") || SUBSCRIPTION_PLANS[0];
  const recommendedCycle = selectedCycles[recommendedPlan.id] || "monthly";
  const recommendedPrice = recommendedPlan.prices[recommendedCycle];
  const generationShortfall = generationContext
    ? Math.max(0, generationContext.requiredCredits - generationContext.balance)
    : 0;
  const recommendedGenerationCount = generationContext && generationContext.requiredCredits > 0
    ? Math.max(1, Math.floor(recommendedPrice.credits / generationContext.requiredCredits))
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#100b1d]/75 p-2 backdrop-blur-[8px] sm:p-4" onClick={closeIfIdle}>
      <section className="relative max-h-[96dvh] w-full max-w-[1080px] overflow-hidden rounded-[22px] border border-white/15 bg-[#fafafc] shadow-[0_40px_140px_rgba(8,4,20,0.55)] sm:max-h-[94vh] sm:rounded-[28px]" onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label={t("studio.billing.close")} onClick={closeIfIdle} disabled={Boolean(loadingItem)} className="absolute end-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-xl text-white backdrop-blur-md transition hover:bg-white/20 disabled:opacity-50 sm:end-5 sm:top-5">×</button>

        <div ref={scrollRef} className="max-h-[96dvh] overflow-y-auto sm:max-h-[94vh]">
          <header className="relative overflow-hidden bg-[radial-gradient(circle_at_82%_8%,rgba(160,104,255,0.42),transparent_34%),radial-gradient(circle_at_12%_110%,rgba(91,70,255,0.35),transparent_38%),linear-gradient(135deg,#171126,#2a184c_58%,#332064)] px-4 pb-7 pt-7 text-white sm:px-8 sm:pb-9 sm:pt-8">
            <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
            <div className="relative mx-auto max-w-3xl text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-base shadow-[inset_0_1px_0_rgba(255,255,255,.2)] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl">◆</div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#c7baff]">{t("studio.billing.premium")}</p>
              <h2 className="mt-2 text-[28px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[38px]">{t("studio.billing.plansTitle")}</h2>
              <p className="mx-auto mt-3 hidden max-w-2xl text-xs font-medium leading-5 text-white/65 sm:block sm:text-sm sm:leading-6">{t("studio.billing.description")}</p>

              <div className="mx-auto mt-5 grid max-w-[430px] grid-cols-3 rounded-[14px] border border-white/12 bg-black/20 p-1 backdrop-blur-md">
                {BILLING_CYCLES.map((cycle) => (
                  <button key={cycle} type="button" onClick={() => onAllCyclesChange(cycle)} className={`relative min-h-11 rounded-[10px] px-2 text-xs font-black transition ${commonCycle === cycle ? "bg-white text-[#24163d] shadow-[0_8px_22px_rgba(0,0,0,.2)]" : "text-white/65 hover:text-white"}`}>
                    <span>{t(`studio.billing.cycle.${cycle}`)}</span>
                    {cycle === "yearly" ? <span className={`ms-1 inline-flex rounded-full px-1.5 py-0.5 text-[8px] ${commonCycle === cycle ? "bg-[#eee9ff] text-[#6a4df5]" : "bg-white/12 text-[#d9ceff]"}`}>-35%</span> : null}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-bold text-white/55 sm:text-xs">
                <span className="inline-flex items-center gap-1.5"><span className="text-[#74e4bd]">●</span><span>🔒 PayPal</span></span>
                <span className="hidden sm:inline">◆ {t("studio.billing.premium")}</span>
                <span>{creditBalance === null ? "--" : creditBalance.toLocaleString()} {t("studio.common.credits")}</span>
              </div>
            </div>
          </header>

          <div className="px-3 pb-5 pt-4 sm:px-6 sm:pb-7 sm:pt-5">
            {message ? <p className="mx-auto mb-4 max-w-3xl rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#be123c]">{message}</p> : null}

            {generationContext ? (
              <section className="mx-auto mb-4 max-w-[930px] overflow-hidden rounded-[20px] border border-[#d9d1ff] bg-[linear-gradient(135deg,#f5f2ff,#fff_58%,#f9f7ff)] shadow-[0_12px_34px_rgba(105,82,224,0.11)]">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#6d56f7] text-sm font-black text-white">!</span>
                      <div>
                        <h3 className="text-lg font-black tracking-[-0.025em] text-[#211933]">{t("studio.cost.insufficientTitle", { credits: generationShortfall.toLocaleString() })}</h3>
                        <p className="mt-0.5 text-xs font-semibold text-[#766d84]">{generationContext.providerLabel} · {t("studio.cost.insufficientBody", { required: generationContext.requiredCredits.toLocaleString(), balance: generationContext.balance.toLocaleString() })}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold text-[#80758f]">{t("studio.cost.recommendedCapacity", { plan: t(`studio.billing.plan.${recommendedPlan.id}.name`), credits: recommendedPrice.credits.toLocaleString(), count: recommendedGenerationCount.toLocaleString() })}</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-2 lg:w-[390px]">
                    {[
                      { label: t("studio.cost.required"), value: generationContext.requiredCredits.toLocaleString(), note: `≈${formatApproximateCreditValue(generationContext.requiredCredits)}` },
                      { label: t("studio.cost.balance"), value: generationContext.balance.toLocaleString(), note: t("studio.common.credits") },
                      { label: t("studio.cost.shortfall"), value: generationShortfall.toLocaleString(), note: t("studio.common.credits") }
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white bg-white/80 px-2.5 py-2.5 text-center shadow-sm">
                        <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#91889e]">{item.label}</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-[#241a37]">{item.value}</p>
                        <p className="text-[9px] font-bold text-[#7764ec]">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[#e3ddff] bg-white/55 px-4 py-2 text-center text-[10px] font-semibold text-[#847b90]">{t("studio.cost.valueDisclaimer")}</div>
              </section>
            ) : null}

            <div className="mx-auto grid max-w-[930px] gap-4 lg:grid-cols-2 lg:items-stretch">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const cycle = selectedCycles[plan.id] || commonCycle || plan.defaultCycle;
                const price = plan.prices[cycle];
                const loading = loadingItem === `subscription:${plan.id}:${cycle}`;
                const visuallyHighlighted = generationContext ? plan.id === recommendedPlan.id : plan.highlight;
                const monthlyEquivalent = cycle === "yearly" && price.monthlyEquivalentCents ? price.monthlyEquivalentCents : null;
                const displayedPrice = monthlyEquivalent || price.amountCents;
                const displayedInterval = monthlyEquivalent ? "month" : price.interval;
                const discount = yearlyDiscount(plan);

                return (
                  <article key={plan.id} ref={plan.id === "premium-lite" ? premiumLitePlanRef : null} className={`relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border bg-white p-4 shadow-[0_10px_30px_rgba(27,16,49,0.07)] sm:p-5 ${visuallyHighlighted ? "border-[#8b74ff] ring-2 ring-[#ede9ff]" : "border-[#e6e3eb]"}`}>
                    {visuallyHighlighted ? <span className="absolute end-0 top-0 rounded-bl-xl bg-[linear-gradient(90deg,#7458ff,#9c5cf3)] px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-white">{t(`studio.billing.plan.${plan.id}.badge`)}</span> : null}

                    <div className="pe-24">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8a7cf5]">{visuallyHighlighted ? t("studio.billing.premium") : t(`studio.billing.plan.${plan.id}.badge`)}</p>
                      <h3 className="mt-1.5 text-xl font-black tracking-[-0.025em] text-[#171321] sm:text-2xl">{t(`studio.billing.plan.${plan.id}.name`)}</h3>
                    </div>

                    <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <strong className="text-[40px] font-black leading-none tracking-[-0.055em] text-[#171321] sm:text-[46px]">{formatUsd(displayedPrice).replace(".00", "")}</strong>
                      <span className="pb-1 text-sm font-bold text-[#7b7287]">/ {t(`studio.billing.interval.${displayedInterval}`)}</span>
                      {cycle === "yearly" ? <span className="mb-1 rounded-full bg-[#ecfdf3] px-2 py-1 text-[9px] font-black text-[#087a50]">-{discount}%</span> : null}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#7b7287]">{cycle === "yearly" ? `${formatUsd(price.amountCents).replace(".00", "")} / ${t("studio.billing.interval.year")}` : t("studio.billing.creditsRenew", { credits: price.credits.toLocaleString(), interval: t(`studio.billing.interval.${price.interval}`) })}</p>

                    <div className={`mt-4 rounded-2xl border p-3.5 ${visuallyHighlighted ? "border-[#ddd7ff] bg-[linear-gradient(135deg,#f5f2ff,#fcfbff)]" : "border-[#ebe8ee] bg-[#faf9fb]"}`}>
                      <div className="flex items-end justify-between gap-3">
                        <div><p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8a8193]">{t("studio.billing.includedCredits")}</p><p className="mt-1 text-2xl font-black tracking-tight text-[#171321]">{price.credits.toLocaleString()} <span className="text-[10px] uppercase tracking-[0.08em] text-[#81778e]">{t("studio.common.credits")}</span></p></div>
                        <span className="rounded-full border border-[#e4dfff] bg-white px-2 py-1 text-[9px] font-black text-[#715df5]">{t(`studio.billing.cycle.${cycle}`)}</span>
                      </div>
                      <CreditUsageExamples credits={price.credits} t={t} />
                    </div>

                    <button type="button" onClick={() => onSubscriptionCheckout(plan.id, cycle)} disabled={Boolean(loadingItem)} className={`mt-4 min-h-12 w-full rounded-xl px-4 text-sm font-black transition hover:-translate-y-px active:translate-y-0 disabled:opacity-60 ${visuallyHighlighted ? "bg-[linear-gradient(90deg,#7458ff,#6757f6_55%,#8d59f5)] text-white shadow-[0_10px_24px_rgba(106,90,249,0.24)]" : "bg-[#171321] text-white shadow-[0_10px_22px_rgba(23,19,33,0.16)]"}`}>{loading ? t("studio.billing.openingCheckout") : t(`studio.billing.plan.${plan.id}.cta`)}</button>

                    <div className="mt-4 grid gap-2 border-t border-[#f0edf3] pt-4 sm:grid-cols-2">
                      {plan.features.slice(0, 6).map((feature, index) => <p key={feature} className="flex min-w-0 gap-2 text-[11px] font-semibold leading-5 text-[#51485d]"><span className="shrink-0 text-[#6fdb9f]">✓</span><span>{t(`studio.billing.plan.${plan.id}.feature.${index}`)}</span></p>)}
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="mx-auto mt-4 flex max-w-[930px] flex-col gap-3 rounded-2xl border border-[#e8e5ec] bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f3f1f6] text-sm">◇</span><h3 className="text-sm font-black text-[#292330]">{t("studio.billing.free")}</h3><span className="rounded-full bg-[#f3f1f6] px-2 py-1 text-[9px] font-black text-[#81798a]">{t("studio.billing.currentPlan")}</span></div><p className="mt-1 ps-10 text-xs text-[#837a8c]">{t("studio.billing.trialCredits")} · 100 {t("studio.common.credits")}</p></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-[#766e80]">{[t("studio.billing.freeFeature.imageAudio"), t("studio.billing.freeFeature.history"), t("studio.billing.freeFeature.refund")].map((feature) => <span key={feature}>✓ {feature}</span>)}</div>
            </section>

            <section className="mx-auto mt-4 max-w-[930px] rounded-[20px] border border-[#e8e5ec] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8a7cf5]">{t("studio.billing.extraCredits")}</p><h3 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#171321]">{t("studio.billing.topUpTitle")}</h3></div>
                <p className="text-xs font-semibold text-[#81798a]">{t("studio.billing.currentBalance", { balance: creditBalance === null ? "--" : creditBalance.toLocaleString() })}</p>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {CREDIT_PACKS.map((pack) => {
                  const loading = loadingItem === `credits:${pack.id}`;
                  return (
                    <article key={pack.id} className="rounded-2xl border border-[#ebe8ee] bg-[#fcfbfd] p-3.5 transition hover:border-[#d8d0ff] hover:bg-white">
                      <div className="flex items-start justify-between gap-2"><div><h4 className="text-xs font-black text-[#292330]">{t(`studio.billing.pack.${pack.id}`)}</h4><p className="mt-1 text-lg font-black text-[#171321]">{formatUsd(pack.amountCents).replace(".00", "")}</p></div><span className="rounded-lg bg-[#f0edff] px-2 py-1 text-[9px] font-black text-[#705af5]">{pack.credits.toLocaleString()}</span></div>
                      <CreditUsageExamples credits={pack.credits} t={t} compact />
                      <button type="button" onClick={() => onCreditCheckout(pack.id)} disabled={Boolean(loadingItem)} className="mt-3 min-h-10 w-full rounded-[10px] border border-[#ded9e5] bg-white px-3 text-xs font-black text-[#342c3d] transition hover:border-[#8e7aff] hover:text-[#6955f6] disabled:opacity-60">{loading ? t("studio.billing.opening") : t("studio.billing.recharge")}</button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
