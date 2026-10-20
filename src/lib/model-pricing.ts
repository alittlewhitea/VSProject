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
  unitNote: string;
};

export const CREDIT_LOW_BALANCE_THRESHOLD = 300;
export const CREDIT_MARKUP_MULTIPLIER = 1.65;
export const CREDIT_USD_TO_CREDITS = 150;

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

const FLUX_SCHNELL_BY_SIZE: Record<string, number> = {
  default_4_3: 8,
  landscape_4_3: 8,
  landscape_16_9: 8,
  square_hd: 8,
  square: 5,
  portrait_4_3: 8,
  portrait_16_9: 8
};

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

function nanoBananaCredits(resolution?: string | null, isPro = false) {
  const base = isPro ? 38 : 20;
  if (!isPro && resolution === "0.5K") return Math.ceil(base * 0.75);
  if (resolution === "4K") return base * 2;
  if (resolution === "2K") return Math.ceil(base * 1.5);
  return base;
}

function nanoBananaLiteCredits() {
  return 10;
}

function nanoResolutionMultiplier(resolution?: string | null, isPro = false) {
  if (!isPro && resolution === "0.5K") return 0.75;
  if (resolution === "4K") return 2;
  if (!isPro && resolution === "2K") return 1.5;
  return 1;
}

function normalizedFalUnit(unit?: string | null) {
  return unit?.trim().toLowerCase() || null;
}

function isFalUnit(unit: string | null, ...values: string[]) {
  return Boolean(unit && values.includes(unit));
}

function nanoFeatureCredits(input: Pick<GenerationEstimateInput, "enableWebSearch" | "thinkingLevel">) {
  let credits = 0;
  if (input.enableWebSearch) credits += creditsFromFalUsd(0.015, 3);
  if (input.thinkingLevel === "high") credits += creditsFromFalUsd(0.002, 1);
  return credits;
}

export function creditsFromFalUsd(amountUsd: number, minimumCredits: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return minimumCredits;
  return Math.max(minimumCredits, Math.ceil(amountUsd * CREDIT_USD_TO_CREDITS * CREDIT_MARKUP_MULTIPLIER));
}

