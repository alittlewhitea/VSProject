"use client";
import { useRouter,useSearchParams } from "next/navigation";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { type Locale } from "../../i18n/routing";
import { trackEvent } from "../../lib/analytics";
import { AUTH_REDIRECT_EVENT,requestSignIn } from "../../lib/auth-navigation";
import { FLUX3_MAX_PROMO_END,isFlux3MaxPromotion } from "../../lib/flux3-max";
import { GEMINI_TTS_PROVIDER,geminiTtsBillableText,restoreGeminiTtsOptions } from "../../lib/gemini-tts";
import { HEYGEN_VOICE_PROVIDER, HEYGEN_VOICE_FREE_END, isHeygenVoiceFree, restoreHeygenVoiceOptions } from "../../lib/heygen-voice";
import { DEFAULT_GPT_IMAGE_OPTIONS,GPT_IMAGE_SIZES,gptImageOptionError,gptImageQuality,isGptImageProvider,normalizeGptImageProvider,type GptImageOptions,type GptImageQuality } from "../../lib/gpt-image-models";
import { isH3DailyFreeRequest } from "../../lib/h3-daily-free-policy";
import { heygenAvatarTiming } from "../../lib/heygen-avatar";
import { videoDialogueTiming } from "../../lib/video-spoken-script";
import { heygenAspectRatioError, heygenRequiresHdAspectRatio, preferredHeygenHdRatio } from "../../lib/heygen-video-options";
import { DEFAULT_HEYGEN_REFERENCE_OPTIONS, HEYGEN_REFERENCE_IMAGE_LIMIT, HEYGEN_REFERENCE_PROMPT_LIMIT, heygenReferenceUploadIssue, heygenReferenceValidationKey, prepareHeygenReferencePrompt, type HeygenReferenceOptions } from "../../lib/heygen-reference-video";
import { MISCHIEF_MAX_IMAGE_BYTES,MISCHIEF_PROVIDER } from "../../lib/mischief";
import { CREDIT_LOW_BALANCE_THRESHOLD,estimateGenerationCredits } from "../../lib/model-pricing";
import { SEEDANCE_FLASH_PROVIDER, DEFAULT_SEEDANCE_FLASH_OPTIONS, SEEDANCE_FLASH_IMAGE_LIMIT, parseReferenceMediaUrls, seedanceFlashValidationKey, type SeedanceFlashOptions } from "../../lib/seedance-flash";
import { SEEDREAM_55_PROVIDER, SEEDREAM_55_SIZES, seedream55Error } from "../../lib/seedream-55";
import { useStudioI18n } from "../../lib/studio-i18n";
import { navigateStudio } from "../../lib/studio-navigation";
import { parseStudioReferenceImages,referenceTextWithoutExamples,shouldApplyUrlInput,type AppliedUrlInput } from "../../lib/studio-workspace-inputs";
import { uploadStudioDataUrl, uploadStudioMedia } from "./upload-studio-media";
import type { StudioMediaKind } from "../../lib/studio-media";
import { TOPAZ_VIDEO_PROVIDER, defaultTopazVideoOptions, parseTopazVideoOptions, topazVideoQuote, type TopazVideoSource } from "../../lib/topaz-video-upscale";
import { videoSupportsEndFrame } from "../../lib/video-keyframes";
import { localizeStudioErrorMessage } from "./studio-error-utils";
import { type HomeCreationInput } from "./studio-home";
import {
clearPersistentIdempotency,
clearStudioLoginDraft,
createIdempotencyFingerprint,
getPersistentIdempotency,
mergeTasks,
pickImageOutputUrls,
pickMediaUrl,
readSessionTasks,
readStudioLoginDraft,
safeRemoveLocalStorage,
safeSetLocalStorage,
scopedSessionKey,
sessionTasksKey,
writeSessionTasksCache,
writeStudioLoginDraft,
type StudioMode,
type TaskItem
} from "./studio-storage";
import { AVATAR_KLING_BUFFER_SECONDS,AVATAR_MAX_SECONDS,AudioWorkflow,DEFAULT_VIDEO_DURATION,ELEVENLABS_VOICE_GENDER_OPTIONS,ELEVENLABS_VOICE_META,IMAGE_SIZE_PRESETS,ImageWorkflow,KLING_AVATAR_DEFAULT_SCRIPT,MINIMAX_H3_MAX_AVATAR_PROMPT,MINIMAX_H3_MAX_TURBO_AVATAR_PROMPT,MINIMAX_MUSIC_DEFAULT_PROMPT,PROMPT_IMPROVE_TEXT,PROVIDER_META,SESSION_CREDIT_BALANCE_KEY,StudioWorkflow,VideoWorkflow,WORKFLOW_META,avatarDurationFromPrompt,defaultImageRatioForProvider,defaultImageSizeForProvider,defaultPromptForProvider,defaultVideoResolutionForProvider,estimateAvatarScriptSeconds,frontendPollAttempts,getImageSizePreset,h3PerformanceNote,isAvatarProvider,isH3MaxProvider,isH3VideoProvider,isModelSampleReference,isNanoBananaLiteProvider,isNanoBananaProvider,isProviderAllowedForMode,isProviderDefaultPrompt,isSamplePrompt,lastModelStorageKey,modeForPricing,modelPickerBadge,modelPickerGroup,modelPickerSpeedKey,modelSampleReferenceForProvider,promptForProviderChange,providerForWorkflow,ratioFromImageSize,readRememberedModel,stripAvatarDefaultReferences,studioProjectHref,workflowForMode } from "./studio-workspace-config";
import {useStudioTaskHistory} from "./use-studio-task-history";
import { useStudioAudioState } from "./use-studio-audio-state";
import { useStudioImageState } from "./use-studio-image-state";
import { useStudioSessionBilling, type StudioSessionActionMeta } from "./use-studio-session-billing";
import { useH3DailyFree } from "./use-h3-daily-free";
import { useTaskDetails } from "./use-task-details";
import { useVerifiedAvatarAudio } from "./use-verified-avatar-audio";
import { useVideoPromptEnhancement } from "./use-video-prompt-enhancement";
import {
isKnownVideoDuration,
isKnownVideoRatio,
isKnownVideoResolution,
videoModelConfig,
videoModelDefaultDuration,
videoModelDefaultResolution,
videoModelDurations,
videoModelRatios,
videoModelResolutions
} from "./video-models";

