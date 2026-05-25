export type PricingMode = "image" | "video";

export type GenerationEstimateInput = {
  mode: PricingMode;
  provider: string;
  imageSize?: string | null;
  duration?: string | null;
  hasReferences?: boolean;
  resolution?: string | null;
  falUnitPriceUsd?: number | null;
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
export const CREDIT_MARKUP_MULTIPLIER = 1.12;
export const CREDIT_USD_TO_CREDITS = 150;

const GPT_IMAGE_2_TEXT_HIGH: Record<string, number> = {
  default_4_3: 24,
  landscape_4_3: 24,
  landscape_16_9: 24,
  square_hd: 34,
  square: 12,
  portrait_4_3: 28,
  portrait_16_9: 28
};

const GPT_IMAGE_2_EDIT_HIGH: Record<string, number> = {
  default_4_3: 25,
  landscape_4_3: 25,
  landscape_16_9: 25,
  square_hd: 36,
  square: 14,
  portrait_4_3: 30,
  portrait_16_9: 30
};

const FLUX_SCHNELL_BY_SIZE: Record<string, number> = {
  default_4_3: 6,
  landscape_4_3: 6,
  landscape_16_9: 6,
  square_hd: 6,
  square: 4,
  portrait_4_3: 6,
  portrait_16_9: 6
};

function secondsFromDuration(duration?: string | null) {
  const parsed = Number.parseInt(String(duration || "6s"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
}

function nanoBananaCredits(resolution?: string | null, isPro = false) {
  const base = isPro ? 24 : 14;
  if (resolution === "4K") return base * 2;
  if (resolution === "2K") return Math.ceil(base * 1.5);
  return base;
}

function creditsFromFalUsd(amountUsd: number, minimumCredits: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return minimumCredits;
  return Math.max(minimumCredits, Math.ceil(amountUsd * CREDIT_USD_TO_CREDITS * CREDIT_MARKUP_MULTIPLIER));
}

export function estimateGenerationCredits(input: GenerationEstimateInput) {
  if (input.mode === "image") {
    const imageSize = input.imageSize || "default_4_3";
    const dynamicImagePrice = typeof input.falUnitPriceUsd === "number" ? input.falUnitPriceUsd : null;

    if (input.provider === "chatgpt-image") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, input.hasReferences ? 18 : 16);
      }
      return (input.hasReferences ? GPT_IMAGE_2_EDIT_HIGH : GPT_IMAGE_2_TEXT_HIGH)[imageSize] || 24;
    }

    if (input.provider === "nano-banana-image" || input.provider === "nano-banana-edit") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(input.resolution === "4K" ? dynamicImagePrice * 2 : dynamicImagePrice, 10);
      }
      return nanoBananaCredits(input.resolution);
    }

    if (input.provider === "nano-banana-pro" || input.provider === "nano-banana-pro-edit") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(input.resolution === "4K" ? dynamicImagePrice * 2 : dynamicImagePrice, 18);
      }
      return nanoBananaCredits(input.resolution, true);
    }

    if (input.provider === "flux-image") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, 4);
      }
      return FLUX_SCHNELL_BY_SIZE[imageSize] || 6;
    }

    if (input.provider === "flux-dev") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, 8);
      }
      return 12;
    }

    return 12;
  }

  const seconds = secondsFromDuration(input.duration);
  const dynamicSecondPrice = typeof input.falUnitPriceUsd === "number" ? input.falUnitPriceUsd : null;

  if (input.provider === "seedance-video") {
    if (dynamicSecondPrice) {
      return creditsFromFalUsd(dynamicSecondPrice * seconds, seconds * 35);
    }
    return seconds * 50;
  }

  if (input.provider === "kling-video") {
    if (dynamicSecondPrice) {
      return creditsFromFalUsd(dynamicSecondPrice * seconds, seconds * 16);
    }
    return seconds * 20;
  }

  if (input.provider === "grok-video") {
    return seconds >= 10 ? 68 : seconds >= 8 ? 56 : 42;
  }

  if (input.provider === "veo-video") {
    if (dynamicSecondPrice) {
      return creditsFromFalUsd(dynamicSecondPrice * seconds, seconds * 24);
    }
    return seconds * 32;
  }

  return seconds * 20;
}

export const MODEL_PRICING_ROWS: ModelPricingRow[] = [
  {
    provider: "chatgpt-image",
    label: "GPT Image 2",
    mode: "image",
    workflow: "Text to Image",
    endpointId: "openai/gpt-image-2",
    falBasis: "High quality 1024px output is roughly $0.145-$0.211 depending on canvas.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "chatgpt-image", imageSize: "default_4_3" }),
    unitNote: "24-36 credits"
  },
  {
    provider: "chatgpt-image",
    label: "GPT Image 2 Edit",
    mode: "image",
    workflow: "Image to Image",
    endpointId: "openai/gpt-image-2/edit",
    falBasis: "Editing includes input-image cost; high quality 1024px output is roughly $0.151-$0.219.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "chatgpt-image", imageSize: "default_4_3", hasReferences: true }),
    unitNote: "25-36 credits"
  },
  {
    provider: "nano-banana-image",
    label: "Nano Banana 2",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "fal-ai/nano-banana-2",
    falBasis: "fal lists Nano Banana 2 around $0.08 per image.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-image", resolution: "1K" }),
    unitNote: "14 credits"
  },
  {
    provider: "nano-banana-pro",
    label: "Nano Banana Pro",
    mode: "image",
    workflow: "Text / Image edit",
    endpointId: "fal-ai/nano-banana-pro",
    falBasis: "fal lists Nano Banana Pro around $0.15 per image; 4K is double.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "nano-banana-pro", resolution: "1K" }),
    unitNote: "24 credits"
  },
  {
    provider: "flux-image",
    label: "FLUX Schnell",
    mode: "image",
    workflow: "Fast text draft",
    endpointId: "fal-ai/flux/schnell",
    falBasis: "fal lists FLUX Schnell around $0.003 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-image", imageSize: "landscape_16_9" }),
    unitNote: "4-6 credits"
  },
  {
    provider: "flux-dev",
    label: "FLUX Dev",
    mode: "image",
    workflow: "Higher quality draft",
    endpointId: "fal-ai/flux/dev",
    falBasis: "fal lists FLUX Dev around $0.025 per megapixel.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "flux-dev", imageSize: "landscape_16_9" }),
    unitNote: "12 credits"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/image-to-video",
    falBasis: "fal lists Seedance 2.0 image-to-video around $0.3024 per second.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s" }),
    unitNote: "50 credits/sec"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "fal-ai/kling-video/v3/pro/image-to-video",
    falBasis: "fal lists Kling v3 Pro image-to-video around $0.112 per second without audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "20 credits/sec"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "xai/grok-imagine-video/text-to-video",
    falBasis: "Internal preview pricing for short Grok text-to-video jobs.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s" }),
    unitNote: "42-68 credits"
  }
];
