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
  }
];

export function getCreditPack(packId: string) {
  return CREDIT_PACKS.find((pack) => pack.id === packId) || null;
}

export function formatUsd(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}
