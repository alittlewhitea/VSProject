"use client";
import { useRouter,useSearchParams } from "next/navigation";
import { useEffect,useMemo,useRef,useState } from "react";
import { type Locale } from "../../i18n/routing";
import { trackEvent } from "../../lib/analytics";
import { AUTH_REDIRECT_EVENT,requestSignIn } from "../../lib/auth-navigation";
import {
CREDIT_PACKS
} from "../../lib/billing";
import { FLUX3_MAX_PROMO_END,isFlux3MaxPromotion } from "../../lib/flux3-max";
import { GEMINI_TTS_PROVIDER,geminiTtsBillableText,geminiTtsCharacters,newGeminiTtsOptions,prepareGeminiTts,restoreGeminiTtsOptions } from "../../lib/gemini-tts";
import { DEFAULT_GPT_IMAGE_OPTIONS,GPT_IMAGE_SIZES,gptImageOptionError,gptImageQuality,isGptImageProvider,normalizeGptImageProvider,type GptImageOptions,type GptImageQuality } from "../../lib/gpt-image-models";
import { isH3DailyFreeRequest } from "../../lib/h3-daily-free-policy";
import { heygenAvatarTiming } from "../../lib/heygen-avatar";
import { HEYGEN_REFERENCE_IMAGE_LIMIT,isPublicReferenceUrl } from "../../lib/heygen-reference-video";
import { MISCHIEF_MAX_IMAGE_BYTES,MISCHIEF_PROVIDER } from "../../lib/mischief";
import { CREDIT_LOW_BALANCE_THRESHOLD,estimateGenerationCredits } from "../../lib/model-pricing";
import { useStudioI18n } from "../../lib/studio-i18n";
import { navigateStudio } from "../../lib/studio-navigation";
import { parseStudioReferenceImages,referenceTextWithoutExamples,shouldApplyUrlInput,type AppliedUrlInput } from "../../lib/studio-workspace-inputs";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { videoSupportsEndFrame } from "../../lib/video-keyframes";
import {
formatSeconds,
trimAudioFileToDataUrl
} from "./studio-audio-utils";
import { type GenerationBillingContext } from "./studio-billing-modal";
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
import { useFloatingPanel } from "./use-floating-panel";
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

