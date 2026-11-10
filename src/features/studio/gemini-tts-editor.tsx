"use client";

import { GEMINI_TTS_VOICES, prepareGeminiTts, type GeminiTtsOptions } from "../../lib/gemini-tts";
import { StudioComposerPrompt } from "./studio-composer-controls";

type Props = { prompt: string; options: GeminiTtsOptions; onPromptChange: (value: string) => void; onChange: (value: GeminiTtsOptions) => void; translate: (key: string, values?: Record<string, string | number | null | undefined>) => string };
const control = "min-h-11 w-full min-w-0 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm text-[var(--studio-text)] outline-none focus:border-[var(--studio-primary)]";

export function GeminiTtsEditor({ prompt, options, onPromptChange, onChange, translate: t }: Props) {
  const dialogue = options.mode === "dialogue";
  const result = prepareGeminiTts(dialogue ? "" : prompt, options);
  const patch = (value: Partial<GeminiTtsOptions>) => onChange({ ...options, ...value });
  const voiceOptions = GEMINI_TTS_VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>);
  return <div data-gemini-tts-editor className="grid min-w-0 gap-4">
    <div role="group" aria-label={t("studio.geminiTts.mode")} className="grid grid-cols-2 gap-2">{(["single", "dialogue"] as const).map(mode => <button key={mode} type="button" data-speech-mode={mode} aria-pressed={options.mode === mode} onClick={() => patch({ mode })} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${options.mode === mode ? "border-[var(--studio-primary)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)]"}`}>{t(`studio.geminiTts.${mode}`)}</button>)}</div>
    {!dialogue ? <>
      <label className="grid gap-2 text-xs font-semibold text-[var(--studio-muted)]">{t("studio.field.voice")}<select data-gemini-voice value={options.voice} onChange={event => patch({ voice: event.target.value })} className={control}>{voiceOptions}</select></label>
      <StudioComposerPrompt label={t("studio.audioWorkbench.voiceScript")} prompt={prompt} placeholder={t("studio.placeholder.audio")} translate={t} onChange={onPromptChange} />
    </> : <>
      <div className="grid gap-3 sm:grid-cols-2">{options.speakers.map((speaker, index) => <div key={index} className="grid min-w-0 gap-2 rounded-xl border border-[var(--studio-border)] p-3">
        <label className="grid gap-1 text-xs text-[var(--studio-muted)]">{t("studio.geminiTts.speaker")} {index + 1}<input data-speaker-alias={index} value={speaker.speaker_id} onChange={event => { const alias = event.target.value; patch({ speakers: options.speakers.map((s, i) => i === index ? { ...s, speaker_id: alias } : s), turns: options.turns.map(turn => turn.speaker_id === speaker.speaker_id ? { ...turn, speaker_id: alias } : turn) }); }} className={control} /></label>
        <label className="grid gap-1 text-xs text-[var(--studio-muted)]">{t("studio.field.voice")}<select data-speaker-voice={index} value={speaker.voice} onChange={event => patch({ speakers: options.speakers.map((s, i) => i === index ? { ...s, voice: event.target.value } : s) })} className={control}>{voiceOptions}</select></label>
      </div>)}</div>
      <div className="grid gap-3">{options.turns.map((turn, index) => <div key={index} data-speech-turn className="grid min-w-0 gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-3">
        <div className="flex items-center gap-2"><label className="min-w-0 flex-1 text-xs text-[var(--studio-muted)]">{t("studio.geminiTts.speaker")}<select aria-label={`${t("studio.geminiTts.speaker")} ${index + 1}`} value={turn.speaker_id} onChange={event => patch({ turns: options.turns.map((row, i) => i === index ? { ...row, speaker_id: event.target.value } : row) })} className={control}>{options.speakers.map((speaker, i) => <option key={i} value={speaker.speaker_id}>{speaker.speaker_id || `${t("studio.geminiTts.speaker")} ${i + 1}`}</option>)}</select></label><button type="button" disabled={options.turns.length === 1} aria-label={`${t("studio.geminiTts.remove")} ${index + 1}`} onClick={() => patch({ turns: options.turns.filter((_, i) => i !== index) })} className="min-h-11 px-2 text-xs text-[var(--studio-muted)] disabled:opacity-40">{t("studio.geminiTts.remove")}</button></div>
        <textarea aria-label={`${t("studio.geminiTts.turn")} ${index + 1}`} rows={3} value={turn.text} onChange={event => patch({ turns: options.turns.map((row, i) => i === index ? { ...row, text: event.target.value } : row) })} placeholder={t("studio.geminiTts.turn")} className={control} />
        <details className="text-xs text-[var(--studio-muted)]"><summary className="min-h-9 cursor-pointer py-2">{t("studio.geminiTts.turnStyle")}</summary><input aria-label={`${t("studio.geminiTts.turnStyle")} ${index + 1}`} value={turn.style_instructions || ""} onChange={event => patch({ turns: options.turns.map((row, i) => i === index ? { ...row, style_instructions: event.target.value } : row) })} className={control} /></details>
      </div>)}</div>
      <button type="button" data-add-speech-turn disabled={options.turns.length >= 100} onClick={() => patch({ turns: [...options.turns, { speaker_id: options.speakers[options.turns.length % 2].speaker_id, text: "" }] })} className="min-h-11 rounded-xl border border-[var(--studio-border)] px-3 text-sm font-semibold text-[var(--studio-accent)] disabled:opacity-40">{t("studio.geminiTts.addTurn")}</button>
    </>}
    <label className="grid gap-2 text-xs font-semibold text-[var(--studio-muted)]">{t("studio.geminiTts.style")}<textarea data-speech-style rows={2} value={options.styleInstructions} onChange={event => patch({ styleInstructions: event.target.value })} placeholder={t("studio.geminiTts.stylePlaceholder")} className={control} /><span className="font-normal leading-5">{t("studio.geminiTts.billingHint")}</span></label>
    {result.error && (prompt.trim() || options.turns.some(turn => turn.text.trim())) ? <p role="status" className="text-xs leading-5 text-amber-700">{t(result.error === "input_too_long" ? "studio.geminiTts.inputTooLong" : "studio.geminiTts.invalid")}</p> : null}
    <p className="text-xs leading-5 text-[var(--studio-muted)]">{t("studio.geminiTts.hint")}</p>
  </div>;
}
