"use client";
import {StudioDeferredSection} from "./studio-deferred-section";
import dynamic from "next/dynamic";
import { trackEvent } from "../../lib/analytics";
import { requestSignIn } from "../../lib/auth-navigation";
import {
formatApproximateCreditValue
} from "../../lib/billing";
import { GPT_IMAGE_QUALITIES,GPT_IMAGE_SIZES,isGptImageProvider } from "../../lib/gpt-image-models";
import { estimateGenerationCredits } from "../../lib/model-pricing";
import {HEYGEN_VOICE_MAX_CHARACTERS} from "../../lib/heygen-voice";
import { parseStudioReferenceImages } from "../../lib/studio-workspace-inputs";
const AudioSettings = dynamic(() => import("./audio-settings").then(module=>module.AudioSettings));
const AudioWorkbench = dynamic(() => import("./audio-workbench").then(module=>module.AudioWorkbench));
const AvatarSettings = dynamic(() => import("./avatar-settings").then(module=>module.AvatarSettings));
const AvatarWorkbench = dynamic(() => import("./avatar-workbench").then(module=>module.AvatarWorkbench));
const GeminiTtsEditor = dynamic(() => import("./gemini-tts-editor").then(module=>module.GeminiTtsEditor));
const ImagePromptGallery = dynamic(() => import("./image-prompt-gallery").then(module=>module.ImagePromptGallery));
const ImageSettings = dynamic(() => import("./image-settings").then(module=>module.ImageSettings));
const ImageWorkbench = dynamic(() => import("./image-workbench").then(module=>module.ImageWorkbench));
import { ModelPicker } from "./model-picker";
import Link from "./studio-link";
import { ELEVENLABS_LANGUAGE_OPTIONS,ELEVENLABS_VOICE_GENDER_OPTIONS,IMAGE_SIZE_PRESETS,KLING_AVATAR_PREVIEW_VIDEO_URL,NANO_ASPECT_RATIO_OPTIONS,PROVIDER_META,TEXT_NORMALIZATION_OPTIONS,defaultVideoResolutionForProvider,isH3VideoProvider,isNanoBananaLiteProvider,isNanoBananaProvider,ratioFromImageSize } from "./studio-workspace-config";
import { UnifiedWorkbenchLayout } from "./unified-workbench-layout";
import {
videoModelBadge,
videoModelGroup
} from "./video-models";
const VideoSettings = dynamic(() => import("./video-settings").then(module=>module.VideoSettings));
import { WorkflowSwitcher } from "./workflow-switcher";

