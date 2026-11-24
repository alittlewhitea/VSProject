import { formatApproximateCreditValue } from "../../lib/billing";
import { StudioSelectField } from "./studio-primitives";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type AvatarSettingsProps = {
  compact?: boolean;
  isHeygenAvatar?: boolean;
  dailyFreeLabel?: string;

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

export function AvatarSettings({
  compact=false,
  isHeygenAvatar=false,
  dailyFreeLabel,

  isH3MaxAvatar,
  duration,
  durationOptions,
  resolution,
  resolutionOptions,
  automaticDuration,
  scriptTooLong,
  estimatedCredits,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  translate,
  onDurationChange,
  onResolutionChange,
  onGenerate
}: AvatarSettingsProps) {
  return (
    <div className={`${compact?"df-avatar-settings ":""}bg-[var(--studio-panel)] px-4 py-4 text-start`}>
      <div className="mb-3 grid gap-2">
        <div className={`mt-3 grid gap-2 ${isH3MaxAvatar || isHeygenAvatar ? "grid-cols-2" : "grid-cols-1"}`}>
          {isHeygenAvatar || isH3MaxAvatar ? (
            <>
              <StudioSelectField
                icon="duration"
                label={translate("studio.field.duration")}
                value={duration}
                options={durationOptions.map((item) => ({ value: item, label: item }))}
                onValueChange={onDurationChange}
              />
              <StudioSelectField
                icon="resolution"
                label={translate("studio.field.resolution")}
                value={resolution}
                options={resolutionOptions.map((item) => ({ value: item, label: item }))}
                onValueChange={onResolutionChange}
              />
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
        {dailyFreeLabel ? <p role="status" className="mt-2 text-xs font-semibold text-[var(--studio-success)]">{dailyFreeLabel}</p> : null}
      </div>

    </div>
  );
}
