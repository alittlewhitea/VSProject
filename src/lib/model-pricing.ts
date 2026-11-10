import { isGptImageProvider, gptImageEndpoint, gptImageQuality, gptImageSize } from "./gpt-image-models";
import { flux3MaxDuration, flux3MaxSecondPrice } from "./flux3-max";
import { lowestPaidCreditPriceUsd } from "./credit-pack-prices";
import { MISCHIEF_PROVIDER, MISCHIEF_MODEL, mischiefCostUsd } from "./mischief";
import { GEMINI_TTS_PROVIDER, GEMINI_TTS_MODEL, GEMINI_TTS_RATE_PER_1000, geminiTtsCharacters } from "./gemini-tts";
import { GEMINI_OMNI_TEXT_MODEL, GEMINI_OMNI_IMAGE_MODEL, geminiOmniDuration, geminiOmniResolution, geminiOmniSecondPrice } from "./gemini-omni";
export type PricingMode = "image" | "video" | "audio";

export type GenerationEstimateInput = {
  mode: PricingMode;
  provider: string;
  imageSize?: string | null;
  imageWidth?: number | null; imageHeight?: number | null; outputFormat?: string | null;
  imageReasoningEffort?: string | null; frameCount?: number | null; svgModel?: string | null;
  duration?: string | null;
  hasReferences?: boolean;
  videoWorkflow?: "text-to-video" | "image-to-video" | "reference-to-video";
  referenceCount?: number;
  resolution?: string | null;
  falUnitPriceUsd?: number | null;
  falUnit?: string | null;
  quality?: "low" | "medium" | "high" | string | null;
  numImages?: number | null;
  enableWebSearch?: boolean | null;
  thinkingLevel?: string | null;
  generateAudio?: boolean | null;
  promptText?: string | null;
  pricingTime?: number;
};

export type ModelPricingRow = {
  provider: string;
  label: string;
  mode: PricingMode;
  workflow: string;
  endpointId: string;
  falBasis: string;
  typicalCredits: number;
  referenceDuration?: string;
  referenceResolution?: string;
  unitNote: string;
};

export const CREDIT_LOW_BALANCE_THRESHOLD = 300;
export const CREDIT_MARKUP_MULTIPLIER = 1;
export const HD_CREDIT_MARKUP_MULTIPLIER = 1.2;
export const CREDIT_USD_TO_CREDITS = 150;
// fal model pages checked 2026-10-23: 35% off through October 31.
// Application fallback boundary uses Asia/Shanghai; final provider billing may differ.
export const H3_PROMOTION_END = Date.parse("2026-11-01T00:00:00+08:00");
// The supplier specifies October 31 without a timezone; use the same
// Asia/Shanghai fallback boundary as the existing H3 promotion.
export const HEYGEN_PROMOTION_END = Date.parse("2026-11-01T00:00:00+08:00");
export function heygenSecondPrice(resolution?: string | null, pricingTime = Date.now()) {
  const high = resolution?.toLowerCase() === "1080p" || resolution?.toLowerCase() === "2k";
  return (high ? 0.06 : 0.02) * (pricingTime < HEYGEN_PROMOTION_END ? 0.5 : 1);
}
export function h3SupplierSecondPrice(input: GenerationEstimateInput) {
  const turbo = input.provider === "minimax-h3-max-turbo-video";
  const resolution = input.resolution?.toLowerCase();
  const listRate = resolution === "1080p" ? 0.16 : resolution === "768p" ? 0.08 : 0.05;
  return listRate * (turbo ? 0.5 : 1) * ((input.pricingTime ?? Date.now()) < H3_PROMOTION_END ? 0.65 : 1);
}

export const GPT_IMAGE_TARGET_MARGIN = 0.20;
// Budget assumption, not a verified payment-provider fee schedule.
export const GPT_IMAGE_PAYMENT_FEE_RESERVE = 0.05;

export function gptImageCreditsFromCostUsd(costUsd: number, targetMargin = GPT_IMAGE_TARGET_MARGIN) {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 1;
  if (!Number.isFinite(targetMargin) || targetMargin < 0 || targetMargin + GPT_IMAGE_PAYMENT_FEE_RESERVE >= 1) {
    throw new Error("Invalid GPT image pricing margin");
  }
  const revenuePerCredit = lowestPaidCreditPriceUsd() * (1 - targetMargin - GPT_IMAGE_PAYMENT_FEE_RESERVE);
  return Math.max(1, Math.ceil(costUsd / revenuePerCredit - 1e-9));
}

