type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type VoiceGender = "all" | "female" | "male";
type MusicFormat = "mp3" | "wav" | "pcm";

type AudioSettingsProps = {
  provider: string;
  providerOptions: Array<{ value: string; label: string }>;
  isElevenLabs: boolean;
  audioVoiceOptions: string[];
  languageOptions: readonly { value: string }[];
  voiceGenderOptions: readonly { value: VoiceGender }[];
  ttsVoice: string;
  ttsLanguageCode: string;
  ttsTimestamps: boolean;
  audioVoiceGender: VoiceGender;
  ttsStability: number;
  textNormalization: string;
  textNormalizationOptions: readonly { value: string }[];
  musicSampleRate: number;
  musicBitrate: number;
  musicFormat: MusicFormat;
  estimatedCredits: number;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  translate: Translate;
  onProviderChange: (value: string) => void;
  onTtsVoiceChange: (value: string) => void;
  onTtsLanguageCodeChange: (value: string) => void;
  onTtsTimestampsChange: (value: boolean) => void;
  onAudioVoiceGenderChange: (value: VoiceGender) => void;
  onTtsStabilityChange: (value: number) => void;
  onTextNormalizationChange: (value: string) => void;
  onMusicSampleRateChange: (value: number) => void;
  onMusicBitrateChange: (value: number) => void;
  onMusicFormatChange: (value: MusicFormat) => void;
  onGenerate: () => void;
};

const controlClass = "min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none";

export function AudioSettings({
  provider,
  providerOptions,
  isElevenLabs,
  audioVoiceOptions,
  languageOptions,
  voiceGenderOptions,
  ttsVoice,
  ttsLanguageCode,
  ttsTimestamps,
  audioVoiceGender,
  ttsStability,
  textNormalization,
  textNormalizationOptions,
  musicSampleRate,
  musicBitrate,
  musicFormat,
  estimatedCredits,
  generateDisabled,
  isSubmitting,
  isAuthenticated,
  translate,
  onProviderChange,
  onTtsVoiceChange,
  onTtsLanguageCodeChange,
  onTtsTimestampsChange,
  onAudioVoiceGenderChange,
  onTtsStabilityChange,
  onTextNormalizationChange,
  onMusicSampleRateChange,
  onMusicBitrateChange,
  onMusicFormatChange,
  onGenerate
}: AudioSettingsProps) {
  return (
    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(event) => onProviderChange(event.target.value)} className={controlClass}>
            {providerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          {isElevenLabs ? (
            <>
              <select value={ttsVoice} onChange={(event) => onTtsVoiceChange(event.target.value)} className={controlClass}>
                {audioVoiceOptions.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
              </select>
              <select value={ttsLanguageCode} onChange={(event) => onTtsLanguageCodeChange(event.target.value)} className={controlClass}>
                {languageOptions.map((item) => (
                  <option key={item.value || "auto"} value={item.value}>{translate(`studio.languageOption.${item.value || "auto"}`)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onTtsTimestampsChange(!ttsTimestamps)}
                className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${ttsTimestamps ? "border-[#20c997]/25 bg-[#20c997]/10 text-[#17916e]" : "border-[#758bac]/15 bg-white text-[#66758b]"}`}
              >
                {translate("studio.field.wordTimestamps")}: {translate(ttsTimestamps ? "studio.state.on" : "studio.state.off")}
              </button>
            </>
          ) : (
            <>
              <select value={musicSampleRate} onChange={(event) => onMusicSampleRateChange(Number(event.target.value))} className={controlClass}>
                {[16000, 24000, 32000, 44100].map((value) => <option key={value} value={value}>{value} Hz</option>)}
              </select>
              <select value={musicBitrate} onChange={(event) => onMusicBitrateChange(Number(event.target.value))} className={controlClass}>
                {[32000, 64000, 128000, 256000].map((value) => <option key={value} value={value}>{value / 1000} kbps</option>)}
              </select>
              <select value={musicFormat} onChange={(event) => onMusicFormatChange(event.target.value as MusicFormat)} className={`${controlClass} uppercase`}>
                {(["mp3", "wav", "pcm"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </>
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

      {isElevenLabs ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
              <span>{translate("studio.music.voiceGender")}</span>
              <span>{translate(`studio.music.${audioVoiceGender}`)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {voiceGenderOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => onAudioVoiceGenderChange(option.value)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${audioVoiceGender === option.value ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                  {translate(`studio.music.${option.value}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
            <span className="mb-3 block text-xs font-black text-[#6e7d95]">{translate("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
            <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(event) => onTtsStabilityChange(Number(event.target.value))} className="w-full accent-[#151b2a]" />
          </label>
          <label className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
            <span className="mb-3 block text-xs font-black text-[#6e7d95]">{translate("studio.field.textNormalization")}</span>
            <select value={textNormalization} onChange={(event) => onTextNormalizationChange(event.target.value)} className="h-10 w-full rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 text-sm font-black text-[#66758b] outline-none">
              {textNormalizationOptions.map((item) => <option key={item.value} value={item.value}>{translate(`studio.textNormalization.${item.value}`)}</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
