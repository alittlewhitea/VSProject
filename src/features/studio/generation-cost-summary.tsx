"use client";

import { formatApproximateCreditValue } from "../../lib/billing";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type GenerationCostSummaryProps = {
  estimatedCredits: number;
  creditBalance: number | null;
  translate: Translate;
};

export function GenerationCostSummary({ estimatedCredits, creditBalance, translate }: GenerationCostSummaryProps) {
  const afterGeneration = creditBalance === null ? null : Math.max(0, creditBalance - estimatedCredits);
  const remainingGenerations = afterGeneration === null || estimatedCredits <= 0
    ? null
    : Math.floor(afterGeneration / estimatedCredits);
  const shortfall = creditBalance === null ? 0 : Math.max(0, estimatedCredits - creditBalance);

  return (
    <div className="mt-2.5 flex min-h-8 flex-col gap-1 rounded-[10px] border border-[#ebe8ff] bg-[#faf9ff] px-3 py-2 text-[10px] font-semibold leading-4 text-[#746b86] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="inline-flex items-center gap-1.5 font-bold text-[#6955d9]">
        <span aria-hidden="true">{"\u24d8"}</span>
        {translate("studio.cost.estimatedValue", { amount: formatApproximateCreditValue(estimatedCredits) })}
      </span>
      {shortfall > 0 ? (
        <span className="font-bold tabular-nums text-[#c2415d]">
          {translate("studio.cost.insufficientTitle", { credits: shortfall.toLocaleString() })}
        </span>
      ) : afterGeneration !== null && remainingGenerations !== null ? (
        <span className="tabular-nums text-[#5d6472]">
          {translate("studio.cost.afterGeneration", {
            credits: afterGeneration.toLocaleString(),
            count: remainingGenerations.toLocaleString()
          })}
        </span>
      ) : (
        <span className="text-[#8a8193]">{translate("studio.cost.valueDisclaimer")}</span>
      )}
    </div>
  );
}
