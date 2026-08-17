import { formatApproximateCreditValue } from "../../lib/billing";
import { GenerationCostSummary } from "./generation-cost-summary";
import { ModelPicker, type ModelPickerOption } from "./model-picker";

type Translate = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

type VoiceGender = "all" | "female" | "male";
type MusicFormat = "mp3" | "wav" | "pcm";

type AudioSettingsProps = {
  provider: string;
  providerOptions: ModelPickerOption[];
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
  creditBalance: number | null;
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

const controlClass = "h-10 min-w-0 rounded-[10px] border border-[#eaecf0] bg-white px-3 text-[13px] font-bold text-[#344054] outline-none";

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
  creditBalance,
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
    <div className="bg-white px-4 py-4 text-start">
      <ModelPicker value={provider} options={providerOptions} translate={translate} onChange={onProviderChange} />
      <div className="mb-3 grid gap-2">
        <div className="mt-3 grid grid-cols-2 gap-2">
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
                className={`inline-flex h-10 items-center justify-center rounded-[10px] border px-3 text-[12px] font-bold ${ttsTimestamps ? "border-[#cfc9ff] bg-[#f1efff] text-[#6a5af9]" : "border-[#eaecf0] bg-white text-[#667085]"}`}
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

      {isElevenLabs ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[#eaecf0] bg-white p-3">
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
          <label className="rounded-xl border border-[#eaecf0] bg-white p-3">
            <span className="mb-3 block text-xs font-black text-[#6e7d95]">{translate("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
            <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(event) => onTtsStabilityChange(Number(event.target.value))} className="w-full accent-[#151b2a]" />
          </label>
          <label className="rounded-xl border border-[#eaecf0] bg-white p-3">
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
