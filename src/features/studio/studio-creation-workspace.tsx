"use client";

import dynamic from "next/dynamic";
import { trackEvent } from "../../lib/analytics";
import { requestSignIn } from "../../lib/auth-navigation";
import { GPT_IMAGE_SIZES, isGptImageProvider } from "../../lib/gpt-image-models";
import { HEYGEN_VOICE_MAX_CHARACTERS } from "../../lib/heygen-voice";
import { parseStudioReferenceImages } from "../../lib/studio-workspace-inputs";
import { ModelPicker } from "./model-picker";
import { StudioDeferredSection } from "./studio-deferred-section";
import {
  ELEVENLABS_LANGUAGE_OPTIONS,
  ELEVENLABS_VOICE_GENDER_OPTIONS,
  IMAGE_SIZE_PRESETS,
  NANO_ASPECT_RATIO_OPTIONS,
  TEXT_NORMALIZATION_OPTIONS,
  isH3VideoProvider,
  isNanoBananaLiteProvider,
  isNanoBananaProvider,
  ratioFromImageSize
} from "./studio-workspace-config";
import { UnifiedWorkbenchLayout } from "./unified-workbench-layout";
import type { StudioController } from "./use-studio-controller";
import { WorkflowSwitcher } from "./workflow-switcher";

const AudioSettings = dynamic(() => import("./audio-settings").then((module) => module.AudioSettings));
const AudioWorkbench = dynamic(() => import("./audio-workbench").then((module) => module.AudioWorkbench));
const AvatarSettings = dynamic(() => import("./avatar-settings").then((module) => module.AvatarSettings));
const AvatarWorkbench = dynamic(() => import("./avatar-workbench").then((module) => module.AvatarWorkbench));
const GeminiTtsEditor = dynamic(() => import("./gemini-tts-editor").then((module) => module.GeminiTtsEditor));
const ImagePromptGallery = dynamic(() => import("./image-prompt-gallery").then((module) => module.ImagePromptGallery));
const ImageSettings = dynamic(() => import("./image-settings").then((module) => module.ImageSettings));
const ImageWorkbench = dynamic(() => import("./image-workbench").then((module) => module.ImageWorkbench));
const TopazVideoSettings = dynamic(() => import("./topaz-video-settings").then((module) => module.TopazVideoSettings));
const VideoSettings = dynamic(() => import("./video-settings").then((module) => module.VideoSettings));
const VideoTemplateGallery = dynamic(() => import("../../features/studio/studio-video-template-gallery"), { ssr: false });
const ImageTemplateGallery = dynamic(() => import("../../features/studio/studio-image-template-gallery"), { ssr: false });
const AvatarLibrary = dynamic(() => import("../../features/studio/studio-avatar-library"), { ssr: false });

