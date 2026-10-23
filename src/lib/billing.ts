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
export type CreditPaymentProvider = "paypal" | "dodo";

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
      provider: "minimax-h3-max-turbo-video",
      duration: "5s",
      resolution: "480p"
    }),
    seconds: 5,
    resolution: "480p",
    model: "H3 Max Turbo"
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

// Examples follow the same estimator used by Studio and server billing.
// Token-priced examples are allowances; actual prompts and references can vary.
function creditPackExamples(credits: number): CreditPack["examples"] {
  const samples = [
    {label: "GPT Image 2.5 Flare", input: {mode:"image",provider:"chatgpt-image",quality:"low"}, note:"Low quality image allowance; prompt and reference costs vary"},
    {label: "Nano Banana 2.1", input: {mode:"image",provider:"nano-banana-image",resolution:"1K"}, note:"1K image allowance; token costs vary"},
    {label: "Nano Banana Pro", input: {mode:"image",provider:"nano-banana-pro",resolution:"1K"}, note:"1K images"},
    {label: "FLUX Schnell", input: {mode:"image",provider:"flux-image",imageSize:"landscape_16_9"}, note:"1024 × 576 image drafts"},
    {label: "Topaz Upscale", input: {mode:"image",provider:"topaz-image"}, note:"image enhancement allowance"},
    {label: "Eleven v4 Turbo", input: {mode:"audio",provider:"elevenlabs-tts",promptText:"x".repeat(1000)}, note:"1,000-character voiceovers"},
    {label: "Grok Imagine 1.5 Lite", input: {mode:"video",provider:"grok-video",duration:"6s",resolution:"720p"}, note:"6-second 720p clips without reference surcharge"},
    {label: "Kling v3 Pro", input: {mode:"video",provider:"kling-video",duration:"6s",resolution:"1080p",generateAudio:false}, note:"6-second 1080p clips without audio"},
    {label: "Seedance 2.0", input: {mode:"video",provider:"seedance-video",duration:"6s",resolution:"720p"}, note:"6-second 720p allowance"},
    {label: "Veo 3.1", input: {mode:"video",provider:"veo-video",duration:"4s",resolution:"720p",generateAudio:false}, note:"4-second 720p clips without audio"}
  ] satisfies Array<{label:string;input:Parameters<typeof estimateGenerationCredits>[0];note:string}>;
  return samples.map(sample=>({label:sample.label,count:`up to ${Math.floor(credits / estimateGenerationCredits(sample.input)).toLocaleString("en-US")}`,note:sample.note}));
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 800,
    amountCents: 499,
    description: "A friendly starter balance for testing prompts, polishing images, and creating a few short clips.",
    idealFor: "Great for exploring the studio across image, audio, and light video workflows.",
    examples: creditPackExamples(800)
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 1800,
    amountCents: 999,
    description: "A comfortable working balance for weekly creative batches, variations, and mixed media tests.",
    idealFor: "Best for creators making several visual directions before choosing the final output.",
    examples: creditPackExamples(1800)
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 4800,
    amountCents: 2499,
    description: "The most flexible pack for campaigns, prompt libraries, enhancement passes, and video experiments.",
    idealFor: "Best value when you want room for images, audio, and multiple short video drafts.",
    examples: creditPackExamples(4800)
  },
  {
    id: "pro-topup",
    name: "Pro Pack",
    credits: 11000,
    amountCents: 4999,
    description: "A larger one-time credit pack for high-volume creative work. No subscription required.",
    idealFor: "For teams and creators producing larger batches of images, video, avatars and audio.",
    examples: creditPackExamples(11000)
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

/**
 * A stable, easy-to-understand reference value for credits shown in the studio UI.
 * Uses the Studio one-time pack as a reference, not an extra generation charge.
 */
export function approximateCreditValueUsd(credits: number) {
  const reference = CREDIT_PACKS.find((pack) => pack.id === "studio");
  if (!reference || credits <= 0) return 0;
  return (credits * reference.amountCents) / reference.credits / 100;
}

export function formatApproximateCreditValue(credits: number) {
  const value = approximateCreditValueUsd(credits);
  if (value <= 0) return "$0.00";
  if (value < 0.01) return "<$0.01";
  return `$${value.toFixed(2)}`;
}
