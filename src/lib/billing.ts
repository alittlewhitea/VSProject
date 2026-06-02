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
  stripePriceEnv: string;
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

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 600,
    amountCents: 499,
    description: "A friendly starter balance for testing prompts, polishing images, and creating a few short clips.",
    idealFor: "Great for exploring the studio across image, audio, and light video workflows.",
    examples: [
      { label: "GPT Image 2", count: "up to 16", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 30", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 15", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 75", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 30", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 24", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 5", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 3", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 1", note: "6-second 720p video clip" },
      { label: "Veo 3.1", count: "up to 3", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 1500,
    amountCents: 999,
    description: "A comfortable working balance for weekly creative batches, variations, and mixed media tests.",
    idealFor: "Best for creators making several visual directions before choosing the final output.",
    examples: [
      { label: "GPT Image 2", count: "up to 41", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 75", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 39", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 187", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 75", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 60", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 14", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 8", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 3", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 7", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 4000,
    amountCents: 2499,
    description: "The most flexible pack for campaigns, prompt libraries, enhancement passes, and video experiments.",
    idealFor: "Best value when you want room for images, audio, and multiple short video drafts.",
    examples: [
      { label: "GPT Image 2", count: "up to 111", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 200", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 105", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 500", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 200", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 160", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 38", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 23", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 8", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 20", note: "4-second 720p video drafts" }
    ]
  },
  {
    id: "pro-topup",
    name: "Pro Top-up",
    credits: 10000,
    amountCents: 4999,
    description: "A larger optional top-up for teams that need extra room beyond their Premium subscription cycle.",
    idealFor: "For occasional high-volume usage when a Premium subscription needs temporary extra capacity.",
    examples: [
      { label: "GPT Image 2", count: "up to 277", note: "high quality 4:3 images" },
      { label: "Nano Banana 2", count: "up to 500", note: "1K image generations or edits" },
      { label: "Nano Banana Pro", count: "up to 263", note: "premium 1K image generations" },
      { label: "FLUX Schnell", count: "up to 1,250", note: "fast image drafts" },
      { label: "Topaz Upscale", count: "up to 500", note: "image enhance jobs" },
      { label: "ElevenLabs", count: "up to 400", note: "1,000-character voiceovers" },
      { label: "Grok Imagine", count: "up to 95", note: "6-second 720p video clips" },
      { label: "Kling v3 Pro", count: "up to 58", note: "6-second video clips" },
      { label: "Seedance 2.0", count: "up to 20", note: "6-second 720p video clips" },
      { label: "Veo 3.1", count: "up to 50", note: "4-second 720p video drafts" }
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
        credits: 650,
        interval: "week",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_LITE_WEEKLY"
      },
      monthly: {
        amountCents: 1299,
        credits: 2000,
        interval: "month",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_LITE_MONTHLY"
      },
      yearly: {
        amountCents: 9900,
        credits: 26000,
        interval: "year",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_LITE_YEARLY",
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
        credits: 1400,
        interval: "week",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_WEEKLY"
      },
      monthly: {
        amountCents: 2499,
        credits: 4500,
        interval: "month",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_MONTHLY"
      },
      yearly: {
        amountCents: 19900,
        credits: 68000,
        interval: "year",
        stripePriceEnv: "STRIPE_PRICE_PREMIUM_YEARLY",
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

export function formatUsd(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}
