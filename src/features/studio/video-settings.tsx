"use client";

import type { ReactNode } from "react";
import { StudioPanel, StudioSelectField, StudioStatusNotice, type StudioStatusTone } from "./studio-primitives";
import type { useVideoPromptEnhancement } from "./use-video-prompt-enhancement";
import styles from "./video-settings.module.css";
import { videoSupportsEndFrame } from "../../lib/video-keyframes";
import { StudioVideoReferencePanel } from "./studio-video-reference-panel";
import { useEffect, useState } from "react";
import { StudioComposerGenerate } from "./studio-composer-controls";
import { GenerationCostSummary } from "./generation-cost-summary";
import type { StudioVideoWorkflow } from "./video-models";
import { ModelPicker, type ModelPickerOption } from "./model-picker";
import { videoDialogueTiming } from "../../lib/video-spoken-script";
import { heygenRequiresHdAspectRatio } from "../../lib/heygen-video-options";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type VideoSettingsProps = {
  workflowTabs?: ReactNode;
  statusMessage?: string;
  statusTone?: StudioStatusTone;
  dailyFreeLabel?: string;
  promptAI: ReturnType<typeof useVideoPromptEnhancement>;
  workflow: StudioVideoWorkflow;
  prompt: string;
  referenceImageUrls: string[];
  referenceVideoUrl: string;
  onReferenceVideoUrlChange: (value: string) => void;
  provider: string;
  providerOptions: ModelPickerOption[];
  duration: string;
  durationOptions: string[];
  ratio: string;
  ratioOptions: string[];
  ratioDisabled: boolean;
  showResolutionControl: boolean;
  resolution: string;
  resolutionOptions: string[];
  showAudioControl: boolean;
  generateAudio: boolean;
  reasoningLevel: "low" | "high";
  onReasoningLevelChange: (value:"low"|"high") => void;
  enableSafetyChecker: boolean;
  onEnableSafetyCheckerChange: (value: boolean) => void;
  seed: string;
  estimatedCredits: number;
  creditBalance: number | null;
  generateDisabled: boolean;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  translate: Translate;
  onPromptChange: (value: string) => void;
  onReferenceClear: () => void;
  onReferenceFiles: (files: FileList | null, frameIndex?: number) => Promise<void>;
  onReferenceRemove: (index: number) => void;
  onFileError: () => void;
  onProviderChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onResolutionChange: (value: string) => void;
  onGenerateAudioChange: (value: boolean) => void;
  onSeedChange: (value: string) => void;
  onGenerate: () => void;
};

const PRESETS = [
  { id: "cinematic", label: "Cinematic", icon: "\uD83C\uDFAC", ratio: "16:9", showcaseIndex: 0, title: "Urban Dance", prompt: "A young woman adjusts her hair on a rooftop at golden hour, cinematic framing, soft handheld motion, warm sunlight, natural skin texture, shallow depth of field, subtle film grain, realistic mood." },
  { id: "product", label: "Product Promo", icon: "\uD83E\uDDF4", ratio: "4:3", showcaseIndex: 1, title: "Product Promo", prompt: "A premium skincare bottle on a stone pedestal, soft studio daylight, elegant camera dolly in, minimal luxury composition, crisp highlights, clean shadows, realistic glass reflections, commercial ad style." },
  { id: "lifestyle", label: "Lifestyle Vlog", icon: "\u2600\uFE0F", ratio: "16:9", showcaseIndex: 1, title: "Summer Vibes", prompt: "A cheerful travel vlog scene on a beach promenade, relaxed summer outfit, bright natural daylight, light walking camera, candid expression, airy lifestyle mood, realistic colors, influencer video style." },
  { id: "cyberpunk", label: "Cyberpunk", icon: "\uD83C\uDF03", ratio: "16:9", showcaseIndex: 2, title: "Neon City", prompt: "A futuristic neon city street at night after rain, reflective pavement, glowing signs, slow cinematic push-in, cool blue and magenta lighting, atmospheric haze, high detail, cyberpunk aesthetic." },
  { id: "minimal", label: "Minimal", icon: "\u2728", ratio: "16:9", showcaseIndex: 0, title: "Nature Escape", prompt: "A quiet mountain landscape with a lone figure, clean composition, slow aerial drift, soft clouds, muted color palette, minimal framing, serene mood, highly realistic environmental detail." }
] as const;

