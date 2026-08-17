import { formatApproximateCreditValue } from "../../lib/billing";
import { GenerationCostSummary } from "./generation-cost-summary";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type AvatarSettingsProps = {
  isDreamfaceTalkingAvatar: boolean;
  duration: string;
  durationOptions: string[];
  ratio: string;
  ratioOptions: string[];
  automaticDuration: string;
  scriptTooLong: boolean;
  estimatedCredits: number;
  creditBalance: number | null;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  translate: Translate;
  onDurationChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onGenerate: () => void;
};

const controlClass = "h-10 min-w-0 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-[13px] font-bold text-[#344054] outline-none";

export function AvatarSettings({
  isDreamfaceTalkingAvatar,
  duration,
  durationOptions,
  ratio,
  ratioOptions,
  automaticDuration,
  scriptTooLong,
  estimatedCredits,
  creditBalance,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  translate,
  onDurationChange,
  onRatioChange,
  onGenerate
}: AvatarSettingsProps) {
  const hintCards = [
    {
      icon: "$",
      title: translate("studio.textImage.hintCostTitle"),
      body: translate("studio.avatarWorkbench.hintCostBody")
    },
    {
      icon: "@",
      title: translate("studio.avatarWorkbench.hintImageTitle"),
      body: translate("studio.avatarWorkbench.hintImageBody")
    },
    {
      icon: "*",
      title: translate("studio.avatarWorkbench.hintVoiceTitle"),
      body: translate(
        isDreamfaceTalkingAvatar ? "studio.avatarWorkbench.dreamfaceHint" : "studio.avatar.billingHint",
        { duration: automaticDuration }
      )
    }
  ];

  return (
    <div className="bg-white px-4 py-4 text-start">
      <div className="mb-3 grid gap-2">
        <div className="mt-3 grid grid-cols-2 gap-2">
          {isDreamfaceTalkingAvatar ? (
            <>
              <select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>
                {durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={ratio} onChange={(event) => onRatioChange(event.target.value)} className={controlClass}>
                {ratioOptions.map((item) => <option key={item} value={item}>{item === "source" ? translate("studio.option.sourceImage") : item}</option>)}
              </select>
            </>
          ) : (
            <span className={`inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-[13px] font-bold ${scriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-[#eaecf0] bg-white text-[#344054]"}`}>
              {automaticDuration} {translate("studio.option.automatic")}
            </span>
          )}

          <span className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#eaecf0] bg-white px-3 text-[13px] font-bold text-[#344054]">
            {estimatedCredits} {translate("studio.common.credits")}
          </span>
        </div>

        <button type="button" onClick={onGenerate} disabled={generateDisabled} className="inline-flex h-[46px] w-full items-center justify-center gap-3 rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] px-5 text-[15px] font-extrabold text-white shadow-[0_10px_24px_rgba(106,90,249,0.2)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          {isAuthenticated ? <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">{estimatedCredits} {translate("studio.common.credits")} · ≈{formatApproximateCreditValue(estimatedCredits)}</span> : null}
          <span className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
        </button>
        <GenerationCostSummary estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate} />
      </div>

      <div className="hidden">
        {hintCards.map((card) => (
          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-3.5 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,138,0,0.13),rgba(255,61,129,0.13))]">{card.icon}</span>
            <span>
              <strong className="block text-[13px] font-black text-[#33405a]">{card.title}</strong>
              <span className="mt-1 block text-xs font-bold leading-[1.35] text-[#8390a6]">{card.body}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