export default function StudioCreationWorkspace({ model }: { model: StudioController }) {
  const {
    acceleration,
    accessToken,
    activeWorkflow,
    applyProvider,
    applyWorkflow,
    audioVoiceGender,
    audioVoiceOptions,
    audioWorkflow,
    avatarDuration,
    avatarScriptMeta,
    avatarScriptTooLong,
    avatarVoiceGender,
    avatarVoiceOptions,
    canSubmit,
    cloudMediaEnabled,
    configuredVideoWorkflow,
    creditBalance,
    duration,
    editResolution,
    enableSafetyChecker,
    enableWebSearch,
    estCredits,
    geminiTts,
    generateAudio,
    generateDisabled,
    gptImageOptions,
    gptValidationError,
    guidanceScale,
    h3FreeLabel,
    handleCloudMediaFile,
    handleGenerateClick,
    handleReferenceFiles,
    heygenReferenceOptions,
    heygenValidationError,
    heygenVoice,
    heygenVoiceError,
    heygenVoiceFree,
    imageQuality,
    imageSize,
    imageWorkflow,
    improveTextToImagePrompt,
    isAppsHome,
    isBillingView,
    isElevenLabsAudio,
    isGeminiTts,
    isH3MaxAvatar,
    isHeygenAvatar,
    isHeygenVoice,
    isInstrumental,
    isMiniMaxMusic,
    isProjectsView,
    isPromptlessImageWorkflow,
    isSubmitting,
    isTopazVideo,
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
    outputFormat,
    prompt,
    provider,
    ratio,
    reasoningLevel,
    referenceImageUrls,
    referenceImagesText,
    referenceVideoUrl,
    safetyTolerance,
    saveLoginDraft,
    seed,
    seedanceOptions,
    seedanceValidationError,
    setAcceleration,
    setAudioVoiceGender,
    setAvatarVoiceGender,
    setDuration,
    setEditResolution,
    setEnableSafetyChecker,
    setEnableWebSearch,
    setGeminiTts,
    setGenerateAudio,
    setGptImageOptions,
    setGuidanceScale,
    setHeygenReferenceOptions,
    setHeygenVoice,
    setImageQuality,
    setImageSize,
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
    setSeedanceOptions,
    setStatusText,
    setStatusTone,
    setSystemPrompt,
    setTextNormalization,
    setThinkingLevel,
    setTopazOptions,
    setTopazSource,
    setTtsLanguageCode,
    setTtsStability,
    setTtsTimestamps,
    setTtsVoice,
    setVideoResolution,
    showAudioWorkbenchRedesign,
    showAvatarWorkbenchRedesign,
    showImageToImageRedesign,
    showImageUtilityRedesign,
    showImageWorkbenchRedesign,
    showTextToImageTemplates,
    showVideoAudioControl,
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
    topazOptions,
    topazQuote,
    topazSource,
    ttsLanguageCode,
    ttsStability,
    ttsTimestamps,
    ttsVoice,
    userId,
    videoDurationOptions,
    videoPromptAI,
    videoRatioOptions,
    videoResolution,
    videoResolutionOptions,
    videoWorkflow
  } = model;

  const workflowNavigation = (
    <WorkflowSwitcher
      t={st}
      mode={mode}
      imageWorkflow={imageWorkflow}
      videoWorkflow={videoWorkflow}
      audioWorkflow={audioWorkflow}
      onWorkflowChange={applyWorkflow}
    />
  );

  return (
    <div className={`w-full ${isAppsHome || isProjectsView || isBillingView ? "hidden" : ""}`}>
      <div className="w-full max-w-none overflow-visible text-left">
        {showImageWorkbenchRedesign ? (
          <UnifiedWorkbenchLayout
            workflowTabs={workflowNavigation}
            statusMessage={statusText}
            statusTone={statusTone}
            mode="image"
            editor={
              <ImageWorkbench
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
                onReferenceImagesTextChange={(value) => {
                  setReferenceImagesText(value);
                  setGptImageOptions((current) => ({ ...current, maskUrl: "", markupImageUrl: "" }));
                }}
                onReferenceFiles={handleReferenceFiles}
                onReferenceClear={() => {
                  setGptImageOptions((current) => ({ ...current, maskUrl: "", markupImageUrl: "" }));
                  setReferenceImagesText("");
                  setReferenceImageFiles([]);
                }}
                onReferenceRemove={(index) => {
                  const urls = parseStudioReferenceImages(referenceImagesText);
                  if (index < 0 || index >= referenceImageUrls.length) return;
                  if (index === 0) setGptImageOptions((current) => ({ ...current, maskUrl: "", markupImageUrl: "" }));
                  if (index < urls.length) setReferenceImagesText(urls.filter((_, position) => position !== index).join("\n"));
                  else setReferenceImageFiles((files) => files.filter((_, position) => position !== index - urls.length));
                }}
                onFileError={() => {
                  setStatusTone("error");
                  setStatusText(st("studio.status.fileReadFailed"));
                }}
              />
            }
            settings={
              <ImageSettings
                gptOptions={gptImageOptions}
                referenceImageUrls={referenceImageUrls}
                onGptOptionsChange={setGptImageOptions}
                gptValidationError={gptValidationError}
                provider={provider}
                providerOptions={modelPickerOptions}
                utilityWorkflow={showImageUtilityRedesign ? (imageWorkflow === "enhance-cleanup" ? "enhance-cleanup" : "background-remove") : null}
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
            }
          />
        ) : showAudioWorkbenchRedesign ? (
          <UnifiedWorkbenchLayout
            workflowTabs={workflowNavigation}
            statusMessage={statusText}
            statusTone={statusTone}
            mode="audio"
            editor={
              <AudioWorkbench
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
              />
            }
            settings={
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
            }
          />
        ) : showAvatarWorkbenchRedesign ? (
          <UnifiedWorkbenchLayout
            workflowTabs={workflowNavigation}
            statusMessage={statusText}
            statusTone={statusTone}
            mode="avatar"
            modelSelector={<ModelPicker inline value={provider} options={modelPickerOptions} translate={st} onChange={applyProvider} />}
            editor={
              <AvatarWorkbench
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
                onReferenceImagesTextChange={(value) => {
                  setReferenceImageFiles([]);
                  setReferenceImagesText(value);
                }}
                onReferenceFiles={async (files) => {
                  if (files?.length) setReferenceImagesText("");
                  await handleReferenceFiles(files);
                }}
                onFileError={() => {
                  setStatusTone("error");
                  setStatusText(st("studio.status.fileReadFailed"));
                }}
                onStartImageGuide={startAvatarImageGuide}
                onAvatarVoiceGenderChange={setAvatarVoiceGender}
                onTtsVoiceChange={setTtsVoice}
                onTtsLanguageCodeChange={setTtsLanguageCode}
                onTtsStabilityChange={setTtsStability}
              />
            }
            settings={
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
            }
          />
        ) : showVideoWorkbenchRedesign && isTopazVideo ? (
          <TopazVideoSettings
            workflowTabs={workflowNavigation}
            translate={st}
            token={accessToken}
            upload={handleCloudMediaFile}
            cloudEnabled={cloudMediaEnabled}
            source={topazSource}
            onSourceChange={setTopazSource}
            options={topazOptions}
            onOptionsChange={setTopazOptions}
            quote={topazQuote}
            submitting={isSubmitting}
            statusMessage={statusText}
            statusTone={statusTone}
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
              onUseReference={() => applyWorkflow("reference-to-video")}
              referenceVideoUrl={referenceVideoUrl}
              shortsTemplate={sp.get("templateCategory") === "shorts" && Boolean(sp.get("templateId")) && sp.get("referenceVideo") === referenceVideoUrl}
              heygenReferenceOptions={heygenReferenceOptions}
              onHeygenReferenceOptionsChange={setHeygenReferenceOptions}
              heygenValidationError={heygenValidationError}
              seedanceOptions={seedanceOptions}
              seedanceValidationError={seedanceValidationError}
              onSeedanceOptionsChange={setSeedanceOptions}
              onReferenceVideoUrlChange={setReferenceVideoUrl}
              onMediaUpload={handleCloudMediaFile}
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
                  if (index < urls.length) setReferenceImagesText(urls.filter((_, position) => position !== index).join("\n"));
                  else setReferenceImageFiles((files) => files.filter((_, position) => position !== index - urls.length));
                  return;
                }
                setReferenceImagesText("");
                setReferenceImageFiles(index === 0 ? [] : referenceImageUrls.slice(0, 1));
              }}
              onFileError={() => {
                setStatusTone("error");
                setStatusText(st("studio.status.fileReadFailed"));
              }}
              onProviderChange={applyProvider}
              onDurationChange={setDuration}
              onRatioChange={setRatio}
              onResolutionChange={setVideoResolution}
              onGenerateAudioChange={setGenerateAudio}
              onSeedChange={setSeed}
              onGenerate={handleGenerateClick}
            />
            <StudioDeferredSection id="studio-video-templates">
              <VideoTemplateGallery translate={st} locale={studioI18n.locale} />
            </StudioDeferredSection>
          </>
        ) : null}
      </div>

      {showTextToImageTemplates ? (
        <StudioDeferredSection>
          <ImagePromptGallery
            translate={st}
            onPromptCopied={(item) => {
              trackEvent("gallery_prompt_copied", { gallery_item_id: item.id, category: item.category, surface: "studio" }, accessToken);
            }}
          />
        </StudioDeferredSection>
      ) : null}
      {showImageToImageRedesign ? (
        <StudioDeferredSection>
          <ImageTemplateGallery translate={st} locale={studioI18n.locale} />
        </StudioDeferredSection>
      ) : null}
      {mode === "avatar" ? (
        <StudioDeferredSection>
          <AvatarLibrary
            prompt={prompt}
            locale={studioI18n.locale}
            userId={userId}
            accessToken={accessToken}
            onLogin={(onSuccess) => requestSignIn({ onSuccess, onBeforeRedirect: () => saveLoginDraft(false) })}
            onCreate={(imageUrl) => {
              setReferenceImagesText(imageUrl);
              setReferenceImageFiles([]);
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const composer = document.querySelector<HTMLElement>('[data-creation-workspace="avatar"]');
                  composer?.scrollIntoView({ block: "start", behavior: "smooth" });
                  composer?.querySelector<HTMLTextAreaElement>("textarea[dir=auto]")?.focus({ preventScroll: true });
                })
              );
            }}
          />
        </StudioDeferredSection>
      ) : null}
    </div>
  );
}