export function VideoSettings({
  dailyFreeLabel, workflowTabs, statusMessage, statusTone,
  promptAI, workflow, prompt, referenceImageUrls, referenceVideoUrl, onReferenceVideoUrlChange, provider, providerOptions, duration, durationOptions, ratio, ratioOptions,
  ratioDisabled, showResolutionControl, resolution, resolutionOptions, showAudioControl, generateAudio, seed,
  enableSafetyChecker, onEnableSafetyCheckerChange, reasoningLevel, onReasoningLevelChange,
  estimatedCredits, creditBalance, generateDisabled, isSubmitting, isAuthenticated, translate,
  onPromptChange, onReferenceClear, onReferenceFiles, onReferenceRemove, onFileError, onProviderChange,
  onDurationChange, onRatioChange, onResolutionChange, onGenerateAudioChange, onSeedChange,
  onGenerate
}: VideoSettingsProps) {
  const [activePreset, setActivePreset] = useState("cinematic");
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const speechTiming = provider === "heygen-video" ? videoDialogueTiming(prompt, duration) : null;
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!window.matchMedia("(min-width: 1024px)").matches || event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.isComposing || event.repeat) return;
      // Do not submit behind the model picker, billing dialog, or other modal.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      if (!generateDisabled && !isSubmitting) onGenerate();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [generateDisabled, isSubmitting, onGenerate]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.id);
    promptAI.reset(preset.prompt);
    if (!ratioDisabled && ratioOptions.includes(preset.ratio)) onRatioChange(preset.ratio);
  };
  const inspire = () => {
    if (workflow === "reference-to-video") { promptAI.reset(translate("studio.referenceVideo.templatePrompt")); return; }
    const currentIndex = PRESETS.findIndex((preset) => preset.id === activePreset);
    applyPreset(PRESETS[(currentIndex + 1) % PRESETS.length]);
  };

  return (
    <div className={`${styles.workbench} df-compact-composer df-premium-composer text-start`} data-premium-workspace="video" data-video-workspace={workflow}>
        <StudioPanel className={`${styles.editor} df-premium-panel`} header={workflowTabs}>
          <div className={styles.editorScroll} data-video-editor-scroll>
          <fieldset disabled={isSubmitting || promptAI.busy} className={styles.formGrid}>
          <div className={styles.content} data-video-prompt-section>
          {workflow === "reference-to-video" ? <StudioVideoReferencePanel compact videoUrl={referenceVideoUrl} images={referenceImageUrls} translate={translate} onVideoUrlChange={onReferenceVideoUrlChange} onFiles={onReferenceFiles} onRemove={onReferenceRemove} onFileError={onFileError} /> : null}
          <div className="df-composer-prompt-label mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><label htmlFor="video-studio-prompt" className="shrink-0 text-sm font-medium text-[var(--studio-text)]">{translate("studio.field.prompt")}</label></div>
            <span className="shrink-0 text-xs tabular-nums text-[var(--studio-muted)]">{translate("studio.workbench.characters", { count: prompt.length.toLocaleString() })}</span>
          </div>

          <div className="df-video-composer-input">
            <textarea dir="auto" id="video-studio-prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} onKeyDown={(event) => { if (window.matchMedia("(min-width: 1024px)").matches && (event.ctrlKey || event.metaKey)) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onGenerate(); } }} placeholder={translate(workflow === "reference-to-video" ? "studio.referenceVideo.placeholder" : workflow === "image-to-video" ? "studio.placeholder.imageVideo" : "studio.placeholder.video")} className="h-[150px] w-full resize-none border-0 bg-transparent p-4 text-[15px] leading-[1.55] text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]" />
            {workflow === "image-to-video" ? (
              <div className="mx-3 mb-3" data-video-keyframes>
                <p className="mb-2 text-xs text-[var(--studio-muted)]">{translate(videoSupportsEndFrame(provider) ? "studio.videoWorkbench.keyframeHint" : "studio.videoWorkbench.singleFrameHint")}</p>
                <div className={`grid gap-2 ${videoSupportsEndFrame(provider) ? "grid-cols-2" : "grid-cols-1"}`}>
                  {Array.from({ length: videoSupportsEndFrame(provider) ? 2 : 1 }, (_, index) => (
                    <div key={index} className="min-w-0 rounded-xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-2" data-frame-index={index}>
                      <p className="mb-2 text-xs font-medium text-[var(--studio-text)]">{translate(index === 0 ? "studio.videoWorkbench.startFrame" : "studio.videoWorkbench.endFrame")}</p>
                      {referenceImageUrls[index] ? <img src={referenceImageUrls[index]} alt={translate(index === 0 ? "studio.videoWorkbench.startFrame" : "studio.videoWorkbench.endFrame")} className="mb-2 h-24 w-full rounded-lg object-contain" /> : null}
                      <label className={`df-reference-upload block cursor-pointer rounded-lg bg-[var(--studio-panel)] p-2 text-center text-xs font-medium text-[var(--studio-accent)] ${index === 1 && !referenceImageUrls[0] ? "opacity-40" : ""}`}>
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>{translate("studio.action.chooseImage")}
                        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={translate(index === 0 ? "studio.videoWorkbench.startFrame" : "studio.videoWorkbench.endFrame")} className="sr-only" disabled={index === 1 && !referenceImageUrls[0]} onChange={event => { void onReferenceFiles(event.target.files, index).catch(onFileError); event.target.value = ""; }} />
                      </label>
                      {referenceImageUrls[index] ? <button type="button" onClick={() => onReferenceRemove(index)} className="mt-1 min-h-9 w-full text-xs text-[var(--studio-muted)]">{translate("studio.action.clear")}</button> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className={`${styles.promptActions} mt-3 flex flex-wrap items-center gap-2`}>
            {workflow !== "reference-to-video" ? <button type="button" role="switch" data-video-ai-enhance aria-label={translate("studio.promptAI.enhance")} aria-checked={promptAI.enabled} onClick={() => promptAI.setEnabled(!promptAI.enabled)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-1 text-xs font-semibold text-[var(--studio-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent-border)] focus-visible:ring-offset-2 disabled:opacity-50">
              <span>{translate("studio.promptAI.enhance")}</span>
              <span aria-hidden="true" className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${promptAI.enabled ? "bg-[var(--studio-primary)]" : "bg-[var(--studio-surface)]"}`}>
                <span className={`absolute start-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${promptAI.enabled ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"}`} />
              </span>
            </button> : null}
              <button type="button" onClick={inspire} className="min-h-10 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-xs font-semibold text-[var(--studio-text)] transition hover:bg-[var(--studio-surface)]">{"\uD83D\uDCA1"} {translate("studio.workbench.inspire")}</button>
              <button type="button" onClick={() => onPromptChange("")} disabled={!prompt.length} className="min-h-10 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 text-xs font-semibold text-[var(--studio-muted)] transition hover:border-[var(--studio-accent-border)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-accent)] disabled:cursor-not-allowed disabled:opacity-45"><span aria-hidden="true">{"\u21ba"}</span> {translate("studio.action.clear")}</button>
          </div>
          {workflow !== "reference-to-video" && ((promptAI.notice && promptAI.notice !== "login") || promptAI.busy) ? <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate(`studio.promptAI.${promptAI.busy ? "optimizing" : promptAI.notice}`)}</p> : null}
          {workflow !== "reference-to-video" && promptAI.current ? <div className="mt-2 flex flex-wrap items-start justify-between gap-2"><details className="min-w-0 flex-1 text-xs text-[var(--studio-muted)]"><summary className="min-h-9 cursor-pointer">{translate("studio.promptAI.original")}</summary><p dir="auto" className="mt-1 whitespace-pre-wrap break-words">{promptAI.current.original}</p></details><button type="button" onClick={promptAI.restore} className="min-h-9 rounded-lg border border-[var(--studio-border)] px-3 text-xs font-semibold text-[var(--studio-text)]">{translate("studio.promptAI.restore")}</button></div> : null}
          {speechTiming?.tooLong ? <p role="alert" data-video-dialogue-warning className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">{translate(speechTiming.exceedsModelLimit ? "studio.videoSpeech.limit" : "studio.videoSpeech.duration", { required: speechTiming.requiredSeconds, selected: speechTiming.selectedSeconds, max: speechTiming.maxSeconds })}</p> : null}

          </div>
          <div className={`${styles.configuration} df-premium-config`} data-video-config>
          <div className={styles.toolbar}>
          <ModelPicker inline value={provider} options={providerOptions} translate={translate} onChange={onProviderChange} />
          <div className={styles.parameters} data-video-parameters>
            <StudioSelectField icon="duration" label={translate("studio.field.duration")} value={duration} options={durationOptions.map(value => ({ value, label: value }))} onValueChange={onDurationChange} />
            <StudioSelectField icon="ratio" label={translate("studio.field.aspectRatio")} value={ratio} disabled={ratioDisabled} options={ratioOptions.map(value => ({ value, label: value === "source" ? translate("studio.option.sourceImage") : value === "adaptive" ? translate("studio.option.automatic") : value }))} onValueChange={onRatioChange} />
            <StudioSelectField icon="resolution" label={translate("studio.field.resolution")} value={resolution || "auto"} disabled={!showResolutionControl} options={showResolutionControl ? resolutionOptions.map(value => ({ value, label: value })) : [{ value: resolution || "auto", label: resolution || translate("studio.option.automatic") }]} onValueChange={onResolutionChange} />
            <button type="button" data-video-advanced-trigger aria-expanded={moreSettingsOpen} onClick={() => setMoreSettingsOpen(value => !value)} className={`${styles.advancedButton} df-composer-more`}>{translate(moreSettingsOpen ? "studio.workbench.lessSettings" : "studio.workbench.moreSettings")}</button>
          </div>

          <div className={styles.actionBar} data-video-action-bar>
            <StudioComposerGenerate disabled={generateDisabled} submitting={isSubmitting} authenticated={isAuthenticated} credits={estimatedCredits} translate={translate} onGenerate={onGenerate}/>
          </div>
          </div>
          {dailyFreeLabel ? <p role="status" className="df-composer-daily">{dailyFreeLabel}</p> : null}
          <GenerationCostSummary compact estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate}/>
          {provider === "mischief-video" ? <p data-mischief-notice className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.model.mischief-video")}</p> : null}

          {moreSettingsOpen ? <div data-video-advanced className={`mt-3 grid gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3 ${showAudioControl ? "sm:grid-cols-2" : ""}`}>
            {provider === "flux-3-max-video" ? <label className="min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2"><span className="mb-1 block text-xs text-[var(--studio-muted)]">{translate("studio.flux3.reasoning")}</span><select data-flux3-reasoning value={reasoningLevel} onChange={event=>onReasoningLevelChange(event.target.value as "low"|"high")} className="min-h-8 w-full border-0 bg-transparent text-[13px] font-medium text-[var(--studio-text)] outline-none"><option value="low">{translate("studio.flux3.low")}</option><option value="high">{translate("studio.flux3.high")}</option></select></label> : null}
            {provider === "heygen-video" || provider === "grok-video" || provider === "happy-horse-video" ? <button type="button" role="switch" data-video-safety-checker aria-checked={enableSafetyChecker} onClick={() => onEnableSafetyCheckerChange(!enableSafetyChecker)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border px-3 text-xs font-semibold ${enableSafetyChecker ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]"}`}><span>{translate("studio.field.safety")}</span><span>{translate(enableSafetyChecker ? "studio.state.on" : "studio.state.off")}</span></button> : null}
            <label className="min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2">
              <span className="mb-1 block text-xs text-[var(--studio-muted)]">{translate("studio.field.seed")}</span>
              <input value={seed} onChange={(event) => onSeedChange(event.target.value.replace(/[^\d]/g, "").slice(0, 12))} placeholder={translate("studio.placeholder.random")} inputMode="numeric" className="min-h-8 w-full border-0 bg-transparent text-[13px] font-medium text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]" />
            </label>
            {showAudioControl ? <button type="button" onClick={() => onGenerateAudioChange(!generateAudio)} className={`flex min-h-11 w-full items-center justify-between rounded-[10px] border px-3 text-xs font-semibold ${generateAudio ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]"}`}><span>{translate("studio.field.nativeAudio")}</span><span>{translate(generateAudio ? "studio.state.on" : "studio.state.off")}</span></button> : null}
          </div> : null}

          {provider === "heygen-video" && heygenRequiresHdAspectRatio(workflow, resolution) ? <p data-heygen-hd-ratios className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.heygen.hdRatios")}</p> : null}
          <StudioStatusNotice message={statusMessage} tone={statusTone} />

          </div>
          </fieldset>
          </div>
        </StudioPanel>
    </div>
  );
}
