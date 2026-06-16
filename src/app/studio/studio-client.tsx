"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  creditUsageCapacity,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";
import type { Locale } from "../../i18n/routing";
import { CREDIT_LOW_BALANCE_THRESHOLD, estimateGenerationCredits } from "../../lib/model-pricing";
import { useStudioI18n } from "../../lib/studio-i18n";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";

type TaskStatus = "Queued" | "Running" | "Completed" | "Failed";
type TaskItem = {
  id: string;
  type: "Image" | "Video" | "Audio";
  status: TaskStatus;
  cost: number;
  title?: string | null;
  isFavorite?: boolean;
  provider?: string;
  prompt?: string;
  ratio?: string;
  transport?: "real" | "mock";
  createdAt?: string;
  statusUrl?: string | null;
  responseUrl?: string | null;
  mediaUrl?: string | null;
  updatedAt?: string | null;
  settings?: Record<string, unknown> | null;
  chargedCredits?: number;
  refundedCredits?: number;
  refundStatus?: "refunded" | "not_refunded" | "not_applicable";
  failureReason?: string | null;
};

type StudioMode = "image" | "video" | "audio" | "avatar";

type StudioLoginDraft = {
  createdAt: string;
  autoSubmit: boolean;
  mode: StudioMode;
  provider: string;
  imageWorkflow: ImageWorkflow;
  videoWorkflow?: VideoWorkflow;
  ratio: string;
  imageSize: string;
  referenceImagesText: string;
  referenceImageFiles: string[];
  avatarAudioUrl?: string;
  editResolution: string;
  videoResolution: string;
  generateAudio?: boolean;
  voice?: string;
  stability?: number;
  timestamps?: boolean;
  languageCode?: string;
  textNormalization?: string;
  outputFormat: string;
  duration: string;
  prompt: string;
  imageQuality?: "auto" | "low" | "medium" | "high";
  numImages?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  acceleration?: string;
  limitGenerations?: boolean;
  seed?: string;
  safetyTolerance?: string;
  systemPrompt?: string;
  enableWebSearch?: boolean;
  thinkingLevel?: string;
};

type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
type VideoWorkflow = "avatar-video" | "text-to-video" | "image-to-video";
type StudioWorkflow = ImageWorkflow | VideoWorkflow | "text-to-audio";
type GalleryTemplate = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  model: string;
  category: string;
};

type StudioIconName =
  | "home"
  | "image"
  | "video"
  | "gallery"
  | "projects"
  | "sparkles"
  | "wand"
  | "film"
  | "motion"
  | "cleanup"
  | "audio"
  | "globe"
  | "menu"
  | "x"
  | "chevron-left"
  | "chevron-right";

const SESSION_TASKS_KEY = "nova_session_tasks";
const SESSION_CREDIT_BALANCE_KEY = "nova_session_credit_balance";
const GENERATION_IDEMPOTENCY_KEY_PREFIX = "nova_generation_idempotency";
const STUDIO_LOGIN_DRAFT_KEY = "nova_studio_login_draft";

const HOME_SLIDES: Array<{
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  cta: string;
  href: string;
  gradient: string;
  stats: string[];
}> = [
  {
    eyebrow: "Image studio",
    title: "Make scroll-stopping visuals with",
    accent: "GPT Image 2",
    body: "Readable text, product shots, posters, and campaign concepts.",
    cta: "Start with image",
    href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image",
    gradient: "from-[#bde0fe] via-[#e8f4ff] to-[#d8f7df]",
    stats: ["Ads", "Posters", "Products"]
  },
  {
    eyebrow: "Video studio",
    title: "Turn ideas into short clips with",
    accent: "Kling and Seedance",
    body: "Create motion from text or animate a product, portrait, or scene.",
    cta: "Create a video",
    href: "/studio?mode=video&workflow=image-to-video&duration=5s",
    gradient: "from-[#cfe8ff] via-[#e8e7ff] to-[#f4dcff]",
    stats: ["Text to video", "Image to video", "Social clips"]
  },
  {
    eyebrow: "AI Avatar",
    title: "Create talking presenter videos from",
    accent: "one image",
    body: "Use a face image and a short script to make an avatar video.",
    cta: "Try Avatar",
    href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard",
    gradient: "from-[#ffe1d5] via-[#f5d8e9] to-[#ecc7ff]",
    stats: ["Talking avatar", "Voiceover", "Presenter clips"]
  }
];

const TOOLKIT_APPS: Array<{
  title: string;
  body: string;
  icon: StudioIconName;
  href: string;
  accent: string;
  iconClass: string;
}> = [
  {
    title: "AI Avatar",
    body: "Talking presenter from one image.",
    icon: "video",
    href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard",
    accent: "from-[#dff7ff] via-[#eef2ff] to-[#f7e8ff]",
    iconClass: "text-[#2563eb]"
  },
  {
    title: "Text to Image",
    body: "Ads, posters, products, concepts.",
    icon: "sparkles",
    href: "/studio?mode=image&workflow=text-to-image",
    accent: "from-[#dbeafe] to-[#ecfeff]",
    iconClass: "text-[#0ea5e9]"
  },
  {
    title: "Image to Image",
    body: "Restyle or edit a reference.",
    icon: "wand",
    href: "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image",
    accent: "from-[#fce7f3] to-[#eff6ff]",
    iconClass: "text-[#06b6d4]"
  },
  {
    title: "Text to Video",
    body: "Scene ideas into short clips.",
    icon: "film",
    href: "/studio?mode=video&workflow=text-to-video&duration=5s",
    accent: "from-[#ede9fe] to-[#e0f2fe]",
    iconClass: "text-[#8b5cf6]"
  },
  {
    title: "Image to Video",
    body: "Animate products or portraits.",
    icon: "motion",
    href: "/studio?mode=video&workflow=image-to-video&duration=5s",
    accent: "from-[#dcfce7] to-[#dbeafe]",
    iconClass: "text-[#22c55e]"
  },
  {
    title: "Enhance & Cleanup",
    body: "Upscale and clean images.",
    icon: "cleanup",
    href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image",
    accent: "from-[#fff7ed] to-[#fce7f3]",
    iconClass: "text-[#f97316]"
  },
  {
    title: "Background Remove",
    body: "Transparent PNG cutouts.",
    icon: "cleanup",
    href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove",
    accent: "from-[#ecfeff] to-[#eef2ff]",
    iconClass: "text-[#0891b2]"
  },
  {
    title: "Text to Audio",
    body: "Natural voiceovers from scripts.",
    icon: "audio",
    href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts",
    accent: "from-[#fef9c3] to-[#dcfce7]",
    iconClass: "text-[#10b981]"
  }
];

const STUDIO_BILLING_CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"];

