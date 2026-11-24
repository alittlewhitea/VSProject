"use client";
import { SEEDANCE_FLASH_PROVIDER, SEEDANCE_FLASH_GUIDE_PATH, parseReferenceMediaUrls, seedanceFlashNoticeKeys, type SeedanceFlashOptions } from "../../lib/seedance-flash";
import { SeedanceReferencePanel } from "./seedance-reference-panel";
import { ReferencePromptEditor } from "./reference-prompt-editor";
import { remapReferenceUrlsInPrompt, removeReferenceImageFromPrompt } from "../../lib/reference-prompt";
import { DEFAULT_HEYGEN_REFERENCE_OPTIONS, HEYGEN_PROMPT_ENHANCEMENTS, HEYGEN_REFERENCE_PROMPT_LIMIT, type HeygenReferenceOptions } from "../../lib/heygen-reference-video";

import type { ReactNode } from "react";
import { StudioSelectField, type StudioStatusTone } from "./studio-primitives";
import { UnifiedWorkbenchLayout } from "./unified-workbench-layout";
import type { useVideoPromptEnhancement } from "./use-video-prompt-enhancement";
import styles from "./video-settings.module.css";
import { videoSupportsEndFrame } from "../../lib/video-keyframes";
import { StudioVideoReferencePanel } from "./studio-video-reference-panel";
import { StudioImagePreview, StudioImageUpload } from "./studio-image-upload";
import type { ReferenceMediaUpload } from "./studio-reference-file-upload";
import { useState } from "react";
import { StudioComposerGenerate } from "./studio-composer-controls";
import { GenerationCostSummary } from "./generation-cost-summary";
import type { StudioVideoWorkflow } from "./video-models";
import { ModelPicker, type ModelPickerOption } from "./model-picker";
import { videoDialogueTiming } from "../../lib/video-spoken-script";
import { heygenRequiresHdAspectRatio } from "../../lib/heygen-video-options";
import { StudioIcon } from "./studio-navigation";

type Translate = (key: string, values?: Record<string, string | number | null | undefined>) => string;