// OpenAI's image-generation guide calculator, checked 2026-11-06.
// https://developers.openai.com/api/docs/guides/image-generation#calculating-costs
// The short grid uses round-to-even at exact half integers.
export function gptImageOutputTokens(width: number, height: number, quality?: string | null) {
  const tier = gptImageQuality(quality);
  const effective = tier === "auto" ? "max" : tier;
  const grid = {low:16, medium:24, high:48, xhigh:64, max:96}[effective];
  const factor = {low:4.2, medium:3.3, high:1, xhigh:1, max:1}[effective];
  const shortGrid = grid * Math.min(width, height) / Math.max(width, height);
  const floor = Math.floor(shortGrid);
  const rounded = shortGrid - floor === 0.5 ? floor + floor % 2 : Math.round(shortGrid);
  return Math.round(Math.ceil(grid * rounded * (2_000_000 + width * height) / 4_000_000) * factor);
}

// SVG authoring model rates ($/M), plus explicit token budgets below. These
// are estimates, not a claim that every SVG consumes this many tokens.
const GPT_SVG_AUTHORING_RATES: Record<string, {input: number; output: number}> = {
  "gpt-6-astra": {input:10, output:50},
  "gpt-5.6-terra": {input:2, output:12},
  "gpt-5.5": {input:5, output:30},
  "gpt-5.4": {input:2.5, output:15},
  "gpt-6-luna": {input:0.1, output:0.5}
};
export function estimateGptImageUsd(input: GenerationEstimateInput) {
  const resolved = gptImageSize(input.imageSize, input.imageWidth, input.imageHeight);
  // Auto reserves the largest valid square, which costs more than a 4K wide
  // image at the same quality. Never quote auto as the cheapest preset.
  const {width, height} = resolved === "auto" ? {width:2880, height:2880} : resolved;
  const frames=input.outputFormat==="gif"?Math.min(16,Math.max(2,input.frameCount||9)):1;
  // Per-frame GIF budgeting is conservative; actual shared usage may differ.
  const output = gptImageOutputTokens(width, height, input.quality) * 30 / 1_000_000 * frames;
  const references = input.hasReferences ? Math.min(17,Math.max(1,Math.trunc(input.referenceCount || 1))) : 0;
  // UTF-8 byte count budgets uncached prompt tokens. Reference/planning token
  // usage isn't known pre-generation: these reserves need invoice calibration.
  const promptTokens = Math.max(32, new TextEncoder().encode((input.promptText || "").trim()).length);
  const planningTokens=input.imageReasoningEffort==="high"?4096:input.imageReasoningEffort==="medium"?1024:128;
  const svgRate = GPT_SVG_AUTHORING_RATES[input.svgModel || "gpt-6-astra"] || GPT_SVG_AUTHORING_RATES["gpt-6-astra"];
  const svgCost = input.outputFormat === "svg" ? ((promptTokens + 4096) * svgRate.input + 8192 * svgRate.output) / 1_000_000 : 0;
  const cost = output + references * 0.012 + promptTokens * 5 / 1_000_000 + planningTokens * 10 / 1_000_000 + svgCost;
  // fal rounds total cost up to the closest $0.0001.
  return Math.ceil(cost * 10_000 - 1e-9) / 10_000;
}

function countMultiplier(numImages?: number | null, maximum=4) {
  const parsed = typeof numImages === "number" ? numImages : 1;
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(maximum, Math.max(1, Math.trunc(parsed)));
}

const IMAGE_MEGAPIXELS_BY_SIZE: Record<string, number> = {
  default_4_3: (1024 * 768) / 1_000_000,
  landscape_4_3: (1024 * 768) / 1_000_000,
  landscape_16_9: (1024 * 576) / 1_000_000,
  square_hd: (1024 * 1024) / 1_000_000,
  square: (512 * 512) / 1_000_000,
  portrait_4_3: (768 * 1024) / 1_000_000,
  portrait_16_9: (576 * 1024) / 1_000_000
};

