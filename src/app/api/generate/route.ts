import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import {
  FalApiError,
  falApiErrorFromResponse,
  falRefundCreditsFromCost,
  formatFalFailureReason,
  parseFalFailure
} from "../../../lib/fal-errors";
import {
  claimSignupBonusForIp,
  ensureCreditAccount,
  getCreditAccount,
  getRequestCountryCode,
  getRequestIp,
  refundCredits,
  signupBonusCreditsForCountry,
  spendCredits
} from "../../../lib/credits";
import { estimateGenerationCreditsWithLivePricing } from "../../../lib/fal-pricing";
import {
  DREAMFACE_IO_PROVIDER,
  dreamfaceIoCredits,
  dreamfaceIoUnits,
  ensureDreamfaceIoPublicImage,
  isDreamfaceIoConfigured,
  isDreamfaceIoDailyEligible,
  refundDreamfaceIoBilling,
  refundDreamfaceIoDailyUnits,
  reserveDreamfaceIoDailyUnits,
  submitDreamfaceIoVideo
} from "../../../lib/dreamface-io";
import { isDreamfaceIoEnabled } from "../../../lib/runtime-config";

type GenerateMode = "image" | "video" | "audio" | "avatar";
type StoredGenerateMode = "image" | "video" | "audio";

type GenerateRequest = {
  mode: GenerateMode;
  imageWorkflow?: "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
  videoWorkflow?: "avatar-video" | "text-to-video" | "image-to-video";
  provider: string;
  ratio: string;
  duration: string;
  prompt: string;
  imageSize?: string;
  imageUrls?: string[];
  audioUrl?: string;
  resolution?: string;
  outputFormat?: string;
  quality?: string;
  numImages?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  acceleration?: string;
  limitGenerations?: boolean;
  seed?: number;
  safetyTolerance?: string;
  systemPrompt?: string;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
  generateAudio?: boolean;
  voice?: string;
  stability?: number;
  timestamps?: boolean;
  languageCode?: string;
  textNormalization?: string;
  idempotencyKey?: string;
};

type ExistingTask = {
  id: string;
  mode: "image" | "video" | "audio";
  provider: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  status_url: string | null;
  response_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
};

function isValidBody(body: unknown): body is GenerateRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as Record<string, unknown>;
  return (
    (payload.mode === "image" || payload.mode === "video" || payload.mode === "audio" || payload.mode === "avatar") &&
    typeof payload.provider === "string" &&
    typeof payload.ratio === "string" &&
    typeof payload.duration === "string" &&
    typeof payload.prompt === "string"
  );
}

function storedModeForRequest(body: Pick<GenerateRequest, "mode">): StoredGenerateMode {
  return body.mode === "avatar" ? "video" : body.mode;
}

function isAvatarRequest(body: GenerateRequest) {
  return (body.mode === "avatar" || body.videoWorkflow === "avatar-video") && (body.provider === "kling-avatar-standard" || body.provider === "kling-avatar-pro");
}

function hasReferenceImages(body: GenerateRequest) {
  return body.mode === "image" && Array.isArray(body.imageUrls) && body.imageUrls.some((url) => typeof url === "string" && url.trim());
}

function hasInputImages(body: GenerateRequest) {
  return Array.isArray(body.imageUrls) && body.imageUrls.some((url) => typeof url === "string" && url.trim());
}

function firstInputImage(body: GenerateRequest) {
  return Array.isArray(body.imageUrls) ? body.imageUrls.find((url) => typeof url === "string" && url.trim())?.trim() || null : null;
}