import type { StudioController } from "./use-studio-controller";
const VideoTemplateGallery = dynamic(() => import("../../features/studio/studio-video-template-gallery"), { ssr: false });
const ImageTemplateGallery = dynamic(() => import("../../features/studio/studio-image-template-gallery"), { ssr: false });
const AvatarLibrary = dynamic(() => import("../../features/studio/studio-avatar-library"), { ssr: false });
export default function StudioCreationWorkspace({model}:{model:StudioController}) {
  const { acceleration,
    accessToken,
    activeTasks,
    activeWorkflow,
    applyProvider,
    applyWorkflow,
    audioCharacterCount,
    audioVoiceGender,
    audioVoiceOptions,
    audioWorkflow,
    avatarAudioUrl,
    avatarDuration,
    avatarNeedsImage,
    avatarScriptMeta,
    avatarScriptTooLong,
    avatarVoiceGender,
    avatarVoiceOptions,
    canSubmit,
    configuredVideoWorkflow,
    creditBalance,
    duration,
    editResolution,
    enableSafetyChecker,
    enableWebSearch,
    estCredits,
    geminiTts,
    heygenVoice,
    heygenVoiceFree,
    heygenVoiceError,
    generateAudio,
    generateDisabled,
    gptImageOptions,
    gptValidationError,
    guidanceScale,
    h3FreeLabel,
    handleGenerateClick,
    handleReferenceFiles,
    imageQuality,
    imageSize,
    imageWorkflow,
    improveTextToImagePrompt,
    isAppsHome,
    isAvatarWorkflow,
    isBillingView,
    isElevenLabsAudio,
    isGeminiTts,
    isHeygenVoice,
    isH3MaxAvatar,
    isHeygenAvatar,
    isInstrumental,
    isMiniMaxMusic,
    isProjectsView,
    isPromptlessImageWorkflow,
    isSubmitting,
    limitGenerations,
    lyricsOptimizer,
    mode,
    modelPickerOptions,
    musicAdvancedOpen,
    musicBitrate,
    musicFormat,
    musicLyrics,
    musicSampleRate,
    numImages,
    numInferenceSteps,
    options,
    outputFormat,
    prompt,
    provider,
    providerNote,
    providerSettingsLabel,
    ratio,
    reasoningLevel,
    referenceImageUrls,
    referenceImagesText,
    referenceVideoUrl,
    safetyTolerance,
    saveLoginDraft,
    seed,
    selectedImageSize,
    selectedProviderMeta,
    setAcceleration,
    setAudioVoiceGender,
    setAvatarAudioUrl,
    setAvatarVoiceGender,
    setDuration,
    setEditResolution,
    setEnableSafetyChecker,
    setEnableWebSearch,
    setGeminiTts,
    setHeygenVoice,
    setGenerateAudio,
    setGptImageOptions,
    setGuidanceScale,
    setImageQuality,
    setImageSize,
    setImageWorkflow,
    setIsInstrumental,
    setLimitGenerations,
    setLyricsOptimizer,
    setMusicAdvancedOpen,
    setMusicBitrate,
    setMusicFormat,
    setMusicLyrics,
    setMusicSampleRate,
    setNumImages,
    setNumInferenceSteps,
    setOutputFormat,
    setPrompt,
    setRatio,
    setReasoningLevel,
    setReferenceImageFiles,
    setReferenceImagesText,
    setReferenceVideoUrl,
    setSafetyTolerance,
    setSeed,
    setStatusText,
    setStatusTone,
    setSystemPrompt,
    setTextNormalization,
    setThinkingLevel,
    setToolbarModelSelectOpen,
    setTtsLanguageCode,
    setTtsStability,
    setTtsTimestamps,
    setTtsVoice,
    setVideoResolution,
    setVideoWorkflow,
    showAudioWorkbenchRedesign,
    showAvatarWorkbenchRedesign,
    showImageToImageRedesign,
    showImageUtilityRedesign,
    showImageWorkbenchRedesign,
    showModernWorkbenchRedesign,
    showTextToImageTemplates,
    showVideoAudioControl,
    showVideoModelSelect,
    showVideoResolutionControl,
    showVideoWorkbenchRedesign,
    sp,
    st,
    startAvatarImageGuide,
    statusText,
    statusTone,
    studioI18n,
    systemPrompt,
    textNormalization,
    thinkingLevel,
    toolbarModelSelectOpen,
    toolbarModelSelectPanelRef,
    toolbarModelSelectPlacement,
    toolbarModelSelectRef,
    ttsLanguageCode,
    ttsStability,
    ttsTimestamps,
    ttsVoice,
    userId,
    videoDurationOptions,
    videoModelGroups,
    videoPromptAI,
    videoRatioOptions,
    videoResolution,
    videoResolutionOptions,
    videoWorkflow } = model;


  const workflowNavigation = (
    <WorkflowSwitcher
                t={st}
                mode={mode}
                imageWorkflow={imageWorkflow}
                videoWorkflow={videoWorkflow}
                audioWorkflow={audioWorkflow}
                modern={showModernWorkbenchRedesign}
                imageRedesign={showImageWorkbenchRedesign}
                videoRedesign={showVideoWorkbenchRedesign}
                audioRedesign={showAudioWorkbenchRedesign}
                avatarRedesign={showAvatarWorkbenchRedesign}
                imageToImageRedesign={showImageToImageRedesign}
                imageUtilityRedesign={showImageUtilityRedesign}
                hasReferenceImages={Boolean(referenceImageUrls.length)}
                onWorkflowChange={applyWorkflow}
              />
  );

  const imageSettingsPanel = showImageWorkbenchRedesign ? (
    <ImageSettings
      gptOptions={gptImageOptions}
      referenceImageUrls={referenceImageUrls}
      onGptOptionsChange={setGptImageOptions}
      gptValidationError={gptValidationError}
      provider={provider}
      providerOptions={modelPickerOptions}
      utilityWorkflow={showImageUtilityRedesign ? imageWorkflow === "enhance-cleanup" ? "enhance-cleanup" : "background-remove" : null}
      isImageToImage={showImageToImageRedesign}
      isNanoBanana={isNanoBananaProvider(provider)}
      isNanoBananaLite={isNanoBananaLiteProvider(provider)}
      ratio={ratio}
      ratioOptions={provider === "nano-banana-pro" || provider === "nano-banana-2-lite" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS}
      imageSize={imageSize}
      imageSizePresets={isGptImageProvider(provider) ? GPT_IMAGE_SIZES : IMAGE_SIZE_PRESETS}
      outputFormat={outputFormat}
      imageQuality={imageQuality}
      editResolution={editResolution}
      numInferenceSteps={numInferenceSteps}
      guidanceScale={guidanceScale}
      numImages={numImages}
      seed={seed}
      enableSafetyChecker={enableSafetyChecker}
      acceleration={acceleration}
      safetyTolerance={safetyTolerance}
      limitGenerations={limitGenerations}
      enableWebSearch={enableWebSearch}
      thinkingLevel={thinkingLevel}
      systemPrompt={systemPrompt}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      estimatedCredits={estCredits}
      creditBalance={creditBalance}
      translate={st}
      onProviderChange={applyProvider}
      onRatioChange={(value) => {
        trackEvent("studio_size_selected", { mode, provider, ratio: value }, accessToken);
        setRatio(value);
      }}
      onImageSizeChange={(value) => {
        trackEvent("studio_size_selected", { mode, provider, image_size: value, ratio: ratioFromImageSize(value) }, accessToken);
        setImageSize(value);
        setRatio(ratioFromImageSize(value));
      }}
      onOutputFormatChange={setOutputFormat}
      onImageQualityChange={setImageQuality}
      onEditResolutionChange={setEditResolution}
      onNumInferenceStepsChange={setNumInferenceSteps}
      onGuidanceScaleChange={setGuidanceScale}
      onNumImagesChange={setNumImages}
      onSeedChange={setSeed}
      onEnableSafetyCheckerChange={setEnableSafetyChecker}
      onAccelerationChange={setAcceleration}
      onSafetyToleranceChange={setSafetyTolerance}
      onLimitGenerationsChange={setLimitGenerations}
      onEnableWebSearchChange={setEnableWebSearch}
      onThinkingLevelChange={setThinkingLevel}
      onSystemPromptChange={setSystemPrompt}
      onGenerate={handleGenerateClick}
    />
  ) : null;

  const audioSettingsPanel = showAudioWorkbenchRedesign ? (
    <AudioSettings
      provider={provider}
      providerOptions={modelPickerOptions}
      isElevenLabs={isElevenLabsAudio}
      isGeminiTts={isGeminiTts}
      isHeygenVoice={isHeygenVoice}
      heygenVoice={heygenVoice}
      heygenVoiceFree={heygenVoiceFree}
      heygenVoiceError={heygenVoiceError}
      onHeygenVoiceChange={setHeygenVoice}
      locale={studioI18n.locale}
      audioVoiceOptions={audioVoiceOptions}
      languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
      voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
      ttsVoice={ttsVoice}
      ttsLanguageCode={ttsLanguageCode}
      ttsTimestamps={ttsTimestamps}
      audioVoiceGender={audioVoiceGender}
      ttsStability={ttsStability}
      textNormalization={textNormalization}
      textNormalizationOptions={TEXT_NORMALIZATION_OPTIONS}
      musicSampleRate={musicSampleRate}
      musicBitrate={musicBitrate}
      musicFormat={musicFormat}
      estimatedCredits={estCredits}
      creditBalance={creditBalance}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      translate={st}
      onProviderChange={applyProvider}
      onTtsVoiceChange={setTtsVoice}
      onTtsLanguageCodeChange={setTtsLanguageCode}
      onTtsTimestampsChange={setTtsTimestamps}
      onAudioVoiceGenderChange={setAudioVoiceGender}
      onTtsStabilityChange={setTtsStability}
      onTextNormalizationChange={setTextNormalization}
      onMusicSampleRateChange={setMusicSampleRate}
      onMusicBitrateChange={setMusicBitrate}
      onMusicFormatChange={setMusicFormat}
      onGenerate={handleGenerateClick}
    />
  ) : null;

  const avatarSettingsPanel = showAvatarWorkbenchRedesign ? (
    <AvatarSettings
      compact
      isHeygenAvatar={isHeygenAvatar}
      dailyFreeLabel={h3FreeLabel}

      isH3MaxAvatar={isH3MaxAvatar}
      duration={duration}
      durationOptions={videoDurationOptions}
      resolution={videoResolution}
      resolutionOptions={videoResolutionOptions}
      ratio={ratio}
      ratioOptions={videoRatioOptions}
      automaticDuration={avatarDuration}
      scriptTooLong={avatarScriptTooLong}
      estimatedCredits={estCredits}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      translate={st}
      onDurationChange={setDuration}
      onResolutionChange={setVideoResolution}
      onRatioChange={setRatio}
      onGenerate={handleGenerateClick}
    />
  ) : null;
  const avatarModelSelector = showAvatarWorkbenchRedesign ? (
    <ModelPicker inline value={provider} options={modelPickerOptions} translate={st} onChange={applyProvider} />
  ) : null;
  return (<div className={`${showModernWorkbenchRedesign ? "w-full" : "mx-auto mt-5 max-w-5xl text-center md:mt-16"} ${isAppsHome || isProjectsView || isBillingView ? "hidden" : ""}`}>
              {showModernWorkbenchRedesign ? null : workflowNavigation}
                <div className={showModernWorkbenchRedesign ? "w-full max-w-none overflow-visible" : "mt-4 overflow-visible rounded-[1.7rem] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none sm:mt-5 md:mt-7 md:rounded-[2rem] md:shadow-none"}>
                  <div className={showModernWorkbenchRedesign ? "text-left" : "p-5 text-left md:p-7"}>
                    {showImageWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        workflowTabs={workflowNavigation}
                        statusMessage={statusText}
                        statusTone={statusTone}
                        mode="image"
                        translate={st}
                        editor={<ImageWorkbench
                          workflow={imageWorkflow}
                          prompt={prompt}
                          referenceImagesText={referenceImagesText}
                          referenceImageUrls={referenceImageUrls}
                          templateReferenceUrl={sp.get("templateId") ? sp.get("reference") : null}
                          isPromptlessWorkflow={isPromptlessImageWorkflow}
                          outputFormat={outputFormat}
                          templatesUrl="/gallery"
                          translate={st}
                          onPromptChange={setPrompt}
                          onImprovePrompt={improveTextToImagePrompt}
                          onReferenceImagesTextChange={value=>{setReferenceImagesText(value);setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));}}
                          onReferenceFiles={handleReferenceFiles}
                          onReferenceClear={() => {
                            setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));
                            setReferenceImagesText("");
                            setReferenceImageFiles([]);
                          }}
                          onReferenceRemove={(index) => {
                            const urls = parseStudioReferenceImages(referenceImagesText);
                            if (index < 0 || index >= referenceImageUrls.length) return;
                            if(index===0)setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));
                            if (index < urls.length) setReferenceImagesText(urls.filter((_, position) => position !== index).join("\n"));
                            else setReferenceImageFiles(files => files.filter((_, position) => position !== index - urls.length));
                          }}
                          onFileError={() => { setStatusTone("error"); setStatusText(st("studio.status.fileReadFailed")); }}
                        />}
                        settings={imageSettingsPanel}
                      />
                    ) : showAudioWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        workflowTabs={workflowNavigation}
                        statusMessage={statusText}
                        statusTone={statusTone}
                        mode="audio"
                        translate={st}
                        editor={<AudioWorkbench
                          workflow={audioWorkflow}
                          speechEditor={isGeminiTts ? <GeminiTtsEditor prompt={prompt} options={geminiTts} onPromptChange={setPrompt} onChange={setGeminiTts} translate={st} /> : undefined}
                          scriptMaxLength={isHeygenVoice ? HEYGEN_VOICE_MAX_CHARACTERS : undefined}
                          scriptPlaceholder={isHeygenVoice ? st("studio.heygenVoice.placeholder") : undefined}
                          canSubmit={canSubmit}
                          prompt={prompt}
                          isMiniMaxMusic={isMiniMaxMusic}
                          musicAdvancedOpen={musicAdvancedOpen}
                          isInstrumental={isInstrumental}
                          lyricsOptimizer={lyricsOptimizer}
                          musicLyrics={musicLyrics}
                          translate={st}
                          onPromptChange={setPrompt}
                          onAdvancedOpenChange={setMusicAdvancedOpen}
                          onInstrumentalChange={setIsInstrumental}
                          onLyricsOptimizerChange={setLyricsOptimizer}
                          onMusicLyricsChange={setMusicLyrics}
                        />}
                        settings={audioSettingsPanel}
                      />
                    ) : showVideoWorkbenchRedesign ? (
                      null
                    ) : showAvatarWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        workflowTabs={workflowNavigation}
                        statusMessage={statusText}
                        statusTone={statusTone}
                        mode="avatar"
                        translate={st}
                        modelSelector={avatarModelSelector}
                        editor={<AvatarWorkbench
                          compact
                          prompt={prompt}
                          referenceImagesText={referenceImagesText}
                          referenceImageUrls={referenceImageUrls}

                          isH3MaxAvatar={isH3MaxAvatar || isHeygenAvatar}
                          avatarScriptTooLong={avatarScriptTooLong}
                          avatarScriptMeta={avatarScriptMeta}
                          avatarDuration={avatarDuration}
                          avatarVoiceGender={avatarVoiceGender}
                          avatarVoiceOptions={avatarVoiceOptions}
                          ttsVoice={ttsVoice}
                          ttsLanguageCode={ttsLanguageCode}
                          ttsStability={ttsStability}
                          voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
                          languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
                          translate={st}
                          onPromptChange={setPrompt}
                          onReferenceImagesTextChange={value => { setReferenceImageFiles([]); setReferenceImagesText(value); }}
                          onReferenceFiles={async files => { if (files?.length) setReferenceImagesText(""); await handleReferenceFiles(files); }}
                          onFileError={() => { setStatusTone("error"); setStatusText(st("studio.status.fileReadFailed")); }}
                          onStartImageGuide={startAvatarImageGuide}
                          onAvatarVoiceGenderChange={setAvatarVoiceGender}
                          onTtsVoiceChange={setTtsVoice}
                          onTtsLanguageCodeChange={setTtsLanguageCode}
                          onTtsStabilityChange={setTtsStability}
                        />}
                        settings={avatarSettingsPanel}
                      />
                    ) : isPromptlessImageWorkflow ? (
                      <div
                        className="rounded-2xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-4"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[var(--studio-text)]">{st("studio.field.imageUrl")}<span className="text-[var(--studio-accent)]">*</span></span>
                          <span className="rounded-full bg-[var(--studio-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--studio-accent)]">{st("studio.field.transparentPng")}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <input
                            value={referenceImagesText}
                            onChange={(event) => setReferenceImagesText(event.target.value)}
                            placeholder="https://.../image.jpg"
                            className="min-h-12 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
                          />
                          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-5 text-sm font-semibold text-[var(--studio-text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            {st("studio.action.chooseImage")}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                            />
                          </label>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[var(--studio-muted)]">
                          {st("studio.reference.backgroundHint")}
                        </p>
                      </div>
                    ) : (
                      <textarea
                        dir="auto"
                        rows={5}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[190px] w-full resize-none bg-transparent text-[17px] leading-8 text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)] sm:min-h-[132px] sm:text-base sm:leading-7 md:min-h-[154px] md:text-lg md:leading-8"
                        placeholder={
                          mode === "image"
                            ? st("studio.placeholder.image")
                            : mode === "audio"
                              ? st("studio.placeholder.audio")
                            : mode === "avatar"
                              ? st("studio.placeholder.avatar")
                            : activeWorkflow === "image-to-video"
                              ? st("studio.placeholder.imageVideo")
                              : st("studio.placeholder.video")
                        }
                      />
                    )}
                    {!showModernWorkbenchRedesign && referenceImageUrls.length ? (
                      <div className="mt-4 border-t border-[var(--studio-border)] pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">
                            {st("studio.reference.count", {
                              count: referenceImageUrls.length,
                              label: st(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
                            })}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setReferenceImagesText("");
                              setReferenceImageFiles([]);
                              if (mode === "image" && !isPromptlessImageWorkflow) setImageWorkflow("text-to-image");
                              if (mode === "video" && !isAvatarWorkflow) setVideoWorkflow("text-to-video");
                            }}
                            className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-1 text-xs font-semibold text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                          >
                            {st("studio.action.clear")}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {referenceImageUrls.slice(0, 8).map((url, index) => (
                            <div key={`${url.slice(0, 32)}-${index}`} className="h-16 w-16 overflow-hidden rounded-2xl bg-[var(--studio-accent-soft)] shadow-sm">
                              <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!showModernWorkbenchRedesign && isAvatarWorkflow ? (
                      <div className="mt-4 border-t border-[var(--studio-border)] pt-4">
                        <div
                          className="mb-4 rounded-2xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-4"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--studio-text)]">{st("studio.field.imageUrl")}<span className="text-[var(--studio-accent)]">*</span></span>
                            <span className="rounded-full bg-[var(--studio-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--studio-accent)]">{st("studio.field.avatarImage")}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              value={referenceImagesText}
                              onChange={(event) => setReferenceImagesText(event.target.value)}
                              placeholder="https://.../avatar.jpg"
                              className="min-h-12 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
                            />
                            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-5 text-sm font-semibold text-[var(--studio-text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                              {st("studio.action.choose")}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                              />
                            </label>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[var(--studio-muted)]">
                            {st("studio.reference.avatarHint")}
                          </p>
                          {referenceImageUrls.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {referenceImageUrls.slice(0, 4).map((url, index) => (
                                <div key={`${url.slice(0, 32)}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] shadow-sm">
                                  <img src={url} alt={`Avatar input ${index + 1}`} className="h-full w-full object-cover" />
                                  <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--studio-primary)] text-xs font-semibold text-white">?</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        {(
                        <div className="mb-4 grid gap-4 lg:grid-cols-[0.72fr_1fr]">
                          <div className="overflow-hidden rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-primary)] shadow-sm">
                            <video
                              src={KLING_AVATAR_PREVIEW_VIDEO_URL}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                              className="aspect-video w-full bg-black object-cover"
                            />
                          </div>
                          <div className="rounded-2xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-4">
                            <p className="text-sm font-semibold text-[var(--studio-text)]">{st("studio.avatar.example")}</p>
                            <p className="mt-2 text-xs leading-5 text-[var(--studio-muted)]">
                              {st("studio.avatar.exampleDescription")}
                            </p>
                          </div>
                        </div>
                        )}

                        {(
                        <div className="mb-4 rounded-2xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--studio-text)]">{st("studio.avatar.voice")}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${avatarScriptTooLong ? "bg-[var(--studio-error-soft)] text-[var(--studio-error)]" : "bg-[var(--studio-success-soft)] text-[var(--studio-success)]"}`}>
                              {avatarScriptMeta}
                            </span>
                          </div>
                          <div className="mb-3 inline-grid grid-cols-3 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] p-1 shadow-sm">
                            {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setAvatarVoiceGender(option.value)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  avatarVoiceGender === option.value
                                    ? "bg-[var(--studio-primary)] text-white shadow-none"
                                    : "text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)] hover:text-[var(--studio-text)]"
                                }`}
                              >
                                {st(`studio.voiceGender.${option.value}`)}
                              </button>
                            ))}
                          </div>
                          <div className="grid gap-3 lg:grid-cols-3">
                            <select
                              value={ttsVoice}
                              onChange={(e) => setTtsVoice(e.target.value)}
                              className="min-h-12 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
                            >
                              {avatarVoiceOptions.map((voice) => (
                                <option key={voice} value={voice}>{voice}</option>
                              ))}
                            </select>
                            <select
                              value={ttsLanguageCode}
                              onChange={(e) => setTtsLanguageCode(e.target.value)}
                              className="min-h-12 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
                            >
                              {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                                <option key={item.value || "auto"} value={item.value}>
                                  {st(`studio.languageOption.${item.value || "auto"}`)}
                                </option>
                              ))}
                            </select>
                            <label className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2.5">
                              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--studio-muted)]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={ttsStability}
                                onChange={(e) => setTtsStability(Number(e.target.value))}
                                className="mt-1 w-full accent-[var(--studio-primary)]"
                              />
                            </label>
                          </div>
                          <p className={`mt-3 text-xs leading-5 ${avatarScriptTooLong ? "text-[var(--studio-error)]" : "text-[var(--studio-muted)]"}`}>
                            {avatarScriptTooLong
                              ? st("studio.avatar.scriptTooLong")
                              : st("studio.avatar.billingHint", { duration: avatarDuration })}
                          </p>
                        </div>
                        )}

                        {avatarNeedsImage ? (
                          <div className="mb-4 grid gap-3 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={startAvatarImageGuide}
                              className="rounded-2xl border border-[var(--studio-accent-border)] bg-[var(--studio-accent-soft)] p-4 text-left transition hover:-translate-y-0.5 hover:bg-[var(--studio-panel)] hover:shadow-sm"
                            >
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-accent)]">{st("studio.avatar.guideEyebrow")}</span>
                              <span className="mt-2 block text-sm font-semibold text-[var(--studio-text)]">{st("studio.avatar.guideTitle")}</span>
                              <span className="mt-1 block text-xs leading-5 text-[var(--studio-muted)]">{st("studio.avatar.guideDescription")}</span>
                            </button>
                          </div>
                        ) : null}
                        <label className="hidden">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">Voiceover audio URL</span>
                          <input
                            value={avatarAudioUrl}
                            onChange={(event) => setAvatarAudioUrl(event.target.value)}
                            placeholder="https://.../voiceover.mp3"
                            className="mt-2 w-full rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-3 text-sm font-semibold text-[var(--studio-text)] outline-none transition focus:border-[var(--studio-accent-border)]"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  {!(showModernWorkbenchRedesign) ? (<div className={showModernWorkbenchRedesign ? "hidden" : "grid grid-cols-2 gap-2.5 border-t border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-5 py-4 sm:flex sm:flex-wrap sm:items-center md:px-7"}>
                    {mode !== "audio" && !isPromptlessImageWorkflow ? (
                    <label
                      title={st("studio.action.addReference")}
                      className="col-span-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] text-sm font-semibold text-[var(--studio-text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid sm:h-10 sm:w-10 sm:place-items-center sm:rounded-full sm:text-xl sm:font-light"
                    >
                      <span className="text-xl font-light leading-none">+</span>
                      <span className="sm:hidden">{st("studio.action.referenceImage")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleReferenceFiles(e.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                      />
                    </label>
                    ) : null}
                    <div className="hidden h-7 w-px bg-black/[0.08] sm:block" />
                    {showVideoModelSelect ? (
                      <div className="relative z-[80] col-span-2 w-full sm:col-span-1 sm:w-[290px]" ref={toolbarModelSelectRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setToolbarModelSelectOpen((open) => !open);
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-left text-sm font-semibold text-[var(--studio-text)] shadow-sm outline-none transition hover:bg-[var(--studio-accent-soft)]"
                          aria-haspopup="listbox"
                          aria-expanded={toolbarModelSelectOpen}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{selectedProviderMeta.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--studio-muted)]">{st(`studio.modelSelect.desc.${provider}`)}</span>
                          </span>
                          <span className={`shrink-0 text-base text-[var(--studio-muted)] transition ${toolbarModelSelectOpen ? "rotate-180" : ""}`}>v</span>
                        </button>
                        {toolbarModelSelectOpen ? (
                          <div
                            ref={toolbarModelSelectPanelRef}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            className={`z-[200] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-text)] shadow-none backdrop-blur-xl ${
                              toolbarModelSelectPlacement === "modal"
                                ? "fixed left-1/2 top-20 max-h-[calc(100vh-6rem)] w-[min(calc(100vw-2rem),520px)] -translate-x-1/2"
                                : `absolute left-0 max-h-[min(68vh,520px)] w-full sm:w-[480px] ${
                                    toolbarModelSelectPlacement === "top" ? "bottom-[52px]" : "top-[52px]"
                                  }`
                            }`}
                            role="listbox"
                          >
                            {videoModelGroups.map((group) => {
                              const groupOptions = options.filter((option) => videoModelGroup(option.value) === group.key);
                              if (!groupOptions.length) return null;
                              return (
                                <div key={group.key}>
                                  <div className="bg-gradient-to-b from-[#f8fafc] to-white/0 px-4 py-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">
                                    {group.label}
                                  </div>
                                  {groupOptions.map((option) => {
                                    const meta = PROVIDER_META[option.value] || {
                                      label: option.label,
                                      shortLabel: option.label,
                                      speed: "Standard",
                                      quality: "Balanced",
                                      bestFor: "General generation"
                                    };
                                    const active = provider === option.value;
                                    const modelCredits = estimateGenerationCredits({
                                      mode: "video",
                                      provider: option.value,
                                      duration,
                                      hasReferences: activeWorkflow === "image-to-video",
                                      resolution: defaultVideoResolutionForProvider(option.value)
                                    });
                                    const badge = videoModelBadge(option.value);
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onTouchStart={(event) => event.stopPropagation()}
                                        onClick={() => {
                                          applyProvider(option.value);
                                          setToolbarModelSelectOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between gap-4 border-t border-[var(--studio-border)] px-4 py-3.5 text-left transition hover:bg-[var(--studio-accent-soft)] ${active ? "bg-gradient-to-r from-[#eef8ff] to-white" : "bg-transparent"}`}
                                      >
                                        <span className="min-w-0">
                                          <span className="block text-[15px] font-semibold text-[var(--studio-text)]">{meta.label}</span>
                                          <span className="mt-1 block text-xs leading-5 text-[var(--studio-muted)]">{st(`studio.modelSelect.desc.${option.value}`)}</span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                          {(
                                            <span className="text-xs font-bold text-[var(--studio-muted)]">{st("studio.modelSelect.credits", { credits: modelCredits })}</span>
                                          )}
                                          {badge ? (
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                              badge === "free"
                                                ? "bg-[var(--studio-surface)] text-[var(--studio-muted)]"
                                                : badge === "recommended"
                                                  ? "bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white"
                                                  : badge === "pro"
                                                    ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]"
                                                    : "bg-[var(--studio-warning-soft)] text-[var(--studio-warning)]"
                                            }`}>
                                              {st(`studio.modelSelect.badge.${badge}`)}
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <select
                        value={provider}
                        onChange={(e) => applyProvider(e.target.value)}
                        className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none transition hover:bg-[var(--studio-accent-soft)] sm:w-auto"
                      >
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {PROVIDER_META[option.value]?.label || option.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {mode === "image" ? (
                      isNanoBananaProvider(provider) ? (
                        <select
                          value={ratio}
                          onChange={(e) => {
                            trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                            setRatio(e.target.value);
                          }}
                          className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none sm:w-auto"
                        >
                          {(provider === "nano-banana-pro" || provider === "nano-banana-2-lite" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS).map((item) => (
                            <option key={item} value={item}>
                              {item === "auto" ? st("studio.option.autoRatio") : item}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={imageSize}
                          onChange={(e) => {
                            trackEvent("studio_size_selected", { mode, provider, image_size: e.target.value, ratio: ratioFromImageSize(e.target.value) }, accessToken);
                            setImageSize(e.target.value);
                            setRatio(ratioFromImageSize(e.target.value));
                          }}
                          className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none sm:w-auto"
                        >
                          {IMAGE_SIZE_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      )
                    ) : mode === "audio" ? (
                      isElevenLabsAudio ? (
                        <select
                          value={ttsVoice}
                          onChange={(e) => setTtsVoice(e.target.value)}
                          className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none sm:w-auto"
                        >
                          {audioVoiceOptions.map((voice) => (
                            <option key={voice} value={voice}>{voice}</option>
                          ))}
                        </select>
                      ) : null
                    ) : mode === "avatar" ? (
                      (
                        <span className={`rounded-full border px-4 py-2.5 text-center text-sm font-semibold sm:py-2 ${avatarScriptTooLong ? "border-[var(--studio-border)] bg-[var(--studio-error-soft)] text-[var(--studio-error)]" : "border-[var(--studio-border)] bg-[var(--studio-panel)] text-[var(--studio-muted)]"}`}>
                          {avatarDuration} {st("studio.option.automatic")}
                        </span>
                      )
                    ) : (
                      <>
                        <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none sm:w-auto">
                          {videoDurationOptions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                        <select value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={((provider === "kling-video" || provider === "grok-video" || isH3VideoProvider(provider)) && activeWorkflow === "image-to-video") || isAvatarWorkflow} className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none disabled:opacity-70 sm:w-auto">
                          {videoRatioOptions.map((item) => (
                            <option key={item} value={item}>{item === "source" ? st("studio.option.sourceImage") : item}</option>
                          ))}
                        </select>
                        {showVideoResolutionControl ? (
                          <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="w-full rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-semibold text-[var(--studio-muted)] outline-none sm:w-auto">
                            {videoResolutionOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        ) : null}
                      </>
                    )}
                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--studio-muted)] sm:py-2">
                      {st("studio.generate.estimate", { credits: estCredits })}
                      <span className="ms-1.5 font-bold text-[var(--studio-accent)]">· ≈{formatApproximateCreditValue(estCredits)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateClick}
                      disabled={generateDisabled}
                      className="col-span-2 min-h-12 rounded-full bg-[var(--studio-primary)] px-7 text-sm font-semibold text-white shadow-none transition hover:-translate-y-0.5 hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:min-h-11"
                    >
                      {isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}
                    </button>
                    {isSubmitting ? (
                      <p className="col-span-2 -mt-1 text-center text-xs font-medium leading-5 text-[var(--studio-muted)] sm:text-right">
                        {st("studio.generate.projectsHint")}{" "}
                        <Link href="/studio?view=projects" className="font-semibold text-[var(--studio-accent)] underline-offset-4 hover:underline">
                          {st("studio.nav.projects")}
                        </Link>
                      </p>
                    ) : null}
                  </div>) : null}
                  {null}
                  {mode === "audio" && !showAudioWorkbenchRedesign ? (
                    <div className="border-t border-[var(--studio-border)] bg-[var(--studio-panel)] px-5 py-4 text-left md:px-7">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">{st("studio.field.modelSettings")}</p>
                        <p className="text-xs font-medium text-[var(--studio-muted)]">{providerSettingsLabel}</p>
                      </div>
                      {isElevenLabsAudio ? (
                      <>
                      <div className="grid gap-3 lg:grid-cols-5">
                        <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.music.voiceGender")}</span>
                          <div className="grid grid-cols-3 gap-1">
                            {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setAudioVoiceGender(option.value)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${audioVoiceGender === option.value ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"}`}
                              >
                                {st(`studio.music.${option.value}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.voice")}</span>
                          <select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none"
                          >
                            {audioVoiceOptions.map((voice) => (
                              <option key={voice} value={voice}>{voice}</option>
                            ))}
                          </select>
                        </label>
                        <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={ttsStability}
                            onChange={(e) => setTtsStability(Number(e.target.value))}
                            className="w-full accent-[var(--studio-primary)]"
                          />
                        </label>
                        <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.language")}</span>
                          <select
                            value={ttsLanguageCode}
                            onChange={(e) => setTtsLanguageCode(e.target.value)}
                            className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none"
                          >
                          {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                              <option key={item.value || "auto"} value={item.value}>
                                {st(`studio.languageOption.${item.value || "auto"}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.textNormalization")}</span>
                          <select
                            value={textNormalization}
                            onChange={(e) => setTextNormalization(e.target.value)}
                            className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none"
                          >
                          {TEXT_NORMALIZATION_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {st(`studio.textNormalization.${item.value}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <span>
                            <span className="block text-sm font-semibold text-[var(--studio-text)]">{st("studio.field.wordTimestamps")}</span>
                            <span className="mt-1 block text-xs text-[var(--studio-muted)]">{st("studio.audio.wordTimestampsDescription")}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={ttsTimestamps}
                            onChange={(e) => setTtsTimestamps(e.target.checked)}
                            className="h-5 w-5"
                          />
                        </label>
                        <p className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-3 text-sm font-semibold text-[var(--studio-muted)]">
                          {st("studio.audio.creditEstimate", {
                            characters: audioCharacterCount.toLocaleString(),
                            credits: estCredits
                          })}
                          <span className="ms-1.5 font-bold text-[var(--studio-accent)]">· ≈{formatApproximateCreditValue(estCredits)}</span>
                        </p>
                      </div>
                      </>
                      ) : (
                        <div className="grid gap-3">
                          <button
                            type="button"
                            onClick={() => setMusicAdvancedOpen((value) => !value)}
                            className="flex w-full items-center justify-between rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] px-4 py-3 text-left"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-[var(--studio-text)]">{st("studio.music.additionalSettings")}</span>
                              <span className="mt-1 block text-xs text-[var(--studio-muted)]">{st("studio.music.additionalSettingsDescription")}</span>
                            </span>
                            <span className="text-sm font-semibold text-[var(--studio-muted)]">{musicAdvancedOpen ? st("studio.music.less") : st("studio.music.more")}</span>
                          </button>
                          {musicAdvancedOpen ? (
                          <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-4">
                              <span>
                                <span className="block text-sm font-semibold text-[var(--studio-text)]">{st("studio.music.instrumental")}</span>
                                <span className="mt-1 block text-xs text-[var(--studio-muted)]">{st("studio.music.instrumentalDescription")}</span>
                              </span>
                              <input type="checkbox" checked={isInstrumental} onChange={(e) => setIsInstrumental(e.target.checked)} className="h-5 w-5" />
                            </label>
                            <label className={`flex items-center justify-between gap-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-4 ${isInstrumental ? "opacity-50" : ""}`}>
                              <span>
                                <span className="block text-sm font-semibold text-[var(--studio-text)]">{st("studio.music.autoLyrics")}</span>
                                <span className="mt-1 block text-xs text-[var(--studio-muted)]">{st("studio.music.autoLyricsDescription")}</span>
                              </span>
                              <input type="checkbox" checked={lyricsOptimizer} disabled={isInstrumental} onChange={(e) => setLyricsOptimizer(e.target.checked)} className="h-5 w-5" />
                            </label>
                          </div>
                          {!isInstrumental ? (
                            <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.music.lyrics")}</span>
                              <textarea
                                rows={8}
                                maxLength={3500}
                                value={musicLyrics}
                                onChange={(e) => setMusicLyrics(e.target.value)}
                                disabled={lyricsOptimizer}
                                placeholder={st("studio.music.lyricsPlaceholder")}
                                className="w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-3 text-sm leading-6 text-[var(--studio-text)] outline-none disabled:opacity-50"
                              />
                              <span className="mt-2 block text-xs leading-5 text-[var(--studio-muted)]">{st("studio.music.lyricsDescription")}</span>
                              <span className="mt-2 block text-right text-xs text-[var(--studio-muted)]">{musicLyrics.length.toLocaleString()} / 3,500</span>
                            </label>
                          ) : null}
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.music.sampleRate")}</span>
                              <select value={musicSampleRate} onChange={(e) => setMusicSampleRate(Number(e.target.value))} className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none">
                                {[16000, 24000, 32000, 44100].map((value) => <option key={value} value={value}>{value} Hz</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[var(--studio-muted)]">{st("studio.music.sampleRateDescription")}</span>
                            </label>
                            <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.music.bitrate")}</span>
                              <select value={musicBitrate} onChange={(e) => setMusicBitrate(Number(e.target.value))} className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold text-[var(--studio-text)] outline-none">
                                {[32000, 64000, 128000, 256000].map((value) => <option key={value} value={value}>{value / 1000} kbps</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[var(--studio-muted)]">{st("studio.music.bitrateDescription")}</span>
                            </label>
                            <label className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[var(--studio-muted)]">{st("studio.music.format")}</span>
                              <select value={musicFormat} onChange={(e) => setMusicFormat(e.target.value as "mp3" | "wav" | "pcm")} className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-sm font-semibold uppercase text-[var(--studio-text)] outline-none">
                                {(["mp3", "wav", "pcm"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[var(--studio-muted)]">{st("studio.music.formatDescription")}</span>
                            </label>
                          </div>
                          </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : (showImageWorkbenchRedesign || showAudioWorkbenchRedesign || showAvatarWorkbenchRedesign) ? null : showImageWorkbenchRedesign ? (
                    <ImageSettings
      gptOptions={gptImageOptions}
      referenceImageUrls={referenceImageUrls}
      onGptOptionsChange={setGptImageOptions}
      gptValidationError={gptValidationError}
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      utilityWorkflow={
                        showImageUtilityRedesign
                          ? imageWorkflow === "enhance-cleanup"
                            ? "enhance-cleanup"
                            : "background-remove"
                          : null
                      }
                      isImageToImage={showImageToImageRedesign}
                      isNanoBanana={isNanoBananaProvider(provider)}
                      isNanoBananaLite={isNanoBananaLiteProvider(provider)}
                      ratio={ratio}
                      ratioOptions={
                        provider === "nano-banana-pro" || provider === "nano-banana-2-lite"
                          ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item))
                          : NANO_ASPECT_RATIO_OPTIONS
                      }
                      imageSize={imageSize}
                      imageSizePresets={isGptImageProvider(provider) ? GPT_IMAGE_SIZES : IMAGE_SIZE_PRESETS}
                      outputFormat={outputFormat}
                      imageQuality={imageQuality}
                      editResolution={editResolution}
                      numInferenceSteps={numInferenceSteps}
                      guidanceScale={guidanceScale}
                      numImages={numImages}
                      seed={seed}
                      enableSafetyChecker={enableSafetyChecker}
                      acceleration={acceleration}
                      safetyTolerance={safetyTolerance}
                      limitGenerations={limitGenerations}
                      enableWebSearch={enableWebSearch}
                      thinkingLevel={thinkingLevel}
                      systemPrompt={systemPrompt}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      translate={st}
                      onProviderChange={applyProvider}
                      onRatioChange={(value) => {
                        trackEvent("studio_size_selected", { mode, provider, ratio: value }, accessToken);
                        setRatio(value);
                      }}
                      onImageSizeChange={(value) => {
                        trackEvent("studio_size_selected", {
                          mode,
                          provider,
                          image_size: value,
                          ratio: ratioFromImageSize(value)
                        }, accessToken);
                        setImageSize(value);
                        setRatio(ratioFromImageSize(value));
                      }}
                      onOutputFormatChange={setOutputFormat}
                      onImageQualityChange={setImageQuality}
                      onEditResolutionChange={setEditResolution}
                      onNumInferenceStepsChange={setNumInferenceSteps}
                      onGuidanceScaleChange={setGuidanceScale}
                      onNumImagesChange={setNumImages}
                      onSeedChange={setSeed}
                      onEnableSafetyCheckerChange={setEnableSafetyChecker}
                      onAccelerationChange={setAcceleration}
                      onSafetyToleranceChange={setSafetyTolerance}
                      onLimitGenerationsChange={setLimitGenerations}
                      onEnableWebSearchChange={setEnableWebSearch}
                      onThinkingLevelChange={setThinkingLevel}
                      onSystemPromptChange={setSystemPrompt}
                      onGenerate={handleGenerateClick}
                    />
                  ) : showAudioWorkbenchRedesign ? (
                    <AudioSettings
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      isElevenLabs={isElevenLabsAudio}
      isGeminiTts={isGeminiTts}
                      isHeygenVoice={isHeygenVoice}
                      heygenVoice={heygenVoice}
                      heygenVoiceFree={heygenVoiceFree}
                      heygenVoiceError={heygenVoiceError}
                      onHeygenVoiceChange={setHeygenVoice}
                      locale={studioI18n.locale}
                      audioVoiceOptions={audioVoiceOptions}
                      languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
                      voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
                      ttsVoice={ttsVoice}
                      ttsLanguageCode={ttsLanguageCode}
                      ttsTimestamps={ttsTimestamps}
                      audioVoiceGender={audioVoiceGender}
                      ttsStability={ttsStability}
                      textNormalization={textNormalization}
                      textNormalizationOptions={TEXT_NORMALIZATION_OPTIONS}
                      musicSampleRate={musicSampleRate}
                      musicBitrate={musicBitrate}
                      musicFormat={musicFormat}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      translate={st}
                      onProviderChange={applyProvider}
                      onTtsVoiceChange={setTtsVoice}
                      onTtsLanguageCodeChange={setTtsLanguageCode}
                      onTtsTimestampsChange={setTtsTimestamps}
                      onAudioVoiceGenderChange={setAudioVoiceGender}
                      onTtsStabilityChange={setTtsStability}
                      onTextNormalizationChange={setTextNormalization}
                      onMusicSampleRateChange={setMusicSampleRate}
                      onMusicBitrateChange={setMusicBitrate}
                      onMusicFormatChange={setMusicFormat}
                      onGenerate={handleGenerateClick}
                    />
                  ) : showVideoWorkbenchRedesign ? (
                    <>
                    <VideoSettings
                      workflowTabs={workflowNavigation}
                        statusMessage={statusText}
                        statusTone={statusTone}
                      dailyFreeLabel={h3FreeLabel}
                      workflow={configuredVideoWorkflow}
                      referenceVideoUrl={referenceVideoUrl}
                      onReferenceVideoUrlChange={setReferenceVideoUrl}
                      prompt={prompt}
                      referenceImageUrls={referenceImageUrls}
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      duration={duration}
                      durationOptions={videoDurationOptions}
                      ratio={ratio}
                      ratioOptions={videoRatioOptions}
                      ratioDisabled={(provider === "kling-video" || provider === "grok-video" || isH3VideoProvider(provider)) && activeWorkflow === "image-to-video"}
                      showResolutionControl={showVideoResolutionControl}
                      resolution={videoResolution}
                      resolutionOptions={videoResolutionOptions}
                      showAudioControl={showVideoAudioControl}
                      generateAudio={generateAudio}
                      reasoningLevel={reasoningLevel}
                      onReasoningLevelChange={setReasoningLevel}
                      enableSafetyChecker={enableSafetyChecker}
                      onEnableSafetyCheckerChange={setEnableSafetyChecker}
                      seed={seed}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      translate={st}
                      onPromptChange={videoPromptAI.edit}
                      promptAI={videoPromptAI}
                      onReferenceClear={() => {
                        setReferenceImagesText("");
                        setReferenceImageFiles([]);
                      }}
                      onReferenceFiles={handleReferenceFiles}
                      onReferenceRemove={(index) => {
                        if (videoWorkflow === "reference-to-video") {
                          const urls = parseStudioReferenceImages(referenceImagesText);
                          if (index < urls.length) setReferenceImagesText(urls.filter((_,position)=>position!==index).join("\n"));
                          else setReferenceImageFiles(files=>files.filter((_,position)=>position!==index-urls.length));
                          return;
                        }
                        setReferenceImagesText("");
                        setReferenceImageFiles(index === 0 ? [] : referenceImageUrls.slice(0, 1));
                      }}
                      onFileError={() => { setStatusTone("error"); setStatusText(st("studio.status.fileReadFailed")); }}
                      onProviderChange={applyProvider}
                      onDurationChange={setDuration}
                      onRatioChange={setRatio}
                      onResolutionChange={setVideoResolution}
                      onGenerateAudioChange={setGenerateAudio}
                      onSeedChange={setSeed}
                      onGenerate={handleGenerateClick}
                    />
                    <StudioDeferredSection><VideoTemplateGallery translate={st} locale={studioI18n.locale} /></StudioDeferredSection>
                    </>
                  ) : showAvatarWorkbenchRedesign ? (
                    <AvatarSettings
                      dailyFreeLabel={h3FreeLabel}

                      isH3MaxAvatar={isH3MaxAvatar}
                      duration={duration}
                      durationOptions={videoDurationOptions}
                      resolution={videoResolution}
                      resolutionOptions={videoResolutionOptions}
                      ratio={ratio}
                      ratioOptions={videoRatioOptions}
                      automaticDuration={avatarDuration}
                      scriptTooLong={avatarScriptTooLong}
                      estimatedCredits={estCredits}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      translate={st}
                      onDurationChange={setDuration}
                      onResolutionChange={setVideoResolution}
                      onRatioChange={setRatio}
                      onGenerate={handleGenerateClick}
                    />
                  ) : mode === "image" && !isPromptlessImageWorkflow ? (
                    <div className="border-t border-[var(--studio-border)] bg-[var(--studio-panel)] px-5 py-4 text-left md:px-7">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">{st("studio.field.modelSettings")}</p>
                        <p className="text-xs font-medium text-[var(--studio-muted)]">{providerSettingsLabel}</p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        {isGptImageProvider(provider) ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.quality")}</p>
                            <div className="grid grid-cols-4 gap-1">
                              {GPT_IMAGE_QUALITIES.map((quality) => (
                                <button
                                  key={quality}
                                  type="button"
                                  onClick={() => setImageQuality(quality)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold capitalize transition ${
                                    imageQuality === quality ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                  }`}
                                >
                                  {quality}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <>
                            <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.steps")}</p>
                              <div className="grid grid-cols-4 gap-1">
                                {(provider === "flux-image" ? [1, 2, 4, 8, 12] : [4, 8, 16, 28, 50]).map((steps) => (
                                  <button
                                    key={steps}
                                    type="button"
                                    onClick={() => setNumInferenceSteps(steps)}
                                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                      numInferenceSteps === steps ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                    }`}
                                  >
                                    {steps}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                              <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.guidance")}</p>
                              <input
                                type="range"
                                min="1"
                                max="20"
                                step="0.5"
                                value={guidanceScale}
                                onChange={(e) => setGuidanceScale(Number(e.target.value))}
                                className="w-full accent-[var(--studio-primary)]"
                              />
                              <p className="mt-1 text-xs font-semibold text-[var(--studio-text)]">{guidanceScale}</p>
                            </div>
                          </>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.resolution")}</p>
                            <div className="grid grid-cols-4 gap-1">
                              {["1K", "2K", "4K"].map((resolution) => (
                                <button
                                  key={resolution}
                                  type="button"
                                  onClick={() => setEditResolution(resolution)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    editResolution === resolution ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                  }`}
                                >
                                  {resolution}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.output")}</p>
                          <div className="grid grid-cols-3 gap-1">
                            {(provider === "flux-image" || provider === "flux-dev" ? ["jpeg", "png"] : ["png", "jpeg", "webp"]).map((format) => (
                              <button
                                key={format}
                                type="button"
                                onClick={() => setOutputFormat(format)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold uppercase transition ${
                                  outputFormat === format ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                }`}
                              >
                                {format}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.count")}</p>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setNumImages(count)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                  numImages === count ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.safety")}</p>
                            <button
                              type="button"
                              onClick={() => setEnableSafetyChecker((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                enableSafetyChecker ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "bg-[var(--studio-panel)] text-[var(--studio-muted)]"
                              }`}
                            >
                              {enableSafetyChecker ? st("studio.state.enabled") : st("studio.state.disabled")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.acceleration")}</p>
                            <div className="grid grid-cols-3 gap-1">
                              {["none", "regular", "high"].map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setAcceleration(item)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold capitalize transition ${
                                    acceleration === item ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {isNanoBananaProvider(provider) ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.safetyTolerance")}</p>
                            <div className="grid grid-cols-6 gap-1">
                              {["1", "2", "3", "4", "5", "6"].map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setSafetyTolerance(item)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    safetyTolerance === item ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {isNanoBananaProvider(provider) ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.limitGenerations")}</p>
                            <button
                              type="button"
                              onClick={() => setLimitGenerations((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                limitGenerations ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "bg-[var(--studio-panel)] text-[var(--studio-muted)]"
                              }`}
                            >
                              {limitGenerations ? st("studio.state.on") : st("studio.state.off")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.webSearch")}</p>
                            <button
                              type="button"
                              onClick={() => setEnableWebSearch((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                enableWebSearch ? "bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]" : "bg-[var(--studio-panel)] text-[var(--studio-muted)]"
                              }`}
                            >
                              {enableWebSearch ? st("studio.state.enabled") : st("studio.state.disabled")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" || isNanoBananaLiteProvider(provider) ? (
                          <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.thinking")}</p>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { value: "", label: provider === "nano-banana-image" ? "medium" : st("studio.state.off") },
                                { value: "minimal", label: st("studio.state.minimal") },
                                { value: "high", label: st("studio.state.high") }
                              ].map((item) => (
                                <button
                                  key={item.value || "off"}
                                  type="button"
                                  onClick={() => setThinkingLevel(item.value)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    thinkingLevel === item.value ? "bg-[var(--studio-primary)] text-white" : "bg-[var(--studio-panel)] text-[var(--studio-muted)] hover:bg-[var(--studio-accent-soft)]"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                          <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.seed")}</p>
                          <input
                            value={seed}
                            onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, "").slice(0, 12))}
                            placeholder={st("studio.placeholder.random")}
                            inputMode="numeric"
                            className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-xs font-semibold text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]"
                          />
                        </div>
                        {isNanoBananaProvider(provider) ? (
                          <div className="lg:col-span-2 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-accent-soft)] p-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--studio-muted)]">{st("studio.field.systemPrompt")}</p>
                            <textarea
                              dir="auto"
                              rows={2}
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                              placeholder={st("studio.placeholder.system")}
                              className="w-full resize-none rounded-xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-3 py-2 text-xs font-medium leading-5 text-[var(--studio-text)] outline-none placeholder:text-[var(--studio-muted)]"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {!showModernWorkbenchRedesign ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(mode === "image"
                    ? [
                        { label: st("studio.suggestion.productCampaign"), prompt: "Product campaign" },
                        { label: st("studio.suggestion.socialAd"), prompt: "Social ad" },
                        { label: st("studio.suggestion.brandPoster"), prompt: "Brand poster" },
                        { label: st("studio.suggestion.referenceEdit"), prompt: "Reference edit" }
                      ]
                    : activeWorkflow === "avatar-video"
                      ? [
                          { label: "Product intro", prompt: "Hi, I'm here to introduce our new product. It is designed to help you save time, look more professional, and create better results with less effort." },
                          { label: "Social hook", prompt: "Stop scrolling. If you want to create better AI videos from just one image, here is the easiest way to start." },
                          { label: "Course explainer", prompt: "Welcome back. In this short lesson, I'll explain the key idea step by step so you can understand it quickly and use it right away." },
                          { label: "Real estate intro", prompt: "Welcome to this beautiful property. In the next few seconds, I'll show you why this home is comfortable, modern, and worth a closer look." }
                        ]
                    : activeWorkflow === "image-to-video"
                      ? [
                          { label: st("studio.suggestion.cameraPushIn"), prompt: "Camera push-in" },
                          { label: st("studio.suggestion.productReveal"), prompt: "Product reveal" },
                          { label: st("studio.suggestion.cinematicLoop"), prompt: "Cinematic loop" },
                          { label: st("studio.suggestion.socialMotion"), prompt: "Social motion" }
                        ]
                      : [
                          { label: st("studio.suggestion.ugcAd"), prompt: "UGC-style ad" },
                          { label: st("studio.suggestion.dynamicCamera"), prompt: "Dynamic camera move" },
                          { label: st("studio.suggestion.multiScene"), prompt: "Multi-scene cut" },
                          { label: st("studio.suggestion.broll"), prompt: "B-roll footage" }
                        ]
                  ).map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      onClick={() => setPrompt((current) => current || item.prompt)}
                      className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-2 text-sm font-medium text-[var(--studio-muted)] shadow-sm transition hover:bg-[var(--studio-panel)] hover:text-[var(--studio-text)]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                ) : null}

                {!(showModernWorkbenchRedesign) ? (<div className={showModernWorkbenchRedesign ? "hidden" : "mt-10 grid gap-4 text-left md:grid-cols-3"}>
                  {[
                    { title: st("studio.summary.modelRouting"), body: providerNote },
                    { title: st("studio.summary.canvas"), body: mode === "image" ? `${selectedImageSize.label} / ${selectedImageSize.dimensions}` : `${duration} / ${ratio === "source" ? st("studio.summary.sourceImage") : ratio}` },
                    { title: st("studio.summary.history"), body: activeTasks.length ? st("studio.summary.runningTasks", { count: activeTasks.length }) : st("studio.summary.savedAutomatically") }
                  ].map((card) => (
                    <div key={card.title} className="rounded-[1.5rem] border border-[var(--studio-border)] bg-[var(--studio-panel)] p-5 shadow-none backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-muted)]">{card.title}</p>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--studio-text)]">{card.body}</p>
                    </div>
                  ))}
                </div>) : null}
                {showTextToImageTemplates ? (
                  <StudioDeferredSection><ImagePromptGallery
                    translate={st}
                    onPromptCopied={(item) => {
                      trackEvent("gallery_prompt_copied", { gallery_item_id: item.id, category: item.category, surface: "studio" }, accessToken);
                    }}
                  /></StudioDeferredSection>
                ) : null}
                {showImageToImageRedesign ? <StudioDeferredSection><ImageTemplateGallery translate={st} locale={studioI18n.locale} /></StudioDeferredSection> : null}
                {mode === "avatar" ? <StudioDeferredSection><AvatarLibrary prompt={prompt} locale={studioI18n.locale} userId={userId} accessToken={accessToken} onLogin={onSuccess => requestSignIn({ onSuccess, onBeforeRedirect: () => saveLoginDraft(false) })} onCreate={imageUrl => { setReferenceImagesText(imageUrl); setReferenceImageFiles([]); requestAnimationFrame(() => requestAnimationFrame(() => { const composer=document.querySelector<HTMLElement>('[data-creation-workspace="avatar"]'); composer?.scrollIntoView({block:"start",behavior:"smooth"}); composer?.querySelector<HTMLTextAreaElement>("textarea[dir=auto]")?.focus({preventScroll:true}); })); }} /></StudioDeferredSection> : null}
              </div>);
}