export function useStudioController({ initialLocale, initialMessages, initialView, initialPricingTime }: { initialLocale: Locale; initialMessages?: Record<string,string>; initialView?: "billing"; initialPricingTime?: number }) {

  const studioI18n = useStudioI18n(initialLocale,initialMessages);
  const st = studioI18n.t;
  const localizeStudioError = useCallback((message: string, status?: number) => localizeStudioErrorMessage(st, message, status), [st]);
  const router = useRouter();
  const sp = useSearchParams();
  const mode: StudioMode = sp.get("mode") === "image" ? "image" : sp.get("mode") === "audio" ? "audio" : sp.get("mode") === "avatar" ? "avatar" : "video";
  const view = sp.get("view") || initialView;
  const isBillingView = view === "billing";
  const billingParams = new URLSearchParams(sp.toString());
  billingParams.set("view", "billing");
  for (const key of ["taskId", "checkout", "token", "payment_id", "session_id", "checkout_id"]) billingParams.delete(key);
  const billingHref = `/studio?${billingParams.toString()}`;
  const isReferralsView = view === "referrals";
  const isProjectsView = view === "projects" || isReferralsView;
  const isAppsHome = view === "home" || (!view && !sp.get("mode") && !sp.get("workflow"));
  const providerFromUrl = sp.get("provider");
  const initialWorkflow = workflowForMode(mode, sp.get("workflow"));
  const initialProvider = providerForWorkflow(
    initialWorkflow,
    isProviderAllowedForMode(providerFromUrl, mode)
      ? providerFromUrl === "nano-banana-edit"
        ? "nano-banana-image"
        : providerFromUrl
      : null
  );
  const initialImageWorkflow: ImageWorkflow =
    initialWorkflow === "image-to-image" || initialWorkflow === "enhance-cleanup" || initialWorkflow === "background-remove" ? initialWorkflow : "text-to-image";
  const initialVideoWorkflow: VideoWorkflow =
    initialWorkflow === "avatar-video" || initialWorkflow === "image-to-video" || initialWorkflow === "reference-to-video" || initialWorkflow === "video-upscale" ? initialWorkflow : "text-to-video";
  const initialAudioWorkflow: AudioWorkflow = initialWorkflow === "text-to-music" ? "text-to-music" : "text-to-audio";
  const initialReferenceUrl = sp.get("reference");
  const [prompt, setPrompt] = useState(() => defaultPromptForProvider(initialProvider, initialWorkflow, st("studio.music.defaultPrompt")));
  const [selectedProvider, setProvider] = useState(initialProvider);
  // Query navigation updates mode before effects synchronize the selected model.
  // Never render/quote a model from the previous mode during that transition.
  const provider = isProviderAllowedForMode(selectedProvider, mode) && WORKFLOW_META[initialWorkflow].providers.includes(selectedProvider) ? selectedProvider : initialProvider;
  const [imageWorkflow, setImageWorkflow] = useState<ImageWorkflow>(initialImageWorkflow);
  const [videoWorkflow, setVideoWorkflow] = useState<VideoWorkflow>(initialVideoWorkflow);
  const [videoSidebarCollapsed, setVideoSidebarCollapsed] = useState(false);
  const [audioWorkflow, setAudioWorkflow] = useState<AudioWorkflow>(initialAudioWorkflow);
  const [ratio, setRatio] = useState(mode === "image" ? "1:1" : mode === "avatar" ? "source" : "16:9");
  const imageState = useStudioImageState({ mode, provider, imageWorkflow, setRatio });
  const {
    imageSize, setImageSize, editResolution, setEditResolution, outputFormat, setOutputFormat,
    imageQuality, setImageQuality, gptImageOptions, setGptImageOptions, numImages, setNumImages,
    guidanceScale, setGuidanceScale, numInferenceSteps, setNumInferenceSteps,
    acceleration, setAcceleration, limitGenerations, setLimitGenerations,
    safetyTolerance, setSafetyTolerance, systemPrompt, setSystemPrompt,
    enableWebSearch, setEnableWebSearch, thinkingLevel, setThinkingLevel
  } = imageState;
  const [referenceImagesText, setReferenceImagesText] = useState(() =>
    (mode === "image" || mode === "video" || mode === "avatar") &&
    initialReferenceUrl
      ? initialReferenceUrl
      : initialWorkflow === "avatar-video"
        ? ""
      : initialVideoWorkflow === "image-to-video" && modelSampleReferenceForProvider(initialProvider)
        ? modelSampleReferenceForProvider(initialProvider)
      : ""
  );
  const [referenceImageFiles, setReferenceImageFiles] = useState<string[]>([]);
  const referenceUploadScopeRef = useRef(0);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState(sp.get("referenceVideo") || "");
  const [cloudMediaEnabled, setCloudMediaEnabled] = useState(false);
  const [topazOptions, setTopazOptions] = useState(defaultTopazVideoOptions);
  const [topazSource, setTopazSource] = useState<TopazVideoSource | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/media", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (!controller.signal.aborted) setCloudMediaEnabled(value?.enabled === true); })
      .catch(() => null);
    return () => controller.abort();
  }, []);
  const [seedanceOptions, setSeedanceOptions] = useState<SeedanceFlashOptions>({ ...DEFAULT_SEEDANCE_FLASH_OPTIONS });
  const [heygenReferenceOptions, setHeygenReferenceOptions] = useState<HeygenReferenceOptions>({ ...DEFAULT_HEYGEN_REFERENCE_OPTIONS });
  const lastAppliedVideoUrlRef = useRef<AppliedUrlInput | null>(null);
  const lastRegenerateKeyRef = useRef<string | null>(null);
  const lastAssistantTaskRef = useRef<string | null>(null);
  const lastAssistantImageSettingsRef = useRef<string | null>(null);
  const previousReferenceWorkflow = useRef(initialWorkflow === "reference-to-video");
  const homeReferenceRef = useRef<{ mode: "image" | "video" | "avatar"; image: string } | null>(null);
  const lastAppliedPromptUrlRef = useRef<AppliedUrlInput | null>(null);
  const lastAppliedReferenceUrlRef = useRef<AppliedUrlInput | null>(null);
  const [avatarAudioUrl, setAvatarAudioUrl] = useState(sp.get("audioUrl") || "");
  const [avatarAudioTrimSeconds, setAvatarAudioTrimSeconds] = useState<number | null>(null);
  const [videoResolution, setVideoResolution] = useState(() => defaultVideoResolutionForProvider(initialProvider));
  const [generateAudio, setGenerateAudio] = useState(initialProvider === "flux-3-max-video" || initialProvider === SEEDANCE_FLASH_PROVIDER);
  const [reasoningLevel, setReasoningLevel] = useState<"low"|"high">("high");
  const [pricingTime, setPricingTime] = useState(()=>initialPricingTime ?? Date.now());
  useEffect(()=>{
    if(mode !== "video") return;
    const refresh=()=>setPricingTime(Date.now());
    const interval=window.setInterval(refresh,60000);
    const remaining=FLUX3_MAX_PROMO_END-Date.now();
    const timeout=remaining>0&&remaining<2147483647?window.setTimeout(refresh,remaining+20):null;
    window.addEventListener("focus",refresh);
    return ()=>{window.clearInterval(interval);if(timeout!==null)window.clearTimeout(timeout);window.removeEventListener("focus",refresh);};
  },[mode]);
  const audioState = useStudioAudioState({ mode, provider, prompt, pricingTime });
  const {
    ttsVoice, setTtsVoice, geminiTts, setGeminiTts, heygenVoice, setHeygenVoice, heygenVoiceFreeIntentRef,
    avatarVoiceGender, setAvatarVoiceGender, audioVoiceGender, setAudioVoiceGender,
    ttsStability, setTtsStability, ttsTimestamps, setTtsTimestamps, ttsLanguageCode, setTtsLanguageCode,
    textNormalization, setTextNormalization, musicLyrics, setMusicLyrics, lyricsOptimizer, setLyricsOptimizer,
    isInstrumental, setIsInstrumental, musicSampleRate, setMusicSampleRate, musicBitrate, setMusicBitrate,
    musicFormat, setMusicFormat, musicAdvancedOpen, setMusicAdvancedOpen,
    avatarVoiceOptions, audioVoiceOptions, isMiniMaxMusic, isElevenLabsAudio, isGeminiTts, isHeygenVoice,
    heygenVoiceFree, heygenVoiceError, geminiSpeech, speechBillableText, audioCharacterCount
  } = audioState;
  useEffect(() => {
    if (mode !== "audio" || provider !== HEYGEN_VOICE_PROVIDER) return;
    const refresh = () => setPricingTime(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 60000);
    const remaining = HEYGEN_VOICE_FREE_END - Date.now();
    const deadline = remaining > 0 && remaining < 2147483647 ? window.setTimeout(refresh, remaining + 1) : null;
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); if (deadline !== null) window.clearTimeout(deadline); window.removeEventListener("focus", refresh); };
  }, [mode, provider]);
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(false);
  useEffect(() => {
    if (provider === "heygen-video") setEnableSafetyChecker(videoWorkflow === "reference-to-video");
  }, [provider, videoWorkflow]);
  const [seed, setSeed] = useState("");
  const [duration, setDuration] = useState(
    mode === "video" || mode === "avatar"
      ? videoModelDefaultDuration(initialProvider)
      : "single"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "idle">("idle");

  const [previewModal, setPreviewModal] = useState<{ url: string; type: "Image" | "Video" } | null>(null);
  const sessionActionMetaRef = useRef<StudioSessionActionMeta>({
    mode,
    provider,
    activeWorkflow: initialWorkflow,
    estCredits: 0,
    selectedProviderLabel: provider,
    st,
    saveLoginDraft: () => false
  });
  const sessionBilling = useStudioSessionBilling(sessionActionMetaRef);
  const {
    accessToken,
    userId,
    authReady,
    referralsVisible,
    creditBalance,
    setCreditBalance,
    cacheCreditBalance,
    creditNote,
    billingModalOpen,
    setBillingModalOpen,
    billingMessage,
    billingGenerationContext,
    setBillingGenerationContext,
    loadingBillingItem,
    billingModalScrollRef,
    refreshLiveAccessToken,
    openBillingModal,
    openInsufficientCreditsModal,
    startStudioCreditCheckout
  } = sessionBilling;
  const {tasks,setTasks,taskHistoryNote,setTaskHistoryNote}=useStudioTaskHistory(accessToken,userId,st);
  const h3DailyFree = useH3DailyFree(accessToken, userId);
  const startHomeCreation = useCallback((input: HomeCreationInput) => {
    const hasImage = input.mode !== "audio" && Boolean(input.image);
    const workflow = input.mode === "avatar"
      ? "avatar-video"
      : input.mode === "video"
        ? hasImage ? "image-to-video" : "text-to-video"
        : input.mode === "image"
          ? hasImage ? "image-to-image" : "text-to-image"
          : "text-to-audio";
    homeReferenceRef.current = hasImage ? { mode: input.mode as "image" | "video" | "avatar", image: input.image! } : null;
    const params = new URLSearchParams({ mode: input.mode, workflow });
    if (input.prompt) params.set("prompt", input.prompt);
    if (input.mode === "audio") { setReferenceImagesText(""); setReferenceImageFiles([]); }
    navigateStudio(`/studio?${params.toString()}`);
  }, []);
  const [loginDraftNonce, setLoginDraftNonce] = useState(0);
  const [mobileStudioMenuOpen, setMobileStudioMenuOpen] = useState(false);
  const lastStudioModeRef = useRef<StudioMode>(mode);
  const restoredLoginDraftRef = useRef(false);
  const autoSubmitLoginDraftRef = useRef(false);
  const trackedStudioViewRef = useRef("");
  const lastLocalizedMusicPromptRef = useRef(st("studio.music.defaultPrompt"));

  useEffect(() => {
    const localizedPrompt = st("studio.music.defaultPrompt");
    if (provider === "minimax-music-2.6") {
      setPrompt((current) =>
        !current.trim() || current === MINIMAX_MUSIC_DEFAULT_PROMPT || current === lastLocalizedMusicPromptRef.current
          ? localizedPrompt
          : current
      );
    } else {
      setPrompt((current) =>
        current === MINIMAX_MUSIC_DEFAULT_PROMPT || current === lastLocalizedMusicPromptRef.current
          ? ""
          : current
      );
    }
    lastLocalizedMusicPromptRef.current = localizedPrompt;
  }, [provider, studioI18n.locale]);

  useEffect(() => {
    setMobileStudioMenuOpen(false);
  }, [isAppsHome, isProjectsView, isBillingView, mode]);

  useEffect(() => {
    const workflow = mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow;
    const key = `${mode}:${provider}:${workflow}`;
    if (trackedStudioViewRef.current === key) return;
    trackedStudioViewRef.current = key;
    trackEvent("studio_view", { mode, provider, workflow, signed_in: Boolean(accessToken) }, accessToken);
  }, [accessToken, audioWorkflow, imageWorkflow, mode, provider, videoWorkflow]);

  useEffect(() => {
    const workflowParam = workflowForMode(mode, sp.get("workflow"));
    const providerParam = sp.get("provider");
    const previousMode = lastStudioModeRef.current;
    const modeChanged = previousMode !== mode;
    lastStudioModeRef.current = mode;
    if (modeChanged) referenceUploadScopeRef.current += 1;
    // Avatar portraits belong to that workspace, independently of its script.
    // The URL-input effect below still applies explicitly supplied references.
    if (modeChanged && (previousMode === "avatar" || mode === "avatar")) {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
    }
    setImageWorkflow(
      mode === "image" && (workflowParam === "image-to-image" || workflowParam === "enhance-cleanup" || workflowParam === "background-remove")
        ? workflowParam
        : "text-to-image"
    );
    setVideoWorkflow(
      mode === "video" && (workflowParam === "image-to-video" || workflowParam === "reference-to-video" || workflowParam === "video-upscale")
        ? workflowParam
        : mode === "avatar"
          ? "avatar-video"
          : "text-to-video"
    );
    setAudioWorkflow(mode === "audio" && workflowParam === "text-to-music" ? "text-to-music" : "text-to-audio");
    const enteringReference = mode === "video" && workflowParam === "reference-to-video";
    if (enteringReference && !previousReferenceWorkflow.current) {
      if (sp.get("source") === "assistant") {
        setReferenceImagesText(current=>isModelSampleReference(current) ? "" : current);
      } else { setReferenceImagesText(""); setReferenceImageFiles([]); }
    }
    previousReferenceWorkflow.current = enteringReference;
    const validProviderParam = isProviderAllowedForMode(providerParam, mode) ? providerParam : null;
    const rememberedProvider = validProviderParam ? null : readRememberedModel(workflowParam);
    const nextProvider = providerForWorkflow(
      workflowParam,
      validProviderParam || rememberedProvider
    );
    if(mode==="image"&&isGptImageProvider(nextProvider)&&(modeChanged||!isGptImageProvider(selectedProvider)))setImageQuality("low");
    setProvider(nextProvider === "nano-banana-edit" ? "nano-banana-image" : nextProvider);
    if (sp.get("source") !== "assistant" && !sp.get("prompt") && (modeChanged || nextProvider !== initialProvider)) {
      setPrompt(current => mode === "avatar" && !modeChanged
        ? promptForProviderChange(current, "", st("studio.music.defaultPrompt"))
        : defaultPromptForProvider(nextProvider, workflowParam, st("studio.music.defaultPrompt")));
    }
    if (modeChanged && mode === "image") {
      if (!sp.get("reference")) setReferenceImagesText("");
      if (!sp.get("reference") || sp.get("templateId")) setReferenceImageFiles([]);
    }
    const nextImageSize = mode === "image" ? isGptImageProvider(nextProvider) && sp.get("imageSize") ? sp.get("imageSize")! : defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? defaultImageRatioForProvider(nextProvider, nextImageSize) : mode === "avatar" ? "source" : workflowParam === "reference-to-video" ? nextProvider === SEEDANCE_FLASH_PROVIDER ? "auto" : "adaptive" : nextProvider === SEEDANCE_FLASH_PROVIDER && workflowParam === "image-to-video" ? "source" : "16:9");
    setImageSize(nextImageSize);
    setDuration(current =>
      mode === "avatar" && !modeChanged && provider === nextProvider && videoModelDurations(nextProvider).includes(current)
        ? current
        : mode === "video" || mode === "avatar" ? videoModelDefaultDuration(nextProvider) : "single"
    );
    setVideoResolution(defaultVideoResolutionForProvider(nextProvider));
    setStatusText("");
    setStatusTone("idle");
  }, [mode, sp]);

  useEffect(() => {
    const promptParam = sp.get("prompt");
    const shortsTemplateId = sp.get("templateCategory") === "shorts" ? sp.get("templateId") ?? undefined : undefined;
    const applyPromptParam = shouldApplyUrlInput(lastAppliedPromptUrlRef.current, mode, promptParam, shortsTemplateId);
    lastAppliedPromptUrlRef.current = { mode, value: promptParam, templateId: shortsTemplateId };
    if (promptParam && applyPromptParam) {
      setPrompt(promptParam);
    }

    const providerParam = sp.get("provider");

    const ratioParam = sp.get("ratio");
    if (ratioParam && isKnownVideoRatio(ratioParam)) {
      setRatio(ratioParam);
    }

    const imageSizeParam = sp.get("imageSize");
    if (provider !== "topaz-image" && imageSizeParam && (IMAGE_SIZE_PRESETS.some((preset) => preset.value === imageSizeParam) || provider === SEEDREAM_55_PROVIDER && SEEDREAM_55_SIZES.includes(imageSizeParam) || (isGptImageProvider(provider) && ["auto","custom",...GPT_IMAGE_SIZES.map(preset=>preset.value)].includes(imageSizeParam)))) {
      setImageSize(imageSizeParam);
      setRatio(ratioFromImageSize(imageSizeParam));
    }

    const durationParam = sp.get("duration");
    if (durationParam && (mode === "image" ? durationParam === "single" : isKnownVideoDuration(durationParam))) {
      setDuration(durationParam);
    }

    const resolutionParam = sp.get("resolution");
    if (resolutionParam && isKnownVideoResolution(resolutionParam)) {
      setVideoResolution(resolutionParam);
    }
    const taskParam = sp.get("seedanceTask");
    if (sp.get("source") === "assistant" && workflowForMode(mode, sp.get("workflow")) === "reference-to-video" && providerParam === SEEDANCE_FLASH_PROVIDER && ["reference","editing","extension"].includes(taskParam || "")) {
      const key = `${providerParam}:${taskParam}`;
      if (lastAssistantTaskRef.current !== key) setSeedanceOptions(current=>({...current,task:taskParam as SeedanceFlashOptions["task"]}));
      lastAssistantTaskRef.current = key;
    } else lastAssistantTaskRef.current = null;
    if (sp.get("source") === "assistant" && mode === "image") {
      const key = `${providerParam}:${sp.get("workflow")}:${imageSizeParam}:${sp.get("quality")}:${sp.get("numImages")}:${sp.get("imageResolution")}`;
      if (lastAssistantImageSettingsRef.current !== key) {
        if (sp.get("numImages") === "1") setNumImages(1);
        if (sp.get("imageResolution") === "1K") setEditResolution("1K");
        if (sp.get("quality")) setImageQuality(isGptImageProvider(providerParam || "") ? gptImageQuality(sp.get("quality")) : "high");
      }
      lastAssistantImageSettingsRef.current = key;
    } else lastAssistantImageSettingsRef.current = null;

    const referenceParam = sp.get("reference");
    const applyReferenceParam = shouldApplyUrlInput(lastAppliedReferenceUrlRef.current, mode, referenceParam);
    lastAppliedReferenceUrlRef.current = { mode, value: referenceParam };
    if (mode === "image" && referenceParam) {
      const referenceWorkflow = workflowForMode(mode, sp.get("workflow"));
      setImageWorkflow(referenceWorkflow === "enhance-cleanup" || referenceWorkflow === "background-remove" ? referenceWorkflow : "image-to-image");
      if (applyReferenceParam) {setReferenceImagesText(referenceParam);setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));}
    } else if (mode === "video" && referenceParam && workflowForMode(mode, sp.get("workflow")) !== "reference-to-video") {
      if (applyReferenceParam) setReferenceImagesText(referenceParam);
    } else if (mode === "avatar") {
      if (applyReferenceParam && referenceParam) setReferenceImagesText(referenceParam);
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
      setPrompt((current) => isProviderDefaultPrompt(current, st("studio.music.defaultPrompt")) ? "" : current);
    } else {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
      setPrompt((current) => current.trim() === KLING_AVATAR_DEFAULT_SCRIPT || current.trim() === MINIMAX_H3_MAX_AVATAR_PROMPT || current.trim() === MINIMAX_H3_MAX_TURBO_AVATAR_PROMPT ? "" : current);
    }
  }, [mode, sp]);

  useEffect(() => {
    if (mode !== "video" || workflowForMode(mode, sp.get("workflow")) !== "reference-to-video") {
      lastAppliedVideoUrlRef.current = null;
      return;
    }
    const value = sp.get("referenceVideo");
    if (sp.get("source") === "assistant" && value === null) return;
    if (shouldApplyUrlInput(lastAppliedVideoUrlRef.current, mode, value)) setReferenceVideoUrl(value || "");
    lastAppliedVideoUrlRef.current = {mode, value};
  }, [mode, sp]);

  useEffect(() => {
    if (sp.get("source") !== "regenerate") {
      lastRegenerateKeyRef.current = null;
      return;
    }
    const key = sp.toString();
    if (lastRegenerateKeyRef.current === key) return;
    lastRegenerateKeyRef.current = key;
    const providerParam = sp.get("provider") || "";
    const seedParam = sp.get("seed");
    if (seedParam && /^\d{1,12}$/.test(seedParam)) setSeed(seedParam);
    const taskParam = sp.get("seedanceTask");
    if (providerParam === SEEDANCE_FLASH_PROVIDER && taskParam && ["reference", "editing", "extension"].includes(taskParam)) {
      setSeedanceOptions(current => ({ ...current, task: taskParam as SeedanceFlashOptions["task"] }));
    }
    if (mode === "image") {
      const ratioParam = sp.get("ratio");
      if (ratioParam) setRatio(ratioParam);
      const imageResolutionParam = sp.get("imageResolution");
      if (imageResolutionParam && ["1K", "2K", "4K"].includes(imageResolutionParam)) setEditResolution(imageResolutionParam);
      const qualityParam = sp.get("quality");
      if (qualityParam) setImageQuality(isGptImageProvider(providerParam) ? gptImageQuality(qualityParam) : (qualityParam as GptImageQuality));
      const numImagesParam = Number.parseInt(sp.get("numImages") || "", 10);
      if (Number.isInteger(numImagesParam) && numImagesParam >= 1 && numImagesParam <= 10) setNumImages(numImagesParam);
    }
  }, [mode, sp]);

  // Apply the local upload after the existing route effects select the workflow.
  // Keep image data out of URLs and use the same reference state as editor uploads.
  useEffect(() => {
    const pending = homeReferenceRef.current;
    if (!pending || sp.get("view") === "home" || mode !== pending.mode) return;
    const expectedWorkflow = mode === "avatar" ? "avatar-video" : mode === "image" ? "image-to-image" : "image-to-video";
    if (sp.get("workflow") !== expectedWorkflow) return;
    setReferenceImagesText("");
    setReferenceImageFiles([pending.image]);
    homeReferenceRef.current = null;
  }, [mode, sp]);





  const options = useMemo(
    () => WORKFLOW_META[mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow].providers
      .filter((value) => true)
      .map((value) => ({ value, label: PROVIDER_META[value]?.label || value })),
    [audioWorkflow, imageWorkflow, mode, videoWorkflow]
  );

  const activeWorkflow: StudioWorkflow = mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow;
  const isPromptlessImageWorkflow = mode === "image" && (activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove");
  const allReferenceImageUrls = useMemo(() => [
    ...parseStudioReferenceImages(referenceImagesText),
    ...referenceImageFiles
  ], [referenceImagesText,referenceImageFiles]);
  const referenceImageUrls = useMemo(() => allReferenceImageUrls.slice(0, isPromptlessImageWorkflow ? 1 : isGptImageProvider(provider) ? 16 : 14),[allReferenceImageUrls,isPromptlessImageWorkflow,provider]);
  const isAvatarWorkflow = mode === "avatar" || activeWorkflow === "avatar-video";

  const isH3MaxAvatar = isAvatarWorkflow && isH3MaxProvider(provider);
  const isHeygenAvatar = isAvatarWorkflow && provider === "heygen-video";
  const heygenTiming = heygenAvatarTiming(prompt);
  const avatarScriptSeconds = isAvatarWorkflow ? estimateAvatarScriptSeconds(prompt) : 0;
  const avatarOutputSeconds = isAvatarWorkflow ? avatarScriptSeconds + (AVATAR_KLING_BUFFER_SECONDS) : 0;
  const isDefaultAvatarScript = isAvatarWorkflow && prompt.trim() === KLING_AVATAR_DEFAULT_SCRIPT;
  const avatarDuration = isHeygenAvatar ? duration : isAvatarWorkflow
    ? isH3MaxAvatar
      ? duration
      : avatarDurationFromPrompt(prompt)
    : duration;
  const avatarScriptTooLong = isHeygenAvatar ? heygenTiming.tooLong : isAvatarWorkflow && !isH3MaxAvatar && !isDefaultAvatarScript && avatarOutputSeconds > AVATAR_MAX_SECONDS;
  const verifiedAvatarAudio = useVerifiedAvatarAudio(accessToken, avatarAudioUrl, isAvatarWorkflow && isAvatarProvider(provider));
  useEffect(()=>{
    if(!isAvatarWorkflow||!avatarAudioUrl.trim()||isSubmitting)return;
    if(verifiedAvatarAudio.loading){setStatusTone("idle");setStatusText(st("studio.status.audioChecking"));}
    else if(verifiedAvatarAudio.error){setStatusTone("error");setStatusText(verifiedAvatarAudio.error);}
  },[verifiedAvatarAudio.loading,verifiedAvatarAudio.error,isAvatarWorkflow,avatarAudioUrl,isSubmitting]);
  const avatarQuoteDuration = verifiedAvatarAudio.billableSeconds ? `${verifiedAvatarAudio.billableSeconds}s` : avatarDuration;
  const avatarScriptMeta = isAvatarWorkflow
    ? prompt.trim()
      ? isH3MaxAvatar
        ? st("studio.workbench.characters", { count: prompt.length.toLocaleString() })
        : isDefaultAvatarScript
        ? st("studio.avatar.sampleMeta")
        : st("studio.avatar.scriptMeta", {
            characters: prompt.trim().length.toLocaleString(),
            voiceSeconds: avatarScriptSeconds,
            videoSeconds: Number.parseInt(avatarDuration, 10)
          })
      : st("studio.avatar.emptyMeta")
    : "";
  const avatarSelectedSeconds = Math.max(1, Number.parseInt(avatarDuration, 10) || Number.parseInt(DEFAULT_VIDEO_DURATION, 10));

  const isTopazVideo = mode === "video" && activeWorkflow === "video-upscale";
  const validTopazOptions = isTopazVideo ? parseTopazVideoOptions(topazOptions) : null;
  const topazQuote = topazSource && validTopazOptions ? topazVideoQuote(topazSource, validTopazOptions) : null;
  const baseEstCredits = isTopazVideo || provider === TOPAZ_VIDEO_PROVIDER ? (topazQuote?.credits ?? 0) : estimateGenerationCredits({
    pricingTime,
    mode: modeForPricing(mode),
    provider,
    videoWorkflow: activeWorkflow === "reference-to-video" ? "reference-to-video" : undefined,
    referenceVideoCount: activeWorkflow === "reference-to-video" ? parseReferenceMediaUrls(referenceVideoUrl).length : 0,
    seedanceTask: activeWorkflow === "reference-to-video" ? seedanceOptions.task : undefined,
    imageSize,
    ...(provider === SEEDREAM_55_PROVIDER ? { imageWidth: gptImageOptions.width, imageHeight: gptImageOptions.height } : {}),
    ...(isGptImageProvider(provider)?{imageWidth:gptImageOptions.width,imageHeight:gptImageOptions.height,outputFormat,imageReasoningEffort:gptImageOptions.reasoningEffort,frameCount:gptImageOptions.frameCount,svgModel:gptImageOptions.svgModel}:{}),
    duration: isAvatarWorkflow ? avatarQuoteDuration : duration,
    hasReferences: referenceImageUrls.length > 0,
    referenceCount: referenceImageUrls.length + Number(mode==="image"&&isGptImageProvider(provider)&&imageWorkflow==="image-to-image"&&Boolean(gptImageOptions.maskUrl||gptImageOptions.markupImageUrl)),
    resolution: mode === "image" ? editResolution : videoResolution,
    generateAudio: mode === "video" ? generateAudio : false,
    quality: imageQuality,
    numImages: mode === "image" ? numImages : 1,
    enableWebSearch,
    thinkingLevel,
    promptText: speechBillableText
  });

  const isH3FreeTier = isH3DailyFreeRequest({ mode, provider, resolution: videoResolution, duration: isAvatarWorkflow ? avatarDuration : duration });
  const usesH3FreeAllowance = isH3FreeTier && h3DailyFree.available;
  const h3FreeLoading = isH3FreeTier && (h3DailyFree.loading || creditBalance === null);
  const h3FreeLabel = isH3FreeTier && h3DailyFree.eligible
    ? st(usesH3FreeAllowance ? "studio.h3Free.available" : "studio.h3Free.used") : undefined;
  const estCredits = usesH3FreeAllowance ? 0 : baseEstCredits;
  const recommendedProvider = WORKFLOW_META[activeWorkflow].recommendedProvider;
  const modelPickerOptions = useMemo(() => isTopazVideo ? [] : options.map((option) => {
    const meta = PROVIDER_META[option.value] || {
      label: option.label,
      shortLabel: option.label,
      speed: "Standard",
      quality: "Balanced",
      bestFor: "General generation"
    };
    const optionDurationOptions = mode === "video" ? videoModelDurations(option.value) : [];
    const optionAvatarPrompt = isAvatarWorkflow
      ? promptForProviderChange(prompt, defaultPromptForProvider(option.value, activeWorkflow, st("studio.music.defaultPrompt")), st("studio.music.defaultPrompt"))
      : prompt;
    const optionDuration = isAvatarWorkflow
      ? isH3MaxProvider(option.value) ? videoModelDefaultDuration(option.value) : avatarDurationFromPrompt(optionAvatarPrompt)
      : mode === "video"
        ? optionDurationOptions.includes(duration) ? duration : videoModelDefaultDuration(option.value)
        : duration;
    const optionResolution = mode === "image"
      ? editResolution
      : defaultVideoResolutionForProvider(option.value);
    const optionGenerateAudio = mode === "video" && Boolean(videoModelConfig(option.value)?.showAudioControl) && generateAudio;
    const keepGptSettings = mode === "image" && isGptImageProvider(provider) && isGptImageProvider(option.value);
    const optionImageSize = mode === "image" && !keepGptSettings ? defaultImageSizeForProvider(option.value) : imageSize;
    const optionReferenceCount = referenceImageUrls.length + Number(keepGptSettings && imageWorkflow === "image-to-image" && Boolean(gptImageOptions.maskUrl || gptImageOptions.markupImageUrl));
    const rawOptionCredits = option.value === provider
      ? estCredits
      : estimateGenerationCredits({
          pricingTime,
          mode: modeForPricing(mode),
          provider: option.value,
          videoWorkflow: activeWorkflow === "reference-to-video" ? "reference-to-video" : undefined,
          referenceVideoCount: activeWorkflow === "reference-to-video" ? parseReferenceMediaUrls(referenceVideoUrl).length : 0,
          seedanceTask: activeWorkflow === "reference-to-video" ? seedanceOptions.task : undefined,
          imageSize: optionImageSize,
          duration: optionDuration,
          hasReferences: optionReferenceCount > 0,
          referenceCount: optionReferenceCount,
          resolution: optionResolution,
          generateAudio: optionGenerateAudio,
          quality: keepGptSettings ? imageQuality : isGptImageProvider(option.value) ? "low" : "high",
          ...(keepGptSettings ? {imageWidth:gptImageOptions.width,imageHeight:gptImageOptions.height,outputFormat,imageReasoningEffort:gptImageOptions.reasoningEffort,frameCount:gptImageOptions.frameCount,svgModel:gptImageOptions.svgModel} : {}),
          numImages: mode === "image" ? numImages : 1,
          enableWebSearch,
          thinkingLevel,
          promptText: option.value === GEMINI_TTS_PROVIDER ? geminiTtsBillableText(prompt, geminiTts) : prompt
        });
    const optionDreamfaceUnits = 0;
    const optionCredits = (h3DailyFree.available && isH3DailyFreeRequest({mode,provider:option.value,duration:optionDuration,resolution:option.value===provider?videoResolution:videoModelDefaultResolution(option.value)}))
      ? 0
      : rawOptionCredits;
    const groupKey = modelPickerGroup(mode, activeWorkflow, option.value, recommendedProvider);
    const badgeKey = modelPickerBadge(mode, option.value, recommendedProvider);
    const capabilities: Array<"audio" | "keyframes" | "free" | "budget" | "hd"> = [];
    if (optionCredits === 0) capabilities.push("free");
    if (mode === "video" && (option.value === "heygen-video" || Boolean(videoModelConfig(option.value)?.showAudioControl))) {
      capabilities.push("audio");
    }
    if (mode === "video" && activeWorkflow === "image-to-video" && videoSupportsEndFrame(option.value)) {
      capabilities.push("keyframes");
    }
    if (
      optionCredits > 0 &&
      (mode === "image" ? optionCredits <= 6 : mode === "video" || isAvatarWorkflow ? optionCredits <= 18 : optionCredits <= 8)
    ) {
      capabilities.push("budget");
    }
    if (
      mode === "image"
        ? option.value !== "nano-banana-2-lite"
        : videoModelResolutions(option.value).some((res) => res === "1080p" || res === "2K" || res === "4K")
    ) {
      capabilities.push("hd");
    }
    return {
      value: option.value,
      label: meta.label,
      description: st(groupKey),
      performanceNote: h3PerformanceNote(option.value, activeWorkflow),
      speed: isH3MaxProvider(option.value) ? meta.speed : st(modelPickerSpeedKey(meta.speed)),
      quality: option.value === "heygen-video" ? st("studio.field.nativeAudio") : meta.quality,
      duration: mode === "video" || isAvatarWorkflow
        ? option.value === provider
          ? isAvatarWorkflow ? avatarDuration : duration
          : optionDuration
        : undefined,
      credits: optionCredits,
      badge: option.value===HEYGEN_VOICE_PROVIDER&&isHeygenVoiceFree(pricingTime)?st("studio.heygenVoice.freeBadge"):option.value === "flux-3-max-video" && isFlux3MaxPromotion(pricingTime) ? st("studio.flux3.promotion") : badgeKey ? st(badgeKey) : undefined,
      group: st(groupKey),
      capabilities
    };
  }), [activeWorkflow, avatarDuration, duration, editResolution, estCredits, geminiTts, generateAudio, gptImageOptions, h3DailyFree, imageQuality, imageSize, imageWorkflow, isAvatarWorkflow, isTopazVideo, mode, numImages, options, pricingTime, prompt, provider, recommendedProvider, referenceImageUrls, referenceVideoUrl, seedanceOptions, st, videoResolution]);
  const hasEnoughCredits = creditBalance === null || creditBalance >= estCredits;
  const lowBalanceAfterGeneration = estCredits > 0 && typeof creditBalance === "number" && creditBalance - estCredits < CREDIT_LOW_BALANCE_THRESHOLD;
  const hasMiniMaxLyrics = isInstrumental || lyricsOptimizer || musicLyrics.trim().length > 0;
  const isPromptValid = isPromptlessImageWorkflow || provider === SEEDANCE_FLASH_PROVIDER && activeWorkflow !== "text-to-video" || (
    isHeygenVoice ? !heygenVoiceError : isGeminiTts ? !geminiSpeech.error : isAvatarWorkflow
      ? prompt.trim().length > 0 && !avatarScriptTooLong
      : isMiniMaxMusic
        ? prompt.trim().length >= 10 && hasMiniMaxLyrics
        : prompt.trim().length > 0
  );
  const needsReferenceImage = activeWorkflow === "image-to-image" || activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video";
  const hasRequiredReference = activeWorkflow === "reference-to-video" || !needsReferenceImage || referenceImageUrls.length > 0;
  const gptRequestOptions = {imageSize,imageWidth:gptImageOptions.width,imageHeight:gptImageOptions.height,quality:imageQuality,outputFormat,numImages,imageUrls:referenceImageUrls,background:gptImageOptions.background,imageReasoningEffort:gptImageOptions.reasoningEffort,...(["jpeg","webp"].includes(outputFormat)?{outputCompression:gptImageOptions.outputCompression}:{}),...(outputFormat==="gif"?{frameCount:gptImageOptions.frameCount,frameDurationMs:gptImageOptions.frameDurationMs}:{}),...(outputFormat==="svg"?{svgModel:gptImageOptions.svgModel}:{}),...(activeWorkflow==="image-to-image"?{maskUrl:gptImageOptions.maskUrl,markupImageUrl:gptImageOptions.markupImageUrl}:{})};
  const gptValidationError = mode==="image"&&isGptImageProvider(provider)?gptImageOptionError({...gptRequestOptions,prompt}):mode==="image"&&provider===SEEDREAM_55_PROVIDER&&seedream55Error({...gptRequestOptions,mode,imageWorkflow,prompt,imageUrls:allReferenceImageUrls})?"studio.seedream.invalid":null;
  const seedanceValidationError = provider === SEEDANCE_FLASH_PROVIDER ? seedanceFlashValidationKey({mode,videoWorkflow,prompt,duration,ratio,resolution:videoResolution,imageUrls:videoWorkflow==="text-to-video"?undefined:allReferenceImageUrls,videoUrls:activeWorkflow==="reference-to-video"?parseReferenceMediaUrls(referenceVideoUrl):undefined,audioUrls:activeWorkflow==="reference-to-video"?parseReferenceMediaUrls(seedanceOptions.audioUrls):undefined,seedanceTask:seedanceOptions.task}) : null;
  let heygenValidationError = null;
  if (provider === "heygen-video" && mode === "video") {
    if (activeWorkflow === "reference-to-video") {
      const videos = parseReferenceMediaUrls(referenceVideoUrl);
      const audio = parseReferenceMediaUrls(heygenReferenceOptions.audioUrls);
      const prepared = prepareHeygenReferencePrompt(prompt.trim(), referenceImageUrls, videos, audio);
      heygenValidationError = heygenReferenceValidationKey(videos, allReferenceImageUrls, audio)
        || (prepared.missing ? "studio.mention.missing" : null)
        || (prepared.prompt.length > HEYGEN_REFERENCE_PROMPT_LIMIT ? "studio.heygen.reference.error.prompt" : null);
    }
    if (!heygenValidationError && seed.trim() && (!/^\d+$/.test(seed.trim()) || Number(seed.trim()) > 4294967295)) {
      heygenValidationError = "studio.heygen.reference.error.seed";
    }
  }
  const videoSpeechTooLong = mode === "video" && provider === "heygen-video" && videoDialogueTiming(prompt, duration)?.tooLong;
  const videoAspectRatioError = mode === "video" && provider === "heygen-video" && heygenAspectRatioError(videoWorkflow, videoResolution, ratio);
  const canSubmit = isTopazVideo ? Boolean(topazQuote) :
    isPromptValid && hasRequiredReference && !gptValidationError && !seedanceValidationError && !heygenValidationError && !verifiedAvatarAudio.loading && !verifiedAvatarAudio.error && !videoSpeechTooLong && !videoAspectRatioError;
  const videoPromptAI = useVideoPromptEnhancement({
    mode: videoWorkflow === "image-to-video" ? "image-to-video" : "text-to-video",
    prompt, model: provider, duration, aspectRatio: ratio,
    resolution: videoModelConfig(provider)?.showResolutionControl ? videoResolution : undefined,
    generateAudio: provider === "heygen-video" ? true : generateAudio,
    imageUrls: videoWorkflow === "image-to-video" ? referenceImageUrls : undefined
  }, setPrompt, Boolean(accessToken));
  const generationSubmitLock = useRef<symbol | null>(null);
  const generateDisabled = (accessToken ? !canSubmit || isSubmitting || h3FreeLoading : false) || (mode === "video" && videoPromptAI.busy);
  const activeTasks = useMemo(() => (tasks.filter((task) => task.status === "Queued" || task.status === "Running")), [tasks]);
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const hasCompletedCreation = completedTasks.length > 0;
  const selectedProjectId = sp.get("taskId");
  const selectedProjectSummary = selectedProjectId
    ? tasks.find((task) => task.id === selectedProjectId) || tasks[0] || null
    : tasks[0] || null;
  const selectedProjectDetails = useTaskDetails<{ id: string; request_settings?: Record<string, unknown> | null; output_url?: string | null; raw_result?: unknown }>(selectedProjectSummary?.id, accessToken, view === "projects");
  const selectedProjectTask = selectedProjectSummary ? {
    ...selectedProjectSummary,
    settings: selectedProjectDetails?.request_settings ?? selectedProjectSummary.settings,
    mediaUrl: selectedProjectSummary.mediaUrl || selectedProjectDetails?.output_url || pickMediaUrl(selectedProjectDetails?.raw_result),
    mediaUrls: pickImageOutputUrls(selectedProjectDetails?.raw_result).length?pickImageOutputUrls(selectedProjectDetails?.raw_result):selectedProjectSummary.mediaUrls
  } : null;
  const selectedProviderMeta = PROVIDER_META[provider] || {
    label: provider,
    shortLabel: provider,
    speed: "Standard",
    quality: "Balanced",
    bestFor: "General generation"
  };
  const selectedVideoModelConfig = videoModelConfig(provider);
  const configuredVideoWorkflow = videoWorkflow === "reference-to-video" ? "reference-to-video" : videoWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
  const videoRatioOptions = isAvatarProvider(provider) || isH3MaxAvatar || isHeygenAvatar
    ? ["source"]
    : videoModelRatios(provider, configuredVideoWorkflow, videoResolution);
  const videoDurationOptions = isAvatarProvider(provider)
    ? Array.from({ length: 13 }, (_, index) => `${index + 3}s`)
    : videoModelDurations(provider, videoWorkflow === "image-to-video" ? referenceImageUrls.length : 0);
  const videoResolutionOptions = videoModelResolutions(provider);

  const showVideoResolutionControl = (mode === "video" || isH3MaxAvatar || isHeygenAvatar) && Boolean(selectedVideoModelConfig?.showResolutionControl);
  const showVideoAudioControl = mode === "video" && !isAvatarProvider(provider) && Boolean(selectedVideoModelConfig?.showAudioControl);
  const showTextToImageTemplates = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && imageWorkflow === "text-to-image";
  const showImageToImageRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && imageWorkflow === "image-to-image";
  const showImageUtilityRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && (imageWorkflow === "enhance-cleanup" || imageWorkflow === "background-remove");
  const showVideoWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "video" && (isTopazVideo || videoWorkflow === "text-to-video" || videoWorkflow === "image-to-video" || videoWorkflow === "reference-to-video");
  const showAudioWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "audio" && (audioWorkflow === "text-to-audio" || audioWorkflow === "text-to-music");
  const showAvatarWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && isAvatarWorkflow;
  const showImageWorkbenchRedesign = showTextToImageTemplates || showImageToImageRedesign || showImageUtilityRedesign;
  const providerSettingsLabel =
    provider === SEEDREAM_55_PROVIDER ? `${imageSize.replace("auto_", "")} / ${outputFormat.toUpperCase()} / ${numImages}` : isGptImageProvider(provider)
      ? `${imageQuality} / ${outputFormat.toUpperCase()} / ${numImages}`
    : provider === "flux-image" || provider === "flux-dev"
        ? `${numInferenceSteps} / ${guidanceScale} / ${outputFormat.toUpperCase()}`
        : isNanoBananaLiteProvider(provider)
          ? `1K / ${safetyTolerance} / ${numImages}`
        : mode === "image"
          ? `${editResolution} / ${safetyTolerance} / ${numImages}`
          : isMiniMaxMusic
            ? `${isInstrumental ? "Instrumental" : lyricsOptimizer ? "Auto lyrics" : "Custom lyrics"} / ${musicSampleRate} Hz / ${musicFormat.toUpperCase()}`
          : isGeminiTts
            ? `${audioCharacterCount} / ${geminiTts.mode === "dialogue" ? st("studio.geminiTts.dialogue") : geminiTts.voice} / WAV`
          : isHeygenVoice
            ? `${audioCharacterCount} / ${heygenVoice.referenceAudioUrl.trim()?st("studio.heygenVoice.clonedVoice"):heygenVoice.voice} / WAV`
          : mode === "audio"
            ? `${prompt.trim().length || 0} / ${ttsVoice} / ${ttsStability.toFixed(2)}`
          : isAvatarWorkflow
            ? isH3MaxAvatar
                ? `${videoResolution} / ${avatarDuration}`
              : `${avatarDuration} / ${ttsVoice}`
            : `${videoResolution} / ${duration}${showVideoAudioControl ? generateAudio ? " / ON" : " / OFF" : ""}`;

  useEffect(() => {
    if (!isAvatarWorkflow || !avatarAudioUrl.startsWith("data:audio/") || avatarAudioTrimSeconds === null) return;
    if (avatarAudioTrimSeconds === avatarSelectedSeconds) return;
    setAvatarAudioUrl("");
    setAvatarAudioTrimSeconds(null);
    setStatusTone("idle");
    setStatusText(st("studio.status.avatarDurationChanged", { seconds: avatarSelectedSeconds }));
  }, [avatarAudioTrimSeconds, avatarAudioUrl, avatarSelectedSeconds, isAvatarWorkflow]);

  useEffect(() => {
    if (mode !== "video" && !isH3MaxAvatar) return;
    if (!videoRatioOptions.includes(ratio)) {
      setRatio(provider === "heygen-video" && heygenRequiresHdAspectRatio(configuredVideoWorkflow, videoResolution)
        ? preferredHeygenHdRatio(ratio)
        : videoRatioOptions.includes("auto") ? "auto" : videoRatioOptions[0] || "16:9");
    }
    if (!videoDurationOptions.includes(duration)) {
      setDuration(videoModelDefaultDuration(provider));
    }
    if (showVideoResolutionControl && !videoResolutionOptions.includes(videoResolution)) {
      setVideoResolution(defaultVideoResolutionForProvider(provider));
    }
  }, [configuredVideoWorkflow, duration, isH3MaxAvatar, mode, provider, ratio, showVideoResolutionControl, videoDurationOptions, videoRatioOptions, videoResolution, videoResolutionOptions]);

  useEffect(() => {
    if (!hasCompletedCreation || isH3VideoProvider(provider)) return;
    setPrompt((currentPrompt) => (isSamplePrompt(currentPrompt) ? "" : currentPrompt));
  }, [hasCompletedCreation, provider]);

  function applyWorkflow(nextWorkflow: StudioWorkflow) {
    const nextMode =
      nextWorkflow === "text-to-image" || nextWorkflow === "image-to-image" || nextWorkflow === "enhance-cleanup" || nextWorkflow === "background-remove"
        ? "image"
        : nextWorkflow === "text-to-audio" || nextWorkflow === "text-to-music"
          ? "audio"
          : nextWorkflow === "avatar-video"
            ? "avatar"
            : "video";
    const rememberedProvider = readRememberedModel(nextWorkflow);
    const nextProvider = providerForWorkflow(nextWorkflow, nextMode === "video" ? rememberedProvider : rememberedProvider || provider);
    if (nextMode === "image") {
      const nextImageWorkflow = nextWorkflow as ImageWorkflow;
      if (mode === "image" && imageWorkflow !== nextImageWorkflow) {
        setPrompt("");
      }
      setImageWorkflow(nextImageWorkflow);
      if (mode !== "image" || nextWorkflow === "text-to-image") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
      } else if (nextWorkflow === "background-remove") {
        setReferenceImageFiles((current) => current.slice(0, 1));
      }
      setImageQuality(current=>isGptImageProvider(nextProvider)?isGptImageProvider(provider)?gptImageQuality(current):"low":"high");
    } else if (nextMode === "video" || nextMode === "avatar") {
      setVideoWorkflow(nextWorkflow as VideoWorkflow);
      if (nextMode !== mode && (mode === "avatar" || nextMode === "avatar")) {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
        setAvatarAudioUrl("");
      } else if (nextWorkflow === "text-to-video") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
        setAvatarAudioUrl("");
      } else if (nextWorkflow === "avatar-video") {
        setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
        setReferenceImageFiles((current) => current.slice(0, 1));
      } else if (nextWorkflow === "image-to-video") {
        if (activeWorkflow === "reference-to-video" && referenceImageUrls.length) {
          setReferenceImagesText(""); setReferenceImageFiles(referenceImageUrls.slice(0, videoSupportsEndFrame(nextProvider) ? 2 : 1));
        }
        const shouldUseModelSample = isModelSampleReference(referenceImagesText) || (!referenceImagesText.trim() && referenceImageFiles.length === 0);
        if (shouldUseModelSample) {
          setReferenceImagesText(modelSampleReferenceForProvider(nextProvider));
          setReferenceImageFiles([]);
        }
      }
    } else {
      setAudioWorkflow(nextWorkflow as AudioWorkflow);
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      setAvatarAudioUrl("");
    }
    setProvider(nextProvider);
    if (isNanoBananaProvider(nextProvider) || nextProvider === "topaz-image" || nextProvider === "bria-background-remove") {
      setRatio(defaultImageRatioForProvider(nextProvider, defaultImageSizeForProvider(nextProvider)));
    }
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, nextWorkflow, st("studio.music.defaultPrompt"));
    const shouldApplyDefaultPrompt = !hasCompletedCreation || isH3VideoProvider(nextProvider);
    setPrompt((current) =>
      nextMode === mode
        ? promptForProviderChange(current, shouldApplyDefaultPrompt ? nextDefaultPrompt : "", st("studio.music.defaultPrompt"))
        : shouldApplyDefaultPrompt
          ? nextDefaultPrompt
          : ""
    );
    const nextImageSize = nextMode === "image" ? defaultImageSizeForProvider(nextProvider) : imageSize;
    if (nextMode === "image") {
      setImageSize(nextImageSize);
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      setRatio(nextWorkflow === "avatar-video" ? "source" : nextWorkflow === "reference-to-video" ? "adaptive" : "16:9");
      setDuration(videoModelDefaultDuration(nextProvider));
      setVideoResolution(defaultVideoResolutionForProvider(nextProvider));
    } else {
      setRatio("16:9");
      setDuration("single");
    }
    trackEvent("studio_workflow_selected", { mode: nextMode, workflow: nextWorkflow, provider: nextProvider }, accessToken);
    const params = new URLSearchParams(sp.toString());
    params.set("mode", nextMode);
    if (nextMode !== mode && (mode === "avatar" || nextMode === "avatar")) {
      params.delete("reference");
      params.delete("templateId");
      params.delete("audioUrl");
    }
    if (nextWorkflow !== "reference-to-video") params.delete("referenceVideo");
    if (nextWorkflow === "reference-to-video" || activeWorkflow === "reference-to-video") {
      params.delete("reference");
      params.delete("templateId");
      params.delete("templateCategory");
    }
    params.set("workflow", nextWorkflow);
    params.set("provider", nextProvider);
    if (nextMode === "image") {
      params.set("imageSize", nextImageSize);
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      params.delete("imageSize");
      params.set("ratio", nextWorkflow === "avatar-video" ? "source" : nextWorkflow === "reference-to-video" ? "adaptive" : "16:9");
      if (videoModelConfig(nextProvider)?.showResolutionControl) {
        params.set("resolution", defaultVideoResolutionForProvider(nextProvider));
      } else {
        params.delete("resolution");
      }
    } else {
      params.delete("imageSize");
      params.set("ratio", "16:9");
    }
    navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
  }

  function applyProvider(nextProvider: string, videoOverrides?: { duration?: string; ratio?: string; resolution?: string }) {
    if (mode === "video" && activeWorkflow === "image-to-video" && !videoSupportsEndFrame(nextProvider) && referenceImageUrls.length > 1) {
      setReferenceImagesText("");
      setReferenceImageFiles(referenceImageUrls.slice(0, 1));
      setStatusTone("idle");
      setStatusText(st("studio.videoWorkbench.endFrameRemoved"));
    }
    trackEvent("studio_model_selected", { mode, provider: nextProvider, workflow: activeWorkflow }, accessToken);
    safeSetLocalStorage(lastModelStorageKey(activeWorkflow), nextProvider);
    setProvider(nextProvider);
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, activeWorkflow, st("studio.music.defaultPrompt"));
    setPrompt((current) => promptForProviderChange(current, !hasCompletedCreation || isH3VideoProvider(nextProvider) ? nextDefaultPrompt : "", st("studio.music.defaultPrompt")));
    if (isAvatarProvider(nextProvider) || mode === "avatar") {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
      setReferenceImageFiles((current) => current.slice(0, 1));
      if (!isAvatarProvider(nextProvider)) setAvatarAudioUrl("");
    } else if (mode === "video" && activeWorkflow === "image-to-video") {
      const shouldUseModelSample = isModelSampleReference(referenceImagesText) || (!referenceImagesText.trim() && referenceImageFiles.length === 0);
      if (shouldUseModelSample) {
        setReferenceImagesText(modelSampleReferenceForProvider(nextProvider));
        setReferenceImageFiles([]);
      }
    }
    if (mode === "image") {
      if (referenceImageFiles.length) setReferenceImagesText(current => referenceTextWithoutExamples(current));
      if (nextProvider === "topaz-image") setImageWorkflow("enhance-cleanup");
      if (nextProvider === "bria-background-remove") setImageWorkflow("background-remove");
      if (nextProvider === "nano-banana-2-lite" && activeWorkflow === "image-to-image") setImageWorkflow("text-to-image");
      const nextImageSize = isGptImageProvider(nextProvider)&&isGptImageProvider(provider)?imageSize:defaultImageSizeForProvider(nextProvider);
      setImageSize(nextImageSize);
      setImageQuality(current=>isGptImageProvider(nextProvider)?isGptImageProvider(provider)?gptImageQuality(current):"low":"high");
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "image");
      params.set("workflow", nextProvider === "topaz-image" ? "enhance-cleanup" : nextProvider === "bria-background-remove" ? "background-remove" : nextProvider === "nano-banana-2-lite" && activeWorkflow === "image-to-image" ? "text-to-image" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("imageSize", nextImageSize);
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
      navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
    } else if (mode === "audio") {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      setDuration("single");
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "audio");
      params.set("workflow", audioWorkflow);
      params.set("provider", nextProvider);
      params.delete("imageSize");
      navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
    } else {
      const nextConfiguredWorkflow = activeWorkflow === "reference-to-video" ? "reference-to-video" : activeWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
      const nextResolutionOptions = videoModelResolutions(nextProvider);
      const nextResolution = videoOverrides?.resolution && nextResolutionOptions.includes(videoOverrides.resolution)
        ? videoOverrides.resolution
        : defaultVideoResolutionForProvider(nextProvider);
      const nextRatioOptions = videoModelRatios(nextProvider, nextConfiguredWorkflow, nextResolution);
      const requestedRatio = videoOverrides?.ratio || ratio;
      const nextRatio =
        isAvatarProvider(nextProvider) || (mode === "avatar" && isH3MaxProvider(nextProvider))
          ? "source"
        : nextRatioOptions.includes(requestedRatio)
          ? requestedRatio
          : nextProvider === "heygen-video" && heygenRequiresHdAspectRatio(nextConfiguredWorkflow, nextResolution)
            ? preferredHeygenHdRatio(requestedRatio)
          : nextRatioOptions.includes("auto")
            ? "auto"
            : nextRatioOptions[0] || "16:9";
      const nextDurationOptions = videoModelDurations(nextProvider);
      const requestedDuration = videoOverrides?.duration || duration;
      const nextDuration = nextDurationOptions.includes(requestedDuration)
        ? requestedDuration
        : videoModelDefaultDuration(nextProvider);
      if (mode !== "avatar") {
        setDuration(nextDuration);
      }
      setVideoResolution(nextResolution);
      if((nextProvider === "flux-3-max-video" || nextProvider === SEEDANCE_FLASH_PROVIDER) && provider !== nextProvider){setGenerateAudio(true);setReasoningLevel("high");}
      setRatio(nextRatio);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", mode === "avatar" ? "avatar" : "video");
      params.set("workflow", mode === "avatar" ? "avatar-video" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("ratio", nextRatio);
      if (mode !== "avatar") {
        params.set("duration", nextDuration);
      }
      if (videoModelConfig(nextProvider)?.showResolutionControl) {
        params.set("resolution", nextResolution);
      } else {
        params.delete("resolution");
      }
      navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
    }
  }

  function startAvatarImageGuide() {
    applyWorkflow("text-to-image");
    setPrompt("Professional front-facing presenter avatar portrait, clean background, natural expression, sharp facial details, studio lighting, realistic but friendly, centered composition for talking avatar video.");
  }

  async function handleReferenceFiles(files: FileList | null, frameIndex?: number) {
    if (!files?.length) return;
    const uploadScope = referenceUploadScopeRef.current;
    const readImage = async (file: File) => {
      if (cloudMediaEnabled && accessToken) {
        const url = await uploadStudioMedia(file, "image", accessToken);
        if (url) return url;
      }
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image file could not be read."));
        reader.readAsDataURL(file);
      });
    };
    if (mode === "video" && videoWorkflow === "reference-to-video") {
      const selected = Array.from(files);
      const imageLimit = provider === SEEDANCE_FLASH_PROVIDER ? SEEDANCE_FLASH_IMAGE_LIMIT : HEYGEN_REFERENCE_IMAGE_LIMIT;
      if (provider !== "heygen-video" && (selected.length + referenceImageUrls.length > imageLimit || selected.some(file => !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 30*1024*1024))) {
        setStatusTone("error"); setStatusText(st("studio.seedance.validation.media")); return;
      }
      const uploadIssue = provider === "heygen-video" ? heygenReferenceUploadIssue(selected, referenceImageUrls) : null;
      if (uploadIssue) {
        setStatusTone("error"); setStatusText(st(`studio.heygen.reference.error.${uploadIssue}`)); return;
      }
      const uploaded = await Promise.all(selected.map(readImage));
      if (uploadScope !== referenceUploadScopeRef.current) return;
      setReferenceImageFiles(current => [...current,...uploaded].slice(0,imageLimit));
      return;
    }
    if (mode === "video" && videoWorkflow === "image-to-video") {
      const limit = videoSupportsEndFrame(provider) ? 2 : 1;
      const selected = Array.from(files);
      if (selected.length > (frameIndex === undefined ? limit : 1) || selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > (provider === MISCHIEF_PROVIDER ? MISCHIEF_MAX_IMAGE_BYTES : 30 * 1024 * 1024))) {
        setStatusTone("error");
        setStatusText(provider === MISCHIEF_PROVIDER ? st("studio.model.mischief-video") : st("studio.videoWorkbench.uploadError", { count: frameIndex === undefined ? limit : 1 }));
        return;
      }
      if (frameIndex !== undefined && (frameIndex >= limit || (frameIndex === 1 && !referenceImageUrls[0]))) return;
      const uploaded = await Promise.all(selected.map(readImage));
      if (uploadScope !== referenceUploadScopeRef.current) return;
      const next = frameIndex === undefined ? uploaded : referenceImageUrls.slice(0, limit);
      if (frameIndex !== undefined) next[frameIndex] = uploaded[0];
      setReferenceImagesText("");
      setReferenceImageFiles(next);
      return;
    }
    const singleReferenceWorkflow = isPromptlessImageWorkflow || mode === "video" || mode === "avatar";
    const maxFiles = singleReferenceWorkflow ? 1 : provider === SEEDREAM_55_PROVIDER ? 10 : 4;
    if (provider === SEEDREAM_55_PROVIDER && (Array.from(files).length + referenceImageUrls.length > 10 || Array.from(files).some(file => !file.type.startsWith("image/") || file.size > 30 * 1024 * 1024))) { setStatusTone("error"); setStatusText(st("studio.seedream.invalid")); return; }
    const nextFiles = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, maxFiles)
        .map(readImage)
    );
    if (uploadScope !== referenceUploadScopeRef.current) return;
    if (mode === "video" || mode === "avatar") {
      setReferenceImagesText("");
    } else if (mode === "image" && nextFiles.length) {
      setReferenceImagesText(current => referenceTextWithoutExamples(current));
    }
    setReferenceImageFiles((prev) => (singleReferenceWorkflow ? nextFiles.slice(0, 1) : [...prev, ...nextFiles].slice(0, maxFiles)));
    if (mode === "image" && imageWorkflow === "text-to-image") {
      const nextWorkflow: StudioWorkflow = "image-to-image";
      const nextProvider = providerForWorkflow(nextWorkflow, readRememberedModel(nextWorkflow) || provider);
      const nextImageSize = defaultImageSizeForProvider(nextProvider);
      setImageWorkflow("image-to-image");
      setProvider(nextProvider);
      setImageSize(nextImageSize);
      setImageQuality(current=>isGptImageProvider(nextProvider)?isGptImageProvider(provider)?gptImageQuality(current):"low":"high");
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "image");
      params.set("workflow", nextWorkflow);
      params.set("provider", nextProvider);
      params.set("imageSize", nextImageSize);
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
      navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
    }
    if (mode === "avatar") {
      setVideoWorkflow("avatar-video");
    }
    if (mode === "video" && videoWorkflow !== "image-to-video") {
      const nextWorkflow: StudioWorkflow = "image-to-video";
      const nextProvider = WORKFLOW_META[nextWorkflow].recommendedProvider;
      const nextDurations = videoModelDurations(nextProvider);
      const nextDuration = nextDurations.includes(duration) ? duration : videoModelDefaultDuration(nextProvider);
      const nextRatios = videoModelRatios(nextProvider, nextWorkflow);
      const nextRatio = nextRatios.includes(ratio) ? ratio : nextRatios.includes("auto") ? "auto" : nextRatios[0] || "16:9";
      const nextResolution = defaultVideoResolutionForProvider(nextProvider);
      setVideoWorkflow("image-to-video");
      setProvider(nextProvider);
      const nextDefaultPrompt = defaultPromptForProvider(nextProvider, nextWorkflow, st("studio.music.defaultPrompt"));
      setPrompt((current) => promptForProviderChange(current, nextDefaultPrompt, st("studio.music.defaultPrompt")));
      setDuration(nextDuration);
      setRatio(nextRatio);
      setVideoResolution(nextResolution);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "video");
      params.set("workflow", nextWorkflow);
      params.set("provider", nextProvider);
      params.set("duration", nextDuration);
      params.set("ratio", nextRatio);
      if (videoModelConfig(nextProvider)?.showResolutionControl) params.set("resolution", nextResolution);
      else params.delete("resolution");
      navigateStudio(`/studio?${params.toString()}`, { replace: true, scroll: false });
    }
    trackEvent(
      "studio_reference_uploaded",
      { mode, provider, workflow: activeWorkflow, files: nextFiles.length, total_references: referenceImageUrls.length + nextFiles.length },
      accessToken
    );
  }

  async function handleCloudMediaFile(file: File, kind: StudioMediaKind, signal?: AbortSignal) {
    if (!accessToken) throw new Error("Sign in to upload media.");
    const url = await uploadStudioMedia(file, kind, accessToken, signal);
    if (!url) throw new Error("Media uploads are temporarily unavailable.");
    return url;
  }

  function clearCompletedWorkbench() {
    setPrompt("");
    setReferenceImagesText("");
    setReferenceImageFiles([]);
    setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));
  }

  function saveLoginDraft(autoSubmit: boolean) {
    return writeStudioLoginDraft({
      createdAt: new Date().toISOString(),
      autoSubmit,
      mode,
      provider,
      imageWorkflow,
      videoWorkflow,
      audioWorkflow,
      ratio,
      imageSize,
      referenceImagesText,
      referenceImageFiles,
      referenceVideoUrl,
      seedanceOptions,
      heygenReferenceOptions,
      avatarAudioUrl,
      editResolution,
      videoResolution,
      generateAudio,
      reasoningLevel,
      voice: ttsVoice,
      geminiTts,
      heygenVoice,
      heygenVoiceFreeRequested: autoSubmit && isHeygenVoice && isHeygenVoiceFree(pricingTime),
      stability: ttsStability,
      timestamps: ttsTimestamps,
      languageCode: ttsLanguageCode,
      textNormalization,
      voiceGender: audioVoiceGender,
      lyrics: musicLyrics,
      lyricsOptimizer,
      isInstrumental,
      musicSampleRate,
      musicBitrate,
      musicFormat,
      outputFormat,
      duration,
      prompt,
      imageQuality,
      gptImageOptions,
      numImages,
      guidanceScale,
      numInferenceSteps,
      enableSafetyChecker,
      acceleration,
      limitGenerations,
      seed,
      safetyTolerance,
      systemPrompt,
      enableWebSearch,
      thinkingLevel,
      aiPromptEnhancementEnabled: videoPromptAI.enabled,
      videoPromptEnhancement: mode === "video" ? videoPromptAI.current : null
    });
  }

  const saveLoginDraftRef = useRef(saveLoginDraft);
  saveLoginDraftRef.current = saveLoginDraft;
  const saveLoginDraftStable = useCallback((autoSubmit: boolean) => saveLoginDraftRef.current(autoSubmit), []);
  sessionActionMetaRef.current = {
    mode,
    provider,
    activeWorkflow,
    estCredits,
    selectedProviderLabel: selectedProviderMeta.label,
    st,
    onSignedOut: () => setTasks([]),
    saveLoginDraft: saveLoginDraftStable
  };
  useEffect(() => {
    const save = (event: Event) => { if (!saveLoginDraftRef.current(false)) event.preventDefault(); };
    window.addEventListener(AUTH_REDIRECT_EVENT, save);
    return () => window.removeEventListener(AUTH_REDIRECT_EVENT, save);
  }, []);

  useEffect(() => {
    if (!authReady || !accessToken || restoredLoginDraftRef.current) return;
    const draft = readStudioLoginDraft<ImageWorkflow, VideoWorkflow, AudioWorkflow>();
    if (!draft) return;

    restoredLoginDraftRef.current = true;
    // A retired model must never turn a saved automatic submission into a paid
    // request to a different model after authentication.
    heygenVoiceFreeIntentRef.current=draft.provider===HEYGEN_VOICE_PROVIDER&&draft.heygenVoiceFreeRequested===true;
    const expiredVoiceOffer=heygenVoiceFreeIntentRef.current&&!isHeygenVoiceFree();
    autoSubmitLoginDraftRef.current = draft.autoSubmit && draft.provider !== "mischief-video" && !expiredVoiceOffer;
    setProvider(draft.provider === "nano-banana-edit" ? "nano-banana-image" : normalizeGptImageProvider(draft.provider));
    setImageWorkflow(draft.imageWorkflow);
    setVideoWorkflow(draft.videoWorkflow || "text-to-video");
    setAudioWorkflow(draft.audioWorkflow || "text-to-audio");
    setRatio(draft.ratio);
    setImageSize(draft.imageSize);
    setReferenceImagesText(draft.mode === "avatar" ? stripAvatarDefaultReferences(draft.referenceImagesText) : draft.referenceImagesText);
    setReferenceImageFiles(Array.isArray(draft.referenceImageFiles) ? draft.referenceImageFiles : []);
    setReferenceVideoUrl(draft.referenceVideoUrl || "");
    setSeedanceOptions({ ...DEFAULT_SEEDANCE_FLASH_OPTIONS, ...draft.seedanceOptions });
    setHeygenReferenceOptions({ ...DEFAULT_HEYGEN_REFERENCE_OPTIONS, ...draft.heygenReferenceOptions });
    setAvatarAudioUrl(draft.avatarAudioUrl || "");
    setEditResolution(draft.editResolution);
    setVideoResolution(draft.videoResolution);
    setGenerateAudio(Boolean(draft.generateAudio));
    setReasoningLevel(draft.reasoningLevel === "low" ? "low" : "high");
    setTtsVoice(draft.voice || "Rachel");
    setGeminiTts(restoreGeminiTtsOptions(draft.geminiTts));
    setHeygenVoice(restoreHeygenVoiceOptions(draft.heygenVoice));
    setTtsStability(typeof draft.stability === "number" ? draft.stability : 0.5);
    setTtsTimestamps(Boolean(draft.timestamps));
    setTtsLanguageCode(draft.languageCode || "");
    setTextNormalization(draft.textNormalization || "auto");
    setAudioVoiceGender(draft.voiceGender || "all");
    setMusicLyrics(draft.lyrics || "");
    setLyricsOptimizer(Boolean(draft.lyricsOptimizer));
    setIsInstrumental(Boolean(draft.isInstrumental));
    setMusicSampleRate(draft.musicSampleRate || 44100);
    setMusicBitrate(draft.musicBitrate || 256000);
    setMusicFormat(draft.musicFormat || "mp3");
    setOutputFormat(draft.outputFormat);
    setImageQuality(isGptImageProvider(draft.provider) ? gptImageQuality(draft.imageQuality) : draft.imageQuality || "high");
    setGptImageOptions({...DEFAULT_GPT_IMAGE_OPTIONS,...draft.gptImageOptions});
    setNumImages(draft.numImages || 1);
    setGuidanceScale(draft.guidanceScale || 3.5);
    setNumInferenceSteps(draft.numInferenceSteps || 4);
    setEnableSafetyChecker(typeof draft.enableSafetyChecker === "boolean" ? draft.enableSafetyChecker : draft.provider === "heygen-video" && draft.videoWorkflow === "reference-to-video");
    setAcceleration(draft.acceleration || "none");
    setLimitGenerations(draft.limitGenerations !== false);
    setSeed(draft.seed || "");
    setSafetyTolerance(draft.safetyTolerance || "4");
    setSystemPrompt(draft.systemPrompt || "");
    setEnableWebSearch(Boolean(draft.enableWebSearch));
    setThinkingLevel(draft.thinkingLevel || "");
    setDuration(draft.duration);
    setPrompt(draft.mode === "avatar" ? promptForProviderChange(draft.prompt, "", st("studio.music.defaultPrompt")) : draft.prompt);
    videoPromptAI.setEnabled(draft.aiPromptEnhancementEnabled === true);
    videoPromptAI.restoreDraft(draft.videoPromptEnhancement || null);
    setStatusTone("idle");
    setStatusText(expiredVoiceOffer ? st("studio.heygenVoice.expired") : autoSubmitLoginDraftRef.current ? st("studio.status.restoredContinue") : st("studio.status.restored"));

    setLoginDraftNonce((value) => value + 1);
  }, [accessToken, authReady]);

  async function handleGenerate() {
    if (!canSubmit || isSubmitting || generationSubmitLock.current || (accessToken && h3FreeLoading) || (mode === "video" && videoPromptAI.busy)) {
      return;
    }
    if (accessToken && !hasEnoughCredits) {
      openInsufficientCreditsModal();
      return;
    }

    trackEvent(
      "generate_clicked",
      {
        mode,
        provider,
        workflow: activeWorkflow,
        estimated_credits: estCredits,
        signed_in: Boolean(accessToken),
        has_references: referenceImageUrls.length > 0
      },
      accessToken
    );
    const submissionToken = Symbol("generation");
    generationSubmitLock.current = submissionToken;
    setIsSubmitting(true);
    setStatusTone("idle");
    setStatusText(st("studio.status.submitting"));

    const taskType: TaskItem["type"] = mode === "image" ? "Image" : mode === "audio" ? "Audio" : "Video";
    let idempotencyStorageKey: string | null = null;
    try {
      if (isAvatarProvider(provider) && avatarAudioUrl.trim()) {
        if (avatarAudioUrl.startsWith("data:audio/")) {
          if (avatarAudioTrimSeconds !== avatarSelectedSeconds) {
            throw new Error(st("studio.status.audioReselect", { seconds: avatarSelectedSeconds }));
          }
        } else {
          if (verifiedAvatarAudio.loading || !verifiedAvatarAudio.audioUrl) throw new Error(st("studio.status.audioChecking"));
          if (verifiedAvatarAudio.error) throw new Error(verifiedAvatarAudio.error);
        }
      }
      const liveToken = await refreshLiveAccessToken();
      if (!liveToken) {
        trackEvent(
          "generate_login_required",
          { mode, provider, workflow: activeWorkflow },
          accessToken
        );
        openGenerationSignIn();
        return;
      }

      let finalPrompt = isTopazVideo ? st("studio.workflow.video-upscale") : prompt;
      let promptEnhancement;
      if (mode === "video" && (videoWorkflow === "text-to-video" || videoWorkflow === "image-to-video")) {
        if (videoPromptAI.enabled && !videoPromptAI.current) setStatusText(st("studio.promptAI.optimizing"));
        const optimized = await videoPromptAI.optimize(liveToken, true, videoPromptAI.context);
        finalPrompt = optimized.prompt;
        promptEnhancement = optimized.metadata;
      }
      const parsedSeed = seed.trim() ? Number.parseInt(seed.trim(), 10) : undefined;
      const requestDuration = isAvatarWorkflow ? avatarDuration : duration;
      const requestPayload = {
        mode,
        imageWorkflow,
        videoWorkflow: isAvatarWorkflow ? "avatar-video" : videoWorkflow,
        audioWorkflow: mode === "audio" ? audioWorkflow : undefined,
        provider,
        dailyFree: usesH3FreeAllowance,
        ratio: isAvatarWorkflow ? "source" : ratio,
        duration: requestDuration,
        prompt: isPromptlessImageWorkflow || (isGeminiTts && geminiTts.mode === "dialogue") ? "" : finalPrompt,
        geminiTts: isGeminiTts ? geminiTts : undefined,
        heygenVoice: isHeygenVoice ? heygenVoice : undefined,
        promptEnhancement,
        imageSize: mode === "image" ? imageSize : undefined,
        imageUrls:
          (mode === "image" && referenceImageUrls.length > 0) || (mode === "avatar" || (mode === "video" && (videoWorkflow === "image-to-video" || videoWorkflow === "reference-to-video")))
            ? referenceImageUrls
            : undefined,
        videoUrls: isTopazVideo && topazSource ? [topazSource.url] : mode === "video" && videoWorkflow === "reference-to-video" ? parseReferenceMediaUrls(referenceVideoUrl) : undefined,
        ...(isTopazVideo ? { topazVideoOptions: topazOptions, topazVideoSource: topazSource } : {}),
        ...(provider === "heygen-video" && mode === "video" && videoWorkflow === "reference-to-video" ? { audioUrls: parseReferenceMediaUrls(heygenReferenceOptions.audioUrls), heygenPromptEnhancement: heygenReferenceOptions.promptEnhancement } : {}),
        ...(provider === SEEDANCE_FLASH_PROVIDER ? { seedanceTask: seedanceOptions.task, bitrateMode: seedanceOptions.bitrateMode, codec: seedanceOptions.codec, ...(videoWorkflow === "reference-to-video" ? { audioUrls: parseReferenceMediaUrls(seedanceOptions.audioUrls) } : {}) } : {}),
        audioUrl: isAvatarProvider(provider) && avatarAudioUrl.trim() ? verifiedAvatarAudio.audioUrl : undefined,
        resolution:
          mode === "image"
            ? editResolution
            : (mode === "video" || isH3MaxAvatar || isHeygenAvatar) && (provider === SEEDANCE_FLASH_PROVIDER || provider === "heygen-video" || provider === "flux-3-max-video" || provider === MISCHIEF_PROVIDER || isH3VideoProvider(provider) || provider === "grok-video" || provider === "gemini-omni-flash-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video")
              ? videoResolution
              : undefined,
        generateAudio: provider === MISCHIEF_PROVIDER ? false : mode === "video" || isHeygenAvatar ? provider === "heygen-video" || provider === "gemini-omni-flash-video" || generateAudio : undefined,
        reasoningLevel: provider === "flux-3-max-video" ? reasoningLevel : undefined,
        expectedCredits: estCredits,
        outputFormat: mode === "image" && provider !== "bria-background-remove" ? outputFormat : undefined,
        quality: mode === "image" && !isPromptlessImageWorkflow ? imageQuality : undefined,
        ...(mode==="image"&&isGptImageProvider(provider)?{...gptRequestOptions,enableSafetyChecker:gptImageOptions.enableSafetyChecker}:{}),
        ...(mode === "image" && provider === SEEDREAM_55_PROVIDER ? {imageWidth:gptImageOptions.width,imageHeight:gptImageOptions.height,background:gptImageOptions.background} : {}),
        numImages: mode === "image" && !isPromptlessImageWorkflow ? numImages : undefined,
        guidanceScale: mode === "image" && !isPromptlessImageWorkflow ? guidanceScale : undefined,
        numInferenceSteps: mode === "image" && !isPromptlessImageWorkflow ? numInferenceSteps : undefined,
        enableSafetyChecker: mode==="image"&&isGptImageProvider(provider)?gptImageOptions.enableSafetyChecker:(mode === "image" && !isPromptlessImageWorkflow) || ((mode === "video" || isHeygenAvatar) && (provider === "heygen-video" || provider === "happy-horse-video" || provider === "grok-video")) ? enableSafetyChecker : undefined,
        acceleration: mode === "image" && !isPromptlessImageWorkflow ? acceleration : undefined,
        limitGenerations: mode === "image" && !isPromptlessImageWorkflow ? limitGenerations : undefined,
        seed: Number.isSafeInteger(parsedSeed) && (mode === "image" || provider === SEEDANCE_FLASH_PROVIDER && videoWorkflow === "reference-to-video" || provider === "heygen-video" || provider === "flux-3-max-video" || provider === MISCHIEF_PROVIDER || isH3VideoProvider(provider) || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video") ? parsedSeed : undefined,
        safetyTolerance: mode === "image" && !isPromptlessImageWorkflow ? safetyTolerance : undefined,
        systemPrompt: mode === "image" && !isPromptlessImageWorkflow && systemPrompt.trim() ? systemPrompt.trim() : undefined,
        enableWebSearch: mode === "image" && !isPromptlessImageWorkflow ? enableWebSearch : undefined,
        thinkingLevel: mode === "image" && !isPromptlessImageWorkflow && thinkingLevel ? thinkingLevel : undefined,
        voice: isElevenLabsAudio || isAvatarProvider(provider) ? ttsVoice : undefined,
        stability: isElevenLabsAudio || isAvatarProvider(provider) ? ttsStability : undefined,
        timestamps: isElevenLabsAudio ? ttsTimestamps : undefined,
        languageCode: (isElevenLabsAudio || isAvatarProvider(provider)) && ttsLanguageCode ? ttsLanguageCode : undefined,
        textNormalization: isElevenLabsAudio || isAvatarProvider(provider) ? textNormalization : undefined,
        lyrics: isMiniMaxMusic ? musicLyrics : undefined,
        lyricsOptimizer: isMiniMaxMusic ? lyricsOptimizer : undefined,
        isInstrumental: isMiniMaxMusic ? isInstrumental : undefined,
        musicSampleRate: isMiniMaxMusic ? musicSampleRate : undefined,
        musicBitrate: isMiniMaxMusic ? musicBitrate : undefined,
        musicFormat: isMiniMaxMusic ? musicFormat : undefined
      };
      const fingerprint = createIdempotencyFingerprint({
        ...requestPayload,
        prompt: isGeminiTts ? geminiSpeech.transcript : finalPrompt.trim(),
        imageUrls: referenceImageUrls,
        audioUrl: avatarAudioUrl.trim()
      });
      const idempotency = getPersistentIdempotency(userId, fingerprint);
      idempotencyStorageKey = idempotency.storageKey;

      const preparedPayload = cloudMediaEnabled ? {
        ...requestPayload,
        imageUrls: requestPayload.imageUrls && await Promise.all(requestPayload.imageUrls.map(url => uploadStudioDataUrl(url, "image", liveToken))),
        audioUrl: requestPayload.audioUrl && await uploadStudioDataUrl(requestPayload.audioUrl, "audio", liveToken),
        maskUrl: requestPayload.maskUrl && await uploadStudioDataUrl(requestPayload.maskUrl, "image", liveToken),
        markupImageUrl: requestPayload.markupImageUrl && await uploadStudioDataUrl(requestPayload.markupImageUrl, "image", liveToken)
      } : requestPayload;
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`
        },
        body: JSON.stringify({
          ...preparedPayload,
          idempotencyKey: idempotency.idempotencyKey
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string; code?: string; pricingTime?:number; refundedCredits?:number; balance?:number | null } | null;
        if(errorPayload?.code?.startsWith("studio.gpt26.")) throw new Error(st(errorPayload.code));
        // A generic 5xx may follow an accepted/charged task. Keep its key until
        // the server confirms rejection, so retry cannot create a second job.
        if (response.status < 500 || errorPayload?.code === "provider_not_submitted" || typeof errorPayload?.refundedCredits === "number") {
          clearPersistentIdempotency(idempotencyStorageKey);
          idempotencyStorageKey = null;
        }
        if (errorPayload?.code === "provider_not_submitted") {
          if (typeof errorPayload.balance === "number") {
            setCreditBalance(errorPayload.balance);
            cacheCreditBalance(errorPayload.balance);
          }
          throw new Error(errorPayload.error || st("studio.status.submitFailed"));
        }
        if(errorPayload?.code === "video_price_changed" || errorPayload?.code === "generation_price_changed") {
          setPricingTime(errorPayload.pricingTime || Date.now());
          throw new Error(localizeStudioError(errorPayload.error || "The price has changed. Review the updated credits and try again.", response.status));
        }
        if (errorPayload?.code === "daily_free_unavailable") {
          h3DailyFree.invalidate();
          throw new Error(st("studio.h3Free.unavailable"));
        }
        throw new Error(localizeStudioError(errorPayload?.error || st("studio.status.requestFailed"), response.status));
      }

      const payload = (await response.json()) as {
        taskId: string;
        status: "queued" | "running" | "completed" | "failed";
        transport: "real" | "mock";
        statusUrl?: string | null;
        responseUrl?: string | null;
        storageWarning?: string;
        provider?: string;
        mode?: "image" | "video" | "audio";
        estimatedCredits?: number;
        balance?: number;
        duplicate?: boolean;
        failureReason?: string | null;
        billingSource?: "credits" | "daily_free";
        freeUnitsUsed?: number;
        dailyUnitsRemaining?: number | null;
      };
      clearPersistentIdempotency(idempotencyStorageKey);
      idempotencyStorageKey = null;
      clearStudioLoginDraft();
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        cacheCreditBalance(payload.balance);
      }

      if (usesH3FreeAllowance) {
        h3DailyFree.invalidate();
      }

      const queuedTask: TaskItem = {
        id: payload.taskId,
        type: taskType,
        status:
          payload.status === "running"
            ? "Running"
            : payload.status === "completed"
              ? "Completed"
              : payload.status === "failed"
                ? "Failed"
                : "Queued",
        cost: typeof payload.estimatedCredits === "number" ? payload.estimatedCredits : estCredits,
        provider,
        prompt: isGeminiTts ? geminiSpeech.transcript : finalPrompt.trim(),
        ratio,
        transport: payload.transport,
        createdAt: new Date().toISOString(),
        statusUrl: payload.statusUrl || null,
        responseUrl: payload.responseUrl || null,
        settings: requestPayload,
        failureReason: payload.failureReason || null
      };
      setTasks((prev) => [queuedTask, ...prev.filter((task) => task.id !== queuedTask.id)]);
      navigateStudio(studioProjectHref(payload.taskId));
      trackEvent(
        "generation_queued",
        {
          mode,
          provider,
          workflow: requestPayload.imageWorkflow,
          task_id: payload.taskId,
          transport: payload.transport,
          estimated_credits: estCredits,
          duplicate: Boolean(payload.duplicate)
        },
        liveToken
      );
      if (payload.duplicate) {
        setStatusText(st("studio.status.reusedTask"));
      }
      if (payload.storageWarning) {
        setTaskHistoryNote(st("studio.projects.historySavePending"));
      }
      // The task is accepted by the backend now. Release the button so users can queue
      // another generation while this task continues updating in the background.
      if (generationSubmitLock.current === submissionToken) generationSubmitLock.current = null;
      setIsSubmitting(false);
      if (payload.status === "failed") {
        trackEvent(
          "generation_failed",
          { mode, provider, task_id: payload.taskId, failure_reason: payload.failureReason || "existing_failed" },
          liveToken
        );
        setStatusTone("error");
        setStatusText(payload.failureReason || st("studio.status.existingFailed"));
        return;
      }
      if (payload.transport === "mock") {
        const updateMockStatus = async (mockStatus: "completed" | "failed") => {
          const response = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&mockStatus=${mockStatus}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );
          const statusPayload = (await response.json().catch(() => null)) as { balance?: number | null } | null;
          if (typeof statusPayload?.balance === "number") {
            setCreditBalance(statusPayload.balance);
            cacheCreditBalance(statusPayload.balance);
          }
        };

        await new Promise((resolve) => setTimeout(resolve, 900));
        setTasks((prev) =>
          prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
        );
        setStatusText(st("studio.status.mockQueued"));

        await new Promise((resolve) => setTimeout(resolve, 1200));
        const shouldFail = prompt.toLowerCase().includes("fail");
        if (shouldFail) {
          await updateMockStatus("failed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: 0 } : task))
          );
          setStatusTone("error");
          setStatusText(st("studio.status.mockFailed"));
          trackEvent("generation_failed", { mode, provider, task_id: payload.taskId, transport: "mock" }, liveToken);
        } else {
          await updateMockStatus("completed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          clearCompletedWorkbench();
          setStatusTone("ok");
          setStatusText(st("studio.status.mockCompleted"));
          trackEvent("generation_completed", { mode, provider, task_id: payload.taskId, transport: "mock" }, liveToken);
        }
      } else {
        setStatusText(st("studio.status.falQueued"));
        let finalStatus: "COMPLETED" | "FAILED" | "CANCELED" | "ERROR" | null = null;
        let finalFailureReason: string | null = null;
        let finalActualCredits: number | null = null;
        const maxPollAttempts = frontendPollAttempts(modeForPricing(mode), provider);

        for (let i = 0; i < maxPollAttempts; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1800));
          const statusRes = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&statusUrl=${encodeURIComponent(
              payload.statusUrl || ""
            )}&responseUrl=${encodeURIComponent(payload.responseUrl || "")}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );

          if (!statusRes.ok) {
            continue;
          }

          const statusPayload = (await statusRes.json()) as {
            status?: string;
            result?: unknown;
            balance?: number | null;
            failureReason?: string;
            refundLedgerId?: number | string | null;
            refundedCredits?: number;
            actualCredits?: number;
          };
          if (typeof statusPayload.balance === "number") {
            setCreditBalance(statusPayload.balance);
            cacheCreditBalance(statusPayload.balance);
          }
          const rawStatus = (statusPayload.status || "").toUpperCase();
          if (rawStatus === "IN_QUEUE") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Queued" } : task))
            );
            setStatusText(st("studio.status.falQueue"));
          } else if (rawStatus === "IN_PROGRESS") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
            );
            setStatusText(st("studio.status.falRunning"));
          } else if (["COMPLETED", "FAILED", "CANCELED", "ERROR"].includes(rawStatus)) {
            if (rawStatus === "COMPLETED") {
              const mediaUrl = pickMediaUrl(statusPayload.result);
              setTasks((prev) =>
                prev.map((task) => (task.id === payload.taskId ? { ...task, mediaUrl, mediaUrls:pickImageOutputUrls(statusPayload.result) } : task))
              );
            }
            finalStatus = rawStatus as "COMPLETED" | "FAILED" | "CANCELED" | "ERROR";
            finalFailureReason = statusPayload.failureReason || null;
            finalActualCredits = typeof statusPayload.actualCredits === "number" ? statusPayload.actualCredits : null;
            break;
          }
        }

        if (finalStatus === "COMPLETED") {
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          clearCompletedWorkbench();
          setStatusTone("ok");
          setStatusText(st("studio.status.falCompleted"));
          trackEvent("generation_completed", { mode, provider, task_id: payload.taskId, transport: "real" }, liveToken);
        } else {
          if (finalStatus) {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: finalActualCredits ?? 0, failureReason: finalFailureReason } : task))
            );
            setStatusTone("error");
            setStatusText(
              finalFailureReason
                ? localizeStudioError(finalFailureReason)
                : st("studio.status.falFailedRefund")
            );
            trackEvent("generation_failed", { mode, provider, task_id: payload.taskId, transport: "real", final_status: finalStatus, failure_reason: finalFailureReason }, liveToken);
          } else {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
            );
            setStatusTone("idle");
            setStatusText(
              st("studio.status.backgroundRunning")
            );
          }
        }
      }
    } catch (error) {
      trackEvent(
        "generation_failed",
        { mode, provider, error: error instanceof Error ? error.message.slice(0, 180) : "submit_failed", estimated_credits: estCredits },
        accessToken
      );
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? `${localizeStudioError(error.message)}${idempotencyStorageKey ? st("studio.status.retryReuse") : ""}`
          : st("studio.status.submitFailed")
      );
    } finally {
      if (generationSubmitLock.current === submissionToken) {
        if (usesH3FreeAllowance) void h3DailyFree.refresh();
        generationSubmitLock.current = null;
        setIsSubmitting(false);
      }
    }
  }

  function openGenerationSignIn() {
    const freeVoiceRequested=isHeygenVoice&&isHeygenVoiceFree(pricingTime);
    heygenVoiceFreeIntentRef.current=freeVoiceRequested;
    requestSignIn({
      onBeforeRedirect: () => saveLoginDraft(true),
      onSuccess: () => {
        const expired=freeVoiceRequested&&!isHeygenVoiceFree();
        autoSubmitLoginDraftRef.current = !expired;
        if(expired){setPricingTime(Date.now());setStatusText(st("studio.heygenVoice.expired"));}
        setLoginDraftNonce(value => value + 1);
      }
    });
  }

  function handleGenerateClick() {
    if (!accessToken) {
      trackEvent("generate_login_required", { mode, provider, workflow: activeWorkflow }, accessToken);
      openGenerationSignIn();
      return;
    }
    heygenVoiceFreeIntentRef.current=false;
    handleGenerate();
  }

  useEffect(() => {
    if (!authReady || !accessToken || !autoSubmitLoginDraftRef.current || isSubmitting || !isPromptValid || h3FreeLoading) return;
    const timer = window.setTimeout(() => {
      autoSubmitLoginDraftRef.current = false;
      if(heygenVoiceFreeIntentRef.current&&(provider!==HEYGEN_VOICE_PROVIDER||!isHeygenVoiceFree())) {
        setPricingTime(Date.now());setStatusText(st("studio.heygenVoice.expired"));return;
      }
      handleGenerate();
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authReady, isPromptValid, isSubmitting, loginDraftNonce, h3FreeLoading]);

  function improveTextToImagePrompt() {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${PROMPT_IMPROVE_TEXT}` : PROMPT_IMPROVE_TEXT;
    });
    trackEvent("studio_prompt_improved", { mode, provider, workflow: activeWorkflow }, accessToken);
  }

  return { acceleration,
    accessToken,
    activeTasks,
    activeWorkflow,
    applyProvider,
    applyWorkflow,
    audioVoiceGender,
    audioVoiceOptions,
    audioWorkflow,
    authReady,
    avatarAudioUrl,
    avatarDuration,
    avatarScriptMeta,
    avatarScriptTooLong,
    avatarVoiceGender,
    avatarVoiceOptions,
    billingGenerationContext,
    billingHref,
    billingMessage,
    billingModalOpen,
    billingModalScrollRef,
    canSubmit,
    configuredVideoWorkflow,
    creditBalance,
    creditNote,
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
    seedanceValidationError,
    guidanceScale,
    h3FreeLabel,
    handleGenerateClick,
    handleReferenceFiles,
    handleCloudMediaFile: cloudMediaEnabled && accessToken ? handleCloudMediaFile : undefined,
    cloudMediaEnabled,
    isTopazVideo,
    topazOptions,
    setTopazOptions,
    topazSource,
    setTopazSource,
    topazQuote,
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
    isReferralsView,
    isSubmitting,
    limitGenerations,
    loadingBillingItem,
    lyricsOptimizer,
    mobileStudioMenuOpen,
    mode,
    modelPickerOptions,
    musicAdvancedOpen,
    musicBitrate,
    musicFormat,
    musicLyrics,
    musicSampleRate,
    numImages,
    numInferenceSteps,
    openBillingModal,
    outputFormat,
    previewModal,
    prompt,
    provider,
    providerSettingsLabel,
    ratio,
    reasoningLevel,
    referenceImageUrls,
    referenceImagesText,
    referenceVideoUrl,
    referralsVisible,
    heygenReferenceOptions,
    setHeygenReferenceOptions,
    heygenValidationError,
    safetyTolerance,
    saveLoginDraft: saveLoginDraftStable,
    seed,
    selectedProjectTask,
    selectedProviderMeta,
    setAcceleration,
    setAudioVoiceGender,
    setAvatarAudioUrl,
    setAvatarVoiceGender,
    setBillingGenerationContext,
    setBillingModalOpen,
    setCreditBalance,
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
    setMobileStudioMenuOpen,
    setMusicAdvancedOpen,
    setMusicBitrate,
    setMusicFormat,
    setMusicLyrics,
    setMusicSampleRate,
    setNumImages,
    setNumInferenceSteps,
    setOutputFormat,
    setPreviewModal,
    setPrompt,
    setRatio,
    setReasoningLevel,
    setReferenceImageFiles,
    setReferenceImagesText,
    setReferenceVideoUrl,
    seedanceOptions,
    setSeedanceOptions,
    setSafetyTolerance,
    setSeed,
    setStatusText,
    setStatusTone,
    setSystemPrompt,
    setTextNormalization,
    setThinkingLevel,
    setTtsLanguageCode,
    setTtsStability,
    setTtsTimestamps,
    setTtsVoice,
    setVideoResolution,
    setVideoSidebarCollapsed,
    setVideoWorkflow,
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
    startHomeCreation,
    startStudioCreditCheckout,
    statusText,
    statusTone,
    studioI18n,
    systemPrompt,
    taskHistoryNote,
    tasks,
    textNormalization,
    thinkingLevel,
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
    videoSidebarCollapsed,
    videoWorkflow } as const;
}
export type StudioController = ReturnType<typeof useStudioController>;
