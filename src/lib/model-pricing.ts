export type PricingMode = "image" | "video" | "audio";

export type GenerationEstimateInput = {
  mode: PricingMode;
  provider: string;
  imageSize?: string | null;
  duration?: string | null;
  hasReferences?: boolean;
  resolution?: string | null;
  falUnitPriceUsd?: number | null;
  quality?: "low" | "medium" | "high" | string | null;
  numImages?: number | null;
  enableWebSearch?: boolean | null;
  thinkingLevel?: string | null;
  generateAudio?: boolean | null;
  promptText?: string | null;
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

const GPT_IMAGE_2_TEXT_HIGH_USD: Record<string, number> = {
  default_4_3: 0.145,
  landscape_4_3: 0.145,
  landscape_16_9: 0.145,
  square_hd: 0.211,
  square: 0.053,
  portrait_4_3: 0.145,
  portrait_16_9: 0.145
};

const GPT_IMAGE_2_TEXT_MEDIUM_USD: Record<string, number> = {
  default_4_3: 0.037,
  landscape_4_3: 0.037,
  landscape_16_9: 0.04,
  square_hd: 0.053,
  square: 0.006,
  portrait_4_3: 0.037,
  portrait_16_9: 0.037
};

const GPT_IMAGE_2_TEXT_LOW_USD: Record<string, number> = {
  default_4_3: 0.005,
  landscape_4_3: 0.005,
  landscape_16_9: 0.005,
  square_hd: 0.006,
  square: 0.003,
  portrait_4_3: 0.005,
  portrait_16_9: 0.005
};

const GPT_IMAGE_2_EDIT_HIGH_USD: Record<string, number> = {
  default_4_3: 0.151,
  landscape_4_3: 0.151,
  landscape_16_9: 0.151,
  square_hd: 0.219,
  square: 0.06,
  portrait_4_3: 0.151,
  portrait_16_9: 0.151
};

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

function nanoFeatureCredits(input: Pick<GenerationEstimateInput, "enableWebSearch" | "thinkingLevel">) {
  let credits = 0;
  if (input.enableWebSearch) credits += creditsFromFalUsd(0.015, 3);
  if (input.thinkingLevel === "high") credits += creditsFromFalUsd(0.002, 1);
  return credits;
}

function creditsFromFalUsd(amountUsd: number, minimumCredits: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return minimumCredits;
  return Math.max(minimumCredits, Math.ceil(amountUsd * CREDIT_USD_TO_CREDITS * CREDIT_MARKUP_MULTIPLIER));
}

function creditTableFromUsd(prices: Record<string, number>, minimumCredits: number) {
  return Object.fromEntries(Object.entries(prices).map(([size, usd]) => [size, creditsFromFalUsd(usd, minimumCredits)])) as Record<string, number>;
}

const GPT_IMAGE_2_TEXT_HIGH = creditTableFromUsd(GPT_IMAGE_2_TEXT_HIGH_USD, 9);
const GPT_IMAGE_2_TEXT_MEDIUM = creditTableFromUsd(GPT_IMAGE_2_TEXT_MEDIUM_USD, 3);
const GPT_IMAGE_2_TEXT_LOW = creditTableFromUsd(GPT_IMAGE_2_TEXT_LOW_USD, 2);
const GPT_IMAGE_2_EDIT_HIGH = creditTableFromUsd(GPT_IMAGE_2_EDIT_HIGH_USD, 10);

export function estimateGenerationCredits(input: GenerationEstimateInput) {
  if (input.mode === "image") {
    const imageSize = input.imageSize || "default_4_3";
    const dynamicImagePrice = typeof input.falUnitPriceUsd === "number" ? input.falUnitPriceUsd : null;
    const multiplier = countMultiplier(input.numImages);

    if (input.provider === "chatgpt-image") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice * multiplier, input.hasReferences ? 18 : 16);
      }
      if (input.hasReferences) {
        return ((GPT_IMAGE_2_EDIT_HIGH[imageSize] || 24) * multiplier);
      }
      const table = input.quality === "low" ? GPT_IMAGE_2_TEXT_LOW : input.quality === "medium" ? GPT_IMAGE_2_TEXT_MEDIUM : GPT_IMAGE_2_TEXT_HIGH;
      return ((table[imageSize] || 24) * multiplier);
    }

    if (input.provider === "nano-banana-image" || input.provider === "nano-banana-edit") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(input.resolution === "4K" ? dynamicImagePrice * 2 : dynamicImagePrice, 10);
      }
      return (nanoBananaCredits(input.resolution) + nanoFeatureCredits(input)) * multiplier;
    }

    if (input.provider === "nano-banana-pro" || input.provider === "nano-banana-pro-edit") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(input.resolution === "4K" ? dynamicImagePrice * 2 : dynamicImagePrice, 18);
      }
      return (nanoBananaCredits(input.resolution, true) + nanoFeatureCredits(input)) * multiplier;
    }

    if (input.provider === "flux-image") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, 4);
      }
      return (FLUX_SCHNELL_BY_SIZE[imageSize] || 6) * multiplier;
    }

    if (input.provider === "flux-dev") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, 8);
      }
      return 16 * multiplier;
    }

    if (input.provider === "topaz-image") {
      return creditsFromFalUsd(0.08, 12) * multiplier;
    }

    if (input.provider === "bria-background-remove") {
      if (dynamicImagePrice) {
        return creditsFromFalUsd(dynamicImagePrice, 4);
      }
      return creditsFromFalUsd(0.01, 4);
    }

    return 12;
  }

  if (input.mode === "audio") {
    if (input.provider === "elevenlabs-tts") {
      const characters = Math.max(1, input.promptText?.trim().length || 1);
      return creditsFromFalUsd((characters / 1000) * 0.1, 4);
    }
    return 8;
  }

  const seconds = secondsFromDuration(input.duration);
  const dynamicSecondPrice = typeof input.falUnitPriceUsd === "number" ? input.falUnitPriceUsd : null;

  if (input.provider === "seedance-video") {
    const secondPrice = input.resolution === "1080p" ? 0.682 : 0.3034;
    return creditsFromFalUsd(secondPrice * seconds, seconds * 35);
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
    const imageInputPrice = input.hasReferences ? 0.002 : 0;
    return creditsFromFalUsd((input.resolution === "480p" ? 0.05 : 0.07) * seconds + imageInputPrice, seconds * 8);
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
  {
    provider: "chatgpt-image",
    label: "GPT Image 2",
    mode: "image",
    workflow: "Text to Image",
    endpointId: "openai/gpt-image-2",
    falBasis: "fal GPT Image 2 high quality table: $0.145 for 1024x768, $0.211 for 1024x1024; token billing is ceiled by fal.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "chatgpt-image", imageSize: "default_4_3" }),
    unitNote: "25-36 credits"
  },
  {
    provider: "chatgpt-image",
    label: "GPT Image 2 Edit",
    mode: "image",
    workflow: "Image to Image",
    endpointId: "openai/gpt-image-2/edit",
    falBasis: "fal GPT Image 2 edit uses token/image-token billing; high quality 1024px output is roughly $0.151-$0.219.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "chatgpt-image", imageSize: "default_4_3", hasReferences: true }),
    unitNote: "26-37 credits"
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
    provider: "topaz-image",
    label: "Topaz Upscale",
    mode: "image",
    workflow: "Image enhance",
    endpointId: "fal-ai/topaz/upscale/image",
    falBasis: "fal lists Topaz upscale at $0.08 for a single image up to 24MP output.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "topaz-image", hasReferences: true }),
    unitNote: "14 credits"
  },
  {
    provider: "bria-background-remove",
    label: "Bria Background Remove",
    mode: "image",
    workflow: "Background Remove",
    endpointId: "fal-ai/bria/background/remove",
    falBasis: "fal Bria RMBG 2.0 removes backgrounds from a single input image and returns a transparent PNG.",
    typicalCredits: estimateGenerationCredits({ mode: "image", provider: "bria-background-remove", hasReferences: true }),
    unitNote: "4 credits"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "bytedance/seedance-2.0/text-to-video",
    falBasis: "fal lists Seedance 2.0 text-to-video at $0.3034/s for 720p and $0.682/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s" }),
    unitNote: "51 credits/sec at 720p"
  },
  {
    provider: "seedance-video",
    label: "Seedance 2.0 I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "bytedance/seedance-2.0/image-to-video",
    falBasis: "fal lists Seedance 2.0 image-to-video at $0.3034/s for 720p and $0.682/s for 1080p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "seedance-video", duration: "6s" }),
    unitNote: "51 credits/sec at 720p"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/kling-video/v3/pro/text-to-video",
    falBasis: "fal lists Kling v3 Pro text-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "19 credits/sec without audio"
  },
  {
    provider: "kling-video",
    label: "Kling v3 Pro I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "fal-ai/kling-video/v3/pro/image-to-video",
    falBasis: "fal lists Kling v3 Pro image-to-video at $0.112/s without audio and $0.168/s with native audio.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-video", duration: "6s" }),
    unitNote: "19 credits/sec without audio"
  },
  {
    provider: "kling-avatar-standard",
    label: "Kling AI Avatar v2 Standard",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/standard",
    falBasis: "fal lists Kling AI Avatar v2 Standard at $0.0562/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-standard", duration: "6s", hasReferences: true }),
    unitNote: "10 credits/sec"
  },
  {
    provider: "kling-avatar-pro",
    label: "Kling AI Avatar v2 Pro",
    mode: "video",
    workflow: "AI Avatar",
    endpointId: "fal-ai/kling-video/ai-avatar/v2/pro",
    falBasis: "fal lists Kling AI Avatar v2 Pro at $0.115/s.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "kling-avatar-pro", duration: "6s", hasReferences: true }),
    unitNote: "19 credits/sec"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "xai/grok-imagine-video/text-to-video",
    falBasis: "fal lists Grok Imagine Video at $0.05/s for 480p and $0.07/s for 720p.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s" }),
    unitNote: "9-12 credits/sec"
  },
  {
    provider: "grok-video",
    label: "Grok Imagine Video I2V",
    mode: "video",
    workflow: "Image to Video",
    endpointId: "xai/grok-imagine-video/image-to-video",
    falBasis: "fal lists Grok Imagine image-to-video at $0.05/s for 480p, $0.07/s for 720p, plus $0.002 for image input.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "grok-video", duration: "6s", hasReferences: true }),
    unitNote: "9-12 credits/sec + image input"
  },
  {
    provider: "elevenlabs-tts",
    label: "ElevenLabs Eleven v3",
    mode: "audio",
    workflow: "Text to Audio",
    endpointId: "fal-ai/elevenlabs/tts/eleven-v3",
    falBasis: "fal lists ElevenLabs Eleven v3 text-to-speech at $0.10 per 1000 characters.",
    typicalCredits: estimateGenerationCredits({ mode: "audio", provider: "elevenlabs-tts", promptText: "A 1000 character voiceover script." }),
    unitNote: "17 credits / 1000 chars"
  },
  {
    provider: "veo-video",
    label: "Veo 3.1",
    mode: "video",
    workflow: "Text to Video",
    endpointId: "fal-ai/veo3.1",
    falBasis: "fal lists Veo 3.1 at $0.20/s without audio or $0.40/s with audio for 720p/1080p; 4k costs more.",
    typicalCredits: estimateGenerationCredits({ mode: "video", provider: "veo-video", duration: "8s" }),
    unitNote: "34-68 credits/sec at 720p"
  }
];
