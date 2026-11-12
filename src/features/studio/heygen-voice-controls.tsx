"use client";

import {useMemo} from "react";
import {HEYGEN_VOICES,HEYGEN_VOICE_LANGUAGES,type HeygenVoiceOptions} from "../../lib/heygen-voice";
import {StudioComposerParameter} from "./studio-composer-controls";
type Translate=(key:string,values?:Record<string,string|number|null|undefined>)=>string;
type Props={options:HeygenVoiceOptions;onChange:(options:HeygenVoiceOptions)=>void;translate:Translate;locale:string};
const control="h-10 min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-[13px] font-semibold text-[var(--studio-text)] outline-none";

export function HeygenVoiceParameters({options,onChange,translate,locale}:Props) {
  const languages=useMemo(()=>{const names=new Intl.DisplayNames([locale],{type:"language"});return HEYGEN_VOICE_LANGUAGES.map(code=>({code,label:names.of(code)||code}));},[locale]);
  return <>
    <StudioComposerParameter kind="voice" label={translate("studio.field.voice")}><select data-heygen-voice aria-label={translate("studio.field.voice")} value={options.voice} disabled={Boolean(options.referenceAudioUrl.trim())} onChange={event=>onChange({...options,voice:event.target.value})} className={control}>{HEYGEN_VOICES.map(voice=><option key={voice} value={voice}>{voice}</option>)}</select></StudioComposerParameter>
    <StudioComposerParameter kind="language" label={translate("studio.field.language")}><select data-heygen-language aria-label={translate("studio.field.language")} value={options.language} onChange={event=>onChange({...options,language:event.target.value})} className={control}><option value="">{translate("studio.languageOption.auto")}</option>{languages.map(({code,label})=><option key={code} value={code}>{label}</option>)}</select></StudioComposerParameter>
    <span data-speech-format className="px-2 py-2 text-xs text-[var(--studio-muted)]">WAV · 44.1 kHz</span>
  </>;
}

export function HeygenVoiceAdvanced({options,onChange,translate}:Omit<Props,"locale">) {
  return <div data-heygen-voice-advanced className="grid min-w-0 gap-3 sm:grid-cols-2">
    <label className="df-composer-option"><span>{translate("studio.heygenVoice.expressiveness")} · {options.expressivenessBoost.toFixed(2)}</span><input data-heygen-expression aria-label={translate("studio.heygenVoice.expressiveness")} type="range" min="0" max="1" step="0.05" value={options.expressivenessBoost} onChange={event=>onChange({...options,expressivenessBoost:Number(event.target.value)})} className="w-full accent-[var(--studio-primary)]"/></label>
    <label className="df-composer-option min-w-0"><span>{translate("studio.heygenVoice.reference")}</span><input data-heygen-reference type="url" value={options.referenceAudioUrl} maxLength={8192} placeholder="https://example.com/voice.wav" onChange={event=>onChange({...options,referenceAudioUrl:event.target.value})} className={control+" w-full"}/><span className="text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.heygenVoice.referenceHint")}</span></label>
  </div>;
}
