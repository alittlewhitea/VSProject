import { AvatarComposerInput } from "./avatar-composer-input";
type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type VoiceGender = "all" | "female" | "male";

type AvatarWorkbenchProps = {
  compact?: boolean;
  prompt: string;
  referenceImagesText: string;
  referenceImageUrls: string[];

  isH3MaxAvatar: boolean;
  avatarScriptTooLong: boolean;
  avatarScriptMeta: string;
  avatarDuration: string;
  avatarVoiceGender: VoiceGender;
  avatarVoiceOptions: string[];
  ttsVoice: string;
  ttsLanguageCode: string;
  ttsStability: number;
  voiceGenderOptions: readonly { value: VoiceGender }[];
  languageOptions: readonly { value: string }[];
  translate: Translate;
  onPromptChange: (value: string) => void;
  onReferenceImagesTextChange: (value: string) => void;
  onReferenceFiles: (files: FileList | null) => Promise<void>;
  onFileError: () => void;
  onStartImageGuide: () => void;
  onAvatarVoiceGenderChange: (value: VoiceGender) => void;
  onTtsVoiceChange: (value: string) => void;
  onTtsLanguageCodeChange: (value: string) => void;
  onTtsStabilityChange: (value: number) => void;
};

export function AvatarWorkbench({
  compact=false,
  prompt,
  referenceImagesText,
  referenceImageUrls,

  isH3MaxAvatar,
  avatarScriptTooLong,
  avatarScriptMeta,
  avatarDuration,
  avatarVoiceGender,
  avatarVoiceOptions,
  ttsVoice,
  ttsLanguageCode,
  ttsStability,
  voiceGenderOptions,
  languageOptions,
  translate,
  onPromptChange,
  onReferenceImagesTextChange,
  onReferenceFiles,
  onFileError,
  onStartImageGuide,
  onAvatarVoiceGenderChange,
  onTtsVoiceChange,
  onTtsLanguageCodeChange,
  onTtsStabilityChange
}: AvatarWorkbenchProps) {
  const handleReferenceFiles = (files: FileList | null) => {
    onReferenceFiles(files).catch(onFileError);
  };

  const voiceControls = <>          {!isH3MaxAvatar ? (
            <div className="mt-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--studio-text)]">{translate("studio.avatar.voice")}</span>
                <span className="rounded-full bg-[var(--studio-panel)] px-3 py-1 text-xs font-semibold text-[var(--studio-muted)]">{ttsVoice}</span>
              </div>
              <div className="mb-3 inline-grid grid-cols-3 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] p-1 shadow-none">
                {voiceGenderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onAvatarVoiceGenderChange(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      avatarVoiceGender === option.value
                        ? "bg-[var(--studio-primary)] text-white shadow-none"
                        : "text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]"
                    }`}
                  >
                    {translate(`studio.voiceGender.${option.value}`)}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select value={ttsVoice} onChange={(event) => onTtsVoiceChange(event.target.value)} className="min-h-12 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-bold text-[var(--studio-text)] outline-none">
                  {avatarVoiceOptions.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
                </select>
                <select value={ttsLanguageCode} onChange={(event) => onTtsLanguageCodeChange(event.target.value)} className="min-h-12 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-bold text-[var(--studio-text)] outline-none">
                  {languageOptions.map((item) => (
                    <option key={item.value || "auto"} value={item.value}>{translate(`studio.languageOption.${item.value || "auto"}`)}</option>
                  ))}
                </select>
                <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-muted)]">{translate("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                  <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(event) => onTtsStabilityChange(Number(event.target.value))} className="mt-1 w-full accent-[var(--studio-primary)]" />
                </label>
              </div>
            </div>
          ) : null}</>;
  if(compact) return <AvatarComposerInput prompt={prompt} images={referenceImageUrls} url={referenceImagesText} meta={avatarScriptMeta} tooLong={avatarScriptTooLong} translate={translate} onPrompt={onPromptChange} onUrl={onReferenceImagesTextChange} onFiles={onReferenceFiles} onFileError={onFileError} onGuide={onStartImageGuide}>{!isH3MaxAvatar ? voiceControls : null}</AvatarComposerInput>;
  return (
    <div>
      <div className="grid gap-4 px-4 pb-4 pt-3">
        <div
          className="rounded-2xl border border-dashed border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleReferenceFiles(event.dataTransfer.files);
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text)]">{translate("studio.field.avatarImage")}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--studio-muted)]">{translate("studio.reference.avatarHint")}</p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-[var(--studio-accent-border)] bg-[var(--studio-panel)] px-3 text-xs font-bold text-[var(--studio-accent)] transition hover:bg-[var(--studio-accent-soft)]">
              {translate("studio.action.chooseImage")}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleReferenceFiles(event.target.files)} />
            </label>
          </div>
          <input
            value={referenceImagesText}
            onChange={(event) => onReferenceImagesTextChange(event.target.value)}
            placeholder="https://.../avatar.jpg"
            className="h-10 w-full rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
          />
          {referenceImageUrls.length ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {referenceImageUrls.slice(0, 4).map((url, index) => (
                <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none">
                  <img src={url} alt={`Avatar input ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <button type="button" onClick={onStartImageGuide} className="mt-3 block min-h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-3 text-start transition hover:bg-[var(--studio-accent-soft)]">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-accent)]">{translate("studio.avatar.guideEyebrow")}</span>
              <span className="mt-2 block text-sm font-semibold text-[var(--studio-text)]">{translate("studio.avatar.guideTitle")}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-[var(--studio-muted)]">{translate("studio.avatar.guideDescription")}</span>
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text)]">{translate(isH3MaxAvatar ? "studio.field.prompt" : "studio.avatarWorkbench.script")}</div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${avatarScriptTooLong ? "bg-[var(--studio-error-soft)] text-[var(--studio-error)]" : "bg-[var(--studio-success-soft)] text-[var(--studio-success)]"}`}>
              {avatarScriptMeta}
            </span>
          </div>
          <textarea
            dir="auto"
            rows={7}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[180px] w-full resize-y rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-4 text-[15px] leading-[1.55] text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]"
            placeholder={translate("studio.placeholder.avatar")}
          />
          <div className={`mt-[18px] text-xs font-semibold leading-5 ${avatarScriptTooLong ? "text-[var(--studio-error)]" : "text-[var(--studio-muted)]"}`}>
            {avatarScriptTooLong
              ? translate("studio.avatar.scriptTooLong")
              : isH3MaxAvatar
                ? translate("studio.videoWorkbench.imageHeroDescription")
              : translate("studio.avatar.billingHint", { duration: avatarDuration })}
          </div>

          {voiceControls}
        </div>
      </div>
    </div>
  );
}
