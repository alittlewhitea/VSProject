import { formatApproximateCreditValue } from "../../lib/billing";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type AvatarSettingsProps = {
  dailyFreeLabel?: string;
  isDreamfaceTalkingAvatar: boolean;
  isH3MaxAvatar: boolean;
  duration: string;
  durationOptions: string[];
  resolution: string;
  resolutionOptions: string[];
  ratio: string;
  ratioOptions: string[];
  automaticDuration: string;
  scriptTooLong: boolean;
  estimatedCredits: number;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  translate: Translate;
  onDurationChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onGenerate: () => void;
};

const controlClass = "h-10 min-w-0 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-[13px] font-bold text-[#344054] outline-none";

export function AvatarSettings({
  dailyFreeLabel,
  isDreamfaceTalkingAvatar,
  isH3MaxAvatar,
  duration,
  durationOptions,
  resolution,
  resolutionOptions,
  ratio,
  ratioOptions,
  automaticDuration,
  scriptTooLong,
  estimatedCredits,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  translate,
  onDurationChange,
  onResolutionChange,
  onRatioChange,
  onGenerate
}: AvatarSettingsProps) {
  return (
    <div className="bg-white px-4 py-4 text-start">
      <div className="mb-3 grid gap-2">
        <div className={`mt-3 grid gap-2 ${isDreamfaceTalkingAvatar || isH3MaxAvatar ? "grid-cols-2" : "grid-cols-1"}`}>
          {isDreamfaceTalkingAvatar ? (
            <>
              <select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>
                {durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={ratio} onChange={(event) => onRatioChange(event.target.value)} className={controlClass}>
                {ratioOptions.map((item) => <option key={item} value={item}>{item === "source" ? translate("studio.option.sourceImage") : item}</option>)}
              </select>
            </>
          ) : isH3MaxAvatar ? (
            <>
              <select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>
                {durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={resolution} onChange={(event) => onResolutionChange(event.target.value)} className={controlClass}>
                {resolutionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </>
          ) : (
            <span className={`inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-[13px] font-bold ${scriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-[#eaecf0] bg-white text-[#344054]"}`}>
              {automaticDuration} {translate("studio.option.automatic")}
            </span>
          )}

        </div>

        <button type="button" onClick={onGenerate} disabled={generateDisabled} data-avatar-generate className="inline-flex min-h-[48px] w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#744bfb,#6757f6_55%,#7d53ff)] px-3 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(106,90,249,0.2)] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-white/20 px-2.5 text-[11px] font-bold text-white/95">{estimatedCredits} {translate("studio.common.credits")} · ≈{formatApproximateCreditValue(estimatedCredits)}</span>
        </button>
        {dailyFreeLabel ? <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{dailyFreeLabel}</p> : null}
      </div>

    </div>
  );
}