function secondsFromDuration(duration?: string | null) {
  const parsed = Number.parseInt(String(duration || "5s"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function normalizedFalUnit(unit?: string | null) {
  return unit?.trim().toLowerCase() || null;
}

function isFalUnit(unit: string | null, ...values: string[]) {
  return Boolean(unit && values.includes(unit));
}

export function creditsFromFalUsd(amountUsd: number, minimumCredits = 1, markup = 1) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return minimumCredits;
  // Round only at the final credit boundary, allowing for floating-point noise.
  return Math.max(minimumCredits, Math.ceil(amountUsd * CREDIT_USD_TO_CREDITS * markup - 1e-9));
}

export function generationPricingMultiplier(input: GenerationEstimateInput) {
  const resolution = input.provider === "gemini-omni-flash-video" ? geminiOmniResolution(input.resolution) : input.resolution?.toLowerCase();
  if (input.mode === "audio") return CREDIT_MARKUP_MULTIPLIER;
  if (input.mode === "image") {
    if(isGptImageProvider(input.provider)) {
      // GPT uses its own revenue-margin policy, without a second HD markup.
      return 1;
    }
    return resolution === "2k" || resolution === "4k" || input.quality === "medium" || input.quality === "high" || input.provider === "topaz-image"
      ? HD_CREDIT_MARKUP_MULTIPLIER : CREDIT_MARKUP_MULTIPLIER;
  }
  const basicDefault = ["heygen-video", "minimax-h3-max-video", "minimax-h3-max-turbo-video", "grok-video", "seedance-video", "seedance-mini-video"].includes(input.provider);
  const effectiveResolution = resolution || (basicDefault ? "480p" : "720p");
  if (input.provider === "kling-avatar-standard") return CREDIT_MARKUP_MULTIPLIER;
  if (input.provider === "kling-avatar-pro") return HD_CREDIT_MARKUP_MULTIPLIER;
  return ["720p", "768p", "1080p", "2k", "4k", "2160p"].includes(effectiveResolution)
    ? HD_CREDIT_MARKUP_MULTIPLIER : CREDIT_MARKUP_MULTIPLIER;
}

// Supplier cost estimates, not a promise of the final provider invoice.
// Token/image reserves and fallback unit rates are deliberately explicit.
export function estimateGenerationCostUsd(input: GenerationEstimateInput): number {
  const unit = normalizedFalUnit(input.falUnit);
  const live = typeof input.falUnitPriceUsd === "number" && Number.isFinite(input.falUnitPriceUsd) && input.falUnitPriceUsd > 0 ? input.falUnitPriceUsd : null;
  const resolution = input.resolution?.toLowerCase();
  const seconds = secondsFromDuration(input.duration);
  if (input.mode === "image") {
    const features = (input.enableWebSearch ? 0.015 : 0) + (input.thinkingLevel === "high" ? 0.002 : 0);
    let cost: number;
    if (isGptImageProvider(input.provider)) cost = estimateGptImageUsd(input);
    else if (["nano-banana-image", "nano-banana-edit"].includes(input.provider)) {
      const outputTokens = resolution === "4k" ? 2520 : resolution === "2k" ? 1680 : 1120;
      const promptTokens = Math.ceil(new TextEncoder().encode(input.promptText || "").length / 3);
      const references = input.hasReferences ? Math.min(14, Math.max(1, input.referenceCount || 1)) : 0;
      const thinkingTokens = input.thinkingLevel === "high" ? 1024 : input.thinkingLevel === "minimal" ? 0 : 256;
      cost = (outputTokens * 35.294 + promptTokens * 1.764 + references * 1120 * 1.764 + thinkingTokens * 8.823) / 1_000_000 + (input.enableWebSearch ? 0.015 : 0);
    } else if (["nano-banana-pro", "nano-banana-pro-edit"].includes(input.provider)) {
      cost = (live && isFalUnit(unit, "image", "images") ? live : 0.15) * (resolution === "4k" ? 2 : 1) + features;
    } else if (["nano-banana-lite", "nano-banana-2-lite"].includes(input.provider)) {
      // Fixed 1K token-priced models: retained fallback cost allowance, not a fixed invoice.
      cost = (live && isFalUnit(unit, "image", "images", "generation", "generations") ? live : 0.04) + features;
    } else if (input.provider === "flux-image" || input.provider === "flux-dev") {
      const megapixels = IMAGE_MEGAPIXELS_BY_SIZE[input.imageSize || "default_4_3"] || 1;
      cost = live && isFalUnit(unit, "image", "images", "megapixel", "megapixels")
        ? live * (isFalUnit(unit, "megapixel", "megapixels") ? megapixels : 1)
        : (input.provider === "flux-image" ? 0.003 : 0.025) * megapixels;
    } else if (input.provider === "topaz-image") cost = 0.08;
    else if (input.provider === "bria-background-remove") cost = live && isFalUnit(unit, "image", "images", "generation", "generations") ? live : 0.018;
    else throw new Error("Missing supplier cost estimate for image provider");
    return cost * countMultiplier(input.numImages,isGptImageProvider(input.provider)?10:4);
  }
  if (input.mode === "audio") {
    if (input.provider === GEMINI_TTS_PROVIDER) return Math.max(1, geminiTtsCharacters(input.promptText?.trim() || "")) / 1000 * (live && isFalUnit(unit, "1000 characters") ? live : GEMINI_TTS_RATE_PER_1000);
    if (input.provider === "minimax-music-2.6") return live && isFalUnit(unit, "audio", "audios", "generation", "generations") ? live : 0.15;
    if (input.provider === "elevenlabs-tts") return Math.max(1, input.promptText?.trim().length || 1) / 1000 * (live && isFalUnit(unit, "1000 characters") ? live : 0.04);
    throw new Error("Missing supplier cost estimate for audio provider");
  }
  if (input.provider === "heygen-video") return Math.min(15, Math.max(5, seconds)) * heygenSecondPrice(input.resolution, input.pricingTime);
  if (input.provider === MISCHIEF_PROVIDER) return mischiefCostUsd(input.duration, input.resolution);
  if (input.provider === "flux-3-max-video") return flux3MaxSecondPrice(input.resolution, input.pricingTime) * flux3MaxDuration(input.duration);
  if (input.provider === "minimax-h3-max-turbo-video" || input.provider === "minimax-h3-max-video") return seconds * h3SupplierSecondPrice(input);
  if (input.provider === "gemini-omni-flash-video") return geminiOmniDuration(input.duration, Boolean(input.hasReferences && (input.referenceCount || 0) > 1)) * geminiOmniSecondPrice(input.resolution);
  if (input.provider === "seedance-video") return seconds * (resolution === "4k" ? 1.5552 : resolution === "1080p" ? 0.682 : resolution === "480p" || !resolution ? 0.1407 : 0.3034);
  if (input.provider === "seedance-mini-video") return seconds * (resolution === "480p" || !resolution ? 0.0721 : 0.1547);
  if (input.provider === "happy-horse-video") return seconds * (resolution === "1080p" ? 0.18 : 0.14);
  if (input.provider === "kling-video") return seconds * (input.generateAudio ? 0.168 : 0.112);
  if (input.provider === "kling-avatar-standard") return seconds * 0.0562;
  if (input.provider === "kling-avatar-pro") return seconds * 0.115;
  if (input.provider === "grok-video") return ((seconds <= 15 ? seconds : 5) * (resolution === "1080p" ? 14 : resolution === "720p" ? 3 : 2) + (input.hasReferences ? 1 : 0)) / 100;
  if (input.provider === "veo-video") return seconds * (resolution === "4k" ? (input.generateAudio ? 0.6 : 0.4) : (input.generateAudio ? 0.4 : 0.2));
  // Legacy channel is disabled before billing; retain historical display compatibility.
  if (input.provider === "dreamface-io-video") return Math.ceil(seconds / 5) * 10 / CREDIT_USD_TO_CREDITS;
  throw new Error("Missing supplier cost estimate for video provider");
}

export function estimateGenerationCredits(input: GenerationEstimateInput) {
  // Each output image is quoted individually; batches do not change per-image pricing.
  const count = input.mode === "image" ? countMultiplier(input.numImages,isGptImageProvider(input.provider)?10:4) : 1;
  const unitInput = count > 1 ? { ...input, numImages: 1 } : input;
  if (input.mode === "image" && isGptImageProvider(input.provider)) {
    return gptImageCreditsFromCostUsd(estimateGenerationCostUsd(unitInput)) * count;
  }
  return creditsFromFalUsd(estimateGenerationCostUsd(unitInput), 1, generationPricingMultiplier(input)) * count;
}

export const MODEL_PRICING_ROWS: ModelPricingRow[] = [
  {
    provider: MISCHIEF_PROVIDER, label: "TBC mischief 1", mode: "video", workflow: "Image to Video",
    endpointId: MISCHIEF_MODEL, referenceDuration: "5s", referenceResolution: "720p",
    falBasis: "480p $0.005/s; 720p $0.01/s. Billed by the requested 3 or 5 seconds, not the extra rendered frame.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: MISCHIEF_PROVIDER, duration: "5s", resolution: "720p", hasReferences: true }),
    unitNote: "Estimated credits depend on resolution and duration; check Generate"
  },
  {
    provider: "heygen-video", label: "HeyGen Video Reference", mode: "video", workflow: "Reference to Video",
    endpointId: "heygen/heygen-video/reference-to-video", referenceDuration: "5s", referenceResolution: "480p",
    falBasis: "480p/768p $0.02/s; 1080p/2k $0.06/s after October 31, 2026.",
    typicalCredits: estimateGenerationCredits({mode:"video",provider:"heygen-video",duration:"5s",resolution:"480p"}),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  ...["text-to-video", "image-to-video"].map((workflow): ModelPricingRow => ({
    referenceDuration: "5s", referenceResolution: "480p",
    provider: "heygen-video", label: workflow === "text-to-video" ? "HeyGen Video" : "HeyGen Video I2V",
    mode: "video", workflow: workflow === "text-to-video" ? "Text to Video" : "Image to Video",
    endpointId: `heygen/heygen-video/${workflow}`,
    falBasis: "480p/768p $0.01/s; 1080p/2k $0.03/s through October 31, 2026; list rates double after the promotion.",
    typicalCredits: estimateGenerationCredits({mode:"video",provider:"heygen-video",duration:"5s",resolution:"480p"}),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  })),
  ...["text-to-video", "image-to-video"].map((workflow): ModelPricingRow => ({
    referenceDuration: "5s", referenceResolution: "720p",
    provider: "flux-3-max-video", label: workflow === "text-to-video" ? "FLUX 3 Max" : "FLUX 3 Max I2V",
    mode: "video", workflow: workflow === "text-to-video" ? "Text to Video" : "Image to Video",
    endpointId: `blackforestlabs/flux-3-max/${workflow}`,
    falBasis: "720p: $0.0425/s; 1080p: $0.0725/s during the 75% OFF promotion. Full rates: $0.17/s and $0.29/s.",
    typicalCredits: estimateGenerationCredits({mode:"video",provider:"flux-3-max-video",duration:"5s",resolution:"720p"}),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  })),
  {
    referenceDuration: "5s", referenceResolution: "480p",
    provider: "minimax-h3-max-turbo-video",
    label: "MiniMax H3 Max Turbo",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "minimax/h3-max-turbo/text-to-video",
    falBasis: "Supplier rates: 480p 0.01625 USD/s, 768p 0.026 USD/s, 1080p 0.052 USD/s through October 31, 2026 (35% off). Fallback then uses list rates 0.025/0.04/0.08 USD/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-turbo-video", duration: "5s", resolution: "480p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "5s", referenceResolution: "480p",
    provider: "minimax-h3-max-turbo-video",
    label: "MiniMax H3 Max Turbo I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "minimax/h3-max-turbo/image-to-video",
    falBasis: "Supplier rates: 480p 0.01625 USD/s, 768p 0.026 USD/s, 1080p 0.052 USD/s through October 31, 2026 (35% off). Fallback then uses list rates 0.025/0.04/0.08 USD/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-turbo-video", duration: "5s", resolution: "480p", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "5s", referenceResolution: "480p",
    provider: "minimax-h3-max-video",
    label: "MiniMax H3 Max",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "minimax/h3-max/text-to-video",
    falBasis: "Supplier rates: 480p 0.0325 USD/s, 768p 0.052 USD/s, 1080p 0.104 USD/s through October 31, 2026 (35% off). Fallback then uses list rates 0.05/0.08/0.16 USD/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-video", duration: "5s", resolution: "480p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "5s", referenceResolution: "480p",
    provider: "minimax-h3-max-video",
    label: "MiniMax H3 Max I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "minimax/h3-max/image-to-video",
    falBasis: "Supplier rates: 480p 0.0325 USD/s, 768p 0.052 USD/s, 1080p 0.104 USD/s through October 31, 2026 (35% off). Fallback then uses list rates 0.05/0.08/0.16 USD/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-video", duration: "5s", resolution: "480p", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "8s", referenceResolution: "720p",
    provider: "gemini-omni-flash-video",
    label: "Gemini Omni Flash 1.2",
    mode: "video",
    workflow: "Text to Video",
    endpointId: GEMINI_OMNI_TEXT_MODEL,
    falBasis: "Gemini Omni Flash 1.2 includes audio: $0.0273/s at 360p, $0.0819/s at 720p, $0.1229/s at 1080p, and $0.2457/s at 4K; 3-15 seconds.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "8s", referenceResolution: "720p",
    provider: "gemini-omni-flash-video",
    label: "Gemini Omni Flash 1.2 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: GEMINI_OMNI_IMAGE_MODEL,
    falBasis: "Gemini Omni Flash 1.2 includes audio and input images: $0.0273/s at 360p, $0.0819/s at 720p, $0.1229/s at 1080p, and $0.2457/s at 4K. End-frame interpolation is capped at 10 seconds.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  ...["chatgpt-image","gpt-image-2.6-sunburst"].flatMap(provider => [false,true].map(edit => ({
    provider,
    label: (provider === "chatgpt-image" ? "GPT Image 2.6 Flare · Fast" : "GPT Image 2.6 Sunburst · Pro") + (edit ? " Edit" : ""),
    mode: "image" as const,
    workflow: edit ? "Image to Image" : "Text to Image",
    endpointId: gptImageEndpoint(provider,edit),
    falBasis: "Token billed: text input $5/M, image input $8/M, image output $30/M. Official output token formula plus estimated input/reasoning/format reserves; not a fixed supplier quote.",
    typicalCredits: estimateGenerationCredits({mode:"image",provider,imageSize:"default_4_3",quality:"low",hasReferences:edit,referenceCount:edit?1:0}),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  }))),
  {
    provider: "nano-banana-image",
    label: "Nano Banana 2.1",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "google/nano-banana-2.1",
    falBasis: "Token billed: text/image input $1.764/M, text/thinking output $8.823/M, image output $35.294/M. Credits are estimates and vary with resolution, prompt, references and reasoning.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-image", resolution: "1K" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "nano-banana-pro",
    label: "Nano Banana Pro",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "fal-ai/nano-banana-pro",
    falBasis: "fal lists Nano Banana Pro around $0.15 per image; 4K is double.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-pro", resolution: "1K" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "nano-banana-lite",
    label: "Nano Banana Lite",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "google/nano-banana-lite",
    falBasis: "fal lists Nano Banana Lite with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-lite" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "nano-banana-lite",
    label: "Nano Banana Lite Edit",
    mode: "image",
    workflow: "Image to Image",
    endpointId: "google/nano-banana-lite/edit",
    falBasis: "fal lists Nano Banana Lite Edit with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-lite", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "nano-banana-2-lite",
    label: "Nano Banana 2 Lite",
    mode: "image",
    workflow: "Text to Image",
    endpointId: "google/nano-banana-2-lite",
    falBasis: "fal lists Nano Banana 2 Lite with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-2-lite" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "flux-image",
    label: "FLUX Schnell",
    mode: "image",
    workflow: "Fast text draft",
    endpointId: "fal-ai/flux/schnell",
    falBasis: "fal lists FLUX Schnell around $0.003 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-image", imageSize: "landscape_16_9" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "flux-dev",
    label: "FLUX Dev",
    mode: "image",
    workflow: "Higher quality draft",
    endpointId: "fal-ai/flux/dev",
    falBasis: "fal lists FLUX Dev around $0.025 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-dev", imageSize: "landscape_16_9" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "topaz-image",
    label: "Topaz Upscale",
    mode: "image",
    workflow: "Image enhance",
    endpointId: "fal-ai/topaz/upscale/image",
    falBasis: "fal lists Topaz upscale at $0.08 for a single image up to 24MP output.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "topaz-image", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "bria-background-remove",
    label: "Bria Background Remove",
    mode: "image",
    workflow: "Background Remove",
    endpointId: "fal-ai/bria/background/remove",
    falBasis: "fal lists Bria RMBG 2.0 at $0.018 per generation.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "bria-background-remove", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "bytedance/seedance-2.0/text-to-video",
    falBasis: "fal token billing is about $0.1407/s at 480p, $0.3034/s at 720p, $0.682/s at 1080p, and $1.5552/s at 4k.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s", resolution: "720p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/image-to-video",
    falBasis: "fal token billing is about $0.1407/s at 480p, $0.3034/s at 720p, $0.682/s at 1080p, and $1.5552/s at 4k.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s", resolution: "720p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "seedance-mini-video",
    label: "Seedance 2.0 Mini",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "bytedance/seedance-2.0/mini/text-to-video",
    falBasis: "fal token billing is about $0.0721/s at 480p and $0.1547/s at 720p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-mini-video", duration: "5s", resolution: "720p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "seedance-mini-video",
    label: "Seedance 2.0 Mini I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/mini/image-to-video",
    falBasis: "fal token billing is about $0.0721/s at 480p and $0.1547/s at 720p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-mini-video", duration: "5s", resolution: "720p", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "happy-horse-video",
    label: "Happy Horse 1.1",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "alibaba/happy-horse/v1.1/text-to-video",
    falBasis: "fal lists Happy Horse 1.1 at $0.14/s for 720p and $0.18/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "happy-horse-video", duration: "5s", resolution: "720p" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "happy-horse-video",
    label: "Happy Horse 1.1 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "alibaba/happy-horse/v1.1/image-to-video",
    falBasis: "fal lists Happy Horse 1.1 image-to-video at $0.14/s for 720p and $0.18/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "happy-horse-video", duration: "5s", resolution: "720p", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/kling-video/v3/pro/text-to-video",
    falBasis: "fal lists Kling v3 Pro text-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "fal-ai/kling-video/v3/pro/image-to-video",
    falBasis: "fal lists Kling v3 Pro image-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "kling-avatar-standard",
    label: "Kling AI Avatar v2 Standard",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/standard",
    falBasis: "fal lists Kling AI Avatar v2 Standard at $0.0562/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-standard", duration: "6s", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "kling-avatar-pro",
    label: "Kling AI Avatar v2 Pro",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/pro",
    falBasis: "fal lists Kling AI Avatar v2 Pro at $0.115/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-pro", duration: "6s", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video 1.5 Lite",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "xai/grok-imagine-video/v1.5/lite/text-to-video",
    falBasis: "Grok 1.5 Lite costs $0.02/s at 480p, $0.03/s at 720p and $0.14/s at 1080p; supplier rate before resolution-based credit conversion.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video 1.5 Lite I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "xai/grok-imagine-video/v1.5/lite/image-to-video",
    falBasis: "Grok 1.5 Lite costs $0.02/s at 480p, $0.03/s at 720p and $0.14/s at 1080p, plus $0.01 per input image; supplier rate before resolution-based credit conversion.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "minimax-music-2.6",
    label: "MiniMax Music 2.6",
    mode: "audio",
    workflow: "Lyrics to Music",
    endpointId: "fal-ai/minimax-music/v2.6",
    falBasis: "fal lists MiniMax Music 2.6 at $0.15 per generated audio.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: "minimax-music-2.6" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: GEMINI_TTS_PROVIDER,
    label: "Gemini 3.8 Flash TTS", mode: "audio", workflow: "Text to Audio",
    endpointId: GEMINI_TTS_MODEL,
    falBasis: "$0.045 per 1000 spoken characters; style instructions and speaker aliases are excluded.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: GEMINI_TTS_PROVIDER, promptText: "x".repeat(1000) }),
    unitNote: "Based on spoken text only; check the quote before generating"
  },
  {
    provider: "elevenlabs-tts",
    label: "ElevenLabs Eleven v4 Turbo",
    mode: "audio",
    workflow: "Text to Audio",
    endpointId: "elevenlabs/tts/eleven-v4-turbo",
    falBasis: "fal lists ElevenLabs Eleven v4 Turbo text-to-speech at $0.04 per 1000 characters.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: "elevenlabs-tts", promptText: "x".repeat(1000) }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    provider: "veo-video",
    label: "Veo 3.1",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/veo3.1",
    falBasis: "fal lists Veo 3.1 at $0.20/s without audio or $0.40/s with audio for 720p/1080p; 4k costs more.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "veo-video", duration: "8s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  }
];
