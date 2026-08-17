type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type VoiceGender = "all" | "female" | "male";

type AvatarWorkbenchProps = {
  canSubmit: boolean;
  prompt: string;
  referenceImagesText: string;
  referenceImageUrls: string[];
  isDreamfaceTalkingAvatar: boolean;
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
  canSubmit,
  prompt,
  referenceImagesText,
  referenceImageUrls,
  isDreamfaceTalkingAvatar,
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

  return (
    <div>
      <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f7] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#f1efff] text-sm font-black text-[#6a5af9]">
            {"\u25b6"}
          </span>
          <div>
            <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">{translate("studio.avatarWorkbench.studio")}</strong>
            <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">{translate("studio.avatarWorkbench.studioDescription")}</span>
          </div>
        </div>
        <div className={`inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-xs font-bold ${canSubmit ? "bg-[#ecfdf3] text-[#039855]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
          <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
          {canSubmit ? translate("studio.avatarWorkbench.ready") : translate("studio.avatarWorkbench.waiting")}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-4 pt-3">
        <div
          className="rounded-2xl border border-dashed border-[#cfc9ff] bg-[#faf9ff] p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleReferenceFiles(event.dataTransfer.files);
          }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.field.avatarImage")}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-[#8290a7]">{translate("studio.reference.avatarHint")}</p>
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-[#e2defe] bg-white px-3 text-xs font-bold text-[#6a5af9] transition hover:bg-[#f8f7ff]">
              {translate("studio.action.chooseImage")}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => handleReferenceFiles(event.target.files)} />
            </label>
          </div>
          <input
            value={referenceImagesText}
            onChange={(event) => onReferenceImagesTextChange(event.target.value)}
            placeholder="https://.../avatar.jpg"
            className="h-10 w-full rounded-[10px] border border-[#eaecf0] bg-white px-3 text-sm font-semibold text-[#344054] outline-none transition focus:border-[#8d80ff]"
          />
          {referenceImageUrls.length ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {referenceImageUrls.slice(0, 4).map((url, index) => (
                <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                  <img src={url} alt={`Avatar input ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <button type="button" onClick={onStartImageGuide} className="mt-3 block min-h-11 w-full rounded-xl border border-[#eaecf0] bg-white px-4 py-3 text-start transition hover:bg-[#fcfcfe]">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#2563eb]">{translate("studio.avatar.guideEyebrow")}</span>
              <span className="mt-2 block text-sm font-black text-[#283249]">{translate("studio.avatar.guideTitle")}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-[#8290a7]">{translate("studio.avatar.guideDescription")}</span>
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{translate("studio.avatarWorkbench.script")}</div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${avatarScriptTooLong ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
              {avatarScriptMeta}
            </span>
          </div>
          <textarea
            dir="auto"
            rows={7}
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[180px] w-full resize-y rounded-2xl border border-[#eaecf0] bg-white p-4 text-[15px] leading-[1.55] text-[#101828] outline-none placeholder:text-[#98a2b3]"
            placeholder={translate("studio.placeholder.avatar")}
          />
          <div className={`mt-[18px] text-xs font-extrabold leading-5 ${avatarScriptTooLong ? "text-[#e11d48]" : "text-[#96a2b7]"}`}>
            {avatarScriptTooLong
              ? translate("studio.avatar.scriptTooLong")
              : isDreamfaceTalkingAvatar
                ? translate("studio.avatarWorkbench.dreamfaceHint")
                : translate("studio.avatar.billingHint", { duration: avatarDuration })}
          </div>

          {!isDreamfaceTalkingAvatar ? (
            <div className="mt-4 rounded-2xl border border-[#eaecf0] bg-[#fcfcfe] p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-black text-[#283249]">{translate("studio.avatar.voice")}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#66758b]">{ttsVoice}</span>
              </div>
              <div className="mb-3 inline-grid grid-cols-3 rounded-full border border-[#758bac]/15 bg-white p-1 shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                {voiceGenderOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onAvatarVoiceGenderChange(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                      avatarVoiceGender === option.value
                        ? "bg-[#202633] text-white shadow-[0_8px_20px_rgba(32,38,51,0.14)]"
                        : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"
                    }`}
                  >
                    {translate(`studio.voiceGender.${option.value}`)}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select value={ttsVoice} onChange={(event) => onTtsVoiceChange(event.target.value)} className="min-h-12 rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none">
                  {avatarVoiceOptions.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
                </select>
                <select value={ttsLanguageCode} onChange={(event) => onTtsLanguageCodeChange(event.target.value)} className="min-h-12 rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none">
                  {languageOptions.map((item) => (
                    <option key={item.value || "auto"} value={item.value}>{translate(`studio.languageOption.${item.value || "auto"}`)}</option>
                  ))}
                </select>
                <label className="rounded-2xl border border-[#758bac]/15 bg-white px-4 py-2.5">
                  <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-[#8791a3]">{translate("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                  <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(event) => onTtsStabilityChange(Number(event.target.value))} className="mt-1 w-full accent-[#202633]" />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