export function useStudioController({ initialLocale, initialMessages, initialView }: { initialLocale: Locale; initialMessages?: Record<string,string>; initialView?: "billing" }) {

  const studioI18n = useStudioI18n(initialLocale,initialMessages);
  const st = studioI18n.t;
  const localizeStudioError = (message: string, status?: number) => {
    const normalized = message.toLowerCase();
    if (normalized.includes("no recognizable elements") || normalized.includes("clearly visible subject") || normalized.includes("clearly visible subject in the reference image")) {
      return st("studio.error.referenceSubjectNotVisible");
    }
    if (status === 401 || normalized.includes("unauthorized") || normalized.includes("access token")) {
      return st("studio.error.sessionExpired");
    }
    if (normalized.includes("not enough credits") || normalized.includes("insufficient_credits")) {
      return st("studio.error.notEnoughCredits");
    }
    if (status === 413 || normalized.includes("file is too large") || normalized.includes("uploaded file is too large")) {
      return st("studio.error.uploadTooLarge");
    }
    if (normalized.includes("cannot trim audio") || normalized.includes("audio file could not be trimmed")) {
      return st("studio.status.audioTrimFailed");
    }
    if (normalized.includes("pixel budget")) return st("studio.gpt26.gifHint");
    if (
      status === 422 ||
      normalized.includes("nsfw") ||
      normalized.includes("safety policy") ||
      normalized.includes("content policy") ||
      normalized.includes("moderation")
    ) {
      return st("studio.error.contentRejected");
    }
    if (status && status >= 500) {
      return st("studio.error.providerUnavailable");
    }
    return message;
  };
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
    initialWorkflow === "avatar-video" || initialWorkflow === "image-to-video" || initialWorkflow === "reference-to-video" ? initialWorkflow : "text-to-video";
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
  const [imageSize, setImageSize] = useState("default_4_3");
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
  const lastAppliedVideoUrlRef = useRef<AppliedUrlInput | null>(null);
  const previousReferenceWorkflow = useRef(initialWorkflow === "reference-to-video");
  const homeReferenceRef = useRef<{ mode: "image" | "video"; image: string } | null>(null);
  const lastAppliedPromptUrlRef = useRef<AppliedUrlInput | null>(null);
  const lastAppliedReferenceUrlRef = useRef<AppliedUrlInput | null>(null);
  // Image workspaces start empty; switching models only sets the supported quality default.
  useEffect(() => {
    if(mode !== "image") return;
    if(isGptImageProvider(provider)) setImageQuality(current=>gptImageQuality(current));
  },[mode,provider,imageWorkflow]);

  const [avatarAudioUrl, setAvatarAudioUrl] = useState(sp.get("audioUrl") || "");
  const [avatarAudioTrimSeconds, setAvatarAudioTrimSeconds] = useState<number | null>(null);
  const [editResolution, setEditResolution] = useState("1K");
  const [videoResolution, setVideoResolution] = useState(() => defaultVideoResolutionForProvider(initialProvider));
  const [generateAudio, setGenerateAudio] = useState(initialProvider === "flux-3-max-video");
  const [reasoningLevel, setReasoningLevel] = useState<"low"|"high">("high");
  const [pricingTime, setPricingTime] = useState(()=>Date.now());
  useEffect(()=>{
    if(mode !== "video") return;
    const refresh=()=>setPricingTime(Date.now());
    const interval=window.setInterval(refresh,60000);
    const remaining=FLUX3_MAX_PROMO_END-Date.now();
    const timeout=remaining>0&&remaining<2147483647?window.setTimeout(refresh,remaining+20):null;
    window.addEventListener("focus",refresh);
    return ()=>{window.clearInterval(interval);if(timeout!==null)window.clearTimeout(timeout);window.removeEventListener("focus",refresh);};
  },[mode]);
  const [ttsVoice, setTtsVoice] = useState("Rachel");
  const [geminiTts, setGeminiTts] = useState(newGeminiTtsOptions);
  const [avatarVoiceGender, setAvatarVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [audioVoiceGender, setAudioVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [ttsStability, setTtsStability] = useState(0.5);
  const [ttsTimestamps, setTtsTimestamps] = useState(false);
  const [ttsLanguageCode, setTtsLanguageCode] = useState("");
  const [textNormalization, setTextNormalization] = useState("auto");
  const [musicLyrics, setMusicLyrics] = useState("[Verse]\nStreetlights flicker, the night breeze sighs\nShadows stretch as I walk alone\n\n[Chorus]\nWandering, longing, where should I go");
  const [lyricsOptimizer, setLyricsOptimizer] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [musicSampleRate, setMusicSampleRate] = useState(44100);
  const [musicBitrate, setMusicBitrate] = useState(256000);
  const [musicFormat, setMusicFormat] = useState<"mp3" | "wav" | "pcm">("mp3");
  const [musicAdvancedOpen, setMusicAdvancedOpen] = useState(false);
  const [outputFormat, setOutputFormat] = useState("png");
  const [imageQuality, setImageQuality] = useState<GptImageQuality>("low");
  const [gptImageOptions, setGptImageOptions] = useState<GptImageOptions>({...DEFAULT_GPT_IMAGE_OPTIONS});
  const [numImages, setNumImages] = useState(1);
  useEffect(()=>{
    if(mode!=="image")return;
    if(!isGptImageProvider(provider)) {
      if(!["png","jpeg","webp"].includes(outputFormat))setOutputFormat("png");
      if(numImages>4)setNumImages(4);
    } else {
      if(imageWorkflow==="image-to-image"&&outputFormat==="svg")setOutputFormat("png");
      if(outputFormat==="svg"&&numImages!==1)setNumImages(1);
    }
  },[mode,provider,imageWorkflow,outputFormat,numImages]);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(4);
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(false);
  useEffect(() => {
    if (provider === "heygen-video") setEnableSafetyChecker(false);
  }, [provider]);
  const [acceleration, setAcceleration] = useState("none");
  const [limitGenerations, setLimitGenerations] = useState(true);
  const [seed, setSeed] = useState("");
  const [safetyTolerance, setSafetyTolerance] = useState("4");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState("");
  const [duration, setDuration] = useState(
    mode === "video" || mode === "avatar"
      ? videoModelDefaultDuration(initialProvider)
      : "single"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "idle">("idle");

  const [previewModal, setPreviewModal] = useState<{ url: string; type: "Image" | "Video" } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [referralsVisible,setReferralsVisible] = useState(false);
  useEffect(()=>{
    let active=true;
    setReferralsVisible(false);
    const refresh = async () => {
      try {
        if(accessToken) await fetch("/api/referrals",{method:"POST",headers:{Authorization:`Bearer ${accessToken}`}});
        const response=await fetch(accessToken?"/api/referrals":"/api/referrals/availability",{headers:accessToken?{Authorization:`Bearer ${accessToken}`}:{}});
        const data=await response.json();
        if(active) setReferralsVisible(response.ok && (accessToken?data.enabled===true:data.visible===true));
      } catch {if(active)setReferralsVisible(false);}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),5*60*1000);
    return ()=>{active=false;clearInterval(timer);};
  },[accessToken]);
  const [userId, setUserId] = useState<string | null>(null);
  const {tasks,setTasks,taskHistoryNote,setTaskHistoryNote}=useStudioTaskHistory(accessToken,userId,st);
  const h3DailyFree = useH3DailyFree(accessToken, userId);
  function startHomeCreation(input: HomeCreationInput) {
    const hasImage = input.mode !== "audio" && Boolean(input.image);
    const workflow = input.mode === "video" ? hasImage ? "image-to-video" : "text-to-video" : input.mode === "image" ? hasImage ? "image-to-image" : "text-to-image" : "text-to-audio";
    homeReferenceRef.current = hasImage ? { mode: input.mode as "image" | "video", image: input.image! } : null;
    const params = new URLSearchParams({ mode: input.mode, workflow });
    if (input.prompt) params.set("prompt", input.prompt);
    if (input.mode === "audio") { setReferenceImagesText(""); setReferenceImageFiles([]); }
    navigateStudio(`/studio?${params.toString()}`);
  }

  useEffect(() => {
    if (!accessToken || !userId) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/credits", { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && typeof data.balance === "number") {
          setCreditBalance(data.balance);
          const key = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
          if (key) safeSetLocalStorage(key, String(data.balance));
        }
      } catch { /* A confirmed payment can still be viewed on Billing if refresh fails. */ }
    };
    window.addEventListener("dreamface:credits-updated", refresh);
    return () => { controller.abort(); window.removeEventListener("dreamface:credits-updated", refresh); };
  }, [accessToken, userId]);
  const [authReady, setAuthReady] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const [creditNote, setCreditNote] = useState("");

  const [loginDraftNonce, setLoginDraftNonce] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileStudioMenuOpen, setMobileStudioMenuOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingGenerationContext, setBillingGenerationContext] = useState<GenerationBillingContext | null>(null);
  const [loadingBillingItem, setLoadingBillingItem] = useState<string | null>(null);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [toolbarModelSelectOpen, setToolbarModelSelectOpen] = useState(false);
  const [modelSelectPlacement, setModelSelectPlacement] = useState<"top" | "bottom" | "modal">("bottom");
  const [toolbarModelSelectPlacement, setToolbarModelSelectPlacement] = useState<"top" | "bottom" | "modal">("bottom");
  const billingModalScrollRef = useRef<HTMLDivElement | null>(null);
  const modelSelectRef = useRef<HTMLDivElement | null>(null);
  const modelSelectPanelRef = useRef<HTMLDivElement | null>(null);
  const toolbarModelSelectRef = useRef<HTMLDivElement | null>(null);
  const toolbarModelSelectPanelRef = useRef<HTMLDivElement | null>(null);
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

  useFloatingPanel({
    open: modelSelectOpen,
    triggerRef: modelSelectRef,
    panelRef: modelSelectPanelRef,
    setOpen: setModelSelectOpen,
    onPlacementChange: setModelSelectPlacement
  });

  useFloatingPanel({
    open: toolbarModelSelectOpen,
    triggerRef: toolbarModelSelectRef,
    panelRef: toolbarModelSelectPanelRef,
    setOpen: setToolbarModelSelectOpen,
    onPlacementChange: setToolbarModelSelectPlacement
  });

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      const nextUserId = data.session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
      }
      if (!token) setCreditNote(st("studio.status.signInCredit"));
      setAuthReady(true);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token || null;
      const nextUserId = session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (!nextUserId) {
        setTasks([]);
        setCreditBalance(null);
      }
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
      }
      setAuthReady(true);
    });
    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

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
      mode === "video" && (workflowParam === "image-to-video" || workflowParam === "reference-to-video")
        ? workflowParam
        : mode === "avatar"
          ? "avatar-video"
          : "text-to-video"
    );
    setAudioWorkflow(mode === "audio" && workflowParam === "text-to-music" ? "text-to-music" : "text-to-audio");
    const enteringReference = mode === "video" && workflowParam === "reference-to-video";
    if (enteringReference && !previousReferenceWorkflow.current) {
      setReferenceImagesText(""); setReferenceImageFiles([]);
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
    if (!sp.get("prompt") && (modeChanged || nextProvider !== initialProvider)) {
      setPrompt(current => mode === "avatar" && !modeChanged
        ? promptForProviderChange(current, "", st("studio.music.defaultPrompt"))
        : defaultPromptForProvider(nextProvider, workflowParam, st("studio.music.defaultPrompt")));
    }
    if (modeChanged && mode === "image") {
      if (!sp.get("reference")) setReferenceImagesText("");
      if (!sp.get("reference") || sp.get("templateId")) setReferenceImageFiles([]);
    }
    const nextImageSize = mode === "image" ? isGptImageProvider(nextProvider) && sp.get("imageSize") ? sp.get("imageSize")! : defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? defaultImageRatioForProvider(nextProvider, nextImageSize) : mode === "avatar" ? "source" : workflowParam === "reference-to-video" ? "adaptive" : "16:9");
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
    if (mode !== "image") return;
    const nextImageSize = defaultImageSizeForProvider(provider);
    setImageSize(nextImageSize);
    setRatio(defaultImageRatioForProvider(provider, nextImageSize));
    if (provider === "flux-image") {
      setNumInferenceSteps(4);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "flux-dev") {
      setNumInferenceSteps(28);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "nano-banana-image" || provider === "nano-banana-edit" || provider === "nano-banana-pro" || provider === "nano-banana-2-lite") {
      setEditResolution((current) => (current === "0.5K" ? "1K" : current));
    }
  }, [mode, provider]);

  useEffect(() => {
    const promptParam = sp.get("prompt");
    const applyPromptParam = shouldApplyUrlInput(lastAppliedPromptUrlRef.current, mode, promptParam);
    lastAppliedPromptUrlRef.current = { mode, value: promptParam };
    if (promptParam && applyPromptParam) {
      setPrompt(promptParam);
    }

    const providerParam = sp.get("provider");

    const ratioParam = sp.get("ratio");
    if (ratioParam && isKnownVideoRatio(ratioParam)) {
      setRatio(ratioParam);
    }

    const imageSizeParam = sp.get("imageSize");
    if (provider !== "topaz-image" && imageSizeParam && (IMAGE_SIZE_PRESETS.some((preset) => preset.value === imageSizeParam) || (isGptImageProvider(provider) && ["auto","custom",...GPT_IMAGE_SIZES.map(preset=>preset.value)].includes(imageSizeParam)))) {
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
    if (shouldApplyUrlInput(lastAppliedVideoUrlRef.current, mode, value)) setReferenceVideoUrl(value || "");
    lastAppliedVideoUrlRef.current = {mode, value};
  }, [mode, sp]);

  // Apply the local upload after the existing route effects select the workflow.
  // Keep image data out of URLs and use the same reference state as editor uploads.
  useEffect(() => {
    const pending = homeReferenceRef.current;
    if (!pending || sp.get("view") === "home" || mode !== pending.mode) return;
    const expectedWorkflow = mode === "image" ? "image-to-image" : "image-to-video";
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

  const avatarVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => avatarVoiceGender === "all" || voice.gender === avatarVoiceGender).map((voice) => voice.name) as string[],
    [avatarVoiceGender]
  );
  const audioVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => audioVoiceGender === "all" || voice.gender === audioVoiceGender).map((voice) => voice.name) as string[],
    [audioVoiceGender]
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
  const avatarNeedsImage = isAvatarWorkflow && referenceImageUrls.length === 0;
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
  const isMiniMaxMusic = mode === "audio" && provider === "minimax-music-2.6";
  const isElevenLabsAudio = mode === "audio" && provider === "elevenlabs-tts";
  const isGeminiTts = mode === "audio" && provider === GEMINI_TTS_PROVIDER;
  const geminiSpeech = prepareGeminiTts(geminiTts.mode === "dialogue" ? "" : prompt, geminiTts);
  const speechBillableText = isGeminiTts ? geminiTtsBillableText(prompt, geminiTts) : prompt;
  const audioCharacterCount = mode === "audio" ? isGeminiTts ? geminiTtsCharacters(speechBillableText) : prompt.trim().length : 0;
  const avatarSelectedSeconds = Math.max(1, Number.parseInt(avatarDuration, 10) || Number.parseInt(DEFAULT_VIDEO_DURATION, 10));

  const baseEstCredits = estimateGenerationCredits({
    pricingTime,
    mode: modeForPricing(mode),
    provider,
    imageSize,
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
  const modelPickerOptions = useMemo(() => (options.map((option) => {
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
      badge: option.value === "flux-3-max-video" && isFlux3MaxPromotion(pricingTime) ? st("studio.flux3.promotion") : badgeKey ? st(badgeKey) : undefined,
      group: st(groupKey)
    };
  })), [activeWorkflow, avatarDuration, duration, editResolution, estCredits, geminiTts, generateAudio, gptImageOptions, h3DailyFree, imageQuality, imageSize, imageWorkflow, isAvatarWorkflow, mode, numImages, options, pricingTime, prompt, provider, recommendedProvider, referenceImageUrls, st, videoResolution]);
  const hasEnoughCredits = creditBalance === null || creditBalance >= estCredits;
  const lowBalanceAfterGeneration = typeof creditBalance === "number" && creditBalance - estCredits < CREDIT_LOW_BALANCE_THRESHOLD;
  const hasMiniMaxLyrics = isInstrumental || lyricsOptimizer || musicLyrics.trim().length > 0;
  const isPromptValid = isPromptlessImageWorkflow || (
    isGeminiTts ? !geminiSpeech.error : isAvatarWorkflow
      ? prompt.trim().length > 0 && !avatarScriptTooLong
      : isMiniMaxMusic
        ? prompt.trim().length >= 10 && hasMiniMaxLyrics
        : prompt.trim().length > 0
  );
  const needsReferenceImage = activeWorkflow === "image-to-image" || activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video";
  const hasRequiredReference = activeWorkflow === "reference-to-video" ? isPublicReferenceUrl(referenceVideoUrl) : !needsReferenceImage || referenceImageUrls.length > 0;
  const gptRequestOptions = {imageSize,imageWidth:gptImageOptions.width,imageHeight:gptImageOptions.height,quality:imageQuality,outputFormat,numImages,imageUrls:referenceImageUrls,background:gptImageOptions.background,imageReasoningEffort:gptImageOptions.reasoningEffort,...(["jpeg","webp"].includes(outputFormat)?{outputCompression:gptImageOptions.outputCompression}:{}),...(outputFormat==="gif"?{frameCount:gptImageOptions.frameCount,frameDurationMs:gptImageOptions.frameDurationMs}:{}),...(outputFormat==="svg"?{svgModel:gptImageOptions.svgModel}:{}),...(activeWorkflow==="image-to-image"?{maskUrl:gptImageOptions.maskUrl,markupImageUrl:gptImageOptions.markupImageUrl}:{})};
  const gptValidationError = mode==="image"&&isGptImageProvider(provider)?gptImageOptionError({...gptRequestOptions,prompt}):null;
  const canSubmit = isPromptValid && hasRequiredReference && !gptValidationError && !verifiedAvatarAudio.loading && !verifiedAvatarAudio.error;
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
  const selectedImageSize = getImageSizePreset(imageSize);
  const providerNoteKey = [
    "flux-image",
    "flux-dev",
    "chatgpt-image",
    "topaz-image",
    "kling-avatar-standard",
    "kling-avatar-pro",
    "flux-3-max-video",
    "grok-video",    "seedance-video",
    "seedance-mini-video",
    "happy-horse-video",
    "gemini-omni-flash-video",
    MISCHIEF_PROVIDER,
    "kling-video",
    "veo-video",
    "elevenlabs-tts",
    GEMINI_TTS_PROVIDER,
    "minimax-music-2.6"
  ].includes(provider)
    ? provider
    : "default";
  const providerNote = provider === "heygen-video" ? `${st("studio.field.nativeAudio")} · 5–15s · 480p / 768p / 1080p / 2K` : isGptImageProvider(provider) ? PROVIDER_META[provider].bestFor : st(`studio.model.${providerNoteKey}`);
  const showVideoModelSelect = mode === "video" && (activeWorkflow === "text-to-video" || activeWorkflow === "image-to-video" || activeWorkflow === "reference-to-video");
  const selectedProviderMeta = PROVIDER_META[provider] || {
    label: provider,
    shortLabel: provider,
    speed: "Standard",
    quality: "Balanced",
    bestFor: "General generation"
  };
  const videoModelGroups = [
    { key: "freeDraft", label: st("studio.modelSelect.group.freeDraft") },
    { key: "betterQuality", label: st("studio.modelSelect.group.betterQuality") },
    { key: "premium", label: st("studio.modelSelect.group.premium") }
  ];
  const selectedVideoModelConfig = videoModelConfig(provider);
  const configuredVideoWorkflow = videoWorkflow === "reference-to-video" ? "reference-to-video" : videoWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
  const videoRatioOptions = isAvatarProvider(provider) || isH3MaxAvatar || isHeygenAvatar
    ? ["source"]
    : videoModelRatios(provider, configuredVideoWorkflow);
  const videoDurationOptions = isAvatarProvider(provider)
    ? Array.from({ length: 13 }, (_, index) => `${index + 3}s`)
    : videoModelDurations(provider, videoWorkflow === "image-to-video" ? referenceImageUrls.length : 0);
  const videoResolutionOptions = videoModelResolutions(provider);

  const showVideoResolutionControl = (mode === "video" || isH3MaxAvatar || isHeygenAvatar) && Boolean(selectedVideoModelConfig?.showResolutionControl);
  const showVideoAudioControl = mode === "video" && !isAvatarProvider(provider) && Boolean(selectedVideoModelConfig?.showAudioControl);
  const showTextToImageTemplates = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && imageWorkflow === "text-to-image";
  const showImageToImageRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && imageWorkflow === "image-to-image";
  const showImageUtilityRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "image" && (imageWorkflow === "enhance-cleanup" || imageWorkflow === "background-remove");
  const showVideoWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "video" && (videoWorkflow === "text-to-video" || videoWorkflow === "image-to-video" || videoWorkflow === "reference-to-video");
  const showAudioWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && mode === "audio" && (audioWorkflow === "text-to-audio" || audioWorkflow === "text-to-music");
  const showAvatarWorkbenchRedesign = !isAppsHome && !isProjectsView && !isBillingView && isAvatarWorkflow;
  const showImageWorkbenchRedesign = showTextToImageTemplates || showImageToImageRedesign || showImageUtilityRedesign;
  const showModernWorkbenchRedesign = showImageWorkbenchRedesign || showVideoWorkbenchRedesign || showAudioWorkbenchRedesign || showAvatarWorkbenchRedesign;
  const showModernStudioChrome = showModernWorkbenchRedesign || isProjectsView || isAppsHome || isBillingView;
  const useWideStudioShell = showModernStudioChrome || isAppsHome;
  const providerSettingsLabel =
    isGptImageProvider(provider)
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
          : mode === "audio"
            ? `${prompt.trim().length || 0} / ${ttsVoice} / ${ttsStability.toFixed(2)}`
          : isAvatarWorkflow
            ? isH3MaxAvatar
                ? `${videoResolution} / ${avatarDuration}`
              : `${avatarDuration} / ${ttsVoice}`
            : `${videoResolution} / ${duration}${showVideoAudioControl ? generateAudio ? " / ON" : " / OFF" : ""}`;

  useEffect(() => {
    if (mode !== "avatar") return;
    if (avatarVoiceOptions.includes(ttsVoice)) return;
    setTtsVoice(avatarVoiceOptions[0] || "Rachel");
  }, [avatarVoiceOptions, mode, ttsVoice]);

  useEffect(() => {
    if (!isElevenLabsAudio || audioVoiceOptions.includes(ttsVoice)) return;
    setTtsVoice(audioVoiceOptions[0] || "Rachel");
  }, [audioVoiceOptions, isElevenLabsAudio, ttsVoice]);

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
      setRatio(videoRatioOptions.includes("auto") ? "auto" : videoRatioOptions[0] || "16:9");
    }
    if (!videoDurationOptions.includes(duration)) {
      setDuration(videoModelDefaultDuration(provider));
    }
    if (showVideoResolutionControl && !videoResolutionOptions.includes(videoResolution)) {
      setVideoResolution(defaultVideoResolutionForProvider(provider));
    }
  }, [duration, isH3MaxAvatar, mode, provider, ratio, showVideoResolutionControl, videoDurationOptions, videoRatioOptions, videoResolution, videoResolutionOptions]);

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
    if (nextWorkflow === "reference-to-video" || activeWorkflow === "reference-to-video") { params.delete("reference"); params.delete("templateId"); }
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
      const nextConfiguredWorkflow = activeWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
      const nextRatioOptions = videoModelRatios(nextProvider, nextConfiguredWorkflow);
      const requestedRatio = videoOverrides?.ratio || ratio;
      const nextRatio =
        isAvatarProvider(nextProvider) || (mode === "avatar" && isH3MaxProvider(nextProvider))
          ? "source"
        : nextRatioOptions.includes(requestedRatio)
          ? requestedRatio
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
      const nextResolutionOptions = videoModelResolutions(nextProvider);
      const nextResolution = videoOverrides?.resolution && nextResolutionOptions.includes(videoOverrides.resolution)
        ? videoOverrides.resolution
        : defaultVideoResolutionForProvider(nextProvider);
      setVideoResolution(nextResolution);
      if(nextProvider === "flux-3-max-video" && provider !== nextProvider){setGenerateAudio(true);setReasoningLevel("high");}
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

  function startAvatarAudioGuide() {
    applyWorkflow("text-to-audio");
    setPrompt("Hi, welcome to DreamFace. I am your AI avatar presenter, ready to introduce your product, tell your story, or deliver a polished social video message.");
  }

  async function handleReferenceFiles(files: FileList | null, frameIndex?: number) {
    if (!files?.length) return;
    const uploadScope = referenceUploadScopeRef.current;
    if (mode === "video" && videoWorkflow === "reference-to-video") {
      const selected = Array.from(files);
      if (selected.length + referenceImageUrls.length > HEYGEN_REFERENCE_IMAGE_LIMIT || selected.some(file => !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 30*1024*1024)) {
        setStatusTone("error"); setStatusText(st("studio.referenceVideo.subjectHint")); return;
      }
      const uploaded = await Promise.all(selected.map(file => new Promise<string>((resolve,reject) => {
        const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error("Image file could not be read.")); reader.readAsDataURL(file);
      })));
      if (uploadScope !== referenceUploadScopeRef.current) return;
      setReferenceImageFiles(current => [...current,...uploaded].slice(0,HEYGEN_REFERENCE_IMAGE_LIMIT));
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
      const uploaded = await Promise.all(selected.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Image file could not be read."));
        reader.readAsDataURL(file);
      })));
      if (uploadScope !== referenceUploadScopeRef.current) return;
      const next = frameIndex === undefined ? uploaded : referenceImageUrls.slice(0, limit);
      if (frameIndex !== undefined) next[frameIndex] = uploaded[0];
      setReferenceImagesText("");
      setReferenceImageFiles(next);
      return;
    }
    const singleReferenceWorkflow = isPromptlessImageWorkflow || mode === "video" || mode === "avatar";
    const maxFiles = singleReferenceWorkflow ? 1 : 4;
    const nextFiles = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, maxFiles)
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Image file could not be read."));
              reader.readAsDataURL(file);
            })
        )
    );
    if (uploadScope !== referenceUploadScopeRef.current) return;
    if (mode === "video" || mode === "avatar") {
      setReferenceImagesText("");
    } else if (mode === "image" && nextFiles.length) {
      setReferenceImagesText(current => referenceTextWithoutExamples(current));
    }
    setReferenceImageFiles((prev) => (singleReferenceWorkflow ? nextFiles.slice(0, 1) : [...prev, ...nextFiles].slice(0, 4)));
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

  async function handleAvatarAudioFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setStatusTone("error");
      setStatusText(st("studio.status.audioFileRequired"));
      return;
    }
    const targetSeconds = Math.max(1, Number.parseInt(duration, 10) || Number.parseInt(DEFAULT_VIDEO_DURATION, 10));
    try {
      setStatusTone("idle");
      setStatusText(st("studio.status.audioTrimming", { file: file.name, seconds: targetSeconds }));
      const result = await trimAudioFileToDataUrl(file, targetSeconds);
      setAvatarAudioUrl(result.dataUrl);
      setAvatarAudioTrimSeconds(targetSeconds);
      setStatusTone("idle");
      setStatusText(
        result.trimmed
          ? st("studio.status.audioTrimmed", {
              file: file.name,
              original: formatSeconds(result.originalSeconds),
              output: formatSeconds(result.outputSeconds)
            })
          : st("studio.status.audioFits", {
              file: file.name,
              duration: formatSeconds(result.originalSeconds),
              seconds: targetSeconds
            })
      );
    } catch (error) {
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? localizeStudioError(error.message)
          : st("studio.status.audioTrimFailed")
      );
    }
  }

  function clearCompletedWorkbench() {
    setPrompt("");
    setReferenceImagesText("");
    setReferenceImageFiles([]);
    setGptImageOptions(current=>({...current,maskUrl:"",markupImageUrl:""}));
  }

  function cacheCreditBalance(balance: number) {
    if (typeof window === "undefined") return;
    const creditKey = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
    if (creditKey) {
      safeSetLocalStorage(creditKey, String(balance));
    }
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
      avatarAudioUrl,
      editResolution,
      videoResolution,
      generateAudio,
      reasoningLevel,
      voice: ttsVoice,
      geminiTts,
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
    autoSubmitLoginDraftRef.current = draft.autoSubmit && draft.provider !== "mischief-video";
    setProvider(draft.provider === "nano-banana-edit" ? "nano-banana-image" : normalizeGptImageProvider(draft.provider));
    setImageWorkflow(draft.imageWorkflow);
    setVideoWorkflow(draft.videoWorkflow || "text-to-video");
    setAudioWorkflow(draft.audioWorkflow || "text-to-audio");
    setRatio(draft.ratio);
    setImageSize(draft.imageSize);
    setReferenceImagesText(draft.mode === "avatar" ? stripAvatarDefaultReferences(draft.referenceImagesText) : draft.referenceImagesText);
    setReferenceImageFiles(Array.isArray(draft.referenceImageFiles) ? draft.referenceImageFiles : []);
    setReferenceVideoUrl(draft.referenceVideoUrl || "");
    setAvatarAudioUrl(draft.avatarAudioUrl || "");
    setEditResolution(draft.editResolution);
    setVideoResolution(draft.videoResolution);
    setGenerateAudio(Boolean(draft.generateAudio));
    setReasoningLevel(draft.reasoningLevel === "low" ? "low" : "high");
    setTtsVoice(draft.voice || "Rachel");
    setGeminiTts(restoreGeminiTtsOptions(draft.geminiTts));
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
    setEnableSafetyChecker(draft.enableSafetyChecker === true);
    setAcceleration(draft.acceleration || "none");
    setLimitGenerations(draft.limitGenerations !== false);
    setSeed(draft.seed || "");
    setSafetyTolerance(draft.safetyTolerance || "4");
    setSystemPrompt(draft.systemPrompt || "");
    setEnableWebSearch(Boolean(draft.enableWebSearch));
    setThinkingLevel(draft.thinkingLevel || "");
    setDuration(draft.duration);
    setPrompt(draft.mode === "avatar" ? promptForProviderChange(draft.prompt, "", st("studio.music.defaultPrompt")) : draft.prompt);
    videoPromptAI.setEnabled(draft.aiPromptEnhancementEnabled !== false);
    videoPromptAI.restoreDraft(draft.videoPromptEnhancement || null);
    setStatusTone("idle");
    setStatusText(autoSubmitLoginDraftRef.current ? st("studio.status.restoredContinue") : st("studio.status.restored"));

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
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getSession();
      const liveToken = data.session?.access_token || null;
      if (!liveToken) {
        setAccessToken(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          safeRemoveLocalStorage("nova_access_token");
        }
        trackEvent(
          "generate_login_required",
          { mode, provider, workflow: activeWorkflow },
          accessToken
        );
        openGenerationSignIn();
        return;
      }

      let finalPrompt = prompt;
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
        promptEnhancement,
        imageSize: mode === "image" ? imageSize : undefined,
        imageUrls:
          (mode === "image" && referenceImageUrls.length > 0) || (mode === "avatar" || (mode === "video" && (videoWorkflow === "image-to-video" || videoWorkflow === "reference-to-video")))
            ? referenceImageUrls
            : undefined,
        videoUrls: mode === "video" && videoWorkflow === "reference-to-video" ? [referenceVideoUrl.trim()] : undefined,
        audioUrl: isAvatarProvider(provider) && avatarAudioUrl.trim() ? verifiedAvatarAudio.audioUrl : undefined,
        resolution:
          mode === "image"
            ? editResolution
            : (mode === "video" || isH3MaxAvatar || isHeygenAvatar) && (provider === "heygen-video" || provider === "flux-3-max-video" || provider === MISCHIEF_PROVIDER || isH3VideoProvider(provider) || provider === "grok-video" || provider === "gemini-omni-flash-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video")
              ? videoResolution
              : undefined,
        generateAudio: provider === MISCHIEF_PROVIDER ? false : mode === "video" || isHeygenAvatar ? provider === "heygen-video" || provider === "gemini-omni-flash-video" || generateAudio : undefined,
        reasoningLevel: provider === "flux-3-max-video" ? reasoningLevel : undefined,
        expectedCredits: estCredits,
        outputFormat: mode === "image" && provider !== "bria-background-remove" ? outputFormat : undefined,
        quality: mode === "image" && !isPromptlessImageWorkflow ? imageQuality : undefined,
        ...(mode==="image"&&isGptImageProvider(provider)?{...gptRequestOptions,enableSafetyChecker:gptImageOptions.enableSafetyChecker}:{}),
        numImages: mode === "image" && !isPromptlessImageWorkflow ? numImages : undefined,
        guidanceScale: mode === "image" && !isPromptlessImageWorkflow ? guidanceScale : undefined,
        numInferenceSteps: mode === "image" && !isPromptlessImageWorkflow ? numInferenceSteps : undefined,
        enableSafetyChecker: mode==="image"&&isGptImageProvider(provider)?gptImageOptions.enableSafetyChecker:(mode === "image" && !isPromptlessImageWorkflow) || ((mode === "video" || isHeygenAvatar) && (provider === "heygen-video" || provider === "happy-horse-video" || provider === "grok-video")) ? enableSafetyChecker : undefined,
        acceleration: mode === "image" && !isPromptlessImageWorkflow ? acceleration : undefined,
        limitGenerations: mode === "image" && !isPromptlessImageWorkflow ? limitGenerations : undefined,
        seed: Number.isSafeInteger(parsedSeed) && (mode === "image" || provider === "heygen-video" || provider === "flux-3-max-video" || provider === MISCHIEF_PROVIDER || isH3VideoProvider(provider) || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video") ? parsedSeed : undefined,
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

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`
        },
        body: JSON.stringify({
          ...requestPayload,
          idempotencyKey: idempotency.idempotencyKey
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string; code?: string; pricingTime?:number } | null;
        if(errorPayload?.code?.startsWith("studio.gpt26.")) throw new Error(st(errorPayload.code));
        clearPersistentIdempotency(idempotencyStorageKey);
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
    requestSignIn({
      onBeforeRedirect: () => saveLoginDraft(true),
      onSuccess: () => {
        autoSubmitLoginDraftRef.current = true;
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
    handleGenerate();
  }

  useEffect(() => {
    if (!authReady || !accessToken || !autoSubmitLoginDraftRef.current || isSubmitting || !isPromptValid || h3FreeLoading) return;
    const timer = window.setTimeout(() => {
      autoSubmitLoginDraftRef.current = false;
      handleGenerate();
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authReady, isPromptValid, isSubmitting, loginDraftNonce, h3FreeLoading]);

  async function handleTopUp(amount: number) {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ amount })
      });
      const payload = (await response.json()) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(localizeStudioError(payload.error || st("studio.status.topUpFailed"), response.status));
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        cacheCreditBalance(payload.balance);
      }
      setCreditNote(st("studio.status.topUpAdded", { credits: amount }));
    } catch (error) {
      setCreditNote(error instanceof Error ? localizeStudioError(error.message) : st("studio.status.topUpFailed"));
    }
  }

  function openBillingModal(source: string) {
    setBillingGenerationContext(null);
    setBillingModalOpen(true);
    setBillingMessage("");
    trackEvent("studio_billing_modal_opened", { source, balance: creditBalance, mode, provider }, accessToken);
  }

  function openInsufficientCreditsModal() {
    if (typeof creditBalance !== "number") return;
    const context: GenerationBillingContext = {
      requiredCredits: estCredits,
      balance: creditBalance,
      providerLabel: selectedProviderMeta.label
    };
    setBillingGenerationContext(context);
    setBillingMessage("");
    setBillingModalOpen(true);
    trackEvent("generation_insufficient_credits_shown", {
      mode,
      provider,
      workflow: activeWorkflow,
      required_credits: estCredits,
      balance: creditBalance,
      shortfall: Math.max(0, estCredits - creditBalance)
    }, accessToken);
  }

  function improveTextToImagePrompt() {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${PROMPT_IMPROVE_TEXT}` : PROMPT_IMPROVE_TEXT;
    });
    trackEvent("studio_prompt_improved", { mode, provider, workflow: activeWorkflow }, accessToken);
  }

  async function startStudioCreditCheckout(packId: string, paymentProvider: "paypal" | "dodo", loginToken?: string) {
    const checkoutToken = loginToken || accessToken;
    const checkoutSurface = billingGenerationContext ? "generation_insufficient_modal" : "studio_modal";
    if (!checkoutToken) {
      trackEvent("checkout_login_required", { pack_id: packId, surface: checkoutSurface });
      requestSignIn({ onBeforeRedirect: () => saveLoginDraft(false), onSuccess: session => { void startStudioCreditCheckout(packId, paymentProvider, session.access_token); } });
      return;
    }

    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    setLoadingBillingItem(`credits:${packId}:${paymentProvider}`);
    setBillingMessage("");
    trackEvent(
      "checkout_started",
      { surface: checkoutSurface, payment_provider: paymentProvider, pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
      accessToken
    );

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${checkoutToken}`
        },
        body: JSON.stringify({ type: "credits", packId, provider: paymentProvider })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(response.status === 401 ? st("studio.error.sessionExpired") : st("studio.billing.checkoutFailed"));
      }
      window.location.href = payload.url;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : st("studio.billing.checkoutFailed"));
      setLoadingBillingItem(null);
    }
  }
  return { acceleration,
    accessToken,
    activeTasks,
    activeWorkflow,
    applyProvider,
    applyWorkflow,
    audioCharacterCount,
    audioVoiceGender,
    audioVoiceOptions,
    audioWorkflow,
    authReady,
    avatarAudioUrl,
    avatarDuration,
    avatarNeedsImage,
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
    options,
    outputFormat,
    previewModal,
    prompt,
    provider,
    providerNote,
    providerSettingsLabel,
    ratio,
    reasoningLevel,
    referenceImageUrls,
    referenceImagesText,
    referenceVideoUrl,
    referralsVisible,
    safetyTolerance,
    saveLoginDraft,
    seed,
    selectedImageSize,
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
    setVideoSidebarCollapsed,
    setVideoWorkflow,
    showAudioWorkbenchRedesign,
    showAvatarWorkbenchRedesign,
    showImageToImageRedesign,
    showImageUtilityRedesign,
    showImageWorkbenchRedesign,
    showModernStudioChrome,
    showModernWorkbenchRedesign,
    showTextToImageTemplates,
    showVideoAudioControl,
    showVideoModelSelect,
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
    toolbarModelSelectOpen,
    toolbarModelSelectPanelRef,
    toolbarModelSelectPlacement,
    toolbarModelSelectRef,
    ttsLanguageCode,
    ttsStability,
    ttsTimestamps,
    ttsVoice,
    useWideStudioShell,
    userId,
    videoDurationOptions,
    videoModelGroups,
    videoPromptAI,
    videoRatioOptions,
    videoResolution,
    videoResolutionOptions,
    videoSidebarCollapsed,
    videoWorkflow } as const;
}
export type StudioController = ReturnType<typeof useStudioController>;
