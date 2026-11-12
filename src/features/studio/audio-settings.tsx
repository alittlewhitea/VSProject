"use client";

import { useState } from "react";
import { StudioComposerGenerate, StudioComposerParameter } from "./studio-composer-controls";
import { GenerationCostSummary } from "./generation-cost-summary";
import { ModelPicker, type ModelPickerOption } from "./model-picker";
import type {HeygenVoiceOptions,HeygenVoiceError} from "../../lib/heygen-voice";
import {HeygenVoiceParameters,HeygenVoiceAdvanced} from "./heygen-voice-controls";

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
  isGeminiTts?: boolean;
  isHeygenVoice: boolean;
  heygenVoice: HeygenVoiceOptions;
  heygenVoiceFree: boolean;
  heygenVoiceError: HeygenVoiceError | null;
  locale: string;
  onHeygenVoiceChange: (options:HeygenVoiceOptions)=>void;
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

const controlClass = "h-10 min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-[13px] font-bold text-[var(--studio-text)] outline-none";

export function AudioSettings({
  provider,
  providerOptions,
  isElevenLabs,
  isGeminiTts,
  isHeygenVoice,
  heygenVoice,
  heygenVoiceFree,
  heygenVoiceError,
  locale,
  onHeygenVoiceChange,
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
  const [advancedOpen,setAdvancedOpen]=useState(false);
  return <div className="df-audio-settings df-composer-settings">
    <div className="df-composer-toolbar">
      <ModelPicker inline value={provider} options={providerOptions} translate={translate} onChange={onProviderChange}/>
      <div className="df-composer-parameters">
        {isHeygenVoice ? <HeygenVoiceParameters options={heygenVoice} onChange={onHeygenVoiceChange} translate={translate} locale={locale}/> : isGeminiTts ? <span data-speech-format className="px-3 py-2 text-xs font-semibold text-[var(--studio-muted)]">WAV</span> : isElevenLabs ? <>
          <StudioComposerParameter kind="voice" label={translate("studio.field.voice")}><select aria-label={translate("studio.field.voice")} title={translate("studio.field.voice")} value={ttsVoice} onChange={event=>onTtsVoiceChange(event.target.value)} className={controlClass}>{audioVoiceOptions.map(voice=><option key={voice} value={voice}>{voice}</option>)}</select></StudioComposerParameter>
          <StudioComposerParameter kind="language" label={translate("studio.field.language")}><select aria-label={translate("studio.field.language")} title={translate("studio.field.language")} value={ttsLanguageCode} onChange={event=>onTtsLanguageCodeChange(event.target.value)} className={controlClass}>{languageOptions.map(item=><option key={item.value||"auto"} value={item.value}>{translate(`studio.languageOption.${item.value||"auto"}`)}</option>)}</select></StudioComposerParameter>
        </> : <StudioComposerParameter kind="format" label={translate("studio.music.format")}><select aria-label={translate("studio.music.format")} title={translate("studio.music.format")} value={musicFormat} onChange={event=>onMusicFormatChange(event.target.value as MusicFormat)} className={controlClass}>{(["mp3","wav","pcm"] as const).map(value=><option key={value} value={value}>{value.toUpperCase()}</option>)}</select></StudioComposerParameter>}
      </div>
      {!isGeminiTts ? <button type="button" data-audio-advanced-trigger aria-expanded={advancedOpen} onClick={()=>setAdvancedOpen(value=>!value)} className="df-composer-more">{translate(advancedOpen?"studio.workbench.lessSettings":"studio.workbench.moreSettings")}</button> : null}
      <StudioComposerGenerate disabled={generateDisabled} submitting={isSubmitting} authenticated={isAuthenticated} credits={estimatedCredits} translate={translate} onGenerate={onGenerate}/>
    </div>
    <GenerationCostSummary compact estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate}/>
    {isHeygenVoice ? <div className="px-1 py-2 text-xs leading-5">
      {heygenVoiceFree ? <p data-heygen-voice-free role="status" className="font-semibold text-[var(--studio-accent)]">{translate("studio.heygenVoice.freeNotice")}</p> : null}
      {heygenVoiceError&&heygenVoiceError!=="missing_text" ? <p role="alert" className="text-[var(--studio-error)]">{translate(heygenVoiceError==="invalid_reference"?"studio.heygenVoice.invalidReference":"studio.heygenVoice.invalidOptions")}</p> : null}
    </div> : null}
    {advancedOpen && !isGeminiTts ? <div data-audio-advanced className="df-composer-advanced">
      {isHeygenVoice ? <HeygenVoiceAdvanced options={heygenVoice} onChange={onHeygenVoiceChange} translate={translate}/> : isElevenLabs ? <>
        <button type="button" data-audio-timestamps aria-pressed={ttsTimestamps} onClick={()=>onTtsTimestampsChange(!ttsTimestamps)} className="df-composer-more">{translate("studio.field.wordTimestamps")}: {translate(ttsTimestamps?"studio.state.on":"studio.state.off")}</button>
        <div data-audio-voice-controls className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[var(--studio-muted)]">
              <span>{translate("studio.music.voiceGender")}</span>
              <span>{translate(`studio.music.${audioVoiceGender}`)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {voiceGenderOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => onAudioVoiceGenderChange(option.value)} className={`h-10 rounded-[0.9rem] text-xs font-semibold transition ${audioVoiceGender === option.value ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-accent-soft)] text-[var(--studio-muted)] hover:bg-[var(--studio-panel)]"}`}>
                  {translate(`studio.music.${option.value}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
            <span className="mb-3 block text-xs font-semibold text-[var(--studio-muted)]">{translate("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
            <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(event) => onTtsStabilityChange(Number(event.target.value))} className="w-full accent-[var(--studio-primary)]" />
          </label>
          <label className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
            <span className="mb-3 block text-xs font-semibold text-[var(--studio-muted)]">{translate("studio.field.textNormalization")}</span>
            <select value={textNormalization} onChange={(event) => onTextNormalizationChange(event.target.value)} className="h-10 w-full rounded-[0.9rem] border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-3 text-sm font-semibold text-[var(--studio-muted)] outline-none">
              {textNormalizationOptions.map((item) => <option key={item.value} value={item.value}>{translate(`studio.textNormalization.${item.value}`)}</option>)}
            </select>
          </label>
        </div>
      </> : <div className="grid gap-3 sm:grid-cols-2">
        <label className="df-composer-option"><span>{translate("studio.music.sampleRate")}</span><select value={musicSampleRate} onChange={event=>onMusicSampleRateChange(Number(event.target.value))} className={controlClass}>{[16000,24000,32000,44100].map(value=><option key={value} value={value}>{value} Hz</option>)}</select></label>
        <label className="df-composer-option"><span>{translate("studio.music.bitrate")}</span><select value={musicBitrate} onChange={event=>onMusicBitrateChange(Number(event.target.value))} className={controlClass}>{[32000,64000,128000,256000].map(value=><option key={value} value={value}>{value/1000} kbps</option>)}</select></label>
      </div>}
    </div> : null}
  </div>;
}