function StudioCreditUsageExamples({
  credits,
  t,
  compact = false
}: {
  credits: number;
  t: (key: string, values?: Record<string, string | number | null | undefined>) => string;
  compact?: boolean;
}) {
  const capacity = creditUsageCapacity(credits);
  const examples = [
    { key: "images", value: capacity.images, label: t("studio.billing.usage.images") },
    { key: "videos", value: capacity.videos, label: t("studio.billing.usage.videos") },
    { key: "voiceovers", value: capacity.voiceovers, label: t("studio.billing.usage.voiceovers") },
    { key: "avatars", value: capacity.avatars, label: t("studio.billing.usage.avatars") }
  ];

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#687386]">
        {t("studio.billing.usage.title")}
      </p>
      <div className={`mt-2 grid grid-cols-2 ${compact ? "gap-1.5" : "gap-2"}`}>
        {examples.map((example) => (
          <div key={example.key} className="rounded-xl border border-black/[0.07] bg-white/85 px-2.5 py-2.5">
            <p className={`${compact ? "text-lg" : "text-xl"} font-black tracking-tight text-[#151922]`}>
              {example.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold leading-4 text-[#667085]">{example.label}</p>
          </div>
        ))}
      </div>
      {!compact ? (
        <p className="mt-2 text-[10px] font-medium leading-4 text-[#7b8492]">{t("studio.billing.usage.note")}</p>
      ) : null}
    </div>
  );
}

const KLING_AVATAR_DEFAULT_SCRIPT =
  "Welcome to Cat Facts, where we explore the fascinating world of our feline friends. Did you know that cats spend 70% of their lives sleeping, which means a three-year-old cat has only been awake for about nine months of its life?";
const KLING_AVATAR_DEFAULT_IMAGE_URL = "https://storage.googleapis.com/falserverless/example_inputs/kling_ai_avatar_input.jpg";
const KLING_AVATAR_PREVIEW_VIDEO_URL = "https://v3.fal.media/files/penguin/ln3x7H1p1jL0Pwo7675NI_output.mp4";

function StudioIcon({ name, className = "h-5 w-5" }: { name: StudioIconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
        <path d="M9.5 20v-5h5v5" />
      </svg>
    );
  }
  if (name === "image") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m7 17 4.2-4.2a1.6 1.6 0 0 1 2.2 0L18 17" />
      </svg>
    );
  }
  if (name === "video" || name === "film") {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="12" height="12" rx="3" />
        <path d="m16 10 4-2.2v8.4L16 14" />
      </svg>
    );
  }
  if (name === "gallery") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="8" height="8" rx="2" />
        <rect x="11" y="11" width="8" height="8" rx="2" />
      </svg>
    );
  }
  if (name === "projects") {
    return (
      <svg {...common}>
        <path d="M4 7.5h6l2 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <path d="M4 7.5V6a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v1.5" />
      </svg>
    );
  }
  if (name === "sparkles") {
    return (
      <svg {...common}>
        <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
        <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
        <path d="m5.5 13 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" />
      </svg>
    );
  }
  if (name === "wand") {
    return (
      <svg {...common}>
        <path d="m4 20 12-12" />
        <path d="m14 6 4 4" />
        <path d="M5 4v3" />
        <path d="M3.5 5.5h3" />
        <path d="M19 15v3" />
        <path d="M17.5 16.5h3" />
      </svg>
    );
  }
  if (name === "motion") {
    return (
      <svg {...common}>
        <path d="M5 6h9a5 5 0 0 1 0 10H8" />
        <path d="m8 12 4 4-4 4" />
        <path d="M4 10h5" />
      </svg>
    );
  }
  if (name === "cleanup") {
    return (
      <svg {...common}>
        <path d="m5 19 10.5-10.5a2.1 2.1 0 0 1 3 3L8 22H5Z" />
        <path d="m13 11 3 3" />
        <path d="M6 5h.01" />
        <path d="M10 3h.01" />
        <path d="M4 9h.01" />
      </svg>
    );
  }
  if (name === "audio") {
    return (
      <svg {...common}>
        <path d="M9 18V5l10-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </svg>
    );
  }
  if (name === "globe") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18" />
        <path d="M12 3a15 15 0 0 0 0 18" />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }
  if (name === "x") {
    return (
      <svg {...common}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d={name === "chevron-left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

const IMAGE_SIZE_PRESETS = [
  { value: "default_4_3", label: "Default 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "square_hd", label: "Square HD", dimensions: "1024 x 1024", width: 1024, height: 1024 },
  { value: "square", label: "Square", dimensions: "512 x 512", width: 512, height: 512 },
  { value: "portrait_4_3", label: "Portrait 3:4", dimensions: "768 x 1024", width: 768, height: 1024 },
  { value: "portrait_16_9", label: "Portrait 9:16", dimensions: "576 x 1024", width: 576, height: 1024 },
  { value: "landscape_4_3", label: "Landscape 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "landscape_16_9", label: "Landscape 16:9", dimensions: "1024 x 576", width: 1024, height: 576 }
];

const DEFAULT_VIDEO_RATIO_OPTIONS = ["16:9", "9:16", "1:1"];
const SEEDANCE_VIDEO_RATIO_OPTIONS = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const KLING_IMAGE_VIDEO_RATIO_OPTIONS = ["source"];
const KLING_TEXT_VIDEO_RATIO_OPTIONS = ["16:9", "9:16", "1:1"];
const VEO_VIDEO_RATIO_OPTIONS = ["16:9", "9:16"];
const GROK_VIDEO_RATIO_OPTIONS = ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"];
const GROK_IMAGE_VIDEO_RATIO_OPTIONS = ["auto", ...GROK_VIDEO_RATIO_OPTIONS];
const GROK_VIDEO_RESOLUTION_OPTIONS = ["720p", "480p"];
const SEEDANCE_VIDEO_RESOLUTION_OPTIONS = ["720p", "1080p", "480p"];
const VEO_VIDEO_RESOLUTION_OPTIONS = ["720p", "1080p", "4k"];
const VIDEO_DURATION_OPTIONS = ["3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s", "11s", "12s", "13s", "14s", "15s"];
const GROK_VIDEO_DURATION_OPTIONS = ["1s", "2s", ...VIDEO_DURATION_OPTIONS];
const VEO_VIDEO_DURATION_OPTIONS = ["4s", "6s", "8s"];
const DREAMFACE_IO_DURATION_OPTIONS = ["5s", "10s", "15s"];
const DEFAULT_VIDEO_DURATION = "5s";
const DEFAULT_VEO_VIDEO_DURATION = "8s";
const NANO_ASPECT_RATIO_OPTIONS = ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"];
const ELEVENLABS_VOICE_META = [
  { name: "Rachel", gender: "female" },
  { name: "Aria", gender: "female" },
  { name: "Roger", gender: "male" },
  { name: "Sarah", gender: "female" },
  { name: "Laura", gender: "female" },
  { name: "Charlie", gender: "male" },
  { name: "George", gender: "male" },
  { name: "Callum", gender: "male" },
  { name: "River", gender: "female" },
  { name: "Liam", gender: "male" },
  { name: "Charlotte", gender: "female" },
  { name: "Alice", gender: "female" },
  { name: "Matilda", gender: "female" },
  { name: "Will", gender: "male" },
  { name: "Jessica", gender: "female" },
  { name: "Eric", gender: "male" },
  { name: "Chris", gender: "male" },
  { name: "Brian", gender: "male" },
  { name: "Daniel", gender: "male" },
  { name: "Lily", gender: "female" },
  { name: "Bill", gender: "male" }
] as const;
const ELEVENLABS_VOICES: string[] = ELEVENLABS_VOICE_META.map((voice) => voice.name);
const ELEVENLABS_VOICE_GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" }
] as const;
const ELEVENLABS_LANGUAGE_OPTIONS = [
  { value: "", label: "Auto language" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" }
];
const TEXT_NORMALIZATION_OPTIONS = [
  { value: "auto", label: "Auto normalize" },
  { value: "on", label: "Normalize on" },
  { value: "off", label: "Normalize off" }
];

const PROVIDER_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    speed: string;
    quality: string;
    bestFor: string;
  }
> = {
  "chatgpt-image": {
    label: "GPT Image 2",
    shortLabel: "GPT Image 2",
    speed: "Balanced",
    quality: "Highest text fidelity",
    bestFor: "Ads, infographics, product visuals, readable typography"
  },
  "nano-banana-image": {
    label: "Nano Banana 2",
    shortLabel: "Nano Banana 2",
    speed: "Fast",
    quality: "Strong editing",
    bestFor: "Reference edits, character/product continuity, image remixing"
  },
  "nano-banana-pro": {
    label: "Nano Banana Pro",
    shortLabel: "Banana Pro",
    speed: "Balanced",
    quality: "Premium creative output",
    bestFor: "Higher fidelity campaigns, product visuals, and polished prompt-to-image output"
  },
  "flux-image": {
    label: "FLUX Schnell",
    shortLabel: "Schnell",
    speed: "Fastest",
    quality: "Draft",
    bestFor: "Cheap ideation, quick style exploration, prompt drafts"
  },
  "flux-dev": {
    label: "FLUX Dev",
    shortLabel: "Dev",
    speed: "Medium",
    quality: "Better composition",
    bestFor: "Higher quality drafts and refined visual concepts"
  },
  "topaz-image": {
    label: "Topaz Upscale",
    shortLabel: "Topaz",
    speed: "Medium",
    quality: "Enhance",
    bestFor: "Enhance & Cleanup upscaling, clarity, and face enhancement from an uploaded image"
  },
  "bria-background-remove": {
    label: "Bria Background Remove",
    shortLabel: "Bria BG",
    speed: "Fast",
    quality: "Transparent PNG",
    bestFor: "Removing backgrounds from product, portrait, and asset images"
  },
  "seedance-video": {
    label: "Seedance 2.0",
    shortLabel: "Seedance",
    speed: "Medium",
    quality: "Cinematic motion",
    bestFor: "Cinematic text-to-video and image-to-video with native audio"
  },
  "kling-video": {
    label: "Kling v3 Pro",
    shortLabel: "Kling",
    speed: "Medium",
    quality: "Premium motion",
    bestFor: "Premium text-to-video or image-to-video with stronger camera movement"
  },
  "kling-avatar-standard": {
    label: "Kling AI Avatar v2 Standard",
    shortLabel: "Avatar Std",
    speed: "Medium",
    quality: "Avatar video",
    bestFor: "Talking avatar videos from a character image and voiceover audio URL"
  },
  "kling-avatar-pro": {
    label: "Kling AI Avatar v2 Pro",
    shortLabel: "Avatar Pro",
    speed: "Slower",
    quality: "Premium avatar",
    bestFor: "Higher fidelity talking avatar videos for realistic people, characters, animals, and stylized hosts"
  },
  "veo-video": {
    label: "Veo 3.1",
    shortLabel: "Veo 3.1",
    speed: "Slower",
    quality: "Premium",
    bestFor: "High-end prompt-led video with audio, 1080p, and 4k options"
  },
  "grok-video": {
    label: "Grok Imagine Video",
    shortLabel: "Grok",
    speed: "Fast",
    quality: "Expressive",
    bestFor: "Fast text-to-video and image-to-video ideas with 480p/720p output"
  },
  "dreamface-io-video": {
    label: "DreamFace IO",
    shortLabel: "DreamFace IO",
    speed: "Fast",
    quality: "Everyday video",
    bestFor: "Fast daily text-to-video and image-to-video creation with a free daily allowance"
  },
  "elevenlabs-tts": {
    label: "ElevenLabs Eleven v3",
    shortLabel: "Eleven v3",
    speed: "Fast",
    quality: "Voiceover",
    bestFor: "Text-to-speech voiceovers from scripts with ElevenLabs voices"
  }
};

const WORKFLOW_META: Record<
  StudioWorkflow,
  {
    label: string;
    description: string;
    recommendedProvider: string;
    providers: string[];
  }
> = {
  "text-to-image": {
    label: "Text to Image",
    description: "Create a new image from a prompt.",
    recommendedProvider: "chatgpt-image",
    providers: ["chatgpt-image", "nano-banana-pro", "nano-banana-image", "flux-dev", "flux-image"]
  },
  "image-to-image": {
    label: "Image to Image",
    description: "Upload references and edit, restyle, or extend them.",
    recommendedProvider: "nano-banana-image",
    providers: ["nano-banana-image", "chatgpt-image", "nano-banana-pro"]
  },
  "enhance-cleanup": {
    label: "Image Enhance",
    description: "Upscale, sharpen, and clean up an uploaded image.",
    recommendedProvider: "topaz-image",
    providers: ["topaz-image"]
  },
  "background-remove": {
    label: "Background Remove",
    description: "Remove the background from one image.",
    recommendedProvider: "bria-background-remove",
    providers: ["bria-background-remove"]
  },
  "avatar-video": {
    label: "AI Avatar",
    description: "Create a talking avatar video from one image and an audio URL.",
    recommendedProvider: "kling-avatar-standard",
    providers: ["kling-avatar-standard", "kling-avatar-pro"]
  },
  "text-to-video": {
    label: "Text to Video",
    description: "Turn a written scene into a short video.",
    recommendedProvider: "dreamface-io-video",
    providers: ["dreamface-io-video", "grok-video", "kling-video", "seedance-video", "veo-video"]
  },
  "image-to-video": {
    label: "Image to Video",
    description: "Animate a reference image into a short video.",
    recommendedProvider: "dreamface-io-video",
    providers: ["dreamface-io-video", "kling-video", "seedance-video", "grok-video"]
  },
  "text-to-audio": {
    label: "Text to Audio",
    description: "Turn a written script into a voiceover.",
    recommendedProvider: "elevenlabs-tts",
    providers: ["elevenlabs-tts"]
  }
};

const PROMPT_PRESETS = [
  "Anime key visual of a young cyberpunk courier standing on a rainy neon street, reflective puddles, glowing shop signs, dramatic rim light, cinematic composition, highly detailed",
  "Anime fantasy academy courtyard at sunset, two students in elegant uniforms, floating magical books, warm golden light, soft clouds, detailed background, polished illustration",
  "Epic mountain landscape at sunrise, layered mist in the valley, pine forest foreground, warm orange sky, ultra wide cinematic view, realistic photography style",
  "Quiet Japanese garden after rain, stone path, koi pond, red maple leaves, soft diffused light, peaceful atmosphere, high detail, natural color palette",
  "Editorial portrait of a confident creative director in a modern studio, tasteful wardrobe, soft window light, shallow depth of field, premium magazine photography",
  "Full body character portrait of a futuristic explorer, practical sci-fi suit, desert planet background, strong silhouette, cinematic lighting, concept art quality",
  "Modern glass architecture museum beside a calm river, clean geometric facade, late afternoon sun, people for scale, architectural visualization, realistic detail",
  "Brutalist concrete library interior with dramatic skylight, long shadows, warm reading lamps, minimalist furniture, atmospheric architectural photography",
  "Majestic white tiger walking through a snowy pine forest, visible breath, soft falling snow, realistic fur detail, cinematic wildlife photography",
  "Small orange cat astronaut floating inside a cozy spaceship cabin, Earth visible through the window, playful but realistic lighting, charming detailed scene"
];

function scopedSessionKey(key: string, userId: string | null) {
  return userId ? `${key}:${userId}` : null;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function createIdempotencyFingerprint(payload: Record<string, unknown>) {
  return hashString(JSON.stringify(payload));
}

function createRandomIdempotencyKey() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; browser caches should never break the studio.
  }
}

function truncateCacheValue(value: string | null | undefined, maxLength: number) {
  if (!value) return value ?? null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function compactTaskForCache(task: TaskItem): TaskItem {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    cost: task.cost,
    title: truncateCacheValue(task.title, 120),
    isFavorite: task.isFavorite,
    provider: task.provider,
    prompt: truncateCacheValue(task.prompt, 500) || undefined,
    ratio: task.ratio,
    transport: task.transport,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    mediaUrl: truncateCacheValue(task.mediaUrl, 900),
    chargedCredits: task.chargedCredits,
    refundedCredits: task.refundedCredits,
    refundStatus: task.refundStatus,
    failureReason: truncateCacheValue(task.failureReason, 240)
  };
}

function writeSessionTasksCache(key: string, tasks: TaskItem[]) {
  const serialized = JSON.stringify(tasks.slice(0, 12).map(compactTaskForCache));
  if (!safeSetLocalStorage(key, serialized)) {
    safeRemoveLocalStorage(key);
  }
}

function getPersistentIdempotency(userId: string | null, fingerprint: string) {
  if (typeof window === "undefined") {
    return { storageKey: null, idempotencyKey: createRandomIdempotencyKey() };
  }

  const scope = userId || "anonymous";
  const storageKey = `${GENERATION_IDEMPOTENCY_KEY_PREFIX}:${scope}:${fingerprint}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
    return { storageKey, idempotencyKey: existing };
  }

  const idempotencyKey = createRandomIdempotencyKey();
  safeSetLocalStorage(storageKey, idempotencyKey);
  return { storageKey, idempotencyKey };
}

function clearPersistentIdempotency(storageKey: string | null) {
  if (typeof window !== "undefined" && storageKey) {
    safeRemoveLocalStorage(storageKey);
  }
}

function readStudioLoginDraft() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STUDIO_LOGIN_DRAFT_KEY);
    if (!stored) return null;
    const draft = JSON.parse(stored) as StudioLoginDraft;
    if (!draft || typeof draft !== "object" || typeof draft.prompt !== "string") return null;
    return draft;
  } catch {
    return null;
  }
}

function writeStudioLoginDraft(draft: StudioLoginDraft) {
  if (typeof window === "undefined") return true;
  return safeSetLocalStorage(STUDIO_LOGIN_DRAFT_KEY, JSON.stringify(draft));
}

function clearStudioLoginDraft() {
  if (typeof window !== "undefined") {
    safeRemoveLocalStorage(STUDIO_LOGIN_DRAFT_KEY);
  }
}

function readSessionTasks(userId: string | null): TaskItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const key = scopedSessionKey(SESSION_TASKS_KEY, userId);
    if (!key) return [];
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TaskItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 12).map(compactTaskForCache) : [];
  } catch {
    return [];
  }
}

function mergeTasks(remoteTasks: TaskItem[], sessionTasks: TaskItem[]) {
  const seen = new Set<string>();
  return [...sessionTasks, ...remoteTasks].filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

function pickMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") {
    return payload.url;
  }

  const images = payload.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).url === "string") {
      return (first as Record<string, string>).url;
    }
  }

  const image = payload.image;
  if (image && typeof image === "object" && typeof (image as Record<string, unknown>).url === "string") {
    return (image as Record<string, string>).url;
  }

  const video = payload.video;
  if (video && typeof video === "object" && typeof (video as Record<string, unknown>).url === "string") {
    return (video as Record<string, string>).url;
  }

  const videos = payload.videos;
  if (Array.isArray(videos) && videos.length > 0) {
    const first = videos[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).url === "string") {
      return (first as Record<string, string>).url;
    }
  }

  const audio = payload.audio;
  if (audio && typeof audio === "object" && typeof (audio as Record<string, unknown>).url === "string") {
    return (audio as Record<string, string>).url;
  }

  return null;
}

function estimateTaskSeconds(type: "image" | "video" | "audio", provider: string | undefined, duration: string) {
  if (type === "image") {
    if (provider === "topaz-image") return 150;
    if (provider === "flux-image" || provider === "flux-dev") return 120;
    if (provider === "recraft-image") return 75;
    return 90;
  }
  if (type === "audio") return 60;
  if (duration === "10s") return 150;
  if (duration === "8s") return 125;
  return 95;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatTaskDate(value?: string | null) {
  if (!value) return "Just now";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function providerLabel(provider?: string) {
  return provider ? PROVIDER_META[provider]?.label || provider : "Auto routed";
}

function taskTitle(task: TaskItem) {
  if (task.title) return task.title;
  const promptTitle = task.prompt?.trim().split(/\s+/).slice(0, 8).join(" ");
  return promptTitle || `${providerLabel(task.provider)} ${task.type}`;
}

function statusPillClass(status: TaskStatus) {
  if (status === "Completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "Failed") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "Running") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

function studioProjectHref(taskId?: string) {
  return `/studio?view=projects${taskId ? `&taskId=${encodeURIComponent(taskId)}` : ""}`;
}

function regenerateHref(task: TaskItem) {
  const mode = task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video";
  const workflow = task.type === "Image" ? "text-to-image" : task.type === "Audio" ? "text-to-audio" : "text-to-video";
  const params = new URLSearchParams({ mode, workflow });
  if (task.provider) params.set("provider", task.provider);
  if (task.prompt) params.set("prompt", task.prompt);
  return `/studio?${params.toString()}`;
}

function useAsReferenceHref(task: TaskItem) {
  const params = new URLSearchParams({
    mode: task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video",
    workflow: task.type === "Image" ? "image-to-image" : "image-to-video"
  });
  if (task.mediaUrl) params.set("reference", task.mediaUrl);
  if (task.prompt) params.set("prompt", task.prompt);
  return `/studio?${params.toString()}`;
}

function getImageSizePreset(value: string) {
  return IMAGE_SIZE_PRESETS.find((preset) => preset.value === value) || IMAGE_SIZE_PRESETS[0];
}

function ratioFromImageSize(value: string) {
  const preset = getImageSizePreset(value);
  const ratio = preset.width / preset.height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  if (ratio > 1.5) return "16:9";
  if (ratio > 1.2) return "4:3";
  if (ratio < 0.7) return "9:16";
  return "3:4";
}

function defaultPromptForProvider(provider: string) {
  if (provider === "kling-avatar-standard" || provider === "kling-avatar-pro") {
    return KLING_AVATAR_DEFAULT_SCRIPT;
  }
  return "";
}

function defaultPreviewForProvider(provider: string) {
  if (provider === "kling-avatar-standard" || provider === "kling-avatar-pro") return KLING_AVATAR_PREVIEW_VIDEO_URL;
  return null;
}

function isSamplePrompt(value: string) {
  void value;
  return false;
}

function defaultImageSizeForProvider(provider: string) {
  if (provider === "flux-image" || provider === "flux-dev") return "landscape_16_9";
  if (provider === "nano-banana-image" || provider === "nano-banana-pro" || provider === "nano-banana-edit") return "default_4_3";
  return "default_4_3";
}

function isAvatarProvider(provider: string) {
  return provider === "kling-avatar-standard" || provider === "kling-avatar-pro";
}

function stripKlingAvatarDefaultReference(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter((url) => url && url !== KLING_AVATAR_DEFAULT_IMAGE_URL)
    .join("\n");
}

function estimateAvatarScriptSeconds(text: string) {
  if (text.trim() === KLING_AVATAR_DEFAULT_SCRIPT) return AVATAR_MAX_SECONDS - AVATAR_KLING_BUFFER_SECONDS;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  const cjkCount = (cleaned.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latinWords = (cleaned.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
  const nonSpaceCount = cleaned.replace(/\s/g, "").length;
  return Math.max(3, Math.ceil(Math.max(cjkCount / 4.2, latinWords / 2.55, nonSpaceCount / 12)));
}

const AVATAR_MAX_SECONDS = 15;
const AVATAR_KLING_BUFFER_SECONDS = 2;

function avatarDurationFromPrompt(text: string) {
  const speechSeconds = estimateAvatarScriptSeconds(text);
  const outputSeconds = Math.min(AVATAR_MAX_SECONDS, Math.max(3, speechSeconds + AVATAR_KLING_BUFFER_SECONDS));
  return `${outputSeconds}s`;
}

function modeForPricing(mode: StudioMode): "image" | "video" | "audio" {
  return mode === "avatar" ? "video" : mode;
}

function isProbablyUrl(value: string) {
  if (/^data:audio\//i.test(value.trim())) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function audioBufferToWavBlob(buffer: AudioBuffer, frameCount: number) {
  const channels = Math.max(1, Math.min(buffer.numberOfChannels, 2));
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  function writeString(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

async function trimAudioFileToDataUrl(file: File, maxSeconds: number) {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser cannot trim audio before upload. Please use a modern browser or upload a shorter file.");
  }

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration <= maxSeconds + 0.05) {
      return {
        dataUrl: await readFileAsDataUrl(file),
        originalSeconds: decoded.duration,
        outputSeconds: decoded.duration,
        trimmed: false
      };
    }

    const frameCount = Math.max(1, Math.min(decoded.length, Math.floor(maxSeconds * decoded.sampleRate)));
    const wavBlob = audioBufferToWavBlob(decoded, frameCount);
    return {
      dataUrl: await readFileAsDataUrl(wavBlob),
      originalSeconds: decoded.duration,
      outputSeconds: frameCount / decoded.sampleRate,
      trimmed: true
    };
  } finally {
    void context.close();
  }
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

function readAudioDurationFromUrl(url: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const timer = window.setTimeout(() => {
      audio.src = "";
      reject(new Error("Audio length could not be verified."));
    }, 8000);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = audio.duration;
      audio.src = "";
      if (Number.isFinite(duration) && duration > 0) {
        resolve(duration);
      } else {
        reject(new Error("Audio length could not be verified."));
      }
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      audio.src = "";
      reject(new Error("Audio length could not be verified."));
    };
    audio.src = url;
  });
}

function shortInputValue(value: string) {
  if (!value.trim()) return "";
  if (value.startsWith("data:")) return "Uploaded local file";
  return value;
}

function isProviderAllowedForMode(provider: string | null, mode: StudioMode) {
  if (!provider) return false;
  if (mode === "image") return ["chatgpt-image", "nano-banana-image", "nano-banana-pro", "flux-image", "flux-dev", "nano-banana-edit", "recraft-image", "topaz-image", "bria-background-remove"].includes(provider);
  if (mode === "audio") return ["elevenlabs-tts"].includes(provider);
  if (mode === "avatar") return ["kling-avatar-standard", "kling-avatar-pro"].includes(provider);
  return ["dreamface-io-video", "seedance-video", "kling-video", "kling-avatar-standard", "kling-avatar-pro", "veo-video", "grok-video"].includes(provider);
}

function workflowForMode(mode: StudioMode, workflow: string | null): StudioWorkflow {
  if (mode === "audio") return "text-to-audio";
  if (mode === "avatar") return "avatar-video";
  if (mode === "image") {
    if (workflow === "image-to-image" || workflow === "enhance-cleanup" || workflow === "background-remove") return workflow;
    return "text-to-image";
  }
  if (workflow === "avatar-video") return "avatar-video";
  return workflow === "image-to-video" ? "image-to-video" : "text-to-video";
}

function providerForWorkflow(workflow: StudioWorkflow, requestedProvider?: string | null) {
  const meta = WORKFLOW_META[workflow];
  if (requestedProvider && meta.providers.includes(requestedProvider)) return requestedProvider;
  return meta.recommendedProvider;
}

function taskProgress(task: Pick<TaskItem, "status" | "createdAt" | "type" | "provider">, duration: string) {
  if (task.status === "Completed") return 100;
  if (task.status === "Failed") return 100;
  const estimate = estimateTaskSeconds(task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video", task.provider, duration);
  const startedAt = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const base = task.status === "Running" ? 25 : 8;
  return Math.min(94, Math.max(base, Math.round((elapsed / estimate) * 100)));
}

function frontendPollAttempts(mode: "image" | "video" | "audio", provider: string) {
  if (mode === "video" || isAvatarProvider(provider)) return 240;
  return 100;
}

function StudioContent({ initialLocale }: { initialLocale: Locale }) {
  const studioI18n = useStudioI18n(initialLocale);
  const st = studioI18n.t;
  const localizeStudioError = (message: string, status?: number) => {
    const normalized = message.toLowerCase();
    if (normalized.includes("no recognizable elements") || normalized.includes("clearly visible subject") || normalized.includes("clearly visible subject in the reference image")) {
      return st("studio.error.referenceSubjectNotVisible");
    }
    if (status === 401 || normalized.includes("unauthorized") || normalized.includes("access token")) {
      return st("studio.error.sessionExpired");
    }
    if (normalized.includes("not enough credits") || normalized.includes("insufficient_credits")) {
      return st("studio.error.notEnoughCredits");
    }
    if (status === 413 || normalized.includes("file is too large") || normalized.includes("uploaded file is too large")) {
      return st("studio.error.uploadTooLarge");
    }
    if (normalized.includes("cannot trim audio") || normalized.includes("audio file could not be trimmed")) {
      return st("studio.status.audioTrimFailed");
    }
    if (
      status === 422 ||
      normalized.includes("nsfw") ||
      normalized.includes("safety policy") ||
      normalized.includes("content policy") ||
      normalized.includes("moderation")
    ) {
      return st("studio.error.contentRejected");
    }
    if (status && status >= 500) {
      return st("studio.error.providerUnavailable");
    }
    return message;
  };
  const router = useRouter();
  const sp = useSearchParams();
  const mode: StudioMode = sp.get("mode") === "image" ? "image" : sp.get("mode") === "audio" ? "audio" : sp.get("mode") === "avatar" ? "avatar" : "video";
  const view = sp.get("view");
  const isProjectsView = view === "projects";
  const isAppsHome = view === "home" || (!view && !sp.get("mode") && !sp.get("workflow"));
  const providerFromUrl = sp.get("provider");
  const initialWorkflow = workflowForMode(mode, sp.get("workflow"));
  const initialProvider = providerForWorkflow(
    initialWorkflow,
    isProviderAllowedForMode(providerFromUrl, mode)
      ? providerFromUrl === "nano-banana-edit"
        ? "nano-banana-image"
        : providerFromUrl
      : null
  );
  const initialImageWorkflow: ImageWorkflow =
    initialWorkflow === "image-to-image" || initialWorkflow === "enhance-cleanup" || initialWorkflow === "background-remove" ? initialWorkflow : "text-to-image";
  const initialVideoWorkflow: VideoWorkflow =
    initialWorkflow === "avatar-video" || initialWorkflow === "image-to-video" ? initialWorkflow : "text-to-video";
  const initialReferenceUrl = sp.get("reference");
  const [prompt, setPrompt] = useState(() => defaultPromptForProvider(initialProvider));
  const [provider, setProvider] = useState(initialProvider);
  const [imageWorkflow, setImageWorkflow] = useState<ImageWorkflow>(initialImageWorkflow);
  const [videoWorkflow, setVideoWorkflow] = useState<VideoWorkflow>(initialVideoWorkflow);
  const [ratio, setRatio] = useState(mode === "image" ? "1:1" : mode === "avatar" ? "source" : "16:9");
  const [imageSize, setImageSize] = useState("default_4_3");
  const [referenceImagesText, setReferenceImagesText] = useState(() =>
    (mode === "image" || mode === "video" || mode === "avatar") &&
    initialReferenceUrl
      ? initialReferenceUrl
      : isAvatarProvider(initialProvider)
        ? KLING_AVATAR_DEFAULT_IMAGE_URL
      : ""
  );
  const [referenceImageFiles, setReferenceImageFiles] = useState<string[]>([]);
  const [avatarAudioUrl, setAvatarAudioUrl] = useState(sp.get("audioUrl") || "");
  const [avatarAudioTrimSeconds, setAvatarAudioTrimSeconds] = useState<number | null>(null);
  const [editResolution, setEditResolution] = useState("1K");
  const [videoResolution, setVideoResolution] = useState("720p");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("Rachel");
  const [avatarVoiceGender, setAvatarVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [ttsStability, setTtsStability] = useState(0.5);
  const [ttsTimestamps, setTtsTimestamps] = useState(false);
  const [ttsLanguageCode, setTtsLanguageCode] = useState("");
  const [textNormalization, setTextNormalization] = useState("auto");
  const [outputFormat, setOutputFormat] = useState("png");
  const [imageQuality, setImageQuality] = useState<"auto" | "low" | "medium" | "high">("low");
  const [numImages, setNumImages] = useState(1);
  const [guidanceScale, setGuidanceScale] = useState(3.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(4);
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(true);
  const [acceleration, setAcceleration] = useState("none");
  const [limitGenerations, setLimitGenerations] = useState(true);
  const [seed, setSeed] = useState("");
  const [safetyTolerance, setSafetyTolerance] = useState("4");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState("");
  const [duration, setDuration] = useState(mode === "video" || mode === "avatar" ? DEFAULT_VIDEO_DURATION : "single");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "idle">("idle");
  const [taskHistoryNote, setTaskHistoryNote] = useState("");
  const [previewModal, setPreviewModal] = useState<{ url: string; type: "Image" | "Video" } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [dreamfaceIoEnabled, setDreamfaceIoEnabled] = useState<boolean | null>(null);
  const [dreamfaceIoEligible, setDreamfaceIoEligible] = useState(false);
  const [dreamfaceIoRemainingUnits, setDreamfaceIoRemainingUnits] = useState(0);
  const [creditNote, setCreditNote] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loginDraftNonce, setLoginDraftNonce] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [galleryTemplates, setGalleryTemplates] = useState<GalleryTemplate[]>([]);
  const [galleryTemplateNote, setGalleryTemplateNote] = useState("");
  const [homeSlideIndex, setHomeSlideIndex] = useState(0);
  const [mobileStudioMenuOpen, setMobileStudioMenuOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [loadingBillingItem, setLoadingBillingItem] = useState<string | null>(null);
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<Record<string, BillingCycle>>(() =>
    Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan.defaultCycle]))
  );
  const restoredLoginDraftRef = useRef(false);
  const autoSubmitLoginDraftRef = useRef(false);
  const trackedStudioViewRef = useRef("");
  const trackedLoginSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/model-availability", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { models?: { dreamfaceIo?: boolean } }) => {
        setDreamfaceIoEnabled(Boolean(payload.models?.dreamfaceIo));
      })
      .catch(() => setDreamfaceIoEnabled(false));
  }, []);

  useEffect(() => {
    setMobileStudioMenuOpen(false);
  }, [isAppsHome, isProjectsView, mode]);

  useEffect(() => {
    if (!isAppsHome) return;
    const timer = window.setInterval(() => {
      setHomeSlideIndex((index) => (index + 1) % HOME_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [isAppsHome]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      const nextUserId = data.session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (typeof window !== "undefined") {
        if (token) {
          safeSetLocalStorage("nova_access_token", token);
        } else {
          safeRemoveLocalStorage("nova_access_token");
        }
      }
      if (!token) setCreditNote(st("studio.status.signInCredit"));
      if (token && nextUserId && trackedLoginSuccessRef.current !== nextUserId) {
        trackedLoginSuccessRef.current = nextUserId;
        trackEvent("login_success", { surface: "studio", mode, provider }, token);
      }
      setAuthReady(true);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token || null;
      const nextUserId = session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (!nextUserId) {
        setTasks([]);
        setCreditBalance(null);
      }
      if (typeof window !== "undefined") {
        if (token) {
          safeSetLocalStorage("nova_access_token", token);
        } else {
          safeRemoveLocalStorage("nova_access_token");
        }
      }
      if (token && nextUserId && trackedLoginSuccessRef.current !== nextUserId) {
        trackedLoginSuccessRef.current = nextUserId;
        trackEvent("login_success", { surface: "studio", mode, provider }, token);
      }
      setAuthReady(true);
    });
    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const workflow = mode === "image" ? imageWorkflow : mode === "audio" ? "text-to-audio" : mode === "avatar" ? "avatar-video" : videoWorkflow;
    const key = `${mode}:${provider}:${workflow}`;
    if (trackedStudioViewRef.current === key) return;
    trackedStudioViewRef.current = key;
    trackEvent("studio_view", { mode, provider, workflow, signed_in: Boolean(accessToken) }, accessToken);
  }, [accessToken, imageWorkflow, mode, provider, videoWorkflow]);

  useEffect(() => {
    const workflowParam = workflowForMode(mode, sp.get("workflow"));
    const providerParam = sp.get("provider");
    setImageWorkflow(
      mode === "image" && (workflowParam === "image-to-image" || workflowParam === "enhance-cleanup" || workflowParam === "background-remove")
        ? workflowParam
        : "text-to-image"
    );
    setVideoWorkflow(
      mode === "video" && (workflowParam === "image-to-video")
        ? workflowParam
        : mode === "avatar"
          ? "avatar-video"
          : "text-to-video"
    );
    const nextProvider = providerForWorkflow(
      workflowParam,
      isProviderAllowedForMode(providerParam, mode) ? providerParam : null
    );
    setProvider(nextProvider === "nano-banana-edit" ? "nano-banana-image" : nextProvider);
    const nextImageSize = mode === "image" ? defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? (nextProvider === "topaz-image" ? "auto" : ratioFromImageSize(nextImageSize)) : mode === "avatar" ? "source" : "16:9");
    setImageSize(nextImageSize);
    setDuration(mode === "video" || mode === "avatar" ? DEFAULT_VIDEO_DURATION : "single");
    setStatusText("");
    setStatusTone("idle");
  }, [mode, sp]);

  useEffect(() => {
    if (mode !== "image") return;
    const nextImageSize = defaultImageSizeForProvider(provider);
    setImageSize(nextImageSize);
    setRatio(provider === "topaz-image" ? "auto" : ratioFromImageSize(nextImageSize));
    if (provider === "flux-image") {
      setNumInferenceSteps(4);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "flux-dev") {
      setNumInferenceSteps(28);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "nano-banana-pro") {
      setEditResolution((current) => (current === "0.5K" ? "1K" : current));
    }
  }, [mode, provider]);

  useEffect(() => {
    const promptParam = sp.get("prompt");
    if (promptParam) {
      setPrompt(promptParam);
    }

    const providerParam = sp.get("provider");
    if (isProviderAllowedForMode(providerParam, mode)) {
      setProvider(providerParam === "nano-banana-edit" ? "nano-banana-image" : (providerParam as string));
    }

    const ratioParam = sp.get("ratio");
    if (ratioParam && [...SEEDANCE_VIDEO_RATIO_OPTIONS, ...GROK_IMAGE_VIDEO_RATIO_OPTIONS, ...KLING_TEXT_VIDEO_RATIO_OPTIONS, ...KLING_IMAGE_VIDEO_RATIO_OPTIONS, ...VEO_VIDEO_RATIO_OPTIONS].includes(ratioParam)) {
      setRatio(ratioParam);
    }

    const imageSizeParam = sp.get("imageSize");
    if (provider !== "topaz-image" && imageSizeParam && IMAGE_SIZE_PRESETS.some((preset) => preset.value === imageSizeParam)) {
      setImageSize(imageSizeParam);
      setRatio(ratioFromImageSize(imageSizeParam));
    }

    const durationParam = sp.get("duration");
    if (durationParam && (mode === "image" ? durationParam === "single" : VIDEO_DURATION_OPTIONS.includes(durationParam))) {
      setDuration(durationParam);
    }

    const resolutionParam = sp.get("resolution");
    if (resolutionParam && [...GROK_VIDEO_RESOLUTION_OPTIONS, ...SEEDANCE_VIDEO_RESOLUTION_OPTIONS, ...VEO_VIDEO_RESOLUTION_OPTIONS].includes(resolutionParam)) {
      setVideoResolution(resolutionParam);
    }

    const referenceParam = sp.get("reference");
    if (mode === "image" && referenceParam) {
      const referenceWorkflow = workflowForMode(mode, sp.get("workflow"));
      setImageWorkflow(referenceWorkflow === "enhance-cleanup" || referenceWorkflow === "background-remove" ? referenceWorkflow : "image-to-image");
      setReferenceImagesText(referenceParam);
    } else if (mode === "avatar") {
      const avatarProvider = isProviderAllowedForMode(providerParam, mode) ? providerParam : providerForWorkflow(workflowForMode(mode, sp.get("workflow")), null);
      if (isAvatarProvider(avatarProvider || "")) {
        setPrompt((current) => (current.trim() ? current : KLING_AVATAR_DEFAULT_SCRIPT));
        setReferenceImagesText((current) => (current.trim() ? current : KLING_AVATAR_DEFAULT_IMAGE_URL));
      }
    } else {
      setReferenceImagesText((current) => stripKlingAvatarDefaultReference(current));
      setPrompt((current) => (current.trim() === KLING_AVATAR_DEFAULT_SCRIPT ? "" : current));
    }
  }, [mode, sp]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    (async () => {
      try {
        const response = await fetch("/api/tasks", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!response.ok) {
          throw new Error("Task history could not be loaded.");
        }
        const payload = (await response.json()) as {
          tasks: Array<{
            id: string;
            mode: "image" | "video" | "audio";
            provider?: string;
            prompt?: string;
            status: "queued" | "running" | "completed" | "failed";
            estimated_credits: number;
            transport?: "real" | "mock";
            created_at?: string;
            status_url?: string | null;
            response_url?: string | null;
            output_url?: string | null;
            raw_result?: unknown;
            title?: string | null;
            is_favorite?: boolean;
            request_settings?: Record<string, unknown> | null;
            charged_credits?: number;
            refunded_credits?: number;
            refund_status?: "refunded" | "not_refunded" | "not_applicable";
            failure_reason?: string | null;
            updated_at?: string | null;
          }>;
          storageWarning?: string;
        };
        const remoteTasks: TaskItem[] = payload.tasks.map((t) => ({
          id: t.id,
          type: t.mode === "image" ? "Image" : t.mode === "audio" ? "Audio" : "Video",
          status:
            t.status === "queued"
              ? "Queued"
              : t.status === "running"
                ? "Running"
                : t.status === "completed"
                  ? "Completed"
                  : "Failed",
          cost: t.estimated_credits,
          title: t.title || null,
          isFavorite: Boolean(t.is_favorite),
          provider: t.provider,
          prompt: t.prompt,
          transport: t.transport,
          createdAt: t.created_at,
          statusUrl: t.status_url || null,
          responseUrl: t.response_url || null,
          mediaUrl: t.output_url || pickMediaUrl(t.raw_result) || null,
          updatedAt: t.updated_at || null,
          settings: t.request_settings || null,
          chargedCredits: t.charged_credits,
          refundedCredits: t.refunded_credits,
          refundStatus: t.refund_status,
          failureReason: t.failure_reason || null
        }));
        const sessionTasks = readSessionTasks(userId);
        if (payload.storageWarning) {
          setTasks((currentTasks) => mergeTasks(currentTasks, sessionTasks));
          setTaskHistoryNote(
            sessionTasks.length
              ? st("studio.projects.historyBrowserFallback")
              : payload.storageWarning
          );
          return;
        }
        setTasks(mergeTasks(remoteTasks, sessionTasks));
        setTaskHistoryNote(sessionTasks.length ? st("studio.projects.browserTasks") : "");
      } catch (error) {
        const sessionTasks = readSessionTasks(userId);
        setTasks(sessionTasks);
        setTaskHistoryNote(
          sessionTasks.length
            ? st("studio.projects.historyBrowserFallback")
            : error instanceof Error
              ? error.message
              : st("studio.projects.historyUnavailable")
        );
      }
    })();
  }, [accessToken, userId]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    let hasCachedBalance = false;
    if (typeof window !== "undefined") {
      const creditKey = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
      const cachedBalance = creditKey ? window.localStorage.getItem(creditKey) : null;
      if (cachedBalance && Number.isFinite(Number(cachedBalance))) {
        hasCachedBalance = true;
        setCreditBalance(Number(cachedBalance));
        setCreditNote(st("studio.status.browserBalance"));
      }
    }

    (async () => {
      try {
        const response = await fetch("/api/credits", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const payload = (await response.json()) as {
          balance?: number | null;
          signupBonusCredits?: number;
          signupBonusBlockedByIp?: boolean;
          storageWarning?: string;
          error?: string;
          dreamfaceIo?: {
            enabled?: boolean;
            eligible?: boolean;
            remainingUnits?: number;
          };
        };
        if (!response.ok) {
          throw new Error(localizeStudioError(payload.error || st("studio.status.balanceUnavailable"), response.status));
        }
        if (typeof payload.balance === "number") {
          setCreditBalance(payload.balance);
          if (typeof window !== "undefined") {
            const creditKey = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
            if (creditKey) {
              safeSetLocalStorage(creditKey, String(payload.balance));
            }
          }
        }
        if (payload.dreamfaceIo) {
          setDreamfaceIoEnabled(Boolean(payload.dreamfaceIo.enabled));
          setDreamfaceIoEligible(Boolean(payload.dreamfaceIo.eligible));
          setDreamfaceIoRemainingUnits(
            typeof payload.dreamfaceIo.remainingUnits === "number" ? payload.dreamfaceIo.remainingUnits : 0
          );
        }
        if (payload.storageWarning) {
          setCreditNote(
            hasCachedBalance
              ? st("studio.status.cloudBalanceUnavailable")
              : st("studio.status.balanceUnavailable")
          );
        } else {
          setCreditNote(
            payload.signupBonusBlockedByIp
              ? st("studio.status.trialUnavailable")
              : ""
          );
        }
      } catch (error) {
        setCreditNote(
          !hasCachedBalance
            ? error instanceof Error
              ? error.message
              : st("studio.status.balanceUnavailable")
            : st("studio.status.cloudBalanceUnavailable")
        );
      }
    })();
  }, [accessToken, userId]);

  useEffect(() => {
    const tasksKey = scopedSessionKey(SESSION_TASKS_KEY, userId);
    if (typeof window === "undefined" || !tasksKey) {
      return;
    }

    if (tasks.length) {
      writeSessionTasksCache(tasksKey, tasks);
    } else {
      safeRemoveLocalStorage(tasksKey);
    }
  }, [tasks, userId]);

  const options = useMemo(
    () => WORKFLOW_META[mode === "image" ? imageWorkflow : mode === "audio" ? "text-to-audio" : mode === "avatar" ? "avatar-video" : videoWorkflow].providers
      .filter((value) => value !== "dreamface-io-video" || dreamfaceIoEnabled !== false)
      .map((value) => ({ value, label: PROVIDER_META[value]?.label || value })),
    [dreamfaceIoEnabled, imageWorkflow, mode, videoWorkflow]
  );
  useEffect(() => {
    if (provider !== "dreamface-io-video" || dreamfaceIoEnabled !== false) return;
    setProvider(videoWorkflow === "image-to-video" ? "kling-video" : "grok-video");
  }, [dreamfaceIoEnabled, imageWorkflow, mode, provider, videoWorkflow]);
  const avatarVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => avatarVoiceGender === "all" || voice.gender === avatarVoiceGender).map((voice) => voice.name) as string[],
    [avatarVoiceGender]
  );

  const activeWorkflow: StudioWorkflow = mode === "image" ? imageWorkflow : mode === "audio" ? "text-to-audio" : mode === "avatar" ? "avatar-video" : videoWorkflow;
  const activeWorkflowMeta = WORKFLOW_META[activeWorkflow];
  const isPromptlessImageWorkflow = mode === "image" && activeWorkflow === "background-remove";
  const allReferenceImageUrls = [
    ...referenceImagesText
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean),
    ...referenceImageFiles
  ];
  const referenceImageUrls = allReferenceImageUrls.slice(0, isPromptlessImageWorkflow ? 1 : 14);
  const isAvatarWorkflow = mode === "avatar" || activeWorkflow === "avatar-video";
  const avatarNeedsImage = isAvatarWorkflow && referenceImageUrls.length === 0;
  const avatarScriptSeconds = isAvatarWorkflow ? estimateAvatarScriptSeconds(prompt) : 0;
  const avatarOutputSeconds = isAvatarWorkflow ? avatarScriptSeconds + AVATAR_KLING_BUFFER_SECONDS : 0;
  const isDefaultAvatarScript = isAvatarWorkflow && prompt.trim() === KLING_AVATAR_DEFAULT_SCRIPT;
  const avatarDuration = isAvatarWorkflow ? avatarDurationFromPrompt(prompt) : duration;
  const avatarScriptTooLong = isAvatarWorkflow && !isDefaultAvatarScript && avatarOutputSeconds > AVATAR_MAX_SECONDS;
  const avatarScriptMeta = isAvatarWorkflow
    ? prompt.trim()
      ? isDefaultAvatarScript
        ? st("studio.avatar.sampleMeta")
        : st("studio.avatar.scriptMeta", {
            characters: prompt.trim().length.toLocaleString(),
            voiceSeconds: avatarScriptSeconds,
            videoSeconds: Number.parseInt(avatarDuration, 10)
          })
      : st("studio.avatar.emptyMeta")
    : "";
  const audioCharacterCount = mode === "audio" ? prompt.trim().length : 0;
  const avatarSelectedSeconds = Math.max(1, Number.parseInt(avatarDuration, 10) || Number.parseInt(DEFAULT_VIDEO_DURATION, 10));

  const baseEstCredits = estimateGenerationCredits({
    mode: modeForPricing(mode),
    provider,
    imageSize,
    duration: isAvatarWorkflow ? avatarDuration : duration,
    hasReferences: referenceImageUrls.length > 0,
    resolution: mode === "image" ? editResolution : videoResolution,
    generateAudio: mode === "video" ? generateAudio : false,
    quality: imageQuality,
    numImages: mode === "image" ? numImages : 1,
    enableWebSearch,
    thinkingLevel,
    promptText: prompt
  });
  const dreamfaceIoUnits = provider === "dreamface-io-video"
    ? Math.max(1, Math.ceil((Number.parseInt(duration, 10) || 5) / 5))
    : 0;
  const usesDreamfaceIoFreeAllowance =
    provider === "dreamface-io-video" &&
    dreamfaceIoEligible &&
    dreamfaceIoRemainingUnits >= dreamfaceIoUnits;
  const estCredits = usesDreamfaceIoFreeAllowance ? 0 : baseEstCredits;
  const hasEnoughCredits = creditBalance === null || creditBalance >= estCredits;
  const lowBalanceAfterGeneration = typeof creditBalance === "number" && creditBalance - estCredits < CREDIT_LOW_BALANCE_THRESHOLD;
  const estimatedSeconds = estimateTaskSeconds(modeForPricing(mode), provider, isAvatarWorkflow ? avatarDuration : duration);
  const isPromptValid = isPromptlessImageWorkflow || (isAvatarWorkflow ? prompt.trim().length >= 2 && !avatarScriptTooLong : prompt.trim().length >= 8);
  const needsReferenceImage = activeWorkflow === "image-to-image" || activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video";
  const hasRequiredReference = !needsReferenceImage || referenceImageUrls.length > 0;
  const canSubmit = isPromptValid && hasRequiredReference;
  const activeTasks = tasks.filter((task) => task.status === "Queued" || task.status === "Running");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const hasCompletedCreation = completedTasks.length > 0;
  const failedTasks = tasks.filter((task) => task.status === "Failed");
  const selectedProjectId = sp.get("taskId");
  const selectedProjectTask = selectedProjectId
    ? tasks.find((task) => task.id === selectedProjectId) || tasks[0] || null
    : tasks[0] || null;
  const localizedHomeSlides = HOME_SLIDES.map((slide, index) => {
    const key = index === 0 ? "image" : index === 1 ? "video" : "avatar";
    return {
      ...slide,
      eyebrow: st(`studio.home.slide.${key}.eyebrow`),
      title: st(`studio.home.slide.${key}.title`),
      body: st(`studio.home.slide.${key}.body`),
      cta: st(`studio.home.slide.${key}.cta`),
      stats: st(`studio.home.slide.${key}.stats`).split("|")
    };
  });
  const activeHomeSlide = localizedHomeSlides[homeSlideIndex % localizedHomeSlides.length];
  const toolkitTitleKeys = [
    "studio.nav.avatar",
    "studio.workflow.text-to-image",
    "studio.workflow.image-to-image",
    "studio.workflow.text-to-video",
    "studio.workflow.image-to-video",
    "studio.workflow.enhance-cleanup",
    "studio.workflow.background-remove",
    "studio.workflow.text-to-audio"
  ];
  const toolkitBodyKeys = [
    "studio.home.quick.avatar",
    "studio.home.quick.textImage",
    "studio.home.quick.imageImage",
    "studio.home.quick.textVideo",
    "studio.home.quick.imageVideo",
    "studio.home.quick.enhance",
    "studio.home.quick.remove",
    "studio.home.quick.audio"
  ];
  const localizedToolkitApps = TOOLKIT_APPS.map((app, index) => ({
    ...app,
    title: st(toolkitTitleKeys[index]),
    body: st(toolkitBodyKeys[index])
  }));
  const taskStatusLabel = (status: TaskStatus) => st(`studio.task.${status.toLowerCase()}`);
  const taskTypeLabel = (type: TaskItem["type"]) => st(`studio.task.${type.toLowerCase()}`);
  const latestActiveTask = activeTasks[0] || null;
  const latestActiveProgress = latestActiveTask ? taskProgress(latestActiveTask, isAvatarWorkflow ? avatarDuration : duration) : 0;
  const selectedImageSize = getImageSizePreset(imageSize);
  const videoPreviewRatio = ratio.includes(":") ? ratio.replace(":", " / ") : "16 / 9";
  const previewAspectRatio = mode === "image" ? `${selectedImageSize.width} / ${selectedImageSize.height}` : mode === "audio" ? "16 / 7" : videoPreviewRatio;
  const modelPreviewUrl = hasCompletedCreation ? null : defaultPreviewForProvider(provider);
  const isModelPreviewVideo = provider === "grok-video" || isAvatarProvider(provider);
  const providerNoteKey = [
    "flux-image",
    "flux-dev",
    "chatgpt-image",
    "topaz-image",
    "kling-avatar-standard",
    "kling-avatar-pro",
    "grok-video",
    "dreamface-io-video",
    "seedance-video",
    "kling-video",
    "veo-video",
    "elevenlabs-tts"
  ].includes(provider)
    ? provider
    : "default";
  const providerNote = st(`studio.model.${providerNoteKey}`);
  const videoRatioOptions = isAvatarProvider(provider)
    ? ["source"]
    : provider === "grok-video"
    ? activeWorkflow === "image-to-video"
      ? GROK_IMAGE_VIDEO_RATIO_OPTIONS
      : GROK_VIDEO_RATIO_OPTIONS
    : provider === "seedance-video"
      ? SEEDANCE_VIDEO_RATIO_OPTIONS
        : provider === "kling-video"
        ? activeWorkflow === "image-to-video"
          ? KLING_IMAGE_VIDEO_RATIO_OPTIONS
          : KLING_TEXT_VIDEO_RATIO_OPTIONS
        : provider === "veo-video"
          ? VEO_VIDEO_RATIO_OPTIONS
          : DEFAULT_VIDEO_RATIO_OPTIONS;
  const videoDurationOptions =
    provider === "dreamface-io-video"
      ? DREAMFACE_IO_DURATION_OPTIONS
    : provider === "veo-video"
      ? VEO_VIDEO_DURATION_OPTIONS
      : provider === "seedance-video"
        ? VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 4)
      : isAvatarProvider(provider)
        ? VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 3)
      : provider === "grok-video"
          ? GROK_VIDEO_DURATION_OPTIONS
          : VIDEO_DURATION_OPTIONS;
  const videoResolutionOptions =
    provider === "dreamface-io-video"
      ? ["720p"]
    : provider === "seedance-video"
      ? SEEDANCE_VIDEO_RESOLUTION_OPTIONS
      : provider === "veo-video"
        ? VEO_VIDEO_RESOLUTION_OPTIONS
        : GROK_VIDEO_RESOLUTION_OPTIONS;
  const showVideoResolutionControl = mode === "video" && (provider === "dreamface-io-video" || provider === "grok-video" || provider === "seedance-video" || provider === "veo-video");
  const showVideoAudioControl = mode === "video" && !isAvatarProvider(provider) && (provider === "seedance-video" || provider === "kling-video" || provider === "veo-video");
  const showTextToImageTemplates = !isAppsHome && !isProjectsView && mode === "image" && imageWorkflow === "text-to-image";
  const providerSettingsLabel =
    provider === "chatgpt-image"
      ? `${imageQuality} / ${outputFormat.toUpperCase()} / ${numImages}`
    : provider === "flux-image" || provider === "flux-dev"
        ? `${numInferenceSteps} / ${guidanceScale} / ${outputFormat.toUpperCase()}`
        : mode === "image"
          ? `${editResolution} / ${safetyTolerance} / ${numImages}`
          : mode === "audio"
            ? `${prompt.trim().length || 0} / ${ttsVoice} / ${ttsStability.toFixed(2)}`
          : isAvatarWorkflow
            ? `${avatarDuration} / ${ttsVoice}`
            : `${videoResolution} / ${duration}${showVideoAudioControl ? generateAudio ? " / ON" : " / OFF" : ""}`;

  useEffect(() => {
    if (mode !== "avatar") return;
    if (avatarVoiceOptions.includes(ttsVoice)) return;
    setTtsVoice(avatarVoiceOptions[0] || "Rachel");
  }, [avatarVoiceOptions, mode, ttsVoice]);

  useEffect(() => {
    if (!isAvatarWorkflow || !avatarAudioUrl.startsWith("data:audio/") || avatarAudioTrimSeconds === null) return;
    if (avatarAudioTrimSeconds === avatarSelectedSeconds) return;
    setAvatarAudioUrl("");
    setAvatarAudioTrimSeconds(null);
    setStatusTone("idle");
    setStatusText(st("studio.status.avatarDurationChanged", { seconds: avatarSelectedSeconds }));
  }, [avatarAudioTrimSeconds, avatarAudioUrl, avatarSelectedSeconds, isAvatarWorkflow]);

  useEffect(() => {
    if (mode !== "video") return;
    if (!videoRatioOptions.includes(ratio)) {
      setRatio(videoRatioOptions.includes("auto") ? "auto" : videoRatioOptions[0] || "16:9");
    }
    if (!videoDurationOptions.includes(duration)) {
      setDuration(provider === "veo-video" ? DEFAULT_VEO_VIDEO_DURATION : DEFAULT_VIDEO_DURATION);
    }
    if (showVideoResolutionControl && !videoResolutionOptions.includes(videoResolution)) {
      setVideoResolution(videoResolutionOptions[0] || "720p");
    }
  }, [duration, mode, provider, ratio, showVideoResolutionControl, videoDurationOptions, videoRatioOptions, videoResolution, videoResolutionOptions]);

  useEffect(() => {
    if (!showTextToImageTemplates) return;
    let cancelled = false;
    setGalleryTemplateNote("");
    fetch("/api/gallery?sort=featured&limit=18")
      .then((response) => {
        if (!response.ok) throw new Error(st("studio.status.galleryUnavailable"));
        return response.json();
      })
      .then((payload: { items?: GalleryTemplate[] }) => {
        if (cancelled) return;
        setGalleryTemplates(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch((error) => {
        if (cancelled) return;
        setGalleryTemplates([]);
        setGalleryTemplateNote(error instanceof Error ? error.message : st("studio.status.galleryUnavailable"));
      });
    return () => {
      cancelled = true;
    };
  }, [showTextToImageTemplates]);

  useEffect(() => {
    if (!hasCompletedCreation) return;
    setPrompt((currentPrompt) => (isSamplePrompt(currentPrompt) ? "" : currentPrompt));
  }, [hasCompletedCreation]);

  function applyWorkflow(nextWorkflow: StudioWorkflow) {
    const nextMode =
      nextWorkflow === "text-to-image" || nextWorkflow === "image-to-image" || nextWorkflow === "enhance-cleanup" || nextWorkflow === "background-remove"
        ? "image"
        : nextWorkflow === "text-to-audio"
          ? "audio"
          : nextWorkflow === "avatar-video"
            ? "avatar"
            : "video";
    const nextProvider = providerForWorkflow(nextWorkflow, provider);
      if (nextMode === "image") {
      setImageWorkflow(nextWorkflow as ImageWorkflow);
      if (nextWorkflow === "text-to-image") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
      }
      setImageQuality(nextProvider === "chatgpt-image" ? "low" : "high");
    } else if (nextMode === "video" || nextMode === "avatar") {
      setVideoWorkflow(nextWorkflow as VideoWorkflow);
      if (nextWorkflow === "text-to-video") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
        setAvatarAudioUrl("");
      } else if (nextWorkflow === "avatar-video") {
        setReferenceImagesText((current) => current || KLING_AVATAR_DEFAULT_IMAGE_URL);
        setReferenceImageFiles([]);
      }
    } else {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      setAvatarAudioUrl("");
    }
    setProvider(nextProvider);
    if (nextProvider === "nano-banana-image" || nextProvider === "nano-banana-pro" || nextProvider === "topaz-image" || nextProvider === "bria-background-remove") {
      setRatio(nextProvider === "nano-banana-image" || nextProvider === "topaz-image" || nextProvider === "bria-background-remove" ? "auto" : "1:1");
    }
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider);
    setPrompt(!hasCompletedCreation && nextDefaultPrompt ? nextDefaultPrompt : "");
    const nextImageSize = nextMode === "image" ? defaultImageSizeForProvider(nextProvider) : imageSize;
    if (nextMode === "image") {
      setImageSize(nextImageSize);
      setRatio(nextProvider === "topaz-image" || nextProvider === "bria-background-remove" ? "auto" : ratioFromImageSize(nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      setRatio(nextWorkflow === "avatar-video" ? "source" : "16:9");
      setDuration(nextProvider === "veo-video" ? DEFAULT_VEO_VIDEO_DURATION : DEFAULT_VIDEO_DURATION);
    } else {
      setRatio("16:9");
      setDuration("single");
    }
    trackEvent("studio_workflow_selected", { mode: nextMode, workflow: nextWorkflow, provider: nextProvider }, accessToken);
    const params = new URLSearchParams(sp.toString());
    params.set("mode", nextMode);
    params.set("workflow", nextWorkflow);
    params.set("provider", nextProvider);
    if (nextMode === "image") {
      params.set("imageSize", nextImageSize);
      params.set("ratio", nextProvider === "topaz-image" || nextProvider === "bria-background-remove" ? "auto" : ratioFromImageSize(nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      params.delete("imageSize");
      params.set("ratio", nextWorkflow === "avatar-video" ? "source" : "16:9");
    } else {
      params.delete("imageSize");
      params.set("ratio", "16:9");
    }
    router.replace(`/studio?${params.toString()}`, { scroll: false });
  }

  function applyProvider(nextProvider: string) {
    trackEvent("studio_model_selected", { mode, provider: nextProvider, workflow: activeWorkflow }, accessToken);
    setProvider(nextProvider);
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider);
    setPrompt(!hasCompletedCreation && nextDefaultPrompt ? nextDefaultPrompt : "");
    if (isAvatarProvider(nextProvider)) {
      setReferenceImagesText((current) => current || KLING_AVATAR_DEFAULT_IMAGE_URL);
      setReferenceImageFiles([]);
    }
    if (mode === "image") {
      if (nextProvider !== "topaz-image" && nextProvider !== "bria-background-remove") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
      }
      if (nextProvider === "topaz-image") setImageWorkflow("enhance-cleanup");
      if (nextProvider === "bria-background-remove") setImageWorkflow("background-remove");
      const nextImageSize = defaultImageSizeForProvider(nextProvider);
      setImageSize(nextImageSize);
      setImageQuality(nextProvider === "chatgpt-image" ? "low" : "high");
      setRatio(nextProvider === "nano-banana-image" || nextProvider === "topaz-image" || nextProvider === "bria-background-remove" ? "auto" : nextProvider === "nano-banana-pro" ? "1:1" : ratioFromImageSize(nextImageSize));
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "image");
      params.set("workflow", nextProvider === "topaz-image" ? "enhance-cleanup" : nextProvider === "bria-background-remove" ? "background-remove" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("imageSize", nextImageSize);
      params.set("ratio", nextProvider === "nano-banana-image" || nextProvider === "topaz-image" || nextProvider === "bria-background-remove" ? "auto" : nextProvider === "nano-banana-pro" ? "1:1" : ratioFromImageSize(nextImageSize));
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    } else if (mode === "audio") {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "audio");
      params.set("workflow", "text-to-audio");
      params.set("provider", nextProvider);
      params.delete("imageSize");
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    } else {
      const nextRatio =
        mode === "avatar" || isAvatarProvider(nextProvider)
          ? "source"
        : nextProvider === "kling-video" && activeWorkflow === "image-to-video"
          ? "source"
          : nextProvider === "grok-video" && activeWorkflow === "image-to-video" && ratio === "source"
            ? "auto"
          : nextProvider === "kling-video" && !KLING_TEXT_VIDEO_RATIO_OPTIONS.includes(ratio)
            ? "16:9"
            : nextProvider === "veo-video" && !VEO_VIDEO_RATIO_OPTIONS.includes(ratio)
              ? "16:9"
              : ratio === "source"
                ? "auto"
                : ratio;
      if (mode !== "avatar" && nextProvider === "seedance-video" && Number.parseInt(duration, 10) < 4) {
        setDuration("4s");
      }
      if (mode !== "avatar" && nextProvider === "veo-video" && !VEO_VIDEO_DURATION_OPTIONS.includes(duration)) {
        setDuration(DEFAULT_VEO_VIDEO_DURATION);
      }
      const nextResolution = nextProvider === "veo-video" && !VEO_VIDEO_RESOLUTION_OPTIONS.includes(videoResolution) ? "720p" : videoResolution;
      if (nextResolution !== videoResolution) {
        setVideoResolution("720p");
      }
      setRatio(nextRatio);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", mode === "avatar" ? "avatar" : "video");
      params.set("workflow", mode === "avatar" ? "avatar-video" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("ratio", nextRatio);
      if (nextProvider === "grok-video" || nextProvider === "seedance-video" || nextProvider === "veo-video") {
        params.set("resolution", nextResolution);
      } else {
        params.delete("resolution");
      }
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    }
  }

  function startAvatarImageGuide() {
    applyWorkflow("text-to-image");
    setPrompt("Professional front-facing presenter avatar portrait, clean background, natural expression, sharp facial details, studio lighting, realistic but friendly, centered composition for talking avatar video.");
  }

  function startAvatarAudioGuide() {
    applyWorkflow("text-to-audio");
    setPrompt("Hi, welcome to DreamFace. I am your AI avatar presenter, ready to introduce your product, tell your story, or deliver a polished social video message.");
  }

  async function handleReferenceFiles(files: FileList | null) {
    if (!files?.length) return;
    const maxFiles = isPromptlessImageWorkflow ? 1 : 4;
    const nextFiles = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, maxFiles)
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Image file could not be read."));
              reader.readAsDataURL(file);
            })
        )
    );
    setReferenceImageFiles((prev) => (isPromptlessImageWorkflow ? nextFiles.slice(0, 1) : [...prev, ...nextFiles].slice(0, 4)));
    if (mode === "image" && imageWorkflow === "text-to-image") {
      setImageWorkflow("image-to-image");
      if (!WORKFLOW_META["image-to-image"].providers.includes(provider)) {
        setProvider(WORKFLOW_META["image-to-image"].recommendedProvider);
      }
    }
    if (mode === "avatar") {
      setVideoWorkflow("avatar-video");
    }
    if (mode === "video" && videoWorkflow !== "image-to-video") {
      setVideoWorkflow("image-to-video");
      if (!WORKFLOW_META["image-to-video"].providers.includes(provider)) {
        setProvider(WORKFLOW_META["image-to-video"].recommendedProvider);
      }
    }
    trackEvent(
      "studio_reference_uploaded",
      { mode, provider, workflow: activeWorkflow, files: nextFiles.length, total_references: referenceImageUrls.length + nextFiles.length },
      accessToken
    );
  }

  async function handleAvatarAudioFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setStatusTone("error");
      setStatusText(st("studio.status.audioFileRequired"));
      return;
    }
    const targetSeconds = Math.max(1, Number.parseInt(duration, 10) || Number.parseInt(DEFAULT_VIDEO_DURATION, 10));
    try {
      setStatusTone("idle");
      setStatusText(st("studio.status.audioTrimming", { file: file.name, seconds: targetSeconds }));
      const result = await trimAudioFileToDataUrl(file, targetSeconds);
      setAvatarAudioUrl(result.dataUrl);
      setAvatarAudioTrimSeconds(targetSeconds);
      setStatusTone("idle");
      setStatusText(
        result.trimmed
          ? st("studio.status.audioTrimmed", {
              file: file.name,
              original: formatSeconds(result.originalSeconds),
              output: formatSeconds(result.outputSeconds)
            })
          : st("studio.status.audioFits", {
              file: file.name,
              duration: formatSeconds(result.originalSeconds),
              seconds: targetSeconds
            })
      );
    } catch (error) {
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? localizeStudioError(error.message)
          : st("studio.status.audioTrimFailed")
      );
    }
  }

  function clearCompletedWorkbench() {
    setPrompt("");
    setReferenceImagesText("");
    setReferenceImageFiles([]);
  }

  function cacheCreditBalance(balance: number) {
    if (typeof window === "undefined") return;
    const creditKey = scopedSessionKey(SESSION_CREDIT_BALANCE_KEY, userId);
    if (creditKey) {
      safeSetLocalStorage(creditKey, String(balance));
    }
  }

  function saveLoginDraft(autoSubmit: boolean) {
    return writeStudioLoginDraft({
      createdAt: new Date().toISOString(),
      autoSubmit,
      mode,
      provider,
      imageWorkflow,
      videoWorkflow,
      ratio,
      imageSize,
      referenceImagesText,
      referenceImageFiles,
      avatarAudioUrl,
      editResolution,
      videoResolution,
      generateAudio,
      voice: ttsVoice,
      stability: ttsStability,
      timestamps: ttsTimestamps,
      languageCode: ttsLanguageCode,
      textNormalization,
      outputFormat,
      duration,
      prompt,
      imageQuality,
      numImages,
      guidanceScale,
      numInferenceSteps,
      enableSafetyChecker,
      acceleration,
      limitGenerations,
      seed,
      safetyTolerance,
      systemPrompt,
      enableWebSearch,
      thinkingLevel
    });
  }

  useEffect(() => {
    if (!authReady || !accessToken || restoredLoginDraftRef.current) return;
    const draft = readStudioLoginDraft();
    if (!draft) return;

    restoredLoginDraftRef.current = true;
    autoSubmitLoginDraftRef.current = draft.autoSubmit;
    setProvider(draft.provider === "nano-banana-edit" ? "nano-banana-image" : draft.provider);
    setImageWorkflow(draft.imageWorkflow);
    setVideoWorkflow(draft.videoWorkflow || "text-to-video");
    setRatio(draft.ratio);
    setImageSize(draft.imageSize);
    setReferenceImagesText(draft.referenceImagesText);
    setReferenceImageFiles(Array.isArray(draft.referenceImageFiles) ? draft.referenceImageFiles : []);
    setAvatarAudioUrl(draft.avatarAudioUrl || "");
    setEditResolution(draft.editResolution);
    setVideoResolution(draft.videoResolution);
    setGenerateAudio(Boolean(draft.generateAudio));
    setTtsVoice(draft.voice || "Rachel");
    setTtsStability(typeof draft.stability === "number" ? draft.stability : 0.5);
    setTtsTimestamps(Boolean(draft.timestamps));
    setTtsLanguageCode(draft.languageCode || "");
    setTextNormalization(draft.textNormalization || "auto");
    setOutputFormat(draft.outputFormat);
    setImageQuality(draft.imageQuality || "high");
    setNumImages(draft.numImages || 1);
    setGuidanceScale(draft.guidanceScale || 3.5);
    setNumInferenceSteps(draft.numInferenceSteps || 4);
    setEnableSafetyChecker(draft.enableSafetyChecker !== false);
    setAcceleration(draft.acceleration || "none");
    setLimitGenerations(draft.limitGenerations !== false);
    setSeed(draft.seed || "");
    setSafetyTolerance(draft.safetyTolerance || "4");
    setSystemPrompt(draft.systemPrompt || "");
    setEnableWebSearch(Boolean(draft.enableWebSearch));
    setThinkingLevel(draft.thinkingLevel || "");
    setDuration(draft.duration);
    setPrompt(draft.prompt);
    setStatusTone("idle");
    setStatusText(draft.autoSubmit ? st("studio.status.restoredContinue") : st("studio.status.restored"));

    setLoginDraftNonce((value) => value + 1);
  }, [accessToken, authReady]);

  async function handleGenerate() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    trackEvent(
      "generate_clicked",
      {
        mode,
        provider,
        workflow: activeWorkflow,
        estimated_credits: estCredits,
        signed_in: Boolean(accessToken),
        has_references: referenceImageUrls.length > 0
      },
      accessToken
    );
    setIsSubmitting(true);
    setStatusTone("idle");
    setStatusText(st("studio.status.submitting"));

    const taskType: TaskItem["type"] = mode === "image" ? "Image" : mode === "audio" ? "Audio" : "Video";
    let idempotencyStorageKey: string | null = null;
    try {
      if (isAvatarWorkflow && avatarAudioUrl.trim()) {
        if (avatarAudioUrl.startsWith("data:audio/")) {
          if (avatarAudioTrimSeconds !== avatarSelectedSeconds) {
            throw new Error(st("studio.status.audioReselect", { seconds: avatarSelectedSeconds }));
          }
        } else {
          setStatusText(st("studio.status.audioChecking"));
          const remoteAudioSeconds = await readAudioDurationFromUrl(avatarAudioUrl.trim());
          if (remoteAudioSeconds > avatarSelectedSeconds + 0.5) {
            throw new Error(
              st("studio.status.remoteAudioTooLong", {
                duration: formatSeconds(remoteAudioSeconds),
                seconds: avatarSelectedSeconds
              })
            );
          }
        }
      }
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getSession();
      const liveToken =
        data.session?.access_token ||
        accessToken ||
        (typeof window !== "undefined" ? window.localStorage.getItem("nova_access_token") : null);
      if (!liveToken) {
        trackEvent(
          "generate_login_required",
          { mode, provider, workflow: activeWorkflow },
          accessToken
        );
        const next = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/studio?mode=image&workflow=text-to-image";
        const saved = saveLoginDraft(true);
        setStatusTone(saved ? "idle" : "error");
        setStatusText(
          saved
            ? st("studio.status.savedLoginDraft")
            : st("studio.status.draftSaveFailed")
        );
        router.push(`/auth?next=${encodeURIComponent(next)}`);
        return;
      }

      const parsedSeed = seed.trim() ? Number.parseInt(seed.trim(), 10) : undefined;
      const requestDuration = isAvatarWorkflow ? avatarDuration : duration;
      const requestPayload = {
        mode,
        imageWorkflow,
        videoWorkflow: isAvatarWorkflow ? "avatar-video" : videoWorkflow,
        provider,
        ratio: isAvatarWorkflow ? "source" : ratio,
        duration: requestDuration,
        prompt,
        imageSize: mode === "image" ? imageSize : undefined,
        imageUrls:
          (mode === "image" && referenceImageUrls.length > 0) || (mode === "avatar" || (mode === "video" && videoWorkflow === "image-to-video"))
            ? referenceImageUrls
            : undefined,
        audioUrl: isAvatarWorkflow && avatarAudioUrl.trim() ? avatarAudioUrl.trim() : undefined,
        resolution:
          mode === "image"
            ? editResolution
            : mode === "video" && (provider === "dreamface-io-video" || provider === "grok-video" || provider === "seedance-video" || provider === "veo-video")
              ? videoResolution
              : undefined,
        generateAudio: mode === "video" ? generateAudio : undefined,
        outputFormat: mode === "image" && !isPromptlessImageWorkflow ? outputFormat : undefined,
        quality: mode === "image" && !isPromptlessImageWorkflow ? imageQuality : undefined,
        numImages: mode === "image" && !isPromptlessImageWorkflow ? numImages : undefined,
        guidanceScale: mode === "image" && !isPromptlessImageWorkflow ? guidanceScale : undefined,
        numInferenceSteps: mode === "image" && !isPromptlessImageWorkflow ? numInferenceSteps : undefined,
        enableSafetyChecker: mode === "image" && !isPromptlessImageWorkflow ? enableSafetyChecker : undefined,
        acceleration: mode === "image" && !isPromptlessImageWorkflow ? acceleration : undefined,
        limitGenerations: mode === "image" && !isPromptlessImageWorkflow ? limitGenerations : undefined,
        seed: Number.isSafeInteger(parsedSeed) && (mode === "image" || provider === "dreamface-io-video" || provider === "seedance-video" || provider === "veo-video") ? parsedSeed : undefined,
        safetyTolerance: mode === "image" && !isPromptlessImageWorkflow ? safetyTolerance : undefined,
        systemPrompt: mode === "image" && !isPromptlessImageWorkflow && systemPrompt.trim() ? systemPrompt.trim() : undefined,
        enableWebSearch: mode === "image" && !isPromptlessImageWorkflow ? enableWebSearch : undefined,
        thinkingLevel: mode === "image" && !isPromptlessImageWorkflow && thinkingLevel ? thinkingLevel : undefined,
        voice: mode === "audio" || isAvatarWorkflow ? ttsVoice : undefined,
        stability: mode === "audio" || isAvatarWorkflow ? ttsStability : undefined,
        timestamps: mode === "audio" ? ttsTimestamps : undefined,
        languageCode: (mode === "audio" || isAvatarWorkflow) && ttsLanguageCode ? ttsLanguageCode : undefined,
        textNormalization: mode === "audio" || isAvatarWorkflow ? textNormalization : undefined
      };
      const fingerprint = createIdempotencyFingerprint({
        ...requestPayload,
        prompt: prompt.trim(),
        imageUrls: referenceImageUrls,
        audioUrl: avatarAudioUrl.trim()
      });
      const idempotency = getPersistentIdempotency(userId, fingerprint);
      idempotencyStorageKey = idempotency.storageKey;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`
        },
        body: JSON.stringify({
          ...requestPayload,
          idempotencyKey: idempotency.idempotencyKey
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        clearPersistentIdempotency(idempotencyStorageKey);
        throw new Error(localizeStudioError(errorPayload?.error || st("studio.status.requestFailed"), response.status));
      }

      const payload = (await response.json()) as {
        taskId: string;
        status: "queued" | "running" | "completed" | "failed";
        transport: "real" | "mock";
        statusUrl?: string | null;
        responseUrl?: string | null;
        storageWarning?: string;
        provider?: string;
        mode?: "image" | "video" | "audio";
        estimatedCredits?: number;
        balance?: number;
        duplicate?: boolean;
        failureReason?: string | null;
        billingSource?: "credits" | "daily_free";
        freeUnitsUsed?: number;
        dailyUnitsRemaining?: number | null;
      };
      clearPersistentIdempotency(idempotencyStorageKey);
      clearStudioLoginDraft();
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        cacheCreditBalance(payload.balance);
      }
      if (provider === "dreamface-io-video" && typeof payload.dailyUnitsRemaining === "number") {
        setDreamfaceIoRemainingUnits(payload.dailyUnitsRemaining);
      }

      const queuedTask: TaskItem = {
        id: payload.taskId,
        type: taskType,
        status:
          payload.status === "running"
            ? "Running"
            : payload.status === "completed"
              ? "Completed"
              : payload.status === "failed"
                ? "Failed"
                : "Queued",
        cost: typeof payload.estimatedCredits === "number" ? payload.estimatedCredits : estCredits,
        provider,
        prompt: prompt.trim(),
        ratio,
        transport: payload.transport,
        createdAt: new Date().toISOString(),
        statusUrl: payload.statusUrl || null,
        responseUrl: payload.responseUrl || null,
        settings: requestPayload,
        failureReason: payload.failureReason || null
      };
      setTasks((prev) => [queuedTask, ...prev.filter((task) => task.id !== queuedTask.id)]);
      router.push(`/studio?view=projects&mode=${mode}&taskId=${encodeURIComponent(payload.taskId)}`);
      trackEvent(
        "generation_queued",
        {
          mode,
          provider,
          workflow: requestPayload.imageWorkflow,
          task_id: payload.taskId,
          transport: payload.transport,
          estimated_credits: estCredits,
          duplicate: Boolean(payload.duplicate)
        },
        liveToken
      );
      if (payload.duplicate) {
        setStatusText(st("studio.status.reusedTask"));
      }
      if (payload.storageWarning) {
        setTaskHistoryNote(st("studio.projects.historySavePending"));
      }
      if (payload.status === "failed") {
        trackEvent(
          "generation_failed",
          { mode, provider, task_id: payload.taskId, failure_reason: payload.failureReason || "existing_failed" },
          liveToken
        );
        setStatusTone("error");
        setStatusText(payload.failureReason || st("studio.status.existingFailed"));
        return;
      }
      if (payload.transport === "mock") {
        const updateMockStatus = async (mockStatus: "completed" | "failed") => {
          const response = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&mockStatus=${mockStatus}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );
          const statusPayload = (await response.json().catch(() => null)) as { balance?: number | null } | null;
          if (typeof statusPayload?.balance === "number") {
            setCreditBalance(statusPayload.balance);
            cacheCreditBalance(statusPayload.balance);
          }
        };

        await new Promise((resolve) => setTimeout(resolve, 900));
        setTasks((prev) =>
          prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
        );
        setStatusText(st("studio.status.mockQueued"));

        await new Promise((resolve) => setTimeout(resolve, 1200));
        const shouldFail = prompt.toLowerCase().includes("fail");
        if (shouldFail) {
          await updateMockStatus("failed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: 0 } : task))
          );
          setStatusTone("error");
          setStatusText(st("studio.status.mockFailed"));
          trackEvent("generation_failed", { mode, provider, task_id: payload.taskId, transport: "mock" }, liveToken);
        } else {
          await updateMockStatus("completed").catch(() => null);
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          clearCompletedWorkbench();
          setStatusTone("ok");
          setStatusText(st("studio.status.mockCompleted"));
          trackEvent("generation_completed", { mode, provider, task_id: payload.taskId, transport: "mock" }, liveToken);
        }
      } else {
        setStatusText(st(provider === "dreamface-io-video" ? "studio.status.dreamfaceIoQueued" : "studio.status.falQueued"));
        let finalStatus: "COMPLETED" | "FAILED" | "CANCELED" | "ERROR" | null = null;
        let finalFailureReason: string | null = null;
        let finalActualCredits: number | null = null;
        const maxPollAttempts = frontendPollAttempts(modeForPricing(mode), provider);

        for (let i = 0; i < maxPollAttempts; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1800));
          const statusRes = await fetch(
            `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&statusUrl=${encodeURIComponent(
              payload.statusUrl || ""
            )}&responseUrl=${encodeURIComponent(payload.responseUrl || "")}`,
            {
              headers: {
                Authorization: `Bearer ${liveToken}`
              }
            }
          );

          if (!statusRes.ok) {
            continue;
          }

          const statusPayload = (await statusRes.json()) as {
            status?: string;
            result?: unknown;
            balance?: number | null;
            failureReason?: string;
            refundLedgerId?: number | string | null;
            refundedCredits?: number;
            actualCredits?: number;
          };
          if (typeof statusPayload.balance === "number") {
            setCreditBalance(statusPayload.balance);
            cacheCreditBalance(statusPayload.balance);
          }
          const rawStatus = (statusPayload.status || "").toUpperCase();
          if (rawStatus === "IN_QUEUE") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Queued" } : task))
            );
            setStatusText(st(provider === "dreamface-io-video" ? "studio.status.dreamfaceIoQueue" : "studio.status.falQueue"));
          } else if (rawStatus === "IN_PROGRESS") {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
            );
            setStatusText(st(provider === "dreamface-io-video" ? "studio.status.dreamfaceIoRunning" : "studio.status.falRunning"));
          } else if (["COMPLETED", "FAILED", "CANCELED", "ERROR"].includes(rawStatus)) {
            if (rawStatus === "COMPLETED") {
              const mediaUrl = pickMediaUrl(statusPayload.result);
              setTasks((prev) =>
                prev.map((task) => (task.id === payload.taskId ? { ...task, mediaUrl } : task))
              );
            }
            finalStatus = rawStatus as "COMPLETED" | "FAILED" | "CANCELED" | "ERROR";
            finalFailureReason = statusPayload.failureReason || null;
            finalActualCredits = typeof statusPayload.actualCredits === "number" ? statusPayload.actualCredits : null;
            break;
          }
        }

        if (finalStatus === "COMPLETED") {
          setTasks((prev) =>
            prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task))
          );
          clearCompletedWorkbench();
          setStatusTone("ok");
          setStatusText(st(provider === "dreamface-io-video" ? "studio.status.dreamfaceIoCompleted" : "studio.status.falCompleted"));
          trackEvent("generation_completed", { mode, provider, task_id: payload.taskId, transport: "real" }, liveToken);
        } else {
          if (finalStatus) {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Failed", cost: finalActualCredits ?? 0, failureReason: finalFailureReason } : task))
            );
            setStatusTone("error");
            setStatusText(
              finalFailureReason
                ? localizeStudioError(finalFailureReason)
                : st(provider === "dreamface-io-video" ? "studio.status.dreamfaceIoFailedRefund" : "studio.status.falFailedRefund")
            );
            trackEvent("generation_failed", { mode, provider, task_id: payload.taskId, transport: "real", final_status: finalStatus, failure_reason: finalFailureReason }, liveToken);
          } else {
            setTasks((prev) =>
              prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task))
            );
            setStatusTone("idle");
            setStatusText(
              st("studio.status.backgroundRunning")
            );
          }
        }
      }
    } catch (error) {
      trackEvent(
        "generation_failed",
        { mode, provider, error: error instanceof Error ? error.message.slice(0, 180) : "submit_failed", estimated_credits: estCredits },
        accessToken
      );
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? `${localizeStudioError(error.message)}${idempotencyStorageKey ? st("studio.status.retryReuse") : ""}`
          : st("studio.status.submitFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!authReady || !accessToken || !autoSubmitLoginDraftRef.current || isSubmitting || !isPromptValid) return;
    autoSubmitLoginDraftRef.current = false;
    const timer = window.setTimeout(() => {
      handleGenerate();
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authReady, isPromptValid, isSubmitting, loginDraftNonce]);

  async function handleTopUp(amount: number) {
    if (!accessToken) return;
    try {
      const response = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ amount })
      });
      const payload = (await response.json()) as { balance?: number; error?: string };
      if (!response.ok) throw new Error(localizeStudioError(payload.error || st("studio.status.topUpFailed"), response.status));
      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        cacheCreditBalance(payload.balance);
      }
      setCreditNote(st("studio.status.topUpAdded", { credits: amount }));
    } catch (error) {
      setCreditNote(error instanceof Error ? localizeStudioError(error.message) : st("studio.status.topUpFailed"));
    }
  }

  function openBillingModal(source: string) {
    setBillingModalOpen(true);
    setBillingMessage("");
    trackEvent("studio_billing_modal_opened", { source, balance: creditBalance, mode, provider }, accessToken);
  }

  async function startStudioCreditCheckout(packId: string) {
    if (!accessToken) {
      trackEvent("checkout_login_required", { pack_id: packId, surface: "studio_modal" });
      const nextPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/studio?view=home";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    setLoadingBillingItem(`credits:${packId}`);
    setBillingMessage("");
    trackEvent(
      "checkout_started",
      { surface: "studio_modal", pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
      accessToken
    );

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ packId })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(response.status === 401 ? st("studio.error.sessionExpired") : st("studio.billing.checkoutFailed"));
      }
      window.location.href = payload.url;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : st("studio.billing.checkoutFailed"));
      setLoadingBillingItem(null);
    }
  }

  async function startStudioSubscriptionCheckout(planId: string, cycle: BillingCycle) {
    if (!accessToken) {
      trackEvent("checkout_login_required", { plan_id: planId, cycle, surface: "studio_modal" });
      const nextPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/studio?view=home";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
    const price = plan?.prices[cycle];
    setLoadingBillingItem(`subscription:${planId}:${cycle}`);
    setBillingMessage("");
    trackEvent(
      "subscription_checkout_started",
      {
        surface: "studio_modal",
        plan_id: planId,
        cycle,
        credits: price?.credits || null,
        amount_cents: price?.amountCents || null,
        value: price ? price.amountCents / 100 : null,
        currency: "USD"
      },
      accessToken
    );

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ type: "subscription", planId, cycle })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(response.status === 401 ? st("studio.error.sessionExpired") : st("studio.billing.subscriptionCheckoutFailed"));
      }
      window.location.href = payload.url;
    } catch (error) {
      setBillingMessage(error instanceof Error ? error.message : st("studio.billing.subscriptionCheckoutFailed"));
      setLoadingBillingItem(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(189,224,254,0.42),transparent_34%),radial-gradient(circle_at_74%_14%,rgba(255,200,221,0.28),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fbfcff_54%,#f7f9fd_100%)] pb-10 text-[#1f2430]">
      <div className="pointer-events-none absolute left-[18%] top-10 h-72 w-72 rounded-full bg-[#bde0fe]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[14%] top-6 h-80 w-80 rounded-full bg-[#ffc8dd]/24 blur-3xl" />
      <div className="mx-auto max-w-[1540px] px-2 pt-2 md:px-8 md:pt-5">
        <header className="hidden">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-3xl font-semibold tracking-tight text-white">
              dreamface
            </Link>
            <nav className="hidden items-center gap-5 text-sm text-white/48 lg:flex">
              <Link className="transition hover:text-white" href="/#platform">Platform</Link>
              <Link className="transition hover:text-white" href="/#providers">Providers</Link>
              <Link className="transition hover:text-white" href="/gallery">Gallery</Link>
              <Link className="transition hover:text-white" href="/#platform">Platform</Link>
              <Link className="transition hover:text-white" href="/#pricing">Pricing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {accessToken ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = createBrowserSupabaseClient();
                    await supabase.auth.signOut();
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Sign out
                </button>
                <Link href="/studio?view=projects" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/[0.06] hover:text-white">
                  Projects
                </Link>
                <Link href="/billing" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/[0.06] hover:text-white">
                  Billing
                </Link>
              </>
            ) : (
              <Link href="/auth?next=%2Fstudio%3Fmode%3Dimage%26workflow%3Dtext-to-image" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/[0.06] hover:text-white">
                Sign in
              </Link>
            )}
            <Link href="/studio?mode=image&workflow=text-to-image" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5">
              Open Studio
            </Link>
          </div>
        </header>
        {!authReady ? (
          <section className="mb-4 rounded-2xl border border-black/[0.06] bg-white/82 p-6 text-sm text-[#667085] shadow-sm">
            {st("studio.checkingSession")}
          </section>
        ) : null}

        {billingModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/58 p-3 backdrop-blur-sm md:p-6"
            onClick={() => {
              if (!loadingBillingItem) setBillingModalOpen(false);
            }}
          >
            <section
              className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white/75 bg-white shadow-[0_34px_110px_rgba(15,23,42,0.28)] md:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#08bff1,#8b5cf6,#f6b431)]" />
              <button
                type="button"
                aria-label={st("studio.billing.close")}
                onClick={() => {
                  if (!loadingBillingItem) setBillingModalOpen(false);
                }}
                disabled={Boolean(loadingBillingItem)}
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white text-2xl leading-none text-[#667085] shadow-sm transition hover:bg-[#f8fafc] hover:text-[#111827] disabled:opacity-50"
              >
                x
              </button>

              <div className="max-h-[92vh] overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[#12bff3] bg-white shadow-[0_16px_40px_rgba(8,191,241,0.18)]">
                    <span className="relative block h-5 w-6">
                      <span className="absolute left-1/2 top-0 h-3 w-4 -translate-x-1/2 rounded-t-sm bg-[#ffd45d]" />
                      <span className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-[#f6a91f]" />
                    </span>
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#08a8d8]">{st("studio.billing.premium")}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#151922] md:text-5xl">{st("studio.billing.plansTitle")}</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#667085] md:text-base">
                    {st("studio.billing.description")}
                  </p>
                  <div className="mt-5 inline-flex rounded-full border border-black/10 bg-[#f3f6fb] p-1">
                    {STUDIO_BILLING_CYCLES.map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() =>
                          setSelectedBillingCycles(
                            Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, cycle]))
                          )
                        }
                        className={`rounded-full px-4 py-2 text-xs font-black transition ${
                          SUBSCRIPTION_PLANS.every((plan) => selectedBillingCycles[plan.id] === cycle)
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6b7280] hover:text-[#111827]"
                        }`}
                      >
                        {st(`studio.billing.cycle.${cycle}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {billingMessage ? (
                  <p className="mx-auto mt-5 max-w-3xl rounded-2xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#be123c]">
                    {billingMessage}
                  </p>
                ) : null}

                <div className="mt-7 grid gap-4 lg:grid-cols-3">
                  <article className="flex min-h-[460px] flex-col rounded-[1.35rem] border border-black/10 bg-[#f8fafc] p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
                    <h3 className="text-2xl font-black text-[#151922]">{st("studio.billing.free")}</h3>
                    <p className="mt-5 text-5xl font-black">$0</p>
                    <p className="mt-2 text-sm font-semibold text-[#667085]">{st("studio.billing.trialCredits")}</p>
                    <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3">
                      <p className="text-3xl font-black tracking-tight text-[#151922]">
                        100
                        <span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                          {st("studio.common.credits")}
                        </span>
                      </p>
                      <StudioCreditUsageExamples credits={100} t={st} compact />
                    </div>
                    <button
                      type="button"
                      disabled
                      className="mt-7 rounded-xl bg-[#e9edf3] px-5 py-3 text-sm font-black text-[#a1a8b3]"
                    >
                      {st("studio.billing.currentPlan")}
                    </button>
                    <div className="mt-8 space-y-3 text-sm font-semibold leading-6 text-[#394150]">
                      {[st("studio.billing.freeFeature.imageAudio"), st("studio.billing.freeFeature.history"), st("studio.billing.freeFeature.refund")].map((feature) => (
                        <p key={feature} className="flex gap-3">
                          <span className="text-[#08bff1]">+</span>
                          <span>{feature}</span>
                        </p>
                      ))}
                    </div>
                  </article>

                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const cycle = selectedBillingCycles[plan.id] || plan.defaultCycle;
                    const price = plan.prices[cycle];
                    const loading = loadingBillingItem === `subscription:${plan.id}:${cycle}`;
                    return (
                      <article
                        key={plan.id}
                        className={`relative flex min-h-[460px] flex-col rounded-[1.35rem] border p-5 shadow-[0_18px_52px_rgba(15,23,42,0.08)] ${
                          plan.highlight
                            ? "border-[#08bff1] bg-white ring-4 ring-[#08bff1]/12"
                            : "border-[#d6c7ff] bg-[linear-gradient(135deg,#ffffff_0%,#f6f1ff_55%,#eafaff_100%)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${plan.highlight ? "bg-[#08bff1] text-[#061215]" : "bg-white text-[#6d55c7]"}`}>
                              {st(`studio.billing.plan.${plan.id}.badge`)}
                            </p>
                            <h3 className="mt-4 text-2xl font-black text-[#151922]">{st(`studio.billing.plan.${plan.id}.name`)}</h3>
                          </div>
                          <select
                            value={cycle}
                            onChange={(event) =>
                              setSelectedBillingCycles((current) => ({
                                ...current,
                                [plan.id]: event.target.value as BillingCycle
                              }))
                            }
                            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-black text-[#485164] outline-none"
                          >
                            {STUDIO_BILLING_CYCLES.map((item) => (
                              <option key={item} value={item}>
                                {st(`studio.billing.cycle.${item}`)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-6">
                          <p className="text-5xl font-black tracking-tight">
                            {formatUsd(price.amountCents).replace(".00", "")}
                            <span className="text-lg font-bold text-[#5d6675]"> / {st(`studio.billing.interval.${price.interval}`)}</span>
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[#667085]">
                            {st("studio.billing.creditsRenew", {
                              credits: price.credits.toLocaleString(),
                              interval: st(`studio.billing.interval.${price.interval}`)
                            })}
                          </p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#08bff1]/25 bg-[linear-gradient(135deg,#f0fbff_0%,#ffffff_55%,#f4f1ff_100%)] px-4 py-3 shadow-[0_10px_28px_rgba(8,191,241,0.08)]">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#487080]">
                            {st("studio.billing.includedCredits")}
                          </p>
                          <p className="mt-1 text-3xl font-black tracking-tight text-[#151922]">
                            {price.credits.toLocaleString()}
                            <span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-[#667085]">
                              {st("studio.common.credits")}
                            </span>
                          </p>
                          <StudioCreditUsageExamples credits={price.credits} t={st} />
                        </div>

                        <button
                          type="button"
                          onClick={() => startStudioSubscriptionCheckout(plan.id, cycle)}
                          disabled={Boolean(loadingBillingItem)}
                          className={`mt-6 rounded-xl px-5 py-3 text-sm font-black transition active:scale-[0.98] disabled:opacity-60 ${
                            plan.highlight ? "bg-[#08bff1] text-[#061215]" : "bg-[#151922] text-white"
                          }`}
                        >
                          {loading ? st("studio.billing.openingCheckout") : st(`studio.billing.plan.${plan.id}.cta`)}
                        </button>

                        <div className="mt-6 space-y-3 text-sm font-semibold leading-6 text-[#394150]">
                          {plan.features.slice(0, 6).map((feature, index) => (
                            <p key={feature} className="flex gap-3">
                              <span className="text-[#08bff1]">+</span>
                              <span>{st(`studio.billing.plan.${plan.id}.feature.${index}`)}</span>
                            </p>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <section className="mt-6 rounded-[1.35rem] border border-black/10 bg-[#fbfcff] p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#667487]">{st("studio.billing.extraCredits")}</p>
                      <h3 className="mt-2 text-2xl font-black text-[#151922]">{st("studio.billing.topUpTitle")}</h3>
                    </div>
                    <p className="text-sm font-semibold text-[#667085]">
                      {st("studio.billing.currentBalance", { balance: creditBalance === null ? "--" : creditBalance.toLocaleString() })}
                    </p>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {CREDIT_PACKS.map((pack) => {
                      const loading = loadingBillingItem === `credits:${pack.id}`;
                      return (
                        <article key={pack.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                          <h4 className="text-base font-black text-[#151922]">{st(`studio.billing.pack.${pack.id}`)}</h4>
                          <p className="mt-2 text-2xl font-black">{formatUsd(pack.amountCents).replace(".00", "")}</p>
                          <p className="mt-2 text-2xl font-black tracking-tight text-[#151922]">
                            {pack.credits.toLocaleString()}
                            <span className="ml-1 text-[10px] uppercase tracking-[0.1em] text-[#667085]">{st("studio.common.credits")}</span>
                          </p>
                          <StudioCreditUsageExamples credits={pack.credits} t={st} compact />
                          <button
                            type="button"
                            onClick={() => startStudioCreditCheckout(pack.id)}
                            disabled={Boolean(loadingBillingItem)}
                            className="mt-4 w-full rounded-xl bg-[#151922] px-4 py-2.5 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
                          >
                            {loading ? st("studio.billing.opening") : st("studio.billing.recharge")}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            </section>
          </div>
        ) : null}

        <section className="relative min-h-[calc(100vh-1rem)] overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white/72 shadow-[0_20px_60px_rgba(71,85,105,0.10)] backdrop-blur-2xl md:rounded-[2.25rem] md:shadow-[0_32px_120px_rgba(71,85,105,0.14)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7dd3fc]/50 to-transparent" />
          <div className="grid min-h-[calc(100vh-1rem)] lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[96px_minmax(0,1fr)]">
            <aside className="hidden border-r border-black/[0.06] bg-white/64 px-3 py-5 lg:flex lg:flex-col lg:items-center">
              <a href="https://dreamface.io" aria-label="DreamFace home" className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#38bdf8,#8b5cf6_58%,#34d399)] text-base font-black text-white shadow-[0_16px_36px_rgba(56,189,248,0.28)]">
                DF
              </a>
              <nav className="mt-9 flex flex-1 flex-col items-center gap-4">
                {[
                  { label: "Home", display: st("studio.nav.home"), href: "/studio?view=home", icon: "home" as StudioIconName },
                  { label: "Avatar", display: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard", icon: "video" as StudioIconName },
                  { label: "Image", display: st("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image" as StudioIconName },
                  { label: "Video", display: st("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video" as StudioIconName },
                  { label: "Audio", display: st("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio" as StudioIconName },
                  { label: "Projects", display: st("studio.nav.projects"), href: "/studio?view=projects", icon: "projects" as StudioIconName }
                ].map((item) => {
                  const active =
                    (item.label === "Home" && isAppsHome) ||
                    (!isAppsHome && !isProjectsView && item.label === "Avatar" && mode === "avatar") ||
                    (item.label === "Projects" && isProjectsView) ||
                    (!isAppsHome && !isProjectsView && item.label === "Image" && mode === "image") ||
                    (!isAppsHome && !isProjectsView && item.label === "Video" && mode === "video") ||
                    (!isAppsHome && !isProjectsView && item.label === "Audio" && mode === "audio");
                  if (item.label === "Image") {
                    return (
                      <div key={item.label} className="group relative w-full">
                        <Link
                          href={item.href}
                          className={`flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                            active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#6b7280] hover:bg-black/[0.035] hover:text-[#202633]"
                          }`}
                        >
                          <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${
                            active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/70 text-[#667085]"
                          }`}>
                            <StudioIcon name={item.icon} className="h-4 w-4" />
                          </span>
                          {item.display}
                        </Link>
                        <div className="pointer-events-none absolute left-full top-0 z-50 w-64 translate-x-2 pl-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
                          <div className="rounded-3xl border border-black/[0.06] bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                            {[
                              {
                                label: st("studio.workflow.text-to-image"),
                                body: st("studio.home.quick.textImage"),
                                href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image"
                              },
                              {
                                label: st("studio.workflow.image-to-image"),
                                body: st("studio.home.quick.imageImage"),
                                href: "/studio?mode=image&workflow=image-to-image&provider=nano-banana-image"
                              },
                              {
                                label: st("studio.workflow.enhance-cleanup"),
                                body: st("studio.home.quick.enhance"),
                                href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image"
                              },
                              {
                                label: st("studio.workflow.background-remove"),
                                body: st("studio.home.quick.remove"),
                                href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove"
                              }
                            ].map((workflowItem) => (
                              <Link
                                key={workflowItem.label}
                                href={workflowItem.href}
                                onClick={() =>
                                  trackEvent("studio_workflow_selected", { mode: "image", workflow: workflowItem.label, surface: "sidebar_hover" }, accessToken)
                                }
                                className="block rounded-2xl px-4 py-3 text-left transition hover:bg-[#f3f8ff]"
                              >
                                <span className="text-sm font-semibold text-[#202633]">{workflowItem.label}</span>
                                <span className="mt-1 block text-xs font-medium text-[#8b95a7]">{workflowItem.body}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`group flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                        active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#6b7280] hover:bg-black/[0.035] hover:text-[#202633]"
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${
                        active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/70 text-[#667085]"
                      }`}>
                        <StudioIcon name={item.icon} className="h-4 w-4" />
                      </span>
                      {item.display}
                    </Link>
                  );
                })}
              </nav>
              <Link href="/billing" className="flex w-full items-center justify-center rounded-2xl bg-[#ecfeff] px-2 py-2 text-[11px] font-semibold text-[#06b6d4]">
                {st("studio.billing.open")}
              </Link>
            </aside>

            <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-[1.4rem] border border-black/[0.08] bg-white/90 p-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
              {[
                { label: st("studio.nav.home"), href: "/studio?view=home", icon: "home" as StudioIconName, active: isAppsHome },
                { label: st("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "image" },
                { label: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "avatar" },
                { label: st("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "video" },
                { label: st("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "audio" },
                { label: st("studio.nav.projects"), href: "/studio?view=projects", icon: "projects" as StudioIconName, active: isProjectsView }
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 text-[11px] font-semibold transition ${
                    item.active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#667085]"
                  }`}
                >
                  <StudioIcon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="relative px-3 pb-24 pt-3 md:px-8 md:py-5 lg:px-12">
              <div className="flex items-start justify-between gap-3 md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label={mobileStudioMenuOpen ? st("studio.menu.close") : st("studio.menu.open")}
                      aria-expanded={mobileStudioMenuOpen}
                      onClick={() => setMobileStudioMenuOpen((open) => !open)}
                      className="relative z-[65] grid h-10 w-10 place-items-center rounded-full border border-black/[0.08] bg-white text-[#202633] shadow-sm transition hover:bg-[#f8fbff] lg:hidden"
                    >
                      <StudioIcon name={mobileStudioMenuOpen ? "x" : "menu"} className="h-5 w-5" />
                    </button>
                    <Link href="/studio?view=home" aria-label={st("studio.menu.studioHome")} className="hidden h-10 w-10 place-items-center rounded-full border border-black/[0.08] bg-white text-[#202633] shadow-sm transition hover:bg-[#f8fbff] lg:grid">
                      <StudioIcon name="home" className="h-5 w-5" />
                    </Link>
                    {mobileStudioMenuOpen ? (
                      <>
                      <button
                        type="button"
                        aria-label={st("studio.menu.close")}
                        onClick={() => setMobileStudioMenuOpen(false)}
                        className="fixed inset-0 z-[55] cursor-default bg-transparent lg:hidden"
                      />
                      <div className="fixed left-4 top-[4.45rem] z-[60] max-h-[calc(100dvh-6rem)] w-[min(17rem,calc(100vw-2rem))] overflow-y-auto rounded-[1.15rem] border border-black/[0.08] bg-white p-1.5 shadow-[0_18px_52px_rgba(15,23,42,0.20)] lg:hidden">
                        {[
                          { label: st("studio.menu.dreamfaceHome"), href: "https://dreamface.io/", icon: "home" as StudioIconName, active: false },
                          { label: st("studio.menu.studioHome"), href: "/studio?view=home", icon: "home" as StudioIconName, active: isAppsHome },
                          { label: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "avatar" },
                          { label: st("studio.header.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "image" },
                          { label: st("studio.header.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "video" },
                          { label: st("studio.header.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "audio" },
                          { label: st("studio.nav.projects"), href: "/studio?view=projects", icon: "projects" as StudioIconName, active: isProjectsView }
                        ].map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            onClick={() => setMobileStudioMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-[1rem] px-2.5 py-2.5 text-sm font-semibold transition ${
                              item.active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#485164] hover:bg-[#f6f9fc] hover:text-[#202633]"
                            }`}
                          >
                            <span className={`grid h-8 w-8 place-items-center rounded-xl border ${
                              item.active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/80 text-[#667085]"
                            }`}>
                              <StudioIcon name={item.icon} className="h-4 w-4" />
                            </span>
                            {item.label}
                          </Link>
                        ))}
                        <div className="mt-1 border-t border-black/[0.06] px-2 pb-1 pt-3">
                          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-[#8b95a7]">
                            <StudioIcon name="globe" className="h-4 w-4" />
                            <span>{st("studio.language")}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {studioI18n.locales.map((locale) => (
                              <button
                                key={locale}
                                type="button"
                                onClick={() => {
                                  studioI18n.setLocale(locale);
                                  setMobileStudioMenuOpen(false);
                                }}
                                className={`min-h-10 rounded-xl px-2 py-2 text-left text-xs font-bold transition ${
                                  studioI18n.locale === locale
                                    ? "bg-[#e8f7ff] text-[#0284c7]"
                                    : "bg-[#f8fafc] text-[#485164] hover:bg-[#f1f5f9]"
                                }`}
                              >
                                {studioI18n.localeLabels[locale]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      </>
                    ) : null}
                  </div>
                  <div>
                    <p className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7] sm:block">{st("studio.header.apps")}</p>
                    <h1 className="truncate text-lg font-semibold tracking-tight text-[#202633] sm:text-xl md:text-3xl">
                      {isProjectsView
                        ? st("studio.header.projects")
                        : isAppsHome
                          ? st("studio.header.toolkit")
                          : mode === "image"
                            ? st("studio.header.image")
                            : mode === "audio"
                              ? st("studio.header.audio")
                              : mode === "avatar"
                                ? st("studio.header.avatar")
                                : st("studio.header.video")}
                    </h1>
                    <p className="mt-1 hidden text-sm text-[#8b95a7] sm:block">
                      {isProjectsView
                        ? st("studio.header.projectsDescription")
                        : isAppsHome
                        ? st("studio.header.toolkitDescription")
                        : mode === "image"
                          ? st("studio.header.imageDescription")
                          : mode === "avatar"
                            ? st("studio.header.avatarDescription")
                            : st("studio.header.videoDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => openBillingModal("balance")}
                    className="rounded-full border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-[#485164] shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#08bff1]/45 hover:text-[#0f172a] hover:shadow-[0_16px_36px_rgba(8,191,241,0.14)] md:rounded-2xl md:px-4 md:text-sm"
                  >
                    {st("studio.billing.creditCount", { credits: creditBalance === null ? "--" : creditBalance.toLocaleString() })}
                  </button>
                  <label className="hidden items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-[#485164] shadow-[0_10px_28px_rgba(15,23,42,0.08)] md:inline-flex">
                    <span className="sr-only">{st("studio.language")}</span>
                    <select
                      value={studioI18n.locale}
                      onChange={(event) => studioI18n.setLocale(event.target.value as typeof studioI18n.locale)}
                      className="bg-transparent text-xs font-black outline-none"
                    >
                      {studioI18n.locales.map((locale) => (
                        <option key={locale} value={locale}>
                          {studioI18n.localeLabels[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    aria-label={st("studio.billing.title")}
                    title={st("studio.billing.title")}
                    onClick={() => openBillingModal("vip_badge")}
                    className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#12bff3] bg-white text-[#f6b431] shadow-[0_12px_30px_rgba(8,191,241,0.18)] transition hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-[0_18px_42px_rgba(8,191,241,0.26)]"
                  >
                    <span className="relative block h-4 w-5">
                      <span className="absolute left-1/2 top-0 h-2.5 w-3.5 -translate-x-1/2 rounded-t-sm bg-[#ffd45d]" />
                      <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-[#f6a91f]" />
                    </span>
                  </button>
                  {accessToken ? (
                    <Link href="/studio?view=projects" className="hidden rounded-2xl bg-[#202633] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] sm:inline-flex">
                      {st("studio.nav.projects")}
                    </Link>
                  ) : mode === "audio" ? (
                    <button
                      type="button"
                      onClick={() => applyWorkflow("text-to-audio")}
                      className="rounded-full border border-[#bae6fd] bg-[#e8f7ff] px-4 py-2 text-sm font-semibold text-[#0284c7] shadow-sm"
                    >
                      {st("studio.workflow.text-to-audio")}
                    </button>
                  ) : (
                    <Link href="/auth?next=%2Fstudio%3Fmode%3Dimage%26workflow%3Dtext-to-image" className="rounded-full bg-[#202633] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] md:rounded-2xl md:px-4 md:text-sm">
                      {st("studio.auth.signIn")}
                    </Link>
                  )}
                </div>
              </div>
              {creditNote ? (
                <p className="mt-3 rounded-2xl border border-black/[0.06] bg-white/76 px-4 py-3 text-xs font-semibold text-[#667085] shadow-sm">
                  {creditNote}
                </p>
              ) : null}

              {isAppsHome ? (
                <div className="mx-auto mt-5 max-w-7xl md:mt-8">
                  <div className={`relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-gradient-to-br ${activeHomeSlide.gradient} p-4 shadow-[0_24px_70px_rgba(56,189,248,0.14)] md:rounded-[2.2rem] md:p-7`}>
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
                      <div className="relative flex min-h-[360px] flex-col justify-between rounded-[1.2rem] bg-white/62 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur md:rounded-[1.8rem] md:p-8">
                        <div>
                          <div className="mb-5 flex items-center justify-between gap-3">
                            <span className="rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                              {activeHomeSlide.eyebrow}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                aria-label={st("studio.home.previous")}
                                onClick={() => setHomeSlideIndex((index) => (index + localizedHomeSlides.length - 1) % localizedHomeSlides.length)}
                                className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white/80 text-[#667085] shadow-sm transition hover:bg-white hover:text-[#202633]"
                              >
                                <StudioIcon name="chevron-left" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={st("studio.home.next")}
                                onClick={() => setHomeSlideIndex((index) => (index + 1) % localizedHomeSlides.length)}
                                className="grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white/80 text-[#667085] shadow-sm transition hover:bg-white hover:text-[#202633]"
                              >
                                <StudioIcon name="chevron-right" className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <h2 className="max-w-2xl text-4xl font-black leading-[1.02] tracking-tight text-[#202633] md:text-6xl">
                            {activeHomeSlide.title}{" "}
                            <span className="bg-[linear-gradient(90deg,#0ea5e9,#8b5cf6,#14b8a6)] bg-clip-text text-transparent">
                              {activeHomeSlide.accent}
                            </span>
                          </h2>
                          <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-[#536071] md:text-lg">{activeHomeSlide.body}</p>
                        </div>
                        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
                          <Link
                            href={activeHomeSlide.href}
                            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#111827] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5"
                          >
                            {activeHomeSlide.cta}
                            <StudioIcon name="chevron-right" className="h-4 w-4" />
                          </Link>
                          <div className="flex flex-wrap gap-2">
                            {activeHomeSlide.stats.map((item) => (
                              <span key={item} className="rounded-full border border-white/80 bg-white/62 px-3 py-1.5 text-xs font-black text-[#475569] shadow-sm backdrop-blur">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { label: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=kling-avatar-standard", icon: "video" as StudioIconName, accent: "bg-[#eff6ff] text-[#2563eb]", note: st("studio.home.quick.avatar") },
                          { label: st("studio.workflow.text-to-image"), href: "/studio?mode=image&workflow=text-to-image&provider=chatgpt-image", icon: "sparkles" as StudioIconName, accent: "bg-[#ecfeff] text-[#0891b2]", note: st("studio.home.quick.textImage") },
                          { label: st("studio.workflow.image-to-video"), href: "/studio?mode=video&workflow=image-to-video&duration=5s", icon: "motion" as StudioIconName, accent: "bg-[#f0fdf4] text-[#16a34a]", note: st("studio.home.quick.imageVideo") },
                          { label: st("studio.workflow.enhance-cleanup"), href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image", icon: "cleanup" as StudioIconName, accent: "bg-[#fff7ed] text-[#f97316]", note: st("studio.home.quick.enhance") }
                        ].map((item) => (
                          <Link
                            key={item.label}
                            href={item.href}
                            className="group min-h-[174px] rounded-[1.35rem] border border-white/72 bg-white/70 p-5 text-left shadow-[0_16px_42px_rgba(15,23,42,0.08)] backdrop-blur transition hover:-translate-y-1 hover:bg-white md:min-h-[190px]"
                          >
                            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${item.accent}`}>
                              <StudioIcon name={item.icon} className="h-6 w-6" />
                            </span>
                            <span className="mt-5 block text-xl font-black tracking-tight text-[#202633]">{item.label}</span>
                            <span className="mt-1 block text-sm font-semibold text-[#667085]">{item.note}</span>
                            <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[#0ea5e9]">
                              {st("studio.home.open")} <StudioIcon name="chevron-right" className="h-4 w-4 transition group-hover:translate-x-0.5" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-center gap-2">
                      {localizedHomeSlides.map((slide, index) => (
                        <button
                          key={slide.eyebrow}
                          type="button"
                          aria-label={`Show ${slide.eyebrow}`}
                          onClick={() => setHomeSlideIndex(index)}
                          className={`h-2 rounded-full transition-all ${
                            index === homeSlideIndex ? "w-9 bg-[#202633]" : "w-2.5 bg-white/70 hover:bg-white"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
                    {localizedToolkitApps.map((app) => (
                      <Link
                        key={app.title}
                        href={app.href}
                        className="group relative min-h-[138px] overflow-hidden rounded-[1.35rem] border border-black/[0.05] bg-white/72 p-5 text-left shadow-[0_12px_34px_rgba(15,23,42,0.055)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_52px_rgba(15,23,42,0.09)]"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${app.accent} opacity-55 transition group-hover:opacity-80`} />
                        <div className="relative flex items-start gap-4">
                          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ${app.iconClass}`}>
                            <StudioIcon name={app.icon} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-black tracking-tight text-[#202633]">{app.title}</h3>
                            <p className="mt-1 text-sm font-semibold leading-5 text-[#7a8496]">{app.body}</p>
                          </div>
                        </div>
                        <span className="relative mt-5 inline-flex items-center gap-1 text-sm font-black text-[#0ea5e9]">
                          {st("studio.home.open")} <StudioIcon name="chevron-right" className="h-4 w-4" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {isProjectsView ? (
                <div className="mx-auto mt-5 max-w-7xl md:mt-10">
                  <div className="mb-4 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b95a7]">{st("studio.projects.eyebrow")}</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#202633] md:text-5xl">
                        {st("studio.projects.title")}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a8496] md:mt-3">
                        {st("studio.projects.description")}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-black/[0.06] bg-white/72 p-2 shadow-sm md:min-w-[300px]">
                      {[
                        [st("studio.projects.active"), activeTasks.length],
                        [st("studio.projects.done"), completedTasks.length],
                        [st("studio.projects.failed"), failedTasks.length]
                      ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl bg-[#f8fbff] px-3 py-2.5 text-center md:px-4 md:py-3">
                          <p className="text-lg font-semibold text-[#202633]">{value}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b95a7]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {taskHistoryNote ? (
                    <p className="mb-5 rounded-2xl border border-black/[0.06] bg-white/76 px-4 py-3 text-sm font-medium text-[#667085] shadow-sm">
                      {taskHistoryNote}
                    </p>
                  ) : null}

                  <div className="grid gap-4 md:gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <aside className="order-2 rounded-[1.5rem] border border-black/[0.06] bg-white/76 p-3 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl md:rounded-[2rem] xl:order-1">
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <h3 className="text-sm font-semibold text-[#202633]">{st("studio.projects.list")}</h3>
                          <p className="text-xs font-medium text-[#8b95a7]">
                            {st("studio.projects.savedTasks", {
                              count: tasks.length,
                              label: st(tasks.length === 1 ? "studio.projects.task" : "studio.projects.tasks")
                            })}
                          </p>
                        </div>
                        <Link href="/studio?mode=image&workflow=text-to-image" className="rounded-full bg-[#0ea5e9] px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_26px_rgba(14,165,233,0.22)]">
                          {st("studio.projects.new")}
                        </Link>
                      </div>
                      <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1 md:max-h-[520px] xl:max-h-[680px]">
                        {tasks.length ? (
                          tasks.map((task) => {
                            const selected = selectedProjectTask?.id === task.id;
                            return (
                              <Link
                                key={task.id}
                                href={studioProjectHref(task.id)}
                                className={`block rounded-[1.5rem] border p-4 text-left transition ${
                                  selected
                                    ? "border-[#93c5fd] bg-[linear-gradient(135deg,#ffffff,#eef7ff)] shadow-[0_16px_40px_rgba(14,165,233,0.14)]"
                                    : "border-black/[0.05] bg-white/72 hover:border-[#bae6fd] hover:bg-white"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-[#202633]">{taskTitle(task)}</p>
                                    <p className="mt-1 text-xs font-medium text-[#8b95a7]">
                                      {providerLabel(task.provider)} / {formatTaskDate(task.createdAt)}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPillClass(task.status)}`}>
                                    {taskStatusLabel(task.status)}
                                  </span>
                                </div>
                                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#7a8496]">{task.prompt || st("studio.projects.noPrompt")}</p>
                                <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa4b5]">
                                  <span>{taskTypeLabel(task.type)}</span>
                                  <span>{task.cost} {st("studio.common.credits")}</span>
                                </div>
                              </Link>
                            );
                          })
                        ) : (
                          <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-white/70 p-8 text-center">
                            <p className="text-sm font-semibold text-[#202633]">{st("studio.projects.none")}</p>
                            <p className="mt-2 text-xs leading-5 text-[#8b95a7]">{st("studio.projects.empty")}</p>
                          </div>
                        )}
                      </div>
                    </aside>

                    <section className="order-1 overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[linear-gradient(135deg,#fbfdff,#f7f9fd)] p-3 shadow-[0_26px_86px_rgba(15,23,42,0.10)] md:rounded-[2rem] md:p-6 xl:order-2 xl:min-h-[680px]">
                      {selectedProjectTask ? (
                        <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:gap-5">
                          <article className="relative overflow-hidden rounded-[1.25rem] bg-[#111827] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.22)] md:rounded-[1.75rem] md:p-4">
                            <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-[#60a5fa]/20 blur-3xl" />
                            <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[#c084fc]/18 blur-3xl" />
                            <div className="relative mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{st("studio.projects.preview")}</p>
                                <h3 className="mt-1 max-w-xl truncate text-base font-semibold text-white md:text-lg">{taskTitle(selectedProjectTask)}</h3>
                              </div>
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${statusPillClass(selectedProjectTask.status)}`}>
                                {taskStatusLabel(selectedProjectTask.status)}
                              </span>
                            </div>
                            <div className="relative grid min-h-[300px] place-items-center overflow-hidden rounded-[1.1rem] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(96,165,250,0.16),transparent_35%),linear-gradient(180deg,#182131,#0d121d)] sm:min-h-[380px] md:min-h-[520px] md:rounded-[1.35rem]">
                              {selectedProjectTask.mediaUrl ? (
                                selectedProjectTask.type === "Video" ? (
                                  <video src={selectedProjectTask.mediaUrl} controls className="max-h-[420px] w-full rounded-[1.2rem] object-contain md:max-h-[620px]" />
                                ) : selectedProjectTask.type === "Audio" ? (
                                  <div className="w-full max-w-xl rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
                                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/45">{st("studio.projects.voiceover")}</p>
                                    <audio src={selectedProjectTask.mediaUrl} controls className="w-full" />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModal({ url: selectedProjectTask.mediaUrl || "", type: "Image" })}
                                    className="block max-h-[420px] max-w-full overflow-hidden rounded-[1.2rem] shadow-[0_30px_90px_rgba(0,0,0,0.38)] transition hover:scale-[1.01] md:max-h-[620px]"
                                  >
                                    <img src={selectedProjectTask.mediaUrl} alt={selectedProjectTask.id} className="max-h-[420px] w-full object-contain md:max-h-[620px]" />
                                  </button>
                                )
                              ) : (
                                <div className="max-w-sm px-6 text-center">
                                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/10 text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
                                    {selectedProjectTask.status === "Failed" ? "!" : "..."}
                                  </div>
                                  <p className="mt-5 text-base font-semibold text-white">
                                    {selectedProjectTask.status === "Failed" ? st("studio.projects.generationFailed") : st("studio.projects.providerCreating")}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-white/55">
                                    {selectedProjectTask.status === "Failed"
                                      ? selectedProjectTask.failureReason || st("studio.projects.refundDefault")
                                      : st("studio.projects.providerCreatingDescription")}
                                  </p>
                                  {selectedProjectTask.status === "Queued" || selectedProjectTask.status === "Running" ? (
                                    <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#8b5cf6)] transition-all"
                                        style={{ width: `${taskProgress(selectedProjectTask, duration)}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </article>

                          <aside className="space-y-3 md:space-y-4">
                            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white p-5 shadow-sm">
                              <div className="flex flex-wrap gap-2">
                                {selectedProjectTask.mediaUrl ? (
                                  <a
                                    href={`/api/generate/download?url=${encodeURIComponent(selectedProjectTask.mediaUrl)}&name=${encodeURIComponent(selectedProjectTask.id)}`}
                                    className="rounded-full bg-[#202633] px-4 py-2 text-sm font-semibold text-white"
                                  >
                                    {st("studio.projects.download")}
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedProjectTask.prompt) navigator.clipboard.writeText(selectedProjectTask.prompt).catch(() => null);
                                  }}
                                  className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[#202633]"
                                >
                                  {st("studio.projects.copyPrompt")}
                                </button>
                                <Link href={regenerateHref(selectedProjectTask)} className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[#202633]">
                                  {selectedProjectTask.status === "Failed" ? st("studio.projects.retry") : st("studio.projects.regenerate")}
                                </Link>
                                {selectedProjectTask.mediaUrl && selectedProjectTask.type !== "Audio" ? (
                                  <Link href={useAsReferenceHref(selectedProjectTask)} className="rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[#202633]">
                                    {st("studio.projects.useReference")}
                                  </Link>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white p-5 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7]">{st("studio.projects.prompt")}</p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#354052]">
                                {selectedProjectTask.prompt || st("studio.projects.noPrompt")}
                              </p>
                            </div>

                            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white p-5 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7]">{st("studio.projects.details")}</p>
                              <dl className="mt-4 space-y-3 text-sm">
                                {[
                                  [st("studio.projects.model"), providerLabel(selectedProjectTask.provider)],
                                  [st("studio.projects.mode"), taskTypeLabel(selectedProjectTask.type)],
                                  [st("studio.projects.created"), formatTaskDate(selectedProjectTask.createdAt)],
                                  [st("studio.projects.charged"), `${selectedProjectTask.chargedCredits ?? selectedProjectTask.cost} ${st("studio.common.credits")}`],
                                  [st("studio.projects.refund"), selectedProjectTask.refundedCredits ? `${selectedProjectTask.refundedCredits} ${st("studio.common.credits")}` : selectedProjectTask.refundStatus || "not_applicable"],
                                  [st("studio.projects.transport"), selectedProjectTask.transport || "real"]
                                ].map(([label, value]) => (
                                  <div key={label} className="flex items-center justify-between gap-4 border-b border-black/[0.05] pb-3 last:border-0 last:pb-0">
                                    <dt className="font-medium text-[#8b95a7]">{label}</dt>
                                    <dd className="text-right font-semibold text-[#202633]">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </aside>
                        </div>
                      ) : (
                        <div className="grid min-h-[620px] place-items-center rounded-[1.75rem] border border-dashed border-black/[0.08] bg-white/70 text-center">
                          <div>
                            <p className="text-lg font-semibold text-[#202633]">{st("studio.projects.start")}</p>
                            <p className="mt-2 text-sm text-[#8b95a7]">{st("studio.projects.startDescription")}</p>
                            <Link href="/studio?mode=image&workflow=text-to-image" className="mt-5 inline-flex rounded-full bg-[#0ea5e9] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(14,165,233,0.22)]">
                              {st("studio.projects.createNow")}
                            </Link>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              ) : null}

              <div className={`mx-auto mt-5 max-w-5xl text-center md:mt-16 ${isAppsHome || isProjectsView ? "hidden" : ""}`}>
                <h2 className="hidden text-3xl font-semibold tracking-tight text-[#202633] sm:block md:text-5xl">
                  {st("studio.heading.createToday")}
                </h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7">
                  {mode === "image" ? (
                    <>
                      <div className="grid w-full max-w-[720px] grid-cols-2 rounded-2xl border border-black/[0.06] bg-white/82 p-1 shadow-sm sm:inline-grid sm:w-auto sm:max-w-none sm:grid-cols-4 sm:rounded-full">
                        {(["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as StudioWorkflow[]).map((workflow) => {
                          const active = imageWorkflow === workflow;
                          return (
                            <button
                              key={workflow}
                              type="button"
                              onClick={() => applyWorkflow(workflow)}
                              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition sm:py-2 ${
                                active
                                  ? "bg-[#202633] text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]"
                                  : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"
                              }`}
                            >
                              {st(`studio.workflow.${workflow}`)}
                            </button>
                          );
                        })}
                      </div>
                    <button
                      type="button"
                      onClick={() => applyWorkflow(referenceImageUrls.length ? "image-to-image" : "text-to-image")}
                      className="hidden rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#354052] shadow-sm"
                    >
                      Image Studio / Text + Reference
                    </button>
                    </>
                  ) : mode === "video" ? (
                    (["text-to-video", "image-to-video"] as StudioWorkflow[]).map((workflow) => {
                      const active = activeWorkflow === workflow;
                      return (
                        <button
                          key={workflow}
                          type="button"
                          onClick={() => applyWorkflow(workflow)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-[#bae6fd] bg-[#e8f7ff] text-[#0284c7] shadow-sm"
                              : "border-black/[0.06] bg-white/78 text-[#667085] hover:bg-white hover:text-[#202633]"
                          }`}
                        >
                          {st(`studio.workflow.${workflow}`)}
                        </button>
                      );
                    })
                  ) : (
                    null
                  )}
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.7rem] border border-black/[0.06] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.09)] sm:mt-5 md:mt-7 md:rounded-[2rem] md:shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
                  <div className="p-5 text-left md:p-7">
                    {isPromptlessImageWorkflow ? (
                      <div
                        className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#fbfdff] p-4"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#202633]">{st("studio.field.imageUrl")}<span className="text-[#2563eb]">*</span></span>
                          <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-xs font-semibold text-[#0891b2]">{st("studio.field.transparentPng")}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <input
                            value={referenceImagesText}
                            onChange={(event) => setReferenceImagesText(event.target.value)}
                            placeholder="https://.../image.jpg"
                            className="min-h-12 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                          />
                          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-black/[0.08] bg-white px-5 text-sm font-semibold text-[#202633] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            {st("studio.action.chooseImage")}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                            />
                          </label>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#667085]">
                          {st("studio.reference.backgroundHint")}
                        </p>
                      </div>
                    ) : (
                      <textarea
                        rows={5}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[190px] w-full resize-none bg-transparent text-[17px] leading-8 text-[#202633] outline-none placeholder:text-[#98a3b8] sm:min-h-[132px] sm:text-base sm:leading-7 md:min-h-[154px] md:text-lg md:leading-8"
                        placeholder={
                          mode === "image"
                            ? st("studio.placeholder.image")
                            : mode === "audio"
                              ? st("studio.placeholder.audio")
                            : mode === "avatar"
                              ? st("studio.placeholder.avatar")
                            : activeWorkflow === "image-to-video"
                              ? st("studio.placeholder.imageVideo")
                              : st("studio.placeholder.video")
                        }
                      />
                    )}
                    {referenceImageUrls.length ? (
                      <div className="mt-4 border-t border-black/[0.06] pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8791a3]">
                            {st("studio.reference.count", {
                              count: referenceImageUrls.length,
                              label: st(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
                            })}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setReferenceImagesText("");
                              setReferenceImageFiles([]);
                              if (mode === "image" && !isPromptlessImageWorkflow) setImageWorkflow("text-to-image");
                              if (mode === "video" && !isAvatarWorkflow) setVideoWorkflow("text-to-video");
                            }}
                            className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-semibold text-[#667085] hover:bg-[#f8fafc]"
                          >
                            {st("studio.action.clear")}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {referenceImageUrls.slice(0, 8).map((url, index) => (
                            <div key={`${url.slice(0, 32)}-${index}`} className="h-16 w-16 overflow-hidden rounded-2xl bg-[#f2f6fb] shadow-sm">
                              <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {isAvatarWorkflow ? (
                      <div className="mt-4 border-t border-black/[0.06] pt-4">
                        <div
                          className="mb-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#fbfdff] p-4"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[#202633]">{st("studio.field.imageUrl")}<span className="text-[#2563eb]">*</span></span>
                            <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2563eb]">{st("studio.field.avatarImage")}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              value={referenceImagesText}
                              onChange={(event) => setReferenceImagesText(event.target.value)}
                              placeholder="https://.../avatar.jpg"
                              className="min-h-12 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                            />
                            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-black/[0.08] bg-white px-5 text-sm font-semibold text-[#202633] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                              {st("studio.action.choose")}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                              />
                            </label>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[#667085]">
                            {st("studio.reference.avatarHint")}
                          </p>
                          {referenceImageUrls.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {referenceImageUrls.slice(0, 4).map((url, index) => (
                                <div key={`${url.slice(0, 32)}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-[#7c3aed] bg-[#f2f6fb] shadow-sm">
                                  <img src={url} alt={`Avatar input ${index + 1}`} className="h-full w-full object-cover" />
                                  <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#7c3aed] text-xs font-black text-white">?</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="mb-4 grid gap-4 lg:grid-cols-[0.72fr_1fr]">
                          <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-[#0f172a] shadow-sm">
                            <video
                              src={KLING_AVATAR_PREVIEW_VIDEO_URL}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                              className="aspect-video w-full bg-black object-cover"
                            />
                          </div>
                          <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4">
                            <p className="text-sm font-semibold text-[#202633]">{st("studio.avatar.example")}</p>
                            <p className="mt-2 text-xs leading-5 text-[#667085]">
                              {st("studio.avatar.exampleDescription")}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[#202633]">{st("studio.avatar.voice")}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${avatarScriptTooLong ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
                              {avatarScriptMeta}
                            </span>
                          </div>
                          <div className="mb-3 inline-grid grid-cols-3 rounded-full border border-black/[0.06] bg-white p-1 shadow-sm">
                            {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setAvatarVoiceGender(option.value)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  avatarVoiceGender === option.value
                                    ? "bg-[#202633] text-white shadow-[0_8px_20px_rgba(32,38,51,0.14)]"
                                    : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"
                                }`}
                              >
                                {st(`studio.voiceGender.${option.value}`)}
                              </button>
                            ))}
                          </div>
                          <div className="grid gap-3 lg:grid-cols-3">
                            <select
                              value={ttsVoice}
                              onChange={(e) => setTtsVoice(e.target.value)}
                              className="min-h-12 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                            >
                              {avatarVoiceOptions.map((voice) => (
                                <option key={voice} value={voice}>{voice}</option>
                              ))}
                            </select>
                            <select
                              value={ttsLanguageCode}
                              onChange={(e) => setTtsLanguageCode(e.target.value)}
                              className="min-h-12 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-semibold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                            >
                              {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                                <option key={item.value || "auto"} value={item.value}>
                                  {st(`studio.languageOption.${item.value || "auto"}`)}
                                </option>
                              ))}
                            </select>
                            <label className="rounded-xl border border-black/[0.08] bg-white px-4 py-2.5">
                              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8791a3]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={ttsStability}
                                onChange={(e) => setTtsStability(Number(e.target.value))}
                                className="mt-1 w-full accent-[#202633]"
                              />
                            </label>
                          </div>
                          <p className={`mt-3 text-xs leading-5 ${avatarScriptTooLong ? "text-[#e11d48]" : "text-[#667085]"}`}>
                            {avatarScriptTooLong
                              ? st("studio.avatar.scriptTooLong")
                              : st("studio.avatar.billingHint", { duration: avatarDuration })}
                          </p>
                        </div>

                        {avatarNeedsImage ? (
                          <div className="mb-4 grid gap-3 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={startAvatarImageGuide}
                              className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#2563eb]">{st("studio.avatar.guideEyebrow")}</span>
                              <span className="mt-2 block text-sm font-semibold text-[#202633]">{st("studio.avatar.guideTitle")}</span>
                              <span className="mt-1 block text-xs leading-5 text-[#667085]">{st("studio.avatar.guideDescription")}</span>
                            </button>
                          </div>
                        ) : null}
                        <label className="hidden">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8791a3]">Voiceover audio URL</span>
                          <input
                            value={avatarAudioUrl}
                            onChange={(event) => setAvatarAudioUrl(event.target.value)}
                            placeholder="https://.../voiceover.mp3"
                            className="mt-2 w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-sm font-semibold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 border-t border-black/[0.06] bg-[#fbfcff] px-5 py-4 sm:flex sm:flex-wrap sm:items-center md:px-7">
                    {mode !== "audio" && !isPromptlessImageWorkflow ? (
                    <label
                      title={st("studio.action.addReference")}
                      className="col-span-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white text-sm font-semibold text-[#475467] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid sm:h-10 sm:w-10 sm:place-items-center sm:rounded-full sm:text-xl sm:font-light"
                    >
                      <span className="text-xl font-light leading-none">+</span>
                      <span className="sm:hidden">{st("studio.action.referenceImage")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleReferenceFiles(e.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                      />
                    </label>
                    ) : null}
                    <div className="hidden h-7 w-px bg-black/[0.08] sm:block" />
                    <select
                      value={provider}
                      onChange={(e) => applyProvider(e.target.value)}
                      className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#485164] outline-none transition hover:bg-[#f8fafc] sm:w-auto"
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {PROVIDER_META[option.value]?.label || option.label}
                        </option>
                      ))}
                    </select>
                    {mode === "image" ? (
                      provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                        <select
                          value={ratio}
                          onChange={(e) => {
                            trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                            setRatio(e.target.value);
                          }}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {(provider === "nano-banana-pro" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS).map((item) => (
                            <option key={item} value={item}>
                              {item === "auto" ? st("studio.option.autoRatio") : item}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={imageSize}
                          onChange={(e) => {
                            trackEvent("studio_size_selected", { mode, provider, image_size: e.target.value, ratio: ratioFromImageSize(e.target.value) }, accessToken);
                            setImageSize(e.target.value);
                            setRatio(ratioFromImageSize(e.target.value));
                          }}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {IMAGE_SIZE_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      )
                    ) : mode === "audio" ? (
                      <>
                        <select
                          value={ttsVoice}
                          onChange={(e) => setTtsVoice(e.target.value)}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {ELEVENLABS_VOICES.map((voice) => (
                            <option key={voice} value={voice}>{voice}</option>
                          ))}
                        </select>
                        <select
                          value={ttsLanguageCode}
                          onChange={(e) => setTtsLanguageCode(e.target.value)}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                            <option key={item.value || "auto"} value={item.value}>
                              {st(`studio.languageOption.${item.value || "auto"}`)}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : mode === "avatar" ? (
                      <span className={`rounded-full border px-4 py-2.5 text-center text-sm font-semibold sm:py-2 ${avatarScriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-black/[0.06] bg-white text-[#667085]"}`}>
                        {avatarDuration} {st("studio.option.automatic")}
                      </span>
                    ) : (
                      <>
                        <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto">
                          {videoDurationOptions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                        <select value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={(provider === "kling-video" && activeWorkflow === "image-to-video") || isAvatarWorkflow} className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none disabled:opacity-70 sm:w-auto">
                          {videoRatioOptions.map((item) => (
                            <option key={item} value={item}>{item === "source" ? st("studio.option.sourceImage") : item}</option>
                          ))}
                        </select>
                        {showVideoResolutionControl ? (
                          <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto">
                            {videoResolutionOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        ) : null}
                      </>
                    )}
                    <span className="rounded-full border border-black/[0.06] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#667085] sm:py-2">
                      {provider === "dreamface-io-video"
                        ? usesDreamfaceIoFreeAllowance
                          ? st("studio.generate.dailyFree", { remaining: dreamfaceIoRemainingUnits })
                          : dreamfaceIoEligible
                            ? st("studio.generate.dailyPaid", { credits: estCredits })
                            : st("studio.generate.estimate", { credits: estCredits })
                        : st("studio.generate.estimate", { credits: estCredits })}
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={!canSubmit || isSubmitting || (Boolean(accessToken) && !hasEnoughCredits)}
                      className="col-span-2 min-h-12 rounded-full bg-[#171a22] px-7 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,26,34,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(23,26,34,0.26)] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:min-h-11"
                    >
                      {isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}
                    </button>
                  </div>
                  {provider === "dreamface-io-video" ? (
                    <p className="border-t border-black/[0.05] bg-amber-50/55 px-5 py-2.5 text-center text-xs font-medium text-amber-800/80 md:px-7">
                      {st("studio.dreamfaceIo.qualityHint")}
                    </p>
                  ) : null}
                  {mode === "audio" ? (
                    <div className="border-t border-black/[0.06] bg-white/70 px-5 py-4 text-left md:px-7">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{st("studio.field.modelSettings")}</p>
                        <p className="text-xs font-medium text-[#8b95a7]">{providerSettingsLabel}</p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.field.voice")}</span>
                          <select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none"
                          >
                            {ELEVENLABS_VOICES.map((voice) => (
                              <option key={voice} value={voice}>{voice}</option>
                            ))}
                          </select>
                        </label>
                        <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={ttsStability}
                            onChange={(e) => setTtsStability(Number(e.target.value))}
                            className="w-full accent-[#202633]"
                          />
                        </label>
                        <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.field.language")}</span>
                          <select
                            value={ttsLanguageCode}
                            onChange={(e) => setTtsLanguageCode(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none"
                          >
                          {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                              <option key={item.value || "auto"} value={item.value}>
                                {st(`studio.languageOption.${item.value || "auto"}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.field.textNormalization")}</span>
                          <select
                            value={textNormalization}
                            onChange={(e) => setTextNormalization(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none"
                          >
                          {TEXT_NORMALIZATION_OPTIONS.map((item) => (
                              <option key={item.value} value={item.value}>
                                {st(`studio.textNormalization.${item.value}`)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                        <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span>
                            <span className="block text-sm font-semibold text-[#485164]">{st("studio.field.wordTimestamps")}</span>
                            <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.audio.wordTimestampsDescription")}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={ttsTimestamps}
                            onChange={(e) => setTtsTimestamps(e.target.checked)}
                            className="h-5 w-5"
                          />
                        </label>
                        <p className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm font-semibold text-[#667085]">
                          {st("studio.audio.creditEstimate", {
                            characters: audioCharacterCount.toLocaleString(),
                            credits: estCredits
                          })}
                        </p>
                      </div>
                    </div>
                  ) : mode === "image" && !isPromptlessImageWorkflow ? (
                    <div className="border-t border-black/[0.06] bg-white/70 px-5 py-4 text-left md:px-7">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{st("studio.field.modelSettings")}</p>
                        <p className="text-xs font-medium text-[#8b95a7]">{providerSettingsLabel}</p>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-4">
                        {provider === "chatgpt-image" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.quality")}</p>
                            <div className="grid grid-cols-4 gap-1">
                              {(["auto", "low", "medium", "high"] as const).map((quality) => (
                                <button
                                  key={quality}
                                  type="button"
                                  onClick={() => setImageQuality(quality)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold capitalize transition ${
                                    imageQuality === quality ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                  }`}
                                >
                                  {quality}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <>
                            <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.steps")}</p>
                              <div className="grid grid-cols-4 gap-1">
                                {(provider === "flux-image" ? [1, 2, 4, 8, 12] : [4, 8, 16, 28, 50]).map((steps) => (
                                  <button
                                    key={steps}
                                    type="button"
                                    onClick={() => setNumInferenceSteps(steps)}
                                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                      numInferenceSteps === steps ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                    }`}
                                  >
                                    {steps}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.guidance")}</p>
                              <input
                                type="range"
                                min="1"
                                max="20"
                                step="0.5"
                                value={guidanceScale}
                                onChange={(e) => setGuidanceScale(Number(e.target.value))}
                                className="w-full accent-[#0ea5e9]"
                              />
                              <p className="mt-1 text-xs font-semibold text-[#202633]">{guidanceScale}</p>
                            </div>
                          </>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.resolution")}</p>
                            <div className="grid grid-cols-4 gap-1">
                              {(provider === "nano-banana-pro" ? ["1K", "2K", "4K"] : ["0.5K", "1K", "2K", "4K"]).map((resolution) => (
                                <button
                                  key={resolution}
                                  type="button"
                                  onClick={() => setEditResolution(resolution)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    editResolution === resolution ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                  }`}
                                >
                                  {resolution}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.output")}</p>
                          <div className="grid grid-cols-3 gap-1">
                            {(provider === "flux-image" || provider === "flux-dev" ? ["jpeg", "png"] : ["png", "jpeg", "webp"]).map((format) => (
                              <button
                                key={format}
                                type="button"
                                onClick={() => setOutputFormat(format)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold uppercase transition ${
                                  outputFormat === format ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                }`}
                              >
                                {format}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.count")}</p>
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4].map((count) => (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setNumImages(count)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                  numImages === count ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                }`}
                              >
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.safety")}</p>
                            <button
                              type="button"
                              onClick={() => setEnableSafetyChecker((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                enableSafetyChecker ? "bg-[#e8f7ff] text-[#0284c7]" : "bg-white text-[#667085]"
                              }`}
                            >
                              {enableSafetyChecker ? st("studio.state.enabled") : st("studio.state.disabled")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "flux-image" || provider === "flux-dev" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.acceleration")}</p>
                            <div className="grid grid-cols-3 gap-1">
                              {["none", "regular", "high"].map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setAcceleration(item)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold capitalize transition ${
                                    acceleration === item ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.safetyTolerance")}</p>
                            <div className="grid grid-cols-6 gap-1">
                              {["1", "2", "3", "4", "5", "6"].map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setSafetyTolerance(item)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    safetyTolerance === item ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.limitGenerations")}</p>
                            <button
                              type="button"
                              onClick={() => setLimitGenerations((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                limitGenerations ? "bg-[#e8f7ff] text-[#0284c7]" : "bg-white text-[#667085]"
                              }`}
                            >
                              {limitGenerations ? st("studio.state.on") : st("studio.state.off")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.webSearch")}</p>
                            <button
                              type="button"
                              onClick={() => setEnableWebSearch((value) => !value)}
                              className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                enableWebSearch ? "bg-[#e8f7ff] text-[#0284c7]" : "bg-white text-[#667085]"
                              }`}
                            >
                              {enableWebSearch ? st("studio.state.enabled") : st("studio.state.disabled")}
                            </button>
                          </div>
                        ) : null}
                        {provider === "nano-banana-image" ? (
                          <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.thinking")}</p>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { value: "", label: st("studio.state.off") },
                                { value: "minimal", label: st("studio.state.minimal") },
                                { value: "high", label: st("studio.state.high") }
                              ].map((item) => (
                                <button
                                  key={item.value || "off"}
                                  type="button"
                                  onClick={() => setThinkingLevel(item.value)}
                                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${
                                    thinkingLevel === item.value ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.seed")}</p>
                          <input
                            value={seed}
                            onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, "").slice(0, 12))}
                            placeholder={st("studio.placeholder.random")}
                            inputMode="numeric"
                            className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-[#202633] outline-none placeholder:text-[#a2aabc]"
                          />
                        </div>
                        {provider === "nano-banana-image" || provider === "nano-banana-pro" ? (
                          <div className="lg:col-span-2 rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.systemPrompt")}</p>
                            <textarea
                              rows={2}
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                              placeholder={st("studio.placeholder.system")}
                              className="w-full resize-none rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#202633] outline-none placeholder:text-[#a2aabc]"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(mode === "image"
                    ? [
                        { label: st("studio.suggestion.productCampaign"), prompt: "Product campaign" },
                        { label: st("studio.suggestion.socialAd"), prompt: "Social ad" },
                        { label: st("studio.suggestion.brandPoster"), prompt: "Brand poster" },
                        { label: st("studio.suggestion.referenceEdit"), prompt: "Reference edit" }
                      ]
                    : activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video"
                      ? [
                          { label: st("studio.suggestion.cameraPushIn"), prompt: "Camera push-in" },
                          { label: st("studio.suggestion.productReveal"), prompt: "Product reveal" },
                          { label: st("studio.suggestion.cinematicLoop"), prompt: "Cinematic loop" },
                          { label: st("studio.suggestion.socialMotion"), prompt: "Social motion" }
                        ]
                      : [
                          { label: st("studio.suggestion.ugcAd"), prompt: "UGC-style ad" },
                          { label: st("studio.suggestion.dynamicCamera"), prompt: "Dynamic camera move" },
                          { label: st("studio.suggestion.multiScene"), prompt: "Multi-scene cut" },
                          { label: st("studio.suggestion.broll"), prompt: "B-roll footage" }
                        ]
                  ).map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      onClick={() => setPrompt((current) => current || item.prompt)}
                      className="rounded-full border border-black/[0.06] bg-white/74 px-4 py-2 text-sm font-medium text-[#667085] shadow-sm transition hover:bg-white hover:text-[#202633]"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
                  {[
                    { title: st("studio.summary.modelRouting"), body: providerNote },
                    { title: st("studio.summary.canvas"), body: mode === "image" ? `${selectedImageSize.label} / ${selectedImageSize.dimensions}` : `${duration} / ${ratio === "source" ? st("studio.summary.sourceImage") : ratio}` },
                    { title: st("studio.summary.history"), body: activeTasks.length ? st("studio.summary.runningTasks", { count: activeTasks.length }) : st("studio.summary.savedAutomatically") }
                  ].map((card) => (
                    <div key={card.title} className="rounded-[1.5rem] border border-black/[0.06] bg-white/62 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{card.title}</p>
                      <p className="mt-3 text-sm font-semibold leading-6 text-[#3d4657]">{card.body}</p>
                    </div>
                  ))}
                </div>
                {showTextToImageTemplates ? (
                  <section className="mt-12 text-left">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">{st("studio.gallery.eyebrow")}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#202633]">{st("studio.gallery.title")}</h3>
                      </div>
                      <Link href="/gallery" className="rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] shadow-sm transition hover:bg-[#f8fafc] hover:text-[#202633]">
                        {st("studio.gallery.browse")}
                      </Link>
                    </div>
                    {galleryTemplateNote ? (
                      <p className="rounded-2xl border border-black/[0.06] bg-white/70 p-4 text-sm text-[#667085]">{galleryTemplateNote}</p>
                    ) : null}
                    {galleryTemplates.length ? (
                      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                        {galleryTemplates.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setPrompt(item.prompt);
                              setImageWorkflow("text-to-image");
                              setProvider("chatgpt-image");
                              setReferenceImagesText("");
                              setReferenceImageFiles([]);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              trackEvent("gallery_template_applied", { gallery_id: item.id, model: item.model, surface: "studio" }, accessToken);
                            }}
                            className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white text-left shadow-[0_14px_42px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)]"
                          >
                            <img
                              src={item.thumbnailUrl || item.imageUrl}
                              alt={item.title}
                              className="w-full bg-[#f2f6fb] object-cover"
                              loading="lazy"
                            />
                            <div className="p-4">
                              <p className="line-clamp-1 text-sm font-semibold text-[#202633]">{item.title}</p>
                              <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#7a8496]">{item.prompt}</p>
                              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                                <span>{item.category}</span>
                                <span>{item.model || "Prompt"}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : !galleryTemplateNote ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                          <div key={item} className="h-56 animate-pulse rounded-[1.35rem] border border-black/[0.04] bg-white/60" />
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="hidden sticky top-3 z-40 mb-4 rounded-[1.35rem] border border-white/10 bg-[#151922]/78 px-3 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-sm font-semibold text-[#a2d2ff]">
                DF
              </span>
              <div>
                <p className="text-sm font-semibold text-white">DreamFace Studio</p>
                <p className="text-xs text-white/46">{activeWorkflowMeta.label} / {PROVIDER_META[provider]?.label || provider}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-1">
              <Link
                href="/studio?mode=image&workflow=text-to-image"
                onClick={() => trackEvent("studio_mode_selected", { mode: "image" }, accessToken)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "image"
                    ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                    : "text-white/55 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Image Studio
              </Link>
              <Link
                href="/studio?mode=video&workflow=text-to-video"
                onClick={() => trackEvent("studio_mode_selected", { mode: "video" }, accessToken)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "video"
                    ? "bg-white text-[#111827] shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                    : "text-white/55 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                Video Studio
              </Link>
              </div>
              <Link href="/billing" className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80">
                {creditBalance === null ? "--" : creditBalance.toLocaleString()} credits
              </Link>
            </div>
          </div>
        </section>

        <section className="hidden relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_58px_rgba(0,0,0,0.18)] backdrop-blur-xl md:p-6">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">{mode === "image" ? "AI Image Studio" : "AI Video Studio"}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {mode === "image" ? "Create campaign-ready visuals from one prompt." : "Generate production-ready motion assets."}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                Pick a workflow, choose the right model, preview cost clearly, and keep every result connected to your creation history.
              </p>
            </div>
            <div className="grid min-w-[230px] grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-white/36">Credits</p>
                <p className="mt-1 text-xl font-semibold text-white">{creditBalance === null ? "--" : creditBalance.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-white/36">Estimate</p>
                <p className="mt-1 text-xl font-semibold text-[#a2d2ff]">{estCredits}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hidden mt-5 grid gap-5 xl:grid-cols-[minmax(420px,0.84fr)_minmax(0,1.16fr)]">
          <article className="relative flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl md:p-5">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="pointer-events-none absolute -right-16 top-28 h-48 w-48 rounded-full bg-[#5d8cff]/8 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-28 h-56 w-56 rounded-full bg-[#b38cff]/7 blur-3xl" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/36">Creation console</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{activeWorkflowMeta.label}</h2>
              </div>
              <p
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                  hasEnoughCredits ? "border-white/10 bg-white/[0.06] text-white/62" : "border-[#ff7b87]/25 bg-[#ff5161]/10 text-[#ffb3ba]"
                }`}
              >
                {estCredits} credits
              </p>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className={`grid gap-1 ${mode === "image" ? "grid-cols-3" : "grid-cols-2"}`}>
                {(mode === "image" ? ["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] : mode === "avatar" ? ["avatar-video"] : ["text-to-video", "image-to-video"]).map((workflow) => {
                  const meta = WORKFLOW_META[workflow as StudioWorkflow];
                  const active = activeWorkflow === workflow;
                  return (
                    <button
                      key={workflow}
                      type="button"
                      onClick={() => applyWorkflow(workflow as StudioWorkflow)}
                      className={`rounded-xl px-3 py-2.5 text-left transition duration-200 ${
                        active
                          ? "bg-white text-[#111827] shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                          : "text-white/45 hover:bg-white/[0.055] hover:text-white/78"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{meta.label}</span>
                      <span className={`mt-1 block truncate text-xs ${active ? "text-[#647185]" : "text-white/32"}`}>{meta.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/38">Model capability</p>
                  <p className="mt-1 text-sm text-white/42">Choose the model personality for this creation.</p>
                </div>
                <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/50 shadow-sm sm:inline-flex">
                  {activeWorkflowMeta.label}
                </span>
              </div>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {options.map((option) => {
                  const meta = PROVIDER_META[option.value] || {
                    label: option.label,
                    shortLabel: option.label,
                    speed: "Standard",
                    quality: "Balanced",
                    bestFor: "General generation"
                  };
                  const active = provider === option.value;
                  const modelCredits = estimateGenerationCredits({
                    mode: modeForPricing(mode),
                    provider: option.value,
                    imageSize,
                    duration: isAvatarWorkflow ? avatarDuration : duration,
                    hasReferences: activeWorkflow === "image-to-image" || activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video",
                    resolution: mode === "image" ? editResolution : videoResolution,
                    promptText: mode === "audio" ? prompt : undefined
                  });
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyProvider(option.value)}
                      className={`group relative min-w-[235px] overflow-hidden rounded-[1.35rem] border p-4 text-left transition duration-300 ${
                        active
                          ? "border-[#7ca7ff]/35 bg-[linear-gradient(145deg,rgba(255,255,255,0.13),rgba(255,255,255,0.065))] shadow-[0_18px_48px_rgba(40,88,180,0.22),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
                          : "border-white/10 bg-white/[0.045] shadow-[0_10px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent ${active ? "via-[#9bbcff]/70" : "via-white/12"} to-transparent`} />
                      <div className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl transition ${active ? "bg-[#6ea8ff]/20 opacity-100" : "bg-[#6ea8ff]/0 opacity-0 group-hover:opacity-40"}`} />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-semibold ${
                            active ? "bg-[#1c6be1] text-white shadow-[0_12px_28px_rgba(28,107,225,0.30)]" : "bg-white/[0.06] text-white/55"
                          }`}>
                            {meta.shortLabel.slice(0, 2)}
                          </span>
                          <div>
                          <p className="text-base font-semibold text-white">{meta.label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/38">
                            {meta.speed} / {meta.quality}
                          </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-white/[0.10] text-[#bde0fe] shadow-sm" : "bg-white/[0.055] text-white/42"}`}>
                          {modelCredits} credits
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/48">{meta.bestFor}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden">
              <label className="block">
                <span className="text-sm text-[#5f6779]">Provider API</span>
                <select
                  value={provider}
                  onChange={(e) => {
                    const nextProvider = e.target.value;
                    trackEvent("studio_model_selected", { mode, provider: nextProvider }, accessToken);
                    setProvider(nextProvider);
                    const nextDefaultPrompt = defaultPromptForProvider(nextProvider);
                    setPrompt(!hasCompletedCreation && nextDefaultPrompt ? nextDefaultPrompt : "");
                    if (mode === "image") {
                      setReferenceImagesText(
                        !hasCompletedCreation && nextProvider === "nano-banana-image"
                          ? ""
                          : ""
                      );
                      setReferenceImageFiles([]);
                    }
                    if (mode === "image") {
                      const nextImageSize = defaultImageSizeForProvider(nextProvider);
                      setImageSize(nextImageSize);
                      setRatio(ratioFromImageSize(nextImageSize));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("provider", nextProvider);
                      params.set("imageSize", nextImageSize);
                      params.set("ratio", ratioFromImageSize(nextImageSize));
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    } else {
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "video");
                      params.set("provider", nextProvider);
                      if (nextProvider === "grok-video") {
                        params.set("resolution", videoResolution);
                      } else {
                        params.delete("resolution");
                      }
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }
                  }}
                  className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-[#5f6779]">{mode === "image" ? st("studio.field.outputSize") : st("studio.field.aspectRatio")}</span>
                {mode === "image" ? (
                  <select
                    value={imageSize}
                    onChange={(e) => {
                      trackEvent("studio_size_selected", { mode, provider, image_size: e.target.value, ratio: ratioFromImageSize(e.target.value) }, accessToken);
                      setImageSize(e.target.value);
                      setRatio(ratioFromImageSize(e.target.value));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("provider", provider);
                      params.set("imageSize", e.target.value);
                      params.set("ratio", ratioFromImageSize(e.target.value));
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {IMAGE_SIZE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={ratio}
                    onChange={(e) => {
                      trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                      setRatio(e.target.value);
                    }}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {videoRatioOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div className="hidden">
              <label className="block">
                <span className="text-sm text-[#5f6779]">{mode === "image" && provider === "nano-banana-image" ? "Resolution" : "Duration"}</span>
                {mode === "image" && provider === "nano-banana-image" ? (
                  <select
                    value={editResolution}
                    onChange={(e) => setEditResolution(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    <option value="0.5K">0.5K</option>
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                ) : (
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {mode === "image" ? (
                      <option value="single">Single Output</option>
                    ) : (
                      <>
                        <option value="5s">5 seconds</option>
                        <option value="6s">6 seconds</option>
                        <option value="8s">8 seconds</option>
                        <option value="10s">10 seconds</option>
                      </>
                    )}
                  </select>
                )}
              </label>
              {mode === "image" ? (
                <label className="block">
                  <span className="text-sm text-[#5f6779]">{st("studio.field.outputFormat")}</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WEBP</option>
                  </select>
                </label>
              ) : showVideoResolutionControl ? (
                <label className="block">
                  <span className="text-sm text-[#5f6779]">{st("studio.field.resolution")}</span>
                  <select
                    value={videoResolution}
                    onChange={(e) => {
                      setVideoResolution(e.target.value);
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "video");
                      params.set("provider", provider);
                      params.set("resolution", e.target.value);
                      router.replace(`/studio?${params.toString()}`, { scroll: false });
                    }}
                    className="motion-smooth mt-2 w-full rounded-xl border border-black/10 bg-white/90 p-3 text-[#1d1d1f] outline-none focus:border-[#77a8e8]"
                  >
                    {videoResolutionOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="tone-mint rounded-xl border border-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#667487]">Routing note</p>
                  <p className="mt-2 text-sm leading-6 text-[#475162]">Smart fallback is enabled. If provider queue spikes, tasks reroute to your backup policy.</p>
                </div>
              )}
            </div>

            <div className="mb-4 grid gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_30px_rgba(0,0,0,0.12)] sm:grid-cols-4">
              <label className="block rounded-2xl bg-white/[0.045] px-3 py-2 shadow-sm transition hover:bg-white/[0.07]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  {mode === "image" ? "Canvas" : "Ratio"}
                </span>
                {mode === "image" ? (
                  <select
                    value={imageSize}
                    onChange={(e) => {
                      trackEvent("studio_size_selected", { mode, provider, image_size: e.target.value, ratio: ratioFromImageSize(e.target.value) }, accessToken);
                      setImageSize(e.target.value);
                      setRatio(ratioFromImageSize(e.target.value));
                    }}
                    className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none"
                  >
                    {IMAGE_SIZE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    disabled={provider === "kling-video"}
                    className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none disabled:opacity-70"
                  >
                    {videoRatioOptions.map((item) => (
                      <option key={item} value={item}>
                        {item === "source" ? "Source image" : item}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <div className="rounded-2xl bg-white/[0.045] px-3 py-2 shadow-sm">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{st("studio.field.quality")}</span>
                <p className="mt-1 text-sm font-semibold text-white">
                  {mode === "image" && provider === "nano-banana-image" ? editResolution : mode === "video" ? videoResolution : "High"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.045] px-3 py-2 shadow-sm">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{st("studio.field.output")}</span>
                <p className="mt-1 text-sm font-semibold text-white">{mode === "video" ? duration : "1 image"}</p>
              </div>
              <div className="rounded-2xl bg-[#1c6be1] px-3 py-2 text-white shadow-[0_12px_24px_rgba(28,107,225,0.22)]">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Cost</span>
                <p className="mt-1 text-sm font-semibold">{estCredits} credits</p>
              </div>
            </div>

            <label className="block">
              <span className="flex items-center justify-between text-sm font-semibold text-white/78">
                <span>Prompt</span>
                <span className="text-xs font-medium text-white/35">Scene / subject / style / constraints</span>
              </span>
              <div className="group relative mt-2 overflow-hidden rounded-[1.6rem] bg-[linear-gradient(135deg,rgba(162,210,255,0.32),rgba(255,255,255,0.08),rgba(205,180,219,0.20))] p-px shadow-[0_20px_50px_rgba(0,0,0,0.24)] transition duration-300 focus-within:shadow-[0_26px_70px_rgba(35,90,190,0.24)]">
                <div className="absolute inset-0 opacity-0 blur-xl transition group-focus-within:opacity-60" style={{ background: "radial-gradient(circle at 18% 0%, rgba(108,150,255,0.24), transparent 36%), radial-gradient(circle at 80% 10%, rgba(162,119,255,0.20), transparent 38%)" }} />
                <div className="relative rounded-[1.55rem] bg-[#111722]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-18px_45px_rgba(28,107,225,0.035)] backdrop-blur">
                <div className="flex items-start gap-3">
                  {mode === "image" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video" ? (
                    <label
                      title="Add reference images"
                      className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl font-light text-[#bde0fe] shadow-[0_12px_28px_rgba(0,0,0,0.20)] transition hover:bg-white/[0.10]"
                    >
                      +
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleReferenceFiles(e.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                      />
                    </label>
                  ) : null}
                  <textarea
                    rows={mode === "image" ? 7 : 8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[220px] w-full resize-none bg-transparent px-1 py-2 text-base leading-7 text-white placeholder:text-white/32 outline-none"
                    placeholder="Describe the image you want to create. Add the subject, mood, lighting, camera feel, composition, materials, text details, and what to avoid..."
                  />
                </div>
                {(mode === "image" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video") && referenceImageUrls.length ? (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">
                        {referenceImageUrls.length} reference {referenceImageUrls.length === 1 ? "image" : "images"}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceImagesText("");
                          setReferenceImageFiles([]);
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/58"
                      >
                        {st("studio.action.clear")}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {referenceImageUrls.slice(0, 8).map((url, index) => (
                        <div key={`${url.slice(0, 32)}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-white/[0.06]">
                          <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {isAvatarWorkflow ? (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div
                      className="mb-3 rounded-2xl border border-dashed border-white/14 bg-white/[0.045] p-3"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white/82">{st("studio.field.imageUrl")}<span className="text-[#93c5fd]">*</span></span>
                        <span className="rounded-full bg-[#1d4ed8]/25 px-2.5 py-1 text-[11px] font-semibold text-[#bfdbfe]">{st("studio.field.avatarImage")}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={referenceImagesText}
                          onChange={(event) => setReferenceImagesText(event.target.value)}
                          placeholder="https://.../avatar.jpg"
                          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#77a8e8]"
                        />
                        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-4 text-sm font-semibold text-white/82 transition hover:bg-white/[0.12]">
                          {st("studio.action.choose")}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/38">
                        Drag, choose, or paste a URL. Accepted: jpg, jpeg, png, webp, gif, avif.
                      </p>
                    </div>

                    <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      <video
                        src={KLING_AVATAR_PREVIEW_VIDEO_URL}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full bg-black object-cover"
                      />
                      <div className="border-t border-white/10 px-3 py-2">
                        <p className="text-xs font-semibold text-white/72">{st("studio.avatar.example")}</p>
                        <p className="mt-1 text-xs leading-5 text-white/38">Uses the default avatar image and sample script.</p>
                      </div>
                    </div>

                    <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white/82">{st("studio.avatar.voice")}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${avatarScriptTooLong ? "bg-[#be123c]/25 text-[#fecdd3]" : "bg-[#15803d]/25 text-[#bbf7d0]"}`}>{avatarScriptMeta}</span>
                      </div>
                      <div className="mb-2 grid grid-cols-3 rounded-full border border-white/10 bg-white/[0.06] p-1">
                        {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAvatarVoiceGender(option.value)}
                            className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                              avatarVoiceGender === option.value ? "bg-white text-[#111827]" : "text-white/52 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={ttsVoice}
                          onChange={(event) => setTtsVoice(event.target.value)}
                          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#77a8e8]"
                        >
                          {avatarVoiceOptions.map((voice) => (
                            <option key={voice} value={voice}>{voice}</option>
                          ))}
                        </select>
                        <select
                          value={ttsLanguageCode}
                          onChange={(event) => setTtsLanguageCode(event.target.value)}
                          className="min-h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#77a8e8]"
                        >
                          {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                            <option key={item.value || "auto"} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-white/38">
                        DreamFace generates the voice first, then sends it to Kling Avatar as one tracked Avatar task. Billing uses the estimated final video length.
                      </p>
                    </div>

                    {avatarNeedsImage ? (
                      <div className="mb-3 grid gap-2">
                        <button
                          type="button"
                          onClick={startAvatarImageGuide}
                          className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-left transition hover:bg-white/[0.10]"
                        >
                          <span className="block text-xs font-black uppercase tracking-[0.12em] text-[#93c5fd]">Need an avatar image?</span>
                          <span className="mt-1 block text-sm font-semibold text-white/82">Create a presenter portrait in Image Studio</span>
                        </button>
                      </div>
                    ) : null}
                    <label className="hidden">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">Voiceover audio URL</span>
                      <input
                        value={avatarAudioUrl}
                        onChange={(event) => setAvatarAudioUrl(event.target.value)}
                        placeholder="https://.../voiceover.mp3"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/28 focus:border-[#77a8e8]"
                      />
                    </label>
                  </div>
                ) : null}
                </div>
              </div>
            </label>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_10px_26px_rgba(0,0,0,0.10)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-white/82">{st("studio.field.advanced")}</span>
                  <span className="mt-1 block text-xs text-white/38">
                    {mode === "image" ? `${selectedImageSize.label} / ${outputFormat.toUpperCase()}` : `${duration} / ${ratio}`}
                  </span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-white/52">
                  {advancedOpen ? st("studio.action.hide") : st("studio.action.show")}
                </span>
              </button>
              {advancedOpen ? (
                <div className="grid gap-4 border-t border-white/10 p-4 md:grid-cols-2">
                  {mode === "image" ? (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.outputSize")}</span>
                      <select
                        value={imageSize}
                        onChange={(e) => {
                          trackEvent("studio_size_selected", { mode, provider, image_size: e.target.value, ratio: ratioFromImageSize(e.target.value) }, accessToken);
                          setImageSize(e.target.value);
                          setRatio(ratioFromImageSize(e.target.value));
                          const params = new URLSearchParams(sp.toString());
                          params.set("mode", "image");
                          params.set("workflow", activeWorkflow);
                          params.set("provider", provider);
                          params.set("imageSize", e.target.value);
                          params.set("ratio", ratioFromImageSize(e.target.value));
                          router.replace(`/studio?${params.toString()}`, { scroll: false });
                        }}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        {IMAGE_SIZE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.aspectRatio")}</span>
                      <select
                        value={ratio}
                        onChange={(e) => {
                          trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                          setRatio(e.target.value);
                        }}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        {videoRatioOptions.map((item) => (
                          <option key={item} value={item}>
                            {item === "source" ? "Source image" : item}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {mode === "image" && provider === "nano-banana-image" ? (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.resolution")}</span>
                      <select
                        value={editResolution}
                        onChange={(e) => setEditResolution(e.target.value)}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        <option value="0.5K">0.5K</option>
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </label>
                  ) : mode === "video" ? (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.duration")}</span>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        {videoDurationOptions.map((item) => (
                          <option key={item} value={item}>{Number.parseInt(item, 10)} seconds</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.outputFormat")}</span>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        <option value="png">PNG</option>
                        <option value="jpeg">JPEG</option>
                        <option value="webp">WEBP</option>
                      </select>
                    </label>
                  )}

                  {showVideoResolutionControl ? (
                    <label className="block">
                      <span className="text-sm text-white/50">{st("studio.field.resolution")}</span>
                      <select
                        value={videoResolution}
                        onChange={(e) => setVideoResolution(e.target.value)}
                        className="motion-smooth mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white outline-none focus:border-[#77a8e8]"
                      >
                        {videoResolutionOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {showVideoAudioControl ? (
                    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
                      <span>
                        <span className="block text-sm font-semibold text-white/72">{st("studio.field.nativeAudio")}</span>
                        <span className="mt-1 block text-xs text-white/38">{st("studio.field.nativeAudioDescription")}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={generateAudio}
                        onChange={(e) => setGenerateAudio(e.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            <label className="hidden">
              <span className="text-sm text-[#5f6779]">Prompt</span>
              <div className="mt-2 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-sm focus-within:border-[#77a8e8]">
                <div className="flex items-start gap-3">
                  {mode === "image" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video" ? (
                    <label
                      title="Add reference images"
                      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-black/10 bg-[#f4f8ff] text-2xl font-light text-[#1d1d1f] transition hover:bg-[#e8f1ff]"
                    >
                      +
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleReferenceFiles(e.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                      />
                    </label>
                  ) : null}
                  <textarea
                    rows={mode === "image" ? 5 : 7}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[132px] w-full resize-none bg-transparent px-1 py-2 text-[#1d1d1f] placeholder:text-[#9ca3b7] outline-none"
                    placeholder="Describe the scene you want to create..."
                  />
                </div>
                {mode === "image" && referenceImageUrls.length ? (
                  <div className="mt-3 border-t border-black/5 pt-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#52647f]">
                        {referenceImageUrls.length} reference {referenceImageUrls.length === 1 ? "image" : "images"}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceImagesText("");
                          setReferenceImageFiles([]);
                        }}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#667084]"
                      >
                        {st("studio.action.clear")}
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {referenceImageUrls.slice(0, 8).map((url, index) => (
                        <div key={`${url.slice(0, 32)}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-[#eef1f7]">
                          <img src={url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>

            <div className="sticky bottom-0 -mx-4 mt-auto border-t border-white/10 bg-[#10131a]/82 px-4 pt-4 shadow-[0_-20px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl md:-mx-5 md:px-5">
              <AppButton
                variant="primary"
                onClick={handleGenerate}
                disabled={!canSubmit || isSubmitting || (Boolean(accessToken) && !hasEnoughCredits)}
                className="min-h-[64px] w-full rounded-[1.35rem] bg-gradient-to-br from-[#1c6be1] to-[#3f86ff] text-base shadow-[0_18px_42px_rgba(28,107,225,0.34),0_0_0_1px_rgba(255,255,255,0.14)_inset] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(28,107,225,0.42)] active:translate-y-0 active:shadow-[0_16px_34px_rgba(28,107,225,0.34)]"
              >
                {isSubmitting
                  ? st("studio.generate.creating")
                  : accessToken
                    ? st("studio.generate.buttonWithCredits", { credits: estCredits })
                    : st("studio.auth.signInToGenerate")}
              </AppButton>
              <button
                type="button"
                onClick={() => {
                  const preset = PROMPT_PRESETS[Math.floor(Math.random() * PROMPT_PRESETS.length)];
                  setPrompt(preset);
                }}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white/68 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {st("studio.action.randomPrompt")}
              </button>
            </div>
            <p className="mt-3 text-sm text-white/46">
              {!isAvatarWorkflow && !isPromptValid
                ? st("studio.validation.promptLength")
                : isAvatarWorkflow && avatarScriptTooLong
                  ? st("studio.validation.avatarLength")
                : !hasRequiredReference
                  ? st("studio.validation.referenceRequired")
                  : isPromptlessImageWorkflow
                    ? st("studio.validation.backgroundReady")
                    : st("studio.validation.ready")}
            </p>
            <p className="mt-2 text-xs text-white/35">{providerNote}</p>
            {accessToken && !hasEnoughCredits ? (
              <p className="mt-2 rounded-xl border border-[#ff7b87]/25 bg-[#ff5161]/10 px-3 py-2 text-xs font-semibold text-[#ffb3ba]">
                {st("studio.generate.lowBalance")}
              </p>
            ) : accessToken && lowBalanceAfterGeneration ? (
              <p className="mt-2 rounded-xl border border-[#f5d061]/20 bg-[#f5d061]/10 px-3 py-2 text-xs font-semibold text-[#f5d989]">
                {st("studio.generate.lowBalanceWarning", { threshold: CREDIT_LOW_BALANCE_THRESHOLD })}
              </p>
            ) : null}
            {statusText ? (
              <p
                className={`mt-2 text-sm ${
                  statusTone === "ok"
                    ? "text-[#7dd7a8]"
                    : statusTone === "error"
                      ? "text-[#ff9aa4]"
                      : "text-white/48"
                }`}
              >
                {statusText}
              </p>
            ) : null}
          </article>

          <div className="grid gap-5">
            <article className="relative min-h-[calc(100vh-220px)] overflow-hidden rounded-[2.1rem] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(92,136,255,0.16),transparent_30%),radial-gradient(circle_at_82%_14%,rgba(154,119,255,0.10),transparent_28%),linear-gradient(145deg,#0b0f18_0%,#111827_52%,#080d16_100%)] p-5 text-white shadow-[0_36px_96px_rgba(0,0,0,0.38)] md:p-6">
              <div className="pointer-events-none absolute inset-0 opacity-[0.045]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "18px 18px" }} />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-[#6f7cff]/8 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 bottom-10 h-72 w-72 rounded-full bg-[#5fa8ff]/8 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Immersive preview</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight">Creation Stage</h3>
                  <p className="mt-1 text-xs text-white/50">
                    {mode === "image"
                      ? `${selectedImageSize.label} / ${selectedImageSize.dimensions}`
                      : `${ratio} preview frame`}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/45">Selected</p>
                  <p className="mt-1 max-w-[180px] truncate text-sm font-semibold">{PROVIDER_META[provider]?.label || provider}</p>
                </div>
              </div>
              {modelPreviewUrl ? (
                <div className="relative mt-6 rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_30px_76px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <div className="absolute -inset-8 -z-0 rounded-full bg-[#5f8fff]/12 blur-3xl" />
                  <div className="absolute -bottom-10 right-12 -z-0 h-32 w-48 rounded-full bg-[#8a72ff]/7 blur-3xl" />
                  <div
                    className="relative z-10 overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#111827] shadow-[0_30px_80px_rgba(0,0,0,0.42),0_0_56px_rgba(94,141,255,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_38px_95px_rgba(0,0,0,0.48),0_0_64px_rgba(94,141,255,0.10)]"
                    style={{ aspectRatio: previewAspectRatio }}
                  >
                    <div
                      className="absolute inset-0 opacity-35"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
                        backgroundSize: "36px 36px"
                      }}
                    />
                    {isModelPreviewVideo ? (
                      <video
                        src={modelPreviewUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
                        className="relative h-full w-full object-cover opacity-95"
                      />
                    ) : (
                      <img
                        src={modelPreviewUrl}
                        alt={`${provider} example preview`}
                        className="relative h-full w-full object-cover opacity-95"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/32 to-transparent p-5 text-white">
                      <p className="text-sm font-semibold">
                        {provider === "flux-image"
                          ? "FLUX Schnell sample"
                          : provider === "flux-dev"
                            ? "FLUX Dev sample"
                          : provider === "nano-banana-image" || provider === "nano-banana-edit"
                            ? "Nano Banana 2 Edit sample"
                            : provider === "grok-video"
                              ? "Grok Imagine Video sample"
                            : isAvatarProvider(provider)
                              ? "Kling AI Avatar sample"
                            : "GPT Image 2 sample"}
                      </p>
                      <p className="mt-1 text-xs text-white/75">
                        {mode === "image" ? "The canvas matches your selected output size." : "The frame matches your selected aspect ratio."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative mt-6 rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_30px_76px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <div
                    className="relative grid place-items-center overflow-hidden rounded-[1.45rem] border border-dashed border-white/15 bg-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    style={{ aspectRatio: previewAspectRatio }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 0%, rgba(92,136,255,0.18), transparent 35%), radial-gradient(circle at 82% 18%, rgba(154,119,255,0.10), transparent 30%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                        backgroundSize: "100% 100%, 34px 34px, 34px 34px"
                      }}
                    />
                    <div className="relative max-w-sm px-6 text-center">
                      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl border border-white/10 bg-white/[0.08] shadow-[0_16px_40px_rgba(28,107,225,0.20)]" />
                      <p className="text-base font-semibold text-white">Canvas ready</p>
                      <p className="mt-2 text-sm leading-6 text-white/58">Describe the visual on the left. The first render lands here as a focused creation stage.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Model", value: PROVIDER_META[provider]?.shortLabel || provider },
                  { label: mode === "image" ? "Size" : "Ratio", value: mode === "image" ? selectedImageSize.label : ratio },
                  { label: "Credits", value: `${estCredits}` }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white/90">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="hidden rounded-[1.5rem] border border-black/8 bg-white/90 p-5 shadow-[0_16px_36px_rgba(20,30,55,0.08)]">
              <h3 className="text-base font-semibold tracking-tight">Queue estimate</h3>
              <p className="mt-2 text-sm leading-6 text-[#576173]">
                This setup usually takes about <span className="font-semibold text-[#1d1d1f]">{formatDuration(estimatedSeconds)}</span>.
                Tasks keep running after you leave this page.
              </p>
              <div className="mt-3 rounded-xl border border-black/10 bg-[#f8fbff] p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-[#667084]">
                  <span>{latestActiveTask ? `${latestActiveTask.status} task` : "Ready to submit"}</span>
                  <span>{latestActiveTask ? `${latestActiveProgress}%` : formatDuration(estimatedSeconds)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e6ebf4]">
                  <div
                    className="h-full rounded-full bg-[#8b6fe8] transition-all duration-500"
                    style={{ width: `${latestActiveTask ? latestActiveProgress : 0}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-[#667084]">
                  Progress is an estimate based on provider status and elapsed time. Finished results sync back into Projects.
                </p>
              </div>
            </article>

            <article className="hidden rounded-[1.5rem] border border-black/8 bg-white/90 p-5 shadow-[0_16px_36px_rgba(20,30,55,0.08)]">
              <h3 className="text-base font-semibold tracking-tight">Cost preview</h3>
              <p className="mt-2 text-sm leading-6 text-[#535d6e]">
                Current provider and settings estimate <span className="font-semibold text-[#1d1d1f]">{estCredits} credits</span> for this generation.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Active", value: activeTasks.length },
                  { label: "Done", value: completedTasks.length },
                  { label: "Failed", value: failedTasks.length }
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-black/10 bg-white/90 p-3 text-center">
                    <p className="text-xs text-[#667084]">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="hidden mt-8 grid gap-5 lg:grid-cols-2">
          <article className="card rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-semibold tracking-tight">Recent Tasks</h3>
              <AppButton href="/creations" variant="secondary" size="md">View all</AppButton>
            </div>
            {taskHistoryNote ? (
              <p className="mb-3 rounded-xl border border-[#d8b85d]/30 bg-[#fff8df] px-4 py-3 text-sm text-[#705d1d]">
                {taskHistoryNote}
              </p>
            ) : null}
            {tasks.some((task) => task.mediaUrl) ? (
              <div className="mb-5 grid gap-3">
                <p className="text-sm font-semibold text-[#4f596b]">Latest Outputs</p>
                {tasks
                  .filter((task) => task.mediaUrl)
                  .slice(0, 3)
                  .map((task) => (
                    <div key={`${task.id}-media`} className="rounded-xl border border-black/10 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-[#677388]">{task.id}</p>
                        <a
                          href={`/api/generate/download?url=${encodeURIComponent(task.mediaUrl || "")}&name=${encodeURIComponent(task.id)}`}
                          className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[#2e3b52] hover:bg-[#f3f7ff]"
                        >
                          Download
                        </a>
                      </div>
                      {task.type === "Video" ? (
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ url: task.mediaUrl || "", type: "Video" })}
                          className="block w-full text-left"
                        >
                          <video src={task.mediaUrl || undefined} controls className="w-full rounded-lg" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreviewModal({ url: task.mediaUrl || "", type: "Image" })}
                          className="block w-full"
                        >
                          <img src={task.mediaUrl || ""} alt={task.id} className="w-full rounded-lg object-cover" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            ) : null}
            <div className="space-y-3">
              {tasks.length ? tasks.map((x) => (
                <div key={x.id} className="motion-smooth flex items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 hover:shadow-[0_10px_20px_rgba(18,22,33,0.07)]">
                  <div>
                    <p className="text-sm font-semibold">{x.id}</p>
                    <p className="text-xs text-[#677388]">{x.type} generation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{x.status}</p>
                    <p className="text-xs text-[#677388]">{x.cost} credits</p>
                  </div>
                </div>
              )) : (
                <p className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#667084]">
                  No recent tasks yet.
                </p>
              )}
            </div>
          </article>

          <article className="card tone-pink rounded-3xl p-6">
            <h3 className="text-2xl font-semibold tracking-tight">Background Tasks</h3>
            <p className="mt-2 text-sm leading-7 text-[#576173]">
              Submitted jobs are stored in your account and keep running through the provider queue. You can close the page and check Projects later.
            </p>
            <div className="mt-4 grid gap-3">
              {activeTasks.slice(0, 4).map((task) => {
                const progress = taskProgress(task, duration);
                return (
                  <div key={`${task.id}-progress`} className="rounded-xl border border-black/10 bg-white/90 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{task.id}</p>
                      <p className="shrink-0 text-xs text-[#667388]">{progress}%</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece7f8]">
                      <div className="h-full rounded-full bg-[#d36c9d] transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-[#667388]">{task.status} / {task.cost} credits</p>
                  </div>
                );
              })}
              {!activeTasks.length ? (
                <div className="rounded-xl border border-black/10 bg-white/90 p-4 text-sm text-[#667084]">
                  No background tasks right now.
                </div>
              ) : null}
            </div>
          </article>
        </section>

        {previewModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setPreviewModal(null)}>
            <div className="max-h-[92vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-sm font-semibold text-white"
                >
                  {st("studio.modal.close")}
                </button>
              </div>
              {previewModal.type === "Video" ? (
                <video src={previewModal.url} controls autoPlay className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              ) : (
                <img src={previewModal.url} alt="Preview" className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function StudioPageClient({ initialLocale }: { initialLocale: Locale }) {
  return (
    <Suspense fallback={null}>
      <StudioContent initialLocale={initialLocale} />
    </Suspense>
  );
}
