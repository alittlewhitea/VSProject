import { isGptImageProvider, gptImageEndpoint, gptImageQuality } from "./gpt-image-models";
import { flux3MaxDuration, flux3MaxSecondPrice } from "./flux3-max";
export type PricingMode = "image" | "video" | "audio";

export type GenerationEstimateInput = {
  mode: PricingMode;
  provider: string;
  imageSize?: string | null;
  duration?: string | null;
  hasReferences?: boolean;
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

// fal published output baselines; portrait/wide variants use conservative nearby sizes.
// Input image reserve is an application estimate, not a fixed fal per-image price.
const GPT_IMAGE_OUTPUT_USD = {
  low: {standard:0.005,square:0.006,wide:0.006},
  medium: {standard:0.037,square:0.053,wide:0.053},
  high: {standard:0.145,square:0.211,wide:0.211}
} as const;
export function estimateGptImageUsd(input: GenerationEstimateInput) {
  const size = input.imageSize || "default_4_3";
  const shape = size === "square" || size === "square_hd" ? "square" : size.includes("16_9") ? "wide" : "standard";
  const output = GPT_IMAGE_OUTPUT_USD[gptImageQuality(input.quality)][shape];
  const references = input.hasReferences ? Math.min(16,Math.max(1,Math.trunc(input.referenceCount || 1))) : 0;
  // Conservative UTF-8 byte/3 token heuristic; real tokenization and image detail vary.
  const promptTokens = Math.ceil(new TextEncoder().encode(input.promptText || "").length / 3);
  return output + references * 0.012 + promptTokens * 5 / 1_000_000;
}

function countMultiplier(numImages?: number | null) {
  const parsed = typeof numImages === "number" ? numImages : 1;
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(4, Math.max(1, Math.trunc(parsed)));
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
  const resolution = input.resolution?.toLowerCase();
  if (input.mode === "audio") return CREDIT_MARKUP_MULTIPLIER;
  if (input.mode === "image") {
    return resolution === "2k" || resolution === "4k" || input.quality === "medium" || input.quality === "high" || input.provider === "topaz-image"
      ? HD_CREDIT_MARKUP_MULTIPLIER : CREDIT_MARKUP_MULTIPLIER;
  }
  const basicDefault = ["minimax-h3-max-video", "minimax-h3-max-turbo-video", "grok-video", "seedance-video", "seedance-mini-video"].includes(input.provider);
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
    return cost * countMultiplier(input.numImages);
  }
  if (input.mode === "audio") {
    if (input.provider === "minimax-music-2.6") return live && isFalUnit(unit, "audio", "audios", "generation", "generations") ? live : 0.15;
    if (input.provider === "elevenlabs-tts") return Math.max(1, input.promptText?.trim().length || 1) / 1000 * (live && isFalUnit(unit, "1000 characters") ? live : 0.04);
    throw new Error("Missing supplier cost estimate for audio provider");
  }
  if (input.provider === "heygen-video") return Math.min(15, Math.max(5, seconds)) * heygenSecondPrice(input.resolution, input.pricingTime);
  if (input.provider === "flux-3-max-video") return flux3MaxSecondPrice(input.resolution, input.pricingTime) * flux3MaxDuration(input.duration);
  if (input.provider === "minimax-h3-max-turbo-video" || input.provider === "minimax-h3-max-video") return seconds * h3SupplierSecondPrice(input);
  if (input.provider === "gemini-omni-flash-video") return Math.min(10, Math.max(3, seconds)) * (input.hasReferences ? 0.10 : 0.125);
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
  const count = input.mode === "image" ? countMultiplier(input.numImages) : 1;
  const unitInput = count > 1 ? { ...input, numImages: 1 } : input;
  return creditsFromFalUsd(estimateGenerationCostUsd(unitInput), 1, generationPricingMultiplier(input)) * count;
}

export const MODEL_PRICING_ROWS: ModelPricingRow[] = [
  ...["text-to-video", "image-to-video"].map((workflow): ModelPricingRow => ({
    referenceDuration: "5s", referenceResolution: "768p",
    provider: "heygen-video", label: workflow === "text-to-video" ? "HeyGen Video" : "HeyGen Video I2V",
    mode: "video", workflow: workflow === "text-to-video" ? "Text to Video" : "Image to Video",
    endpointId: `heygen/heygen-video/${workflow}`,
    falBasis: "480p/768p $0.01/s; 1080p/2k $0.03/s through October 31, 2026; list rates double after the promotion.",
    typicalCredits: estimateGenerationCredits({mode:"video",provider:"heygen-video",duration:"5s",resolution:"768p"}),
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
    label: "Gemini Omni Flash",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "google/gemini-omni-flash",
    falBasis: "fal lists Gemini Omni Flash text-to-video at approximately $0.125 per second for 720p video with audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s" }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  {
    referenceDuration: "8s", referenceResolution: "720p",
    provider: "gemini-omni-flash-video",
    label: "Gemini Omni Flash I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "google/gemini-omni-flash/v1.1/image-to-video",
    falBasis: "The supplied Gemini Omni Flash 1.1 documentation lists 720p image-to-video with audio at $0.10 per second.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s", hasReferences: true }),
    unitNote: "Estimated credits depend on the selected model and settings; check Generate"
  },
  ...["chatgpt-image","gpt-image-2.5-sunburst"].flatMap(provider => [false,true].map(edit => ({
    provider,
    label: (provider === "chatgpt-image" ? "GPT Image 2.5 Flare · Fast" : "GPT Image 2.5 Sunburst · Pro") + (edit ? " Edit" : ""),
    mode: "image" as const,
    workflow: edit ? "Image to Image" : "Text to Image",
    endpointId: gptImageEndpoint(provider,edit),
    falBasis: "Token billed: text input $5/M, image input $8/M, image output $30/M. Size baselines plus estimated prompt/reference allowance; not a fixed supplier quote.",
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