type VideoSettingsProps = {
  heygenReferenceOptions: HeygenReferenceOptions;
  heygenValidationError?: string | null;
  onHeygenReferenceOptionsChange: (value: HeygenReferenceOptions) => void;
  seedanceOptions: SeedanceFlashOptions;
  seedanceValidationError?: string | null;
  onSeedanceOptionsChange: (value: SeedanceFlashOptions) => void;
  workflowTabs?: ReactNode;
  statusMessage?: string;
  statusTone?: StudioStatusTone;
  dailyFreeLabel?: string;
  promptAI: ReturnType<typeof useVideoPromptEnhancement>;
  workflow: StudioVideoWorkflow;
  onUseReference: () => void;
  prompt: string;
  referenceImageUrls: string[];
  referenceVideoUrl: string;
  shortsTemplate?: boolean;
  onReferenceVideoUrlChange: (value: string) => void;
  onMediaUpload?: ReferenceMediaUpload;
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
  heygenReferenceOptions = DEFAULT_HEYGEN_REFERENCE_OPTIONS, onHeygenReferenceOptionsChange, heygenValidationError,
  seedanceOptions, onSeedanceOptionsChange, seedanceValidationError,
  dailyFreeLabel, workflowTabs, statusMessage, statusTone,
  promptAI, workflow, onUseReference, prompt, referenceImageUrls, referenceVideoUrl, shortsTemplate, onReferenceVideoUrlChange, onMediaUpload, provider, providerOptions, duration, durationOptions, ratio, ratioOptions,
  ratioDisabled, showResolutionControl, resolution, resolutionOptions, showAudioControl, generateAudio, seed,
  enableSafetyChecker, onEnableSafetyCheckerChange, reasoningLevel, onReasoningLevelChange,
  estimatedCredits, creditBalance, generateDisabled, isSubmitting, isAuthenticated, translate,
  onPromptChange, onReferenceClear, onReferenceFiles, onReferenceRemove, onFileError, onProviderChange,
  onDurationChange, onRatioChange, onResolutionChange, onGenerateAudioChange, onSeedChange,
  onGenerate
}: VideoSettingsProps) {
  const [activePreset, setActivePreset] = useState("cinematic");
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [referenceNotice, setReferenceNotice] = useState("");
  const supportsEndFrame = videoSupportsEndFrame(provider);
  const showSeedanceNotices = provider === SEEDANCE_FLASH_PROVIDER && workflow === "reference-to-video";
  const isHeygenReference = provider === "heygen-video" && workflow === "reference-to-video";
  const referenceVideos = parseReferenceMediaUrls(referenceVideoUrl);
  const referenceAudio = parseReferenceMediaUrls(isHeygenReference ? heygenReferenceOptions.audioUrls : showSeedanceNotices ? seedanceOptions.audioUrls : "");
  const shortsPrompt = shortsTemplate && isHeygenReference ? translate("studio.templates.shorts.prompt") : undefined;
  const awaitingShortsPhoto = prompt === shortsPrompt && referenceImageUrls.length === 0;
  const flashAutomaticRatio = provider === SEEDANCE_FLASH_PROVIDER && workflow === "reference-to-video" && ["editing", "extension"].includes(seedanceOptions.task);
  const flashNeedsInput = seedanceValidationError && ["prompt", "startImage", "emptyReference"].some(code => seedanceValidationError === `studio.seedance.validation.${code}`);
  const speechTiming = provider === "heygen-video" ? videoDialogueTiming(prompt, duration) : null;

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.id);
    promptAI.reset(preset.prompt);
    if (!ratioDisabled && ratioOptions.includes(preset.ratio)) onRatioChange(preset.ratio);
  };
  const inspire = () => {
    if (workflow === "reference-to-video") {
      promptAI.reset(shortsPrompt ?? translate(isHeygenReference && !referenceVideos.length ? "studio.heygen.reference.templatePrompt" : "studio.referenceVideo.templatePrompt"));
      return;
    }
    const currentIndex = PRESETS.findIndex((preset) => preset.id === activePreset);
    applyPreset(PRESETS[(currentIndex + 1) % PRESETS.length]);
  };

  function updateReferencePrompt(nextPrompt: string) {
    if (nextPrompt === prompt) return;
    onPromptChange(nextPrompt);
    setReferenceNotice(translate("studio.mention.removed"));
  }

  function removeReferenceImage(index: number) {
    if (prompt !== shortsPrompt) updateReferencePrompt(removeReferenceImageFromPrompt(prompt, index, referenceImageUrls.length));
    onReferenceRemove(index);
  }

  function changeReferenceVideoUrls(value: string) {
    updateReferencePrompt(remapReferenceUrlsInPrompt(prompt, "video", referenceVideos, parseReferenceMediaUrls(value)));
    onReferenceVideoUrlChange(value);
  }

  function changeReferenceAudioUrls(value: string) {
    updateReferencePrompt(remapReferenceUrlsInPrompt(prompt, "audio", referenceAudio, parseReferenceMediaUrls(value)));
    if (showSeedanceNotices) onSeedanceOptionsChange({ ...seedanceOptions, audioUrls: value });
    else onHeygenReferenceOptionsChange({ ...heygenReferenceOptions, audioUrls: value });
  }

  return (
    <UnifiedWorkbenchLayout
      mode="video"
      data-video-workspace={workflow}
      className={styles.workbench}
      panelClassName={styles.editor}
      bodyClassName={styles.editorScroll}
      workflowTabs={workflowTabs}
      statusMessage={statusMessage}
      statusTone={statusTone}
    >
      <fieldset disabled={isSubmitting || promptAI.busy} className={styles.formGrid}>
          <div className={styles.content} data-video-prompt-section>
          {showSeedanceNotices ? <SeedanceReferencePanel videoUrls={referenceVideoUrl} images={referenceImageUrls}
            options={seedanceOptions} onOptionsChange={onSeedanceOptionsChange} onVideoUrlsChange={changeReferenceVideoUrls}
            onAudioUrlsChange={changeReferenceAudioUrls} onFiles={onReferenceFiles} onRemove={removeReferenceImage}
            onFileError={onFileError} onMediaUpload={onMediaUpload} authenticated={isAuthenticated} translate={translate} /> : null}
          {isHeygenReference ? <StudioVideoReferencePanel compact videoUrl={referenceVideoUrl} images={referenceImageUrls}
            photoUploadHint={shortsPrompt ? translate("studio.templates.shorts.hint") : undefined}
            audioUrls={heygenReferenceOptions.audioUrls} onAudioUrlsChange={changeReferenceAudioUrls} translate={translate}
            onVideoUrlChange={changeReferenceVideoUrls} onFiles={onReferenceFiles} onRemove={removeReferenceImage}
            onFileError={onFileError} onMediaUpload={onMediaUpload} authenticated={isAuthenticated} /> : null}
          <div className="df-composer-prompt-label mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><label htmlFor="video-studio-prompt" className="shrink-0 text-sm font-medium text-[var(--studio-text)]">{translate("studio.field.prompt")}</label></div>
            <span className="shrink-0 text-xs tabular-nums text-[var(--studio-muted)]">{translate("studio.workbench.characters", { count: prompt.length.toLocaleString() })}{provider === "heygen-video" && workflow === "reference-to-video" ? ` / ${HEYGEN_REFERENCE_PROMPT_LIMIT.toLocaleString("en-US")}` : ""}</span>
          </div>

          <div className="df-video-composer-input">
            {showSeedanceNotices || isHeygenReference ? <ReferencePromptEditor value={prompt} images={referenceImageUrls} videos={referenceVideos} audio={referenceAudio} placeholder={translate("studio.referenceVideo.placeholder")} notice={referenceNotice} showMissingNotice={!awaitingShortsPhoto} onChange={next => { setReferenceNotice(""); onPromptChange(next); }} onGenerate={onGenerate} translate={translate} /> : <textarea dir="auto" id="video-studio-prompt" value={prompt} onChange={(event) => onPromptChange(event.target.value)} placeholder={translate(workflow === "reference-to-video" ? "studio.referenceVideo.placeholder" : workflow === "image-to-video" ? "studio.placeholder.imageVideo" : "studio.placeholder.video")} className="h-[150px] w-full resize-none border-0 bg-transparent p-4 text-[15px] leading-[1.55] text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]" />}
            {workflow === "image-to-video" ? (
              <div className="mx-3 mb-3" data-video-keyframes>
                {supportsEndFrame ? (
                  <p className="mb-2 text-xs text-[var(--studio-muted)]">{translate("studio.videoWorkbench.keyframeHint")}</p>
                ) : (
                  <button type="button" onClick={onUseReference} className="mb-2 inline-flex min-h-7 items-center gap-1 rounded-sm text-xs font-medium text-[var(--studio-accent)] hover:underline">
                    {translate("studio.videoWorkbench.singleFrameHint")}
                    <StudioIcon name="chevron-right" className="h-3 w-3 shrink-0 rtl:rotate-180" />
                  </button>
                )}
                <div className={styles.frameGrid}>
                  {Array.from({ length: supportsEndFrame ? 2 : 1 }, (_, index) => {
                    const name = translate(index === 0 ? "studio.videoWorkbench.startFrame" : "studio.videoWorkbench.endFrame");
                    const image = referenceImageUrls[index];
                    return (
                      <div key={index} className={styles.frameSlot} data-frame-index={index} role="group" aria-label={name}>
                        <p>{name}</p>
                        <div className={styles.frameMedia}>
                          {image ? <StudioImagePreview src={image} alt={name} index={index}
                            removeLabel={`${translate("studio.action.clear")} ${name}`} onRemove={() => onReferenceRemove(index)} /> : null}
                          <StudioImageUpload compact={Boolean(image)} label={translate(image ? "studio.action.chooseImage" : "studio.references.upload")}
                            hint={image ? undefined : translate("studio.references.uploadHint")} disabled={index === 1 && !referenceImageUrls[0]}
                            inputProps={{ accept: "image/jpeg,image/png,image/webp", "aria-label": name }}
                            onFiles={files => onReferenceFiles(files, index).catch(onFileError)} />
                        </div>
                      </div>
                    );
                  })}
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
              <button type="button" onClick={inspire}><StudioIcon name="sparkles" className={styles.inspireIcon} />{translate("studio.workbench.inspire")}</button>
              <button type="button" onClick={() => onPromptChange("")} disabled={!prompt.length} className={styles.clearPrompt}><span aria-hidden="true">↺</span>{translate("studio.action.clear")}</button>
          </div>
          {workflow !== "reference-to-video" && ((promptAI.notice && promptAI.notice !== "login") || promptAI.busy) ? <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate(`studio.promptAI.${promptAI.busy ? "optimizing" : promptAI.notice}`)}</p> : null}
          {workflow !== "reference-to-video" && promptAI.current ? <div className="mt-2 flex flex-wrap items-start justify-between gap-2"><details className="min-w-0 flex-1 text-xs text-[var(--studio-muted)]"><summary className="min-h-9 cursor-pointer">{translate("studio.promptAI.original")}</summary><p dir="auto" className="mt-1 whitespace-pre-wrap break-words">{promptAI.current.original}</p></details><button type="button" onClick={promptAI.restore} className="min-h-9 rounded-lg border border-[var(--studio-border)] px-3 text-xs font-semibold text-[var(--studio-text)]">{translate("studio.promptAI.restore")}</button></div> : null}
          {speechTiming?.tooLong ? <p role="alert" data-video-dialogue-warning className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">{translate(speechTiming.exceedsModelLimit ? "studio.videoSpeech.limit" : "studio.videoSpeech.duration", { required: speechTiming.requiredSeconds, selected: speechTiming.selectedSeconds, max: speechTiming.maxSeconds })}</p> : null}

          </div>
          <div className={`${styles.configuration} df-premium-config`} data-video-config>
          <div className={styles.toolbar}>
          <ModelPicker inline videoAppearance value={provider} options={providerOptions} translate={translate} onChange={onProviderChange} />
          <div className={styles.parameters} data-video-parameters>
            <StudioSelectField icon="duration" label={translate("studio.field.duration")} value={provider === SEEDANCE_FLASH_PROVIDER && workflow === "reference-to-video" && seedanceOptions.task === "editing" ? "auto" : duration} disabled={provider === SEEDANCE_FLASH_PROVIDER && workflow === "reference-to-video" && seedanceOptions.task === "editing"} options={durationOptions.map(value => ({ value, label: value === "auto" ? translate("studio.option.automatic") : value }))} onValueChange={onDurationChange} />
            <StudioSelectField icon="ratio" label={translate("studio.field.aspectRatio")} value={flashAutomaticRatio ? "auto" : ratio} disabled={ratioDisabled || flashAutomaticRatio} options={(flashAutomaticRatio ? ["auto"] : ratioOptions).map(value => ({ value, label: value === "source" ? translate("studio.option.sourceImage") : value === "adaptive" || value === "auto" ? translate("studio.option.automatic") : value }))} onValueChange={onRatioChange} />
            <StudioSelectField icon="resolution" label={translate("studio.field.resolution")} value={resolution || "auto"} disabled={!showResolutionControl} options={showResolutionControl ? resolutionOptions.map(value => ({ value, label: value })) : [{ value: resolution || "auto", label: resolution || translate("studio.option.automatic") }]} onValueChange={onResolutionChange} />
            <button type="button" data-video-advanced-trigger aria-expanded={moreSettingsOpen} onClick={() => setMoreSettingsOpen(value => !value)} className={`${styles.advancedButton} df-composer-more`}>
              <StudioIcon name="sliders" className={styles.advancedIcon} />
              <span>{translate(moreSettingsOpen ? "studio.workbench.lessSettings" : "studio.workbench.moreSettings")}</span>
              <StudioIcon name="chevron-down" className={styles.advancedChevron} />
            </button>
          </div>

          <div className={styles.actionBar} data-video-action-bar>
            <StudioComposerGenerate disabled={generateDisabled} submitting={isSubmitting} authenticated={isAuthenticated} credits={estimatedCredits} translate={translate} onGenerate={onGenerate}/>
          </div>
          </div>
          {dailyFreeLabel ? <p role="status" className="df-composer-daily">{dailyFreeLabel}</p> : null}
          <GenerationCostSummary compact estimatedCredits={estimatedCredits} creditBalance={creditBalance} translate={translate}/>
          {showSeedanceNotices ? <a data-seedance-guide href={SEEDANCE_FLASH_GUIDE_PATH} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-lg text-xs font-medium text-[var(--studio-accent)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{translate("studio.seedance.guide")}<span aria-hidden="true">↗</span></a> : null}
          {showSeedanceNotices ? <p data-seedance-quote className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">
            {seedanceFlashNoticeKeys(workflow, duration, seedanceOptions.task).map(key => translate(key, { duration: duration.replace(/s$/, "") })).join(" ")}
            {referenceVideos.length ? ` ${translate("studio.seedance.videoQuote")}` : null}
          </p> : null}
          {showSeedanceNotices && seedanceValidationError ? <p data-seedance-validation role={flashNeedsInput ? "status" : "alert"} className={`mt-2 text-xs ${flashNeedsInput ? "text-[var(--studio-muted)]" : "text-red-600"}`}>{translate(seedanceValidationError)}</p> : null}
          {provider === "mischief-video" ? <p data-mischief-notice className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.model.mischief-video")}</p> : null}

          {moreSettingsOpen ? <div data-video-advanced className={`mt-3 grid gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3 ${showAudioControl ? "sm:grid-cols-2" : ""}`}>
            {provider === SEEDANCE_FLASH_PROVIDER ? <>
              <label className="min-w-0 text-xs text-[var(--studio-muted)]">{translate("studio.seedance.bitrate")}<select className="mt-1 block min-h-10 w-full rounded-lg bg-[var(--studio-panel)] px-2 text-[var(--studio-text)]" value={seedanceOptions.bitrateMode} onChange={event => onSeedanceOptionsChange({ ...seedanceOptions, bitrateMode: event.target.value as SeedanceFlashOptions["bitrateMode"] })}>{["standard", "high"].map(value => <option key={value} value={value}>{translate(`studio.seedance.bitrate.${value}`)}</option>)}</select></label>
              <label className="min-w-0 text-xs text-[var(--studio-muted)]">{translate("studio.seedance.codec")}<select className="mt-1 block min-h-10 w-full rounded-lg bg-[var(--studio-panel)] px-2 text-[var(--studio-text)]" value={seedanceOptions.codec} onChange={event => onSeedanceOptionsChange({ ...seedanceOptions, codec: event.target.value as SeedanceFlashOptions["codec"] })}>{["auto", "H264", "H265"].map(value => <option key={value} value={value}>{value === "auto" ? translate("studio.option.automatic") : value}</option>)}</select></label>
            </> : null}
            {provider === "heygen-video" && workflow === "reference-to-video" ? <label className="min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2"><span className="mb-1 block text-xs text-[var(--studio-muted)]">{translate("studio.heygen.reference.enhancement")}</span><select data-heygen-reference-enhancement value={heygenReferenceOptions.promptEnhancement} onChange={event => onHeygenReferenceOptionsChange({ ...heygenReferenceOptions, promptEnhancement: event.target.value as HeygenReferenceOptions["promptEnhancement"] })} className="min-h-8 w-full border-0 bg-transparent text-[13px] text-[var(--studio-text)]">{HEYGEN_PROMPT_ENHANCEMENTS.map(value => <option key={value} value={value}>{translate(`studio.heygen.reference.enhancement.${value}`)}</option>)}</select><span className="mt-1 block text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.heygen.reference.enhancementHint")}</span></label> : null}
            {provider === "flux-3-max-video" ? <label className="min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2"><span className="mb-1 block text-xs text-[var(--studio-muted)]">{translate("studio.flux3.reasoning")}</span><select data-flux3-reasoning value={reasoningLevel} onChange={event=>onReasoningLevelChange(event.target.value as "low"|"high")} className="min-h-8 w-full border-0 bg-transparent text-[13px] font-medium text-[var(--studio-text)] outline-none"><option value="low">{translate("studio.flux3.low")}</option><option value="high">{translate("studio.flux3.high")}</option></select></label> : null}
            {provider === "heygen-video" || provider === "grok-video" || provider === "happy-horse-video" ? <button type="button" role="switch" data-video-safety-checker aria-checked={enableSafetyChecker} onClick={() => onEnableSafetyCheckerChange(!enableSafetyChecker)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border px-3 text-xs font-semibold ${enableSafetyChecker ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]"}`}><span>{translate("studio.field.safety")}</span><span>{translate(enableSafetyChecker ? "studio.state.on" : "studio.state.off")}</span></button> : null}
            {provider !== SEEDANCE_FLASH_PROVIDER || workflow === "reference-to-video" ? <label className="min-w-0 rounded-[10px] border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2">
              <span className="mb-1 block text-xs text-[var(--studio-muted)]">{translate("studio.field.seed")}</span>
              <input value={seed} onChange={(event) => onSeedChange(event.target.value.replace(/[^\d]/g, "").slice(0, 12))} placeholder={translate("studio.placeholder.random")} inputMode="numeric" className="min-h-8 w-full border-0 bg-transparent text-[13px] font-medium text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]" />
            </label> : null}
            {showAudioControl ? <button type="button" onClick={() => onGenerateAudioChange(!generateAudio)} className={`flex min-h-11 w-full items-center justify-between rounded-[10px] border px-3 text-xs font-semibold ${generateAudio ? "border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)]"}`}><span>{translate("studio.field.nativeAudio")}</span><span>{translate(generateAudio ? "studio.state.on" : "studio.state.off")}</span></button> : null}
          </div> : null}

          {provider === "heygen-video" && heygenRequiresHdAspectRatio(workflow, resolution) ? <p data-heygen-hd-ratios className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">{translate("studio.heygen.hdRatios")}</p> : null}
          {provider === "heygen-video" && heygenValidationError && heygenValidationError !== "studio.mention.missing" ? <p data-heygen-validation role="alert" className="mt-2 text-xs text-red-600">{translate(heygenValidationError)}</p> : null}
        </div>
      </fieldset>
    </UnifiedWorkbenchLayout>
  );
}
