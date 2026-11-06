"use client";

import { formatApproximateCreditValue } from "../../lib/billing";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type GenerationCostSummaryProps = {
  compact?: boolean;
  estimatedCredits: number;
  creditBalance: number | null;
  translate: Translate;
};

export function GenerationCostSummary({ compact = false, estimatedCredits, creditBalance, translate }: GenerationCostSummaryProps) {
  const afterGeneration = creditBalance === null ? null : Math.max(0, creditBalance - estimatedCredits);
  const remainingGenerations = afterGeneration === null || estimatedCredits <= 0
    ? null
    : Math.floor(afterGeneration / estimatedCredits);
  const shortfall = creditBalance === null ? 0 : Math.max(0, estimatedCredits - creditBalance);

  return (
    <div className={compact ? "df-composer-cost" : "mt-2.5 flex min-h-8 flex-col gap-1 rounded-[10px] border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] px-3 py-2 text-[10px] font-semibold leading-4 text-[var(--studio-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"}>
      <span className="inline-flex items-center gap-1.5 font-bold text-[var(--studio-accent)]">
        <span aria-hidden="true">{"\u24d8"}</span>
        {translate("studio.cost.estimatedValue", { amount: formatApproximateCreditValue(estimatedCredits) })}
      </span>
      {shortfall > 0 ? (
        <span className="font-bold tabular-nums text-[var(--studio-error)]">
          {translate("studio.cost.insufficientTitle", { credits: shortfall.toLocaleString() })}
        </span>
      ) : afterGeneration !== null && remainingGenerations !== null ? (
        <span className="tabular-nums text-[var(--studio-muted)]">
          {translate("studio.cost.afterGeneration", {
            credits: afterGeneration.toLocaleString(),
            count: remainingGenerations.toLocaleString()
          })}
        </span>
      ) : (
        <span className="text-[var(--studio-muted)]">{translate("studio.cost.valueDisclaimer")}</span>
      )}
    </div>
  );
}
