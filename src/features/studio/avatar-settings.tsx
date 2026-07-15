type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type AvatarSettingsProps = {
  provider: string;
  providerOptions: Array<{ value: string; label: string }>;
  isDreamfaceTalkingAvatar: boolean;
  duration: string;
  durationOptions: string[];
  ratio: string;
  ratioOptions: string[];
  automaticDuration: string;
  scriptTooLong: boolean;
  estimatedCredits: number;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  translate: Translate;
  onProviderChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onGenerate: () => void;
};

const controlClass = "min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none";

export function AvatarSettings({
  provider,
  providerOptions,
  isDreamfaceTalkingAvatar,
  duration,
  durationOptions,
  ratio,
  ratioOptions,
  automaticDuration,
  scriptTooLong,
  estimatedCredits,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  translate,
  onProviderChange,
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
    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(event) => onProviderChange(event.target.value)} className={controlClass}>
            {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

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
            <span className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${scriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-[#758bac]/15 bg-white text-[#43516a]"}`}>
              {automaticDuration} {translate("studio.option.automatic")}
            </span>
          )}

          <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
            {estimatedCredits} {translate("studio.common.credits")}
          </span>
        </div>

        <button type="button" onClick={onGenerate} disabled={generateDisabled} className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          {isAuthenticated ? <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">{estimatedCredits} {translate("studio.common.credits")}</span> : null}
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
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
