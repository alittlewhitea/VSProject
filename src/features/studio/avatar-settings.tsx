import { formatApproximateCreditValue } from "../../lib/billing";
import type { ReactNode } from "react";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type AvatarSettingsProps = {
  compact?: boolean;
  isHeygenAvatar?: boolean;
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

const controlClass = "h-10 min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-[13px] font-bold text-[var(--studio-text)] outline-none";

function AvatarParameter({label, kind, children}: {label: string; kind: "duration" | "resolution" | "ratio"; children: ReactNode}) {
  return <label className="df-avatar-parameter" title={label}>
    <span className="sr-only">{label}</span>
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === "duration" ? <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></> : kind === "resolution" ? <><path d="M4 8V4h4m-4 0 5 5m11-1V4h-4m4 0-5 5M4 16v4h4m-4 0 5-5m11 1v4h-4m4 0-5-5"/></> : <rect x="3" y="5" width="18" height="14" rx="2"/>}
    </svg>
    {children}
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
  </label>;
}

export function AvatarSettings({
  compact=false,
  isHeygenAvatar=false,
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
    <div className={`${compact?"df-avatar-settings ":""}bg-[var(--studio-panel)] px-4 py-4 text-start`}>
      <div className="mb-3 grid gap-2">
        <div className={`mt-3 grid gap-2 ${isDreamfaceTalkingAvatar || isH3MaxAvatar ? "grid-cols-2" : "grid-cols-1"}`}>
          {isHeygenAvatar ? <><AvatarParameter label={translate("studio.field.duration")} kind="duration"><select aria-label={translate("studio.field.duration")} value={duration} onChange={event=>onDurationChange(event.target.value)} className={controlClass}>{durationOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></AvatarParameter><AvatarParameter label={translate("studio.field.resolution")} kind="resolution"><select aria-label={translate("studio.field.resolution")} value={resolution} onChange={event=>onResolutionChange(event.target.value)} className={controlClass}>{resolutionOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></AvatarParameter></> : isDreamfaceTalkingAvatar ? (
            <>
              <AvatarParameter label={translate("studio.field.duration")} kind="duration"><select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>
                {durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></AvatarParameter>
              <AvatarParameter label={translate("studio.field.aspectRatio")} kind="ratio"><select value={ratio} onChange={(event) => onRatioChange(event.target.value)} className={controlClass}>
                {ratioOptions.map((item) => <option key={item} value={item}>{item === "source" ? translate("studio.option.sourceImage") : item}</option>)}
              </select></AvatarParameter>
            </>
          ) : isH3MaxAvatar ? (
            <>
              <AvatarParameter label={translate("studio.field.duration")} kind="duration"><select value={duration} onChange={(event) => onDurationChange(event.target.value)} className={controlClass}>
                {durationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></AvatarParameter>
              <AvatarParameter label={translate("studio.field.resolution")} kind="resolution"><select value={resolution} onChange={(event) => onResolutionChange(event.target.value)} className={controlClass}>
                {resolutionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></AvatarParameter>
            </>
          ) : (
            <span className={`inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-[13px] font-bold ${scriptTooLong ? "border-[var(--studio-border)] bg-[var(--studio-error-soft)] text-[var(--studio-error)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]"}`}>
              {automaticDuration} {translate("studio.option.automatic")}
            </span>
          )}

        </div>

        <button type="button" onClick={onGenerate} disabled={generateDisabled} data-avatar-generate className="df-generate-button inline-flex min-h-[48px] w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-[var(--studio-primary)] px-3 py-3 text-sm font-semibold text-white shadow-none transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55">
          <span>{isSubmitting ? translate("studio.generate.creating") : isAuthenticated ? translate("studio.generate.button") : translate("studio.auth.signInToGenerate")}</span>
          <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-white/15 px-2.5 text-[11px] font-bold text-white/95">{estimatedCredits} {translate("studio.common.credits")} · ≈{formatApproximateCreditValue(estimatedCredits)}</span>
        </button>
        {dailyFreeLabel ? <p role="status" className="mt-2 text-xs font-semibold text-emerald-700">{dailyFreeLabel}</p> : null}
      </div>

    </div>
  );
}
