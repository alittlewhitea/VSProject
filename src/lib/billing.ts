import { estimateGenerationCredits } from "./model-pricing";

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  amountCents: number;
  description: string;
  idealFor: string;
  examples: Array<{
    label: string;
    count: string;
    note: string;
  }>;
};

export type BillingCycle = "weekly" | "monthly" | "yearly";

export type SubscriptionPlanPrice = {
  amountCents: number;
  credits: number;
  interval: "week" | "month" | "year";
  paypalPlanEnv: string;
  monthlyEquivalentCents?: number;
  savingsText?: string;
};

export type SubscriptionPlan = {
  id: "premium-lite" | "premium";
  name: string;
  badge: string;
  defaultCycle: BillingCycle;
  cta: string;
  bestFor: string;
  description: string;
  highlight?: boolean;
  prices: Record<BillingCycle, SubscriptionPlanPrice>;
  features: string[];
};

export const CREDIT_USAGE_REFERENCE = {
  image: {
    credits: estimateGenerationCredits({
      mode: "image",
      provider: "flux-image",
      imageSize: "landscape_16_9",
      numImages: 1
    })
  },
  video: {
    credits: estimateGenerationCredits({
      mode: "video",
      provider: "dreamface-io-video",
      duration: "5s"
    }),
    seconds: 5
  },
  audio: {
    credits: estimateGenerationCredits({
      mode: "audio",
      provider: "elevenlabs-tts",
      promptText: "x".repeat(1000)
    }),
    characters: 1000
  },
  avatar: {
    credits: estimateGenerationCredits({
      mode: "video",
      provider: "kling-avatar-standard",
      duration: "5s",
      hasReferences: true
    }),
    seconds: 5
  }
} as const;