export function estimateGenerationCredits(input: GenerationEstimateInput) {
  if (input.mode === "image") {
    const imageSize = input.imageSize || "default_4_3";
    const dynamicImagePrice = typeof input.falUnitPriceUsd === "number" ? input.falUnitPriceUsd : null;
    const falUnit = normalizedFalUnit(input.falUnit);
    const multiplier = countMultiplier(input.numImages);

    if (isGptImageProvider(input.provider)) {
      return creditsFromFalUsd(estimateGptImageUsd(input), 2) * multiplier;
    }

    if (input.provider === "nano-banana-image" || input.provider === "nano-banana-edit") {
      // Output-token reserves by resolution; not fixed supplier image prices.
      const outputTokens = input.resolution === "4K" ? 2520 : input.resolution === "2K" ? 1680 : 1120;
      const promptTokens = Math.ceil(new TextEncoder().encode(input.promptText || "").length / 3);
      const references = input.hasReferences ? Math.min(14, Math.max(1, input.referenceCount || 1)) : 0;
      const thinkingTokens = input.thinkingLevel === "high" ? 1024 : input.thinkingLevel === "minimal" ? 0 : 256;
      const costUsd = (outputTokens * 35.294 + promptTokens * 1.764 + references * 1120 * 1.764 + thinkingTokens * 8.823) / 1_000_000;
      return creditsFromFalUsd(costUsd, 4) * multiplier + (input.enableWebSearch ? creditsFromFalUsd(0.015, 3) * multiplier : 0);
    }

    if (input.provider === "nano-banana-pro" || input.provider === "nano-banana-pro-edit") {
      if (dynamicImagePrice && isFalUnit(falUnit, "image", "images")) {
        const costUsd = dynamicImagePrice * nanoResolutionMultiplier(input.resolution, true) * multiplier;
        return creditsFromFalUsd(costUsd, 18 * multiplier) + nanoFeatureCredits(input) * multiplier;
      }
      return (nanoBananaCredits(input.resolution, true) + nanoFeatureCredits(input)) * multiplier;
    }

    if (input.provider === "nano-banana-lite" || input.provider === "nano-banana-2-lite") {
      if (dynamicImagePrice && isFalUnit(falUnit, "image", "images", "generation", "generations")) {
        return creditsFromFalUsd(dynamicImagePrice * multiplier, 5 * multiplier) + nanoFeatureCredits(input) * multiplier;
      }
      return (nanoBananaLiteCredits() + nanoFeatureCredits(input)) * multiplier;
    }

    if (input.provider === "flux-image") {
      if (dynamicImagePrice && isFalUnit(falUnit, "image", "images", "megapixel", "megapixels")) {
        const billedUnits = isFalUnit(falUnit, "megapixel", "megapixels")
          ? IMAGE_MEGAPIXELS_BY_SIZE[imageSize] || 1
          : 1;
        return creditsFromFalUsd(dynamicImagePrice * billedUnits * multiplier, 4 * multiplier);
      }
      return (FLUX_SCHNELL_BY_SIZE[imageSize] || 6) * multiplier;
    }

    if (input.provider === "flux-dev") {
      if (dynamicImagePrice && isFalUnit(falUnit, "image", "images", "megapixel", "megapixels")) {
        const billedUnits = isFalUnit(falUnit, "megapixel", "megapixels")
          ? IMAGE_MEGAPIXELS_BY_SIZE[imageSize] || 1
          : 1;
        return creditsFromFalUsd(dynamicImagePrice * billedUnits * multiplier, 8 * multiplier);
      }
      return 16 * multiplier;
    }

    if (input.provider === "topaz-image") {
      return creditsFromFalUsd(0.08, 12) * multiplier;
    }

    if (input.provider === "bria-background-remove") {
      if (dynamicImagePrice && isFalUnit(falUnit, "image", "images", "generation", "generations")) {
        return creditsFromFalUsd(dynamicImagePrice, 4);
      }
      return creditsFromFalUsd(0.018, 4);
    }

    return 12;
  }

  if (input.mode === "audio") {
    if (input.provider === "minimax-music-2.6") {
      const falUnit = normalizedFalUnit(input.falUnit);
      const audioPrice =
        typeof input.falUnitPriceUsd === "number" && isFalUnit(falUnit, "audio", "audios", "generation", "generations")
          ? input.falUnitPriceUsd
          : 0.15;
      return creditsFromFalUsd(audioPrice, 1);
    }
    if (input.provider === "elevenlabs-tts") {
      const characters = Math.max(1, input.promptText?.trim().length || 1);
      const falUnit = normalizedFalUnit(input.falUnit);
      const unitPrice =
        typeof input.falUnitPriceUsd === "number" && isFalUnit(falUnit, "1000 characters")
          ? input.falUnitPriceUsd
          : 0.04;
      return creditsFromFalUsd((characters / 1000) * unitPrice, 4);
    }
    return 8;
  }

  const seconds = secondsFromDuration(input.duration);

  if (input.provider === "flux-3-max-video") {
    return creditsFromFalUsd(flux3MaxSecondPrice(input.resolution, input.pricingTime) * flux3MaxDuration(input.duration), 1);
  }

  if (input.provider === "dreamface-io-video") {
    return Math.ceil(seconds / 5) * 10;
  }

  if (input.provider === "minimax-h3-max-turbo-video") {
    // Fixed customer pricing at 480p; other tiers use the documented promotional rates.
    const resolution = input.resolution?.toLowerCase();
    if (resolution !== "768p" && resolution !== "1080p") return Math.ceil(seconds * 3);
    const secondPrice = resolution === "1080p" ? 0.048 : resolution === "768p" ? 0.024 : 0.015;
    return creditsFromFalUsd(seconds * secondPrice, 1);
  }

  if (input.provider === "minimax-h3-max-video") {
    const resolution = input.resolution?.toLowerCase();
    if (resolution === "1080p") return Math.ceil(seconds * 20);
    if (resolution !== "768p") return Math.ceil(seconds * 6);
    return creditsFromFalUsd(seconds * 0.048, 1);
  }

  if (input.provider === "gemini-omni-flash-video") {
    const billableSeconds = Math.min(10, Math.max(3, seconds));
    return billableSeconds * (input.hasReferences ? 37 : 35);
  }

  if (input.provider === "seedance-video") {
    const secondPrice = input.resolution === "4k" ? 1.5552 : input.resolution === "1080p" ? 0.682 : input.resolution === "480p" ? 0.1407 : 0.3034;
    return creditsFromFalUsd(secondPrice * seconds, seconds * 35);
  }

  if (input.provider === "seedance-mini-video") {
    return seconds * (input.resolution === "480p" ? 15 : 32);
  }

  if (input.provider === "happy-horse-video") {
    const is1080p = input.resolution === "1080p";
    const secondPrice = is1080p ? 0.18 : 0.14;
    return creditsFromFalUsd(secondPrice * seconds, seconds * (is1080p ? 45 : 35));
  }

  if (input.provider === "kling-video") {
    return creditsFromFalUsd((input.generateAudio ? 0.168 : 0.112) * seconds, seconds * 16);
  }

  if (input.provider === "kling-avatar-standard") {
    return creditsFromFalUsd(0.0562 * seconds, seconds * 10);
  }

  if (input.provider === "kling-avatar-pro") {
    return creditsFromFalUsd(0.115 * seconds, seconds * 18);
  }

  if (input.provider === "grok-video") {
    // Grok 1.5 Lite: supplier cost only, without the usual markup.
    // Use cents to avoid floating-point overcharging on exact credit boundaries.
    const billableSeconds = seconds <= 15 ? seconds : 5;
    const centsPerSecond = input.resolution === "1080p" ? 14 : input.resolution === "720p" ? 3 : 2;
    const inputCents = input.hasReferences ? 1 : 0;
    return Math.ceil((centsPerSecond * billableSeconds + inputCents) * CREDIT_USD_TO_CREDITS / 100);
  }

  if (input.provider === "veo-video") {
    const baseSecondPrice =
      input.resolution === "4k"
        ? input.generateAudio
          ? 0.6
          : 0.4
        : input.generateAudio
          ? 0.4
          : 0.2;
    return creditsFromFalUsd(baseSecondPrice * seconds, seconds * 24);
  }

  return seconds * 20;
}