function isValidAudioInput(value: unknown) {
  return typeof value === "string" && (/^https?:\/\//i.test(value.trim()) || /^data:audio\//i.test(value.trim()));
}

function getModelId(mode: StoredGenerateMode, provider: string, editImage = false): string | null {
  const keyByProvider: Record<string, string | undefined> = {
    "chatgpt-image": editImage
      ? process.env.FAL_MODEL_IMAGE_CHATGPT_EDIT || "openai/gpt-image-2/edit"
      : process.env.FAL_MODEL_IMAGE_CHATGPT || "openai/gpt-image-2",
    "flux-image": process.env.FAL_MODEL_IMAGE_FLUX || "fal-ai/flux/schnell",
    "flux-dev": process.env.FAL_MODEL_IMAGE_FLUX_DEV || "fal-ai/flux/dev",
    "topaz-image": process.env.FAL_MODEL_IMAGE_TOPAZ || "fal-ai/topaz/upscale/image",
    "bria-background-remove": process.env.FAL_MODEL_IMAGE_BRIA_BACKGROUND_REMOVE || "fal-ai/bria/background/remove",
    "nano-banana-image": editImage
      ? process.env.FAL_MODEL_IMAGE_NANO_BANANA_EDIT || "fal-ai/nano-banana-2/edit"
      : process.env.FAL_MODEL_IMAGE_NANO_BANANA || "fal-ai/nano-banana-2",
    "nano-banana-pro": editImage
      ? process.env.FAL_MODEL_IMAGE_NANO_BANANA_PRO_EDIT || "fal-ai/nano-banana-pro/edit"
      : process.env.FAL_MODEL_IMAGE_NANO_BANANA_PRO || "fal-ai/nano-banana-pro",
    "nano-banana-edit": process.env.FAL_MODEL_IMAGE_NANO_BANANA_EDIT || "fal-ai/nano-banana-2/edit",
    "recraft-image": process.env.FAL_MODEL_IMAGE_RECRAFT,
    "seedance-video": editImage
      ? process.env.FAL_MODEL_VIDEO_SEEDANCE_I2V || "bytedance/seedance-2.0/image-to-video"
      : process.env.FAL_MODEL_VIDEO_SEEDANCE || "bytedance/seedance-2.0/text-to-video",
    "kling-video": editImage
      ? process.env.FAL_MODEL_VIDEO_KLING_I2V || "fal-ai/kling-video/v3/pro/image-to-video"
      : process.env.FAL_MODEL_VIDEO_KLING || "fal-ai/kling-video/v3/pro/text-to-video",
    "kling-avatar-standard": process.env.FAL_MODEL_VIDEO_KLING_AVATAR_STANDARD || "fal-ai/kling-video/ai-avatar/v2/standard",
    "kling-avatar-pro": process.env.FAL_MODEL_VIDEO_KLING_AVATAR_PRO || "fal-ai/kling-video/ai-avatar/v2/pro",
    "veo-video": process.env.FAL_MODEL_VIDEO_VEO || "fal-ai/veo3.1",
    "grok-video": editImage
      ? process.env.FAL_MODEL_VIDEO_GROK_I2V || "xai/grok-imagine-video/image-to-video"
      : process.env.FAL_MODEL_VIDEO_GROK || "xai/grok-imagine-video/text-to-video",
    "elevenlabs-tts": process.env.FAL_MODEL_AUDIO_ELEVENLABS || "fal-ai/elevenlabs/tts/eleven-v3"
  };

  return (
    keyByProvider[provider] ||
    (mode === "image"
      ? process.env.FAL_MODEL_IMAGE_DEFAULT
      : mode === "audio"
        ? process.env.FAL_MODEL_AUDIO_DEFAULT
        : process.env.FAL_MODEL_VIDEO_DEFAULT) ||
    null
  );
}

const IMAGE_SIZE_PRESETS = new Set([
  "default_4_3",
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9"
]);
const EDIT_ASPECT_RATIOS = new Set(["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"]);
const EDIT_RESOLUTIONS = new Set(["0.5K", "1K", "2K", "4K"]);
const OUTPUT_FORMATS = new Set(["jpeg", "png", "webp"]);
const FLUX_OUTPUT_FORMATS = new Set(["jpeg", "png"]);
const IMAGE_QUALITIES = new Set(["auto", "low", "medium", "high"]);
const ACCELERATION_OPTIONS = new Set(["none", "regular", "high"]);
const SAFETY_TOLERANCES = new Set(["1", "2", "3", "4", "5", "6"]);
const THINKING_LEVELS = new Set(["minimal", "high"]);
const TTS_TEXT_NORMALIZATION_OPTIONS = new Set(["auto", "on", "off"]);
const VIDEO_ASPECT_RATIOS = new Set(["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"]);
const GROK_IMAGE_VIDEO_ASPECT_RATIOS = new Set(["auto", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"]);
const SEEDANCE_VIDEO_ASPECT_RATIOS = new Set(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
const KLING_TEXT_VIDEO_ASPECT_RATIOS = new Set(["16:9", "9:16", "1:1"]);
const VEO_VIDEO_ASPECT_RATIOS = new Set(["16:9", "9:16"]);
const GROK_VIDEO_RESOLUTIONS = new Set(["480p", "720p"]);
const SEEDANCE_VIDEO_RESOLUTIONS = new Set(["480p", "720p", "1080p"]);
const VEO_VIDEO_RESOLUTIONS = new Set(["720p", "1080p", "4k"]);
const VEO_VIDEO_DURATIONS = new Set(["4s", "6s", "8s"]);
const AVATAR_MAX_SECONDS = 15;
const AVATAR_KLING_BUFFER_SECONDS = 2;
const KLING_AVATAR_DEFAULT_SCRIPT =
  "Welcome to Cat Facts, where we explore the fascinating world of our feline friends. Did you know that cats spend 70% of their lives sleeping, which means a three-year-old cat has only been awake for about nine months of its life?";

function estimateAvatarScriptSeconds(text: string) {
  if (text.trim() === KLING_AVATAR_DEFAULT_SCRIPT) return AVATAR_MAX_SECONDS - AVATAR_KLING_BUFFER_SECONDS;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  const cjkCount = (cleaned.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latinWords = (cleaned.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
  const nonSpaceCount = cleaned.replace(/\s/g, "").length;
  const cjkSeconds = cjkCount / 4.2;
  const wordSeconds = latinWords / 2.55;
  const fallbackSeconds = nonSpaceCount / 12;
  return Math.max(3, Math.ceil(Math.max(cjkSeconds, wordSeconds, fallbackSeconds)));
}

function avatarDurationFromPrompt(prompt: string) {
  const speechSeconds = estimateAvatarScriptSeconds(prompt);
  const outputSeconds = Math.min(AVATAR_MAX_SECONDS, Math.max(3, speechSeconds + AVATAR_KLING_BUFFER_SECONDS));
  return `${outputSeconds}s`;
}

function buildTtsInput(body: GenerateRequest, prompt: string) {
  const languageCode = cleanLanguageCode(body.languageCode);
  return {
    text: prompt,
    voice: typeof body.voice === "string" && body.voice.trim() ? body.voice.trim().slice(0, 80) : "Rachel",
    stability: clampNumber(body.stability, 0, 1, 0.5),
    timestamps: false,
    ...(languageCode ? { language_code: languageCode } : {}),
    apply_text_normalization: body.textNormalization && TTS_TEXT_NORMALIZATION_OPTIONS.has(body.textNormalization) ? body.textNormalization : "auto"
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optionalSeed(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function cleanSystemPrompt(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : undefined;
}

function cleanLanguageCode(value: unknown) {
  return typeof value === "string" && /^[a-z]{2}$/i.test(value.trim()) ? value.trim().toLowerCase() : undefined;
}

function getFalImageSize(ratio: string, imageSize?: string) {
  if (imageSize === "default_4_3") return "landscape_4_3";
  if (imageSize && IMAGE_SIZE_PRESETS.has(imageSize)) return imageSize;
  if (ratio === "16:9") return "landscape_16_9";
  if (ratio === "4:3") return "landscape_4_3";
  if (ratio === "3:4") return "portrait_4_3";
  if (ratio === "9:16") return "portrait_16_9";
  return "square_hd";
}

function buildFalInput(body: GenerateRequest, prompt: string) {
  if (body.mode === "audio" && body.provider === "elevenlabs-tts") {
    return {
      ...buildTtsInput(body, prompt),
      timestamps: Boolean(body.timestamps)
    };
  }

  if (body.mode === "image" && body.provider === "topaz-image") {
    return {
      image_url: firstInputImage(body),
      model: "Standard V2",
      upscale_factor: 2,
      output_format: body.outputFormat && new Set(["jpeg", "png"]).has(body.outputFormat) ? body.outputFormat : "jpeg",
      subject_detection: "All",
      face_enhancement: true,
      face_enhancement_strength: 0.8
    };
  }

  if (body.mode === "image" && body.provider === "bria-background-remove") {
    return {
      image_url: firstInputImage(body)
    };
  }

  if (isAvatarRequest(body)) {
    return {
      image_url: firstInputImage(body),
      audio_url: typeof body.audioUrl === "string" ? body.audioUrl.trim() : "",
      prompt: prompt || "."
    };
  }

  if (body.mode === "video" && body.provider === "seedance-video" && hasInputImages(body)) {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      image_url: firstInputImage(body),
      duration: String(Number.isInteger(duration) && duration >= 4 && duration <= 15 ? duration : 5),
      resolution: body.resolution && SEEDANCE_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p",
      aspect_ratio: SEEDANCE_VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      generate_audio: Boolean(body.generateAudio)
    };
  }

  if (body.mode === "video" && body.provider === "seedance-video") {
    const duration = Number.parseInt(body.duration, 10);
    const seed = optionalSeed(body.seed);
    return {
      prompt,
      duration: String(Number.isInteger(duration) && duration >= 4 && duration <= 15 ? duration : 5),
      resolution: body.resolution && SEEDANCE_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p",
      aspect_ratio: SEEDANCE_VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      generate_audio: Boolean(body.generateAudio),
      ...(seed !== undefined ? { seed } : {})
    };
  }

  if (body.mode === "video" && body.provider === "kling-video" && hasInputImages(body)) {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      start_image_url: firstInputImage(body),
      duration: String(Number.isInteger(duration) && duration >= 3 && duration <= 15 ? duration : 5),
      generate_audio: Boolean(body.generateAudio),
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5
    };
  }

  if (body.mode === "video" && body.provider === "kling-video") {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      duration: String(Number.isInteger(duration) && duration >= 3 && duration <= 15 ? duration : 5),
      generate_audio: Boolean(body.generateAudio),
      aspect_ratio: KLING_TEXT_VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "16:9",
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5
    };
  }

  if (body.mode === "video" && body.provider === "veo-video") {
    const seed = optionalSeed(body.seed);
    return {
      prompt,
      aspect_ratio: VEO_VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "16:9",
      duration: VEO_VIDEO_DURATIONS.has(body.duration) ? body.duration : "8s",
      resolution: body.resolution && VEO_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p",
      generate_audio: Boolean(body.generateAudio),
      auto_fix: true,
      safety_tolerance: body.safetyTolerance && SAFETY_TOLERANCES.has(body.safetyTolerance) ? body.safetyTolerance : "4",
      ...(seed !== undefined ? { seed } : {})
    };
  }

  if (body.mode === "video" && body.provider === "grok-video" && hasInputImages(body)) {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      image_url: firstInputImage(body),
      duration: Number.isInteger(duration) && duration > 0 && duration <= 15 ? duration : 5,
      aspect_ratio: GROK_IMAGE_VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      resolution: body.resolution && GROK_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p"
    };
  }

  if (body.provider === "grok-video") {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      duration: Number.isInteger(duration) && duration > 0 && duration <= 15 ? duration : 5,
      aspect_ratio: VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "16:9",
      resolution: body.resolution && GROK_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p"
    };
  }

  if (body.provider === "nano-banana-edit" || ((body.provider === "nano-banana-image" || body.provider === "nano-banana-pro") && hasReferenceImages(body))) {
    const input: Record<string, unknown> = {
      prompt,
      image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 14) : [],
      aspect_ratio: EDIT_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      resolution: body.resolution && EDIT_RESOLUTIONS.has(body.resolution) ? body.resolution : "1K",
      output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
      num_images: clampInt(body.numImages, 1, 4, 1),
      safety_tolerance: body.safetyTolerance && SAFETY_TOLERANCES.has(body.safetyTolerance) ? body.safetyTolerance : "4",
      limit_generations: body.limitGenerations !== false,
      enable_web_search: Boolean(body.enableWebSearch)
    };
    const seed = optionalSeed(body.seed);
    const systemPrompt = cleanSystemPrompt(body.systemPrompt);
    if (seed !== undefined) input.seed = seed;
    if (systemPrompt) input.system_prompt = systemPrompt;
    if (body.provider === "nano-banana-image" && body.thinkingLevel && THINKING_LEVELS.has(body.thinkingLevel)) {
      input.thinking_level = body.thinkingLevel;
    }
    if (body.provider === "nano-banana-pro" && input.resolution === "0.5K") {
      input.resolution = "1K";
    }
    return input;
  }

  if (body.provider === "chatgpt-image") {
    const seed = optionalSeed(body.seed);
    const quality = body.quality && IMAGE_QUALITIES.has(body.quality) ? body.quality : "high";
    if (hasReferenceImages(body)) {
      return {
        prompt,
        image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 16) : [],
        image_size: getFalImageSize(body.ratio, body.imageSize),
        quality,
        output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
        num_images: clampInt(body.numImages, 1, 4, 1),
        ...(seed !== undefined ? { seed } : {})
      };
    }
    return {
      prompt,
      image_size: getFalImageSize(body.ratio, body.imageSize),
      quality,
      output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
      num_images: clampInt(body.numImages, 1, 4, 1),
      ...(seed !== undefined ? { seed } : {})
    };
  }

  if (body.provider === "nano-banana-image" || body.provider === "nano-banana-pro") {
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: EDIT_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      resolution: body.resolution && EDIT_RESOLUTIONS.has(body.resolution) ? body.resolution : "1K",
      output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
      num_images: clampInt(body.numImages, 1, 4, 1),
      safety_tolerance: body.safetyTolerance && SAFETY_TOLERANCES.has(body.safetyTolerance) ? body.safetyTolerance : "4",
      limit_generations: body.limitGenerations !== false,
      enable_web_search: Boolean(body.enableWebSearch)
    };
    const seed = optionalSeed(body.seed);
    const systemPrompt = cleanSystemPrompt(body.systemPrompt);
    if (seed !== undefined) input.seed = seed;
    if (systemPrompt) input.system_prompt = systemPrompt;
    if (body.provider === "nano-banana-image" && body.thinkingLevel && THINKING_LEVELS.has(body.thinkingLevel)) {
      input.thinking_level = body.thinkingLevel;
    }
    if (body.provider === "nano-banana-pro" && input.resolution === "0.5K") {
      input.resolution = "1K";
    }
    return input;
  }

  if (body.provider === "flux-image" || body.provider === "flux-dev") {
    const seed = optionalSeed(body.seed);
    return {
      prompt,
      image_size: getFalImageSize(body.ratio, body.imageSize),
      guidance_scale: clampNumber(body.guidanceScale, 0, 20, 3.5),
      num_inference_steps: clampInt(body.numInferenceSteps, 1, body.provider === "flux-dev" ? 50 : 12, body.provider === "flux-dev" ? 28 : 4),
      num_images: clampInt(body.numImages, 1, 4, 1),
      enable_safety_checker: body.enableSafetyChecker !== false,
      output_format: body.outputFormat && FLUX_OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "jpeg",
      acceleration: body.acceleration && ACCELERATION_OPTIONS.has(body.acceleration) ? body.acceleration : "none",
      ...(seed !== undefined ? { seed } : {})
    };
  }

  return { prompt };
}

function buildRequestSettings(body: GenerateRequest, modelId: string | null) {
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((url) => typeof url === "string" && url.trim()).slice(0, 14)
    : [];

  return {
    mode: body.mode,
    workflow:
      isAvatarRequest(body)
        ? "avatar-video"
        : body.mode === "image" && body.provider === "bria-background-remove"
        ? "background-remove"
        : body.mode === "image" && imageUrls.length
        ? "image-to-image"
        : body.mode === "video" && imageUrls.length
          ? "image-to-video"
          : body.mode === "audio"
            ? "text-to-audio"
            : body.imageWorkflow || (body.mode === "video" ? "text-to-video" : "text-to-image"),
    provider: body.provider,
    model_id: modelId,
    ratio: body.ratio,
    duration: body.duration,
    image_size: body.imageSize || null,
    image_urls: imageUrls,
    audio_url: body.audioUrl || null,
    resolution: body.resolution || null,
    output_format: body.outputFormat || null,
    quality: body.quality || null,
    num_images: body.numImages || null,
    guidance_scale: body.guidanceScale || null,
    num_inference_steps: body.numInferenceSteps || null,
    enable_safety_checker: typeof body.enableSafetyChecker === "boolean" ? body.enableSafetyChecker : null,
    acceleration: body.acceleration || null,
    limit_generations: typeof body.limitGenerations === "boolean" ? body.limitGenerations : null,
    seed: body.seed || null,
    safety_tolerance: body.safetyTolerance || null,
    system_prompt: cleanSystemPrompt(body.systemPrompt) || null,
    enable_web_search: typeof body.enableWebSearch === "boolean" ? body.enableWebSearch : null,
    thinking_level: body.thinkingLevel || null,
    generate_audio: typeof body.generateAudio === "boolean" ? body.generateAudio : null,
    voice: body.voice || null,
    stability: typeof body.stability === "number" ? body.stability : null,
    timestamps: typeof body.timestamps === "boolean" ? body.timestamps : null,
    language_code: cleanLanguageCode(body.languageCode) || null,
    text_normalization: body.textNormalization || null
  };
}

async function submitFalQueue(falKey: string, modelId: string, input: unknown) {
  const response = await fetchFal(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    attempts: 3,
    timeoutMs: 22000,
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw await falApiErrorFromResponse(response);
  }

  return (await response.json()) as {
    request_id: string;
    status: string;
    status_url: string;
    response_url?: string;
  };
}

function falFailureInfoFromError(error: unknown) {
  if (error instanceof FalApiError) return error.info;
  return parseFalFailure({
    detail: error instanceof Error ? error.message : "fal.ai request failed.",
    error_type: "provider_submit_failed"
  });
}

async function waitForFalResponse(falKey: string, submitPayload: { status_url: string; response_url?: string }, timeoutMs: number) {
  const startedAt = Date.now();
  let responseUrl = submitPayload.response_url || null;

  while (Date.now() - startedAt < timeoutMs) {
    if (responseUrl) {
      const response = await fetchFal(responseUrl, {
        attempts: 2,
        timeoutMs: 16000,
        headers: { Authorization: `Key ${falKey}` }
      });
      if (response.ok) return response.json();
    }

    const statusResponse = await fetchFal(submitPayload.status_url, {
      attempts: 2,
      timeoutMs: 12000,
      headers: { Authorization: `Key ${falKey}` }
    });

    if (statusResponse.ok) {
      const statusPayload = (await statusResponse.json()) as Record<string, unknown>;
      const status = typeof statusPayload.status === "string" ? statusPayload.status.toUpperCase() : "";
      if (typeof statusPayload.response_url === "string") {
        responseUrl = statusPayload.response_url;
      }
      if (status === "COMPLETED" && responseUrl) {
        continue;
      }
      if (status === "FAILED" || status === "ERROR") {
        throw new Error(typeof statusPayload.error === "string" ? statusPayload.error : "fal.ai TTS generation failed.");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("ElevenLabs voice generation timed out before Avatar submission.");
}

function pickAudioUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const audio = data.audio;
  if (audio && typeof audio === "object" && typeof (audio as Record<string, unknown>).url === "string") {
    return (audio as Record<string, string>).url;
  }
  return null;
}

function generationTaskId(idempotencyKey: unknown) {
  const raw = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  const key = raw && /^[a-zA-Z0-9_-]{8,80}$/.test(raw) ? raw : randomUUID();
  return `tsk_${key}`;
}

async function findExistingTask(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, taskId: string) {
  const { data, error } = await admin
    .from("generation_tasks")
    .select("id,mode,provider,status,estimated_credits,transport,status_url,response_url,failure_code,failure_reason")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as ExistingTask | null;
}

async function returnExistingTask(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  task: ExistingTask
) {
  const account = await ensureCreditAccount(admin, userId);
  if (task.status === "failed" && task.failure_code === "insufficient_credits") {
    return NextResponse.json(
      { error: task.failure_reason || "Not enough credits.", taskId: task.id, duplicate: true },
      { status: 402 }
    );
  }

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
    transport: task.transport,
    mode: task.mode,
    provider: task.provider,
    estimatedCredits: task.estimated_credits,
    balance: account.balance,
    statusUrl: task.status_url,
    responseUrl: task.response_url,
    failureCode: task.failure_code,
    failureReason: task.failure_reason,
    duplicate: true
  });
}

async function ensureRequestCreditAccount(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  request: Request
) {
  const existingAccount = await getCreditAccount(admin, userId);
  if (existingAccount) return existingAccount;

  const signupClaim = await claimSignupBonusForIp(admin, userId, getRequestIp(request.headers));
  const signupBonusCredits = signupBonusCreditsForCountry(getRequestCountryCode(request.headers));
  return ensureCreditAccount(admin, userId, {
    signupBonusCredits: signupClaim.allowed ? signupBonusCredits : 0,
    signupBonusReferenceId: signupClaim.ipHash
  });
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const body = await request.json();

    if (!isValidBody(body)) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const isAvatarProvider = isAvatarRequest(body);
    const storageMode = storedModeForRequest(body);
    const isPromptlessImageTool = body.mode === "image" && body.provider === "bria-background-remove";
    const prompt = body.prompt.trim() || (isAvatarProvider || isPromptlessImageTool ? "." : "");
    if (!isAvatarProvider && !isPromptlessImageTool && prompt.length < 8) {
      return NextResponse.json({ error: "Prompt must be at least 8 characters." }, { status: 400 });
    }
    if (isAvatarProvider && prompt.length < 2) {
      return NextResponse.json({ error: "AI Avatar needs a short script for ElevenLabs voice generation." }, { status: 400 });
    }
    const avatarScriptSeconds = isAvatarProvider ? estimateAvatarScriptSeconds(prompt) : 0;
    const avatarOutputSeconds = isAvatarProvider ? avatarScriptSeconds + AVATAR_KLING_BUFFER_SECONDS : 0;
    const isDefaultAvatarScript = isAvatarProvider && prompt.trim() === KLING_AVATAR_DEFAULT_SCRIPT;
    if (isAvatarProvider && !isDefaultAvatarScript && avatarOutputSeconds > AVATAR_MAX_SECONDS) {
      return NextResponse.json({ error: `AI Avatar output is about ${avatarOutputSeconds}s including Kling buffer. Please keep it within ${AVATAR_MAX_SECONDS}s.` }, { status: 400 });
    }
    if (isAvatarProvider) {
      body.duration = avatarDurationFromPrompt(prompt);
      body.videoWorkflow = "avatar-video";
      body.ratio = "source";
    }

    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((url) => typeof url === "string" && url.trim()) : [];
    const isDreamfaceIo = body.provider === DREAMFACE_IO_PROVIDER;
    if (isDreamfaceIo && (body.mode !== "video" || !["text-to-video", "image-to-video"].includes(body.videoWorkflow || ""))) {
      return NextResponse.json({ error: "DreamFace IO is only available for text-to-video and image-to-video." }, { status: 400 });
    }
    if (isDreamfaceIo && !["5s", "10s", "15s"].includes(body.duration)) {
      return NextResponse.json({ error: "DreamFace IO supports 5, 10, or 15 second videos." }, { status: 400 });
    }
    const baseEstimatedCredits = isDreamfaceIo
      ? dreamfaceIoCredits(body.duration)
      : await estimateGenerationCreditsWithLivePricing({
          mode: storageMode,
          provider: body.provider,
          imageSize: body.imageSize,
          duration: body.duration,
          hasReferences: imageUrls.length > 0,
          resolution: body.resolution,
          quality: body.quality,
          numImages: body.numImages,
          enableWebSearch: body.enableWebSearch,
          thinkingLevel: body.thinkingLevel,
          generateAudio: body.generateAudio,
          promptText: prompt
        });
    if (body.mode === "image" && body.provider === "nano-banana-edit") {
      if (!imageUrls.length) {
        return NextResponse.json({ error: "Image to Image requires at least one reference image." }, { status: 400 });
      }
    }
    if (body.mode === "image" && body.provider === "topaz-image" && !imageUrls.length) {
      return NextResponse.json({ error: "Enhance & Cleanup requires one image for Topaz upscale." }, { status: 400 });
    }
    if (body.mode === "image" && body.provider === "bria-background-remove" && !imageUrls.length) {
      return NextResponse.json({ error: "Background Remove requires one image." }, { status: 400 });
    }
    if (isAvatarProvider) {
      if (!imageUrls.length) {
        return NextResponse.json({ error: "AI Avatar requires one avatar reference image." }, { status: 400 });
      }
      if (body.audioUrl && !isValidAudioInput(body.audioUrl)) {
        return NextResponse.json({ error: "AI Avatar audio input is invalid." }, { status: 400 });
      }
    }
    const falKey = process.env.FAL_KEY;
    const modelId = isDreamfaceIo ? "dreamface-io" : getModelId(storageMode, body.provider, hasInputImages(body));
    const taskId = generationTaskId(body.idempotencyKey);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server auth storage is not configured." }, { status: 500 });
    }
    const existingTask = await findExistingTask(admin, user.id, taskId);
    if (existingTask) {
      return returnExistingTask(admin, user.id, existingTask);
    }

    if (isDreamfaceIo && (!(await isDreamfaceIoEnabled(admin)) || !isDreamfaceIoConfigured())) {
      return NextResponse.json({ error: "DreamFace IO is currently unavailable." }, { status: 404 });
    }
    if (isDreamfaceIo && body.videoWorkflow === "image-to-video") {
      try {
        const publicImageUrl = await ensureDreamfaceIoPublicImage(admin, user.id, taskId, firstInputImage(body));
        if (!publicImageUrl) {
          return NextResponse.json({ error: "DreamFace IO image-to-video requires one reference image." }, { status: 400 });
        }
        body.imageUrls = [publicImageUrl];
      } catch {
        return NextResponse.json({ error: "DreamFace IO could not prepare this reference image." }, { status: 422 });
      }
    }

    const creditAccount = await ensureRequestCreditAccount(admin, user.id, request);
    let estimatedCredits = baseEstimatedCredits;
    let billingSource: "credits" | "daily_free" = "credits";
    let freeUnitsUsed = 0;
    let dailyUnitsRemaining: number | null = null;

    if (isDreamfaceIo && await isDreamfaceIoDailyEligible(admin, user.id)) {
      const units = dreamfaceIoUnits(body.duration);
      const reservation = await reserveDreamfaceIoDailyUnits(admin, user.id, taskId, units);
      dailyUnitsRemaining = reservation.remainingUnits;
      if (reservation.allowed) {
        estimatedCredits = 0;
        billingSource = "daily_free";
        freeUnitsUsed = units;
      }
    }

    if (creditAccount.balance < estimatedCredits) {
      return NextResponse.json(
        { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${creditAccount.balance}.` },
        { status: 402 }
      );
    }

    const transport = isDreamfaceIo ? "real" : !falKey || !modelId ? "mock" : "real";
    const requestSettings = {
      ...buildRequestSettings(body, modelId),
      billing_source: billingSource,
      free_units_used: freeUnitsUsed
    };
    try {
      const { error: insertError } = await admin.from("generation_tasks").insert({
        id: taskId,
        user_id: user.id,
        mode: storageMode,
        provider: body.provider,
        prompt,
        status: "queued",
        estimated_credits: estimatedCredits,
        transport,
        request_settings: requestSettings
      });
      if (insertError) {
        const existingAfterConflict = await findExistingTask(admin, user.id, taskId);
        if (existingAfterConflict) {
          return returnExistingTask(admin, user.id, existingAfterConflict);
        }
        throw insertError;
      }
    } catch (insertError) {
      const existingAfterConflict = await findExistingTask(admin, user.id, taskId);
      if (existingAfterConflict) {
        return returnExistingTask(admin, user.id, existingAfterConflict);
      }
      if (billingSource === "daily_free") {
        await refundDreamfaceIoDailyUnits(admin, user.id, taskId).catch(() => null);
      }
      return NextResponse.json(
        {
          error: `Task could not be saved, so credits were not charged: ${
            insertError instanceof Error ? insertError.message : "Task history insert failed."
          }`
        },
        { status: 500 }
      );
    }

    const spendResult = estimatedCredits > 0
      ? await spendCredits(admin, user.id, estimatedCredits, "generation_task", taskId)
      : { ok: true as const, balance: creditAccount.balance };
    if (!spendResult.ok) {
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "insufficient_credits",
          failure_reason: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.`,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);
      return NextResponse.json(
        { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.` },
        { status: 402 }
      );
    }

    if (transport === "mock") {
      return NextResponse.json({
        taskId,
        status: "queued",
        transport: "mock" as const,
        mode: storageMode,
        provider: body.provider,
        estimatedCredits,
        balance: spendResult.balance,
        billingSource,
        freeUnitsUsed,
        dailyUnitsRemaining
      });
    }
    if (!isDreamfaceIo && (!falKey || !modelId)) {
      throw new Error("fal.ai model configuration is missing.");
    }

    let ttsStep:
      | {
          provider: string;
          model_id: string;
          request_id: string;
          status_url: string;
          response_url: string | null;
          audio_url: string;
          voice: string;
          stability: number;
          language_code: string | null;
          text_normalization: string;
          estimated_seconds: number;
          estimated_avatar_seconds: number;
        }
      | null = null;
    let submitPayload: {
      request_id: string;
      status: string;
      status_url: string;
      response_url?: string;
    } | null = null;
    try {
      if (isDreamfaceIo) {
        const dreamfaceSubmit = await submitDreamfaceIoVideo({
          prompt,
          imageUrl: firstInputImage(body),
          ratio: body.ratio,
          resolution: "720p",
          duration: body.duration,
          seed: optionalSeed(body.seed)
        });
        submitPayload = {
          request_id: dreamfaceSubmit.requestId,
          status: dreamfaceSubmit.status,
          status_url: dreamfaceSubmit.statusUrl
        };
      } else if (isAvatarProvider && !body.audioUrl) {
        const ttsModelId = getModelId("audio", "elevenlabs-tts") || "fal-ai/elevenlabs/tts/eleven-v3";
        const ttsInput = buildTtsInput(body, prompt);
        const ttsSubmitPayload = await submitFalQueue(falKey as string, ttsModelId, ttsInput);
        const ttsResult = await waitForFalResponse(falKey as string, ttsSubmitPayload, 90000);
        const audioUrl = pickAudioUrl(ttsResult);
        if (!audioUrl) {
          throw new Error("ElevenLabs voice generation did not return an audio URL.");
        }
        body.audioUrl = audioUrl;
        ttsStep = {
          provider: "elevenlabs-tts",
          model_id: ttsModelId,
          request_id: ttsSubmitPayload.request_id,
          status_url: ttsSubmitPayload.status_url,
          response_url: ttsSubmitPayload.response_url || null,
          audio_url: audioUrl,
          voice: typeof ttsInput.voice === "string" ? ttsInput.voice : "Rachel",
          stability: typeof ttsInput.stability === "number" ? ttsInput.stability : 0.5,
          language_code: "language_code" in ttsInput && typeof ttsInput.language_code === "string" ? ttsInput.language_code : null,
          text_normalization: typeof ttsInput.apply_text_normalization === "string" ? ttsInput.apply_text_normalization : "auto",
          estimated_seconds: avatarScriptSeconds,
          estimated_avatar_seconds: Math.min(AVATAR_MAX_SECONDS, Math.max(3, avatarOutputSeconds))
        };
        await admin
          .from("generation_tasks")
          .update({
            request_settings: {
              ...requestSettings,
              tts_step: ttsStep
            },
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId)
          .eq("user_id", user.id);
      }
      if (!isDreamfaceIo) {
        submitPayload = await submitFalQueue(falKey as string, modelId as string, buildFalInput(body, prompt));
      }
    } catch (networkError) {
      if (isDreamfaceIo) {
        await refundDreamfaceIoBilling(admin, {
          id: taskId,
          user_id: user.id,
          estimated_credits: estimatedCredits,
          request_settings: requestSettings
        });
        const failureReason = "DreamFace IO could not start this generation. Your generation allowance was returned.";
        await admin
          .from("generation_tasks")
          .update({
            status: "failed",
            failure_code: "provider_submit_failed",
            failure_reason: failureReason,
            raw_result: { message: "DreamFace IO provider submission failed." },
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId)
          .eq("user_id", user.id);
        return NextResponse.json(
          {
            error: failureReason,
            failureCode: "provider_submit_failed",
            refundedCredits: billingSource === "credits" ? estimatedCredits : 0,
            balance: billingSource === "credits" ? creditAccount.balance : spendResult.balance
          },
          { status: 502 }
        );
      }
      const failureInfo = falFailureInfoFromError(networkError);
      const refundedCredits = falRefundCreditsFromCost(failureInfo.costUsd, estimatedCredits);
      const balance =
        refundedCredits > 0
          ? await refundCredits(admin, user.id, refundedCredits, "generation_refund", taskId)
          : spendResult.balance;
      const failedSurface = isAvatarProvider ? "Avatar generation" : "provider generation";
      const failureReason =
        networkError instanceof FalApiError
          ? formatFalFailureReason(failureInfo, estimatedCredits, refundedCredits)
          : `fal.ai error before ${failedSurface} started. ${formatFalFailureReason(failureInfo, estimatedCredits, refundedCredits)}`;
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: failureInfo.code || "provider_submit_failed",
          failure_reason: failureReason,
          raw_result: failureInfo.details,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);
      return NextResponse.json(
        {
          error: failureReason,
          failureCode: failureInfo.code,
          failureReason,
          refundedCredits,
          actualCredits: Math.max(0, estimatedCredits - refundedCredits),
          balance
        },
        { status: networkError instanceof FalApiError && networkError.status < 500 ? 422 : 502 }
      );
    }

    if (!submitPayload) {
      throw new Error("Provider submission did not return tracking information.");
    }

    try {
      const normalizedStatus = submitPayload.status?.toUpperCase() === "IN_PROGRESS" ? "running" : "queued";
      const { error: updateError } = await admin
        .from("generation_tasks")
        .update({
          provider_request_id: submitPayload.request_id,
          status: normalizedStatus,
          status_url: submitPayload.status_url,
          response_url: submitPayload.response_url || null,
          request_settings: ttsStep
            ? {
                ...requestSettings,
                tts_step: ttsStep
              }
            : requestSettings,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (updateError) {
      if (isDreamfaceIo) {
        await refundDreamfaceIoBilling(admin, {
          id: taskId,
          user_id: user.id,
          estimated_credits: estimatedCredits,
          request_settings: requestSettings
        });
      }
      const balance = isDreamfaceIo
        ? spendResult.balance
        : await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
      try {
        await admin
          .from("generation_tasks")
          .update({
            status: "failed",
            failure_code: "local_tracking_failed",
            failure_reason: `Provider accepted the task (${submitPayload.request_id}), but local tracking could not be updated. Credits were refunded automatically.`,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId)
          .eq("user_id", user.id);
      } catch {
        // The original update already failed. The response still carries the provider id for support.
      }
      return NextResponse.json(
        {
          error: `Provider accepted the task but local tracking failed, so credits were refunded. Provider request id: ${submitPayload.request_id}. ${
            updateError instanceof Error ? updateError.message : "Task update failed."
          }`,
          balance
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      taskId,
      status: submitPayload.status?.toLowerCase() || "queued",
      transport: "real" as const,
      mode: storageMode,
      provider: body.provider,
      estimatedCredits,
      balance: spendResult.balance,
      billingSource,
      freeUnitsUsed,
      dailyUnitsRemaining,
      statusUrl: submitPayload.status_url,
      responseUrl: submitPayload.response_url || null,
      providerRequestId: submitPayload.request_id
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `Unable to process generation request: ${error.message}` : "Unable to process generation request."
      },
      { status: 500 }
    );
  }
}