export function creditUsageCapacity(credits: number) {
  return {
    images: Math.floor(credits / CREDIT_USAGE_REFERENCE.image.credits),
    videos: Math.floor(credits / CREDIT_USAGE_REFERENCE.video.credits),
    voiceovers: Math.floor(credits / CREDIT_USAGE_REFERENCE.audio.credits),
    avatars: Math.floor(credits / CREDIT_USAGE_REFERENCE.avatar.credits)
  };
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 800,
    amountCents: 499,
    description: "A friendly starter balance for testing prompts, polishing images, and creating a few short clips.",
    idealFor: "Great for exploring the studio across image, audio, and light video workflows.",
    examples: [
      { label: "GPT Image 2", count: "up to 21", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 40", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 20", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 100", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 40", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 32", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 7", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 4", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 1", note: "6-second 720p video clip" },
      { label: "Veo 3.1", count: "up to 4", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 1800,
    amountCents: 999,
    description: "A comfortable working balance for weekly creative batches, variations, and mixed media tests.",
    idealFor: "Best for creators making several visual directions before choosing the final output.",
    examples: [
      { label: "GPT Image 2", count: "up to 49", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 90", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 47", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 225", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 90", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 72", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 17", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 10", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 4", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 8", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 4800,
    amountCents: 2499,
    description: "The most flexible pack for campaigns, prompt libraries, enhancement passes, and video experiments.",
    idealFor: "Best value when you want room for images, audio, and multiple short video drafts.",
    examples: [
      { label: "GPT Image 2", count: "up to 133", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 240", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 126", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 600", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 240", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 192", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 46", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 28", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 10", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 24", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "pro-topup",
    name: "Pro Top-up",
    credits: 11000,
    amountCents: 4999,
    description: "A larger optional top-up for teams that need extra room beyond their Premium subscription cycle.",
    idealFor: "For occasional high-volume usage when a Premium subscription needs temporary extra capacity.",
    examples: [
      { label: "GPT Image 2", count: "up to 305", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 550", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 289", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 1,375", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 550", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 440", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 105", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 64", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 22", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 55", note: "4-second video drafts" }
    ]
  }
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "premium-lite",
    name: "Premium Lite",
    badge: "Most Popular",
    defaultCycle: "monthly",
    cta: "Start Premium Lite",
    bestFor: "Casual creators, image generation, image editing, and short AI tests.",
    description: "A flexible membership for creators who want watermark-free output, faster queues, and steady weekly creative room.",
    highlight: true,
    prices: {
      weekly: {
        amountCents: 499,
        credits: 800,
        interval: "week",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_LITE_WEEKLY"
      },
      monthly: {
        amountCents: 1299,
        credits: 2400,
        interval: "month",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_LITE_MONTHLY"
      },
      yearly: {
        amountCents: 9900,
        credits: 18000,
        interval: "year",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_LITE_YEARLY",
        monthlyEquivalentCents: 825,
        savingsText: "Save $56/year"
      }
    },
    features: [
      "Full image generation",
      "Full image editing",
      "Voice generation",
      "Basic video generation",
      "Commercial use",
      "No watermark",
      "Credit refund protection",
      "Faster queue",
      "Prompt history"
    ]
  },
  {
    id: "premium",
    name: "Premium",
    badge: "Best Value",
    defaultCycle: "monthly",
    cta: "Upgrade to Premium",
    bestFor: "Video generation, heavy creators, marketers, agencies, and content teams.",
    description: "More room for premium video, advanced models, and high-volume campaign work without pushing credit packs first.",
    prices: {
      weekly: {
        amountCents: 999,
        credits: 1700,
        interval: "week",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_WEEKLY"
      },
      monthly: {
        amountCents: 2499,
        credits: 4600,
        interval: "month",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_MONTHLY"
      },
      yearly: {
        amountCents: 19900,
        credits: 38000,
        interval: "year",
        paypalPlanEnv: "PAYPAL_PLAN_PREMIUM_YEARLY",
        monthlyEquivalentCents: 1658,
        savingsText: "Save $100/year"
      }
    },
    features: [
      "Everything in Premium Lite",
      "Higher video capacity",
      "Priority generation queue",
      "Advanced AI models",
      "More Kling, Seedance, and Veo tests",
      "Faster processing",
      "Early access features"
    ]
  }
];

export function getCreditPack(packId: string) {
  return CREDIT_PACKS.find((pack) => pack.id === packId) || null;
}

export function getSubscriptionPlan(planId: string) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) || null;
}

export function getSubscriptionPlanPrice(planId: string, cycle: string) {
  const plan = getSubscriptionPlan(planId);
  if (!plan || !["weekly", "monthly", "yearly"].includes(cycle)) return null;
  return {
    plan,
    cycle: cycle as BillingCycle,
    price: plan.prices[cycle as BillingCycle]
  };
}

export function getSubscriptionPlanPriceByAmountCents(amountCents: number) {
  const matches = SUBSCRIPTION_PLANS.flatMap((plan) =>
    Object.entries(plan.prices)
      .filter(([, price]) => price.amountCents === amountCents)
      .map(([cycle, price]) => ({ plan, cycle: cycle as BillingCycle, price }))
  );
  return matches.length === 1 ? matches[0] : null;
}

const SUBSCRIPTION_PLAN_RANK: Record<SubscriptionPlan["id"], number> = {
  "premium-lite": 1,
  premium: 2
};

const SUBSCRIPTION_CYCLE_RANK: Record<BillingCycle, number> = {
  weekly: 1,
  monthly: 2,
  yearly: 3
};

export function isSubscriptionUpgrade(
  currentPlanId: string,
  currentCycle: string,
  targetPlanId: string,
  targetCycle: string
) {
  const current = getSubscriptionPlanPrice(currentPlanId, currentCycle);
  const target = getSubscriptionPlanPrice(targetPlanId, targetCycle);
  if (!current || !target) return false;

  const currentPlanRank = SUBSCRIPTION_PLAN_RANK[current.plan.id];
  const targetPlanRank = SUBSCRIPTION_PLAN_RANK[target.plan.id];
  const currentCycleRank = SUBSCRIPTION_CYCLE_RANK[current.cycle];
  const targetCycleRank = SUBSCRIPTION_CYCLE_RANK[target.cycle];
  return (
    targetPlanRank >= currentPlanRank &&
    targetCycleRank >= currentCycleRank &&
    (targetPlanRank > currentPlanRank || targetCycleRank > currentCycleRank)
  );
}

export function formatUsd(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}