export const MODEL_PRICING_ROWS: ModelPricingRow[] = [
  ...["text-to-video", "image-to-video"].map((workflow): ModelPricingRow => ({
    provider: "flux-3-max-video", label: workflow === "text-to-video" ? "FLUX 3 Max" : "FLUX 3 Max I2V",
    mode: "video", workflow: workflow === "text-to-video" ? "Text to Video" : "Image to Video",
    endpointId: `blackforestlabs/flux-3-max/${workflow}`,
    falBasis: "720p: $0.0425/s; 1080p: $0.0725/s during the 75% OFF promotion. Full rates: $0.17/s and $0.29/s.",
    typicalCredits: estimateGenerationCredits({mode:"video",provider:"flux-3-max-video",duration:"5s",resolution:"720p"}),
    unitNote: "5–20 seconds; promotion ends 2026-11-08 00:00 Asia/Shanghai; standard credit conversion"
  })),
  {
    provider: "minimax-h3-max-turbo-video",
    label: "MiniMax H3 Max Turbo",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "minimax/h3-max-turbo/text-to-video",
    falBasis: "Fixed promotional pricing (40% off): $0.015 per output second at 480p, $0.024 at 768p and $0.048 at 1080p. No automatic date-based increase.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-turbo-video", duration: "5s", resolution: "480p" }),
    unitNote: "15 credits / 5 sec at 480p; 30 at 768p; 60 at 1080p"
  },
  {
    provider: "minimax-h3-max-turbo-video",
    label: "MiniMax H3 Max Turbo I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "minimax/h3-max-turbo/image-to-video",
    falBasis: "Fixed promotional pricing (40% off): $0.015 per output second at 480p, $0.024 at 768p and $0.048 at 1080p. No automatic date-based increase.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-turbo-video", duration: "5s", resolution: "480p", hasReferences: true }),
    unitNote: "15 credits / 5 sec at 480p; 30 at 768p; 60 at 1080p"
  },
  {
    provider: "minimax-h3-max-video",
    label: "MiniMax H3 Max",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "minimax/h3-max/text-to-video",
    falBasis: "Fixed promotional pricing (40% off): $0.03 per output second at 480p, $0.048 at 768p and $0.096 at 1080p. No automatic date-based increase.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-video", duration: "5s", resolution: "480p" }),
    unitNote: "30 credits / 5 sec at 480p; 60 at 768p; 100 at 1080p"
  },
  {
    provider: "minimax-h3-max-video",
    label: "MiniMax H3 Max I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "minimax/h3-max/image-to-video",
    falBasis: "Fixed promotional pricing (40% off): $0.03 per output second at 480p, $0.048 at 768p and $0.096 at 1080p. No automatic date-based increase.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "minimax-h3-max-video", duration: "5s", resolution: "480p", hasReferences: true }),
    unitNote: "30 credits / 5 sec at 480p; 60 at 768p; 100 at 1080p"
  },
  {
    provider: "gemini-omni-flash-video",
    label: "Gemini Omni Flash",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "google/gemini-omni-flash",
    falBasis: "fal lists Gemini Omni Flash text-to-video at approximately $0.125 per second for 720p video with audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s" }),
    unitNote: "35 credits / sec with audio"
  },
  {
    provider: "gemini-omni-flash-video",
    label: "Gemini Omni Flash I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "google/gemini-omni-flash/v1.1/image-to-video",
    falBasis: "The supplied Gemini Omni Flash 1.1 documentation lists 720p image-to-video with audio at $0.10 per second.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "gemini-omni-flash-video", duration: "8s", hasReferences: true }),
    unitNote: "37 credits / sec with audio"
  },
  ...["chatgpt-image","gpt-image-2.5-sunburst"].flatMap(provider => [false,true].map(edit => ({
    provider,
    label: (provider === "chatgpt-image" ? "GPT Image 2.5 Flare · Fast" : "GPT Image 2.5 Sunburst · Pro") + (edit ? " Edit" : ""),
    mode: "image" as const,
    workflow: edit ? "Image to Image" : "Text to Image",
    endpointId: gptImageEndpoint(provider,edit),
    falBasis: "Token billed: text input $5/M, image input $8/M, image output $30/M. Size baselines plus estimated prompt/reference allowance; not a fixed supplier quote.",
    typicalCredits: estimateGenerationCredits({mode:"image",provider,imageSize:"default_4_3",quality:"low",hasReferences:edit,referenceCount:edit?1:0}),
    unitNote: "Low default; varies with size, quality, prompt, references and image count"
  }))),
  {
    provider: "nano-banana-image",
    label: "Nano Banana 2.1",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "google/nano-banana-2.1",
    falBasis: "Token billed: text/image input $1.764/M, text/thinking output $8.823/M, image output $35.294/M. Credits are estimates and vary with resolution, prompt, references and reasoning.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-image", resolution: "1K" }),
    unitNote: "Estimated credits vary with tokens and resolution"
  },
  {
    provider: "nano-banana-pro",
    label: "Nano Banana Pro",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "fal-ai/nano-banana-pro",
    falBasis: "fal lists Nano Banana Pro around $0.15 per image; 4K is double.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-pro", resolution: "1K" }),
    unitNote: "38-75 credits / image"
  },
  {
    provider: "nano-banana-lite",
    label: "Nano Banana Lite",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "google/nano-banana-lite",
    falBasis: "fal lists Nano Banana Lite with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-lite" }),
    unitNote: "10+ credits / image"
  },
  {
    provider: "nano-banana-lite",
    label: "Nano Banana Lite Edit",
    mode: "image",
    workflow: "Image to Image",
    endpointId: "google/nano-banana-lite/edit",
    falBasis: "fal lists Nano Banana Lite Edit with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-lite", hasReferences: true }),
    unitNote: "10+ credits / image"
  },
  {
    provider: "nano-banana-2-lite",
    label: "Nano Banana 2 Lite",
    mode: "image",
    workflow: "Text to Image",
    endpointId: "google/nano-banana-2-lite",
    falBasis: "fal lists Nano Banana 2 Lite with token pricing and fixed 1K output; fallback uses a low-cost per-image estimate.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-2-lite" }),
    unitNote: "10+ credits / image"
  },
  {
    provider: "flux-image",
    label: "FLUX Schnell",
    mode: "image",
    workflow: "Fast text draft",
    endpointId: "fal-ai/flux/schnell",
    falBasis: "fal lists FLUX Schnell around $0.003 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-image", imageSize: "landscape_16_9" }),
    unitNote: "4+ credits / image"
  },
  {
    provider: "flux-dev",
    label: "FLUX Dev",
    mode: "image",
    workflow: "Higher quality draft",
    endpointId: "fal-ai/flux/dev",
    falBasis: "fal lists FLUX Dev around $0.025 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-dev", imageSize: "landscape_16_9" }),
    unitNote: "8+ credits / image"
  },
  {
    provider: "topaz-image",
    label: "Topaz Upscale",
    mode: "image",
    workflow: "Image enhance",
    endpointId: "fal-ai/topaz/upscale/image",
    falBasis: "fal lists Topaz upscale at $0.08 for a single image up to 24MP output.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "topaz-image", hasReferences: true }),
    unitNote: "20 credits typical"
  },
  {
    provider: "bria-background-remove",
    label: "Bria Background Remove",
    mode: "image",
    workflow: "Background Remove",
    endpointId: "fal-ai/bria/background/remove",
    falBasis: "fal lists Bria RMBG 2.0 at $0.018 per generation.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "bria-background-remove", hasReferences: true }),
    unitNote: "5 credits"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "bytedance/seedance-2.0/text-to-video",
    falBasis: "fal token billing is about $0.1407/s at 480p, $0.3034/s at 720p, $0.682/s at 1080p, and $1.5552/s at 4k.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s", resolution: "720p" }),
    unitNote: "35-385 credits / sec"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/image-to-video",
    falBasis: "fal token billing is about $0.1407/s at 480p, $0.3034/s at 720p, $0.682/s at 1080p, and $1.5552/s at 4k.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s", resolution: "720p" }),
    unitNote: "35-385 credits / sec"
  },
  {
    provider: "seedance-mini-video",
    label: "Seedance 2.0 Mini",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "bytedance/seedance-2.0/mini/text-to-video",
    falBasis: "fal token billing is about $0.0721/s at 480p and $0.1547/s at 720p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-mini-video", duration: "5s", resolution: "720p" }),
    unitNote: "15 credits/sec at 480p, 32 credits/sec at 720p"
  },
  {
    provider: "seedance-mini-video",
    label: "Seedance 2.0 Mini I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/mini/image-to-video",
    falBasis: "fal token billing is about $0.0721/s at 480p and $0.1547/s at 720p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-mini-video", duration: "5s", resolution: "720p", hasReferences: true }),
    unitNote: "15 credits/sec at 480p, 32 credits/sec at 720p"
  },
  {
    provider: "happy-horse-video",
    label: "Happy Horse 1.1",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "alibaba/happy-horse/v1.1/text-to-video",
    falBasis: "fal lists Happy Horse 1.1 at $0.14/s for 720p and $0.18/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "happy-horse-video", duration: "5s", resolution: "720p" }),
    unitNote: "35 credits/sec at 720p, 45 credits/sec at 1080p"
  },
  {
    provider: "happy-horse-video",
    label: "Happy Horse 1.1 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "alibaba/happy-horse/v1.1/image-to-video",
    falBasis: "fal lists Happy Horse 1.1 image-to-video at $0.14/s for 720p and $0.18/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "happy-horse-video", duration: "5s", resolution: "720p", hasReferences: true }),
    unitNote: "35 credits/sec at 720p, 45 credits/sec at 1080p"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/kling-video/v3/pro/text-to-video",
    falBasis: "fal lists Kling v3 Pro text-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "28-42 credits / sec"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "fal-ai/kling-video/v3/pro/image-to-video",
    falBasis: "fal lists Kling v3 Pro image-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "28-42 credits / sec"
  },
  {
    provider: "kling-avatar-standard",
    label: "Kling AI Avatar v2 Standard",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/standard",
    falBasis: "fal lists Kling AI Avatar v2 Standard at $0.0562/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-standard", duration: "6s", hasReferences: true }),
    unitNote: "14 credits / sec"
  },
  {
    provider: "kling-avatar-pro",
    label: "Kling AI Avatar v2 Pro",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/pro",
    falBasis: "fal lists Kling AI Avatar v2 Pro at $0.115/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-pro", duration: "6s", hasReferences: true }),
    unitNote: "29 credits / sec"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video 1.5 Lite",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "xai/grok-imagine-video/v1.5/lite/text-to-video",
    falBasis: "Grok 1.5 Lite costs $0.02/s at 480p, $0.03/s at 720p and $0.14/s at 1080p; no markup.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s" }),
    unitNote: "480p: 3 / sec; 720p: 4.5 / sec; 1080p: 21 / sec; total rounded up"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video 1.5 Lite I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "xai/grok-imagine-video/v1.5/lite/image-to-video",
    falBasis: "Grok 1.5 Lite costs $0.02/s at 480p, $0.03/s at 720p and $0.14/s at 1080p, plus $0.01 per input image; no markup.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s", hasReferences: true }),
    unitNote: "480p: 3 / sec; 720p: 4.5 / sec; 1080p: 21 / sec; +1.5 per image; total rounded up"
  },
  {
    provider: "minimax-music-2.6",
    label: "MiniMax Music 2.6",
    mode: "audio",
    workflow: "Lyrics to Music",
    endpointId: "fal-ai/minimax-music/v2.6",
    falBasis: "fal lists MiniMax Music 2.6 at $0.15 per generated audio.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: "minimax-music-2.6" }),
    unitNote: "38 credits / track"
  },
  {
    provider: "elevenlabs-tts",
    label: "ElevenLabs Eleven v4 Turbo",
    mode: "audio",
    workflow: "Text to Audio",
    endpointId: "elevenlabs/tts/eleven-v4-turbo",
    falBasis: "fal lists ElevenLabs Eleven v4 Turbo text-to-speech at $0.04 per 1000 characters.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: "elevenlabs-tts", promptText: "x".repeat(1000) }),
    unitNote: "10 credits / 1000 chars"
  },
  {
    provider: "veo-video",
    label: "Veo 3.1",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/veo3.1",
    falBasis: "fal lists Veo 3.1 at $0.20/s without audio or $0.40/s with audio for 720p/1080p; 4k costs more.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "veo-video", duration: "8s" }),
    unitNote: "50-149 credits / sec"
  }
];
