"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppButton } from "../../components/ui/button";
import { trackEvent } from "../../lib/analytics";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  creditUsageCapacity,
  formatUsd,
  type BillingCycle
} from "../../lib/billing";
import { isRtlLocale, type Locale } from "../../i18n/routing";
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
  audioWorkflow?: AudioWorkflow;
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
  voiceGender?: "all" | "female" | "male";
  lyrics?: string;
  lyricsOptimizer?: boolean;
  isInstrumental?: boolean;
  musicSampleRate?: number;
  musicBitrate?: number;
  musicFormat?: "mp3" | "wav" | "pcm";
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
type AudioWorkflow = "text-to-audio" | "text-to-music";
type StudioWorkflow = ImageWorkflow | VideoWorkflow | AudioWorkflow;
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
const TEXT_IMAGE_PAGE_INNER_CLASS = "mx-auto w-full max-w-[1220px]";
const TEXT_IMAGE_GALLERY_URL = "https://dreamface.io/gallery";
const STUDIO_SIGN_IN_URL = "https://dreamface.io/en/auth?next=%2Fstudio%3Fview%3Dhome";

const WORKSPACE_VIDEO_BASE_URL = "https://media.dreamface.io/ai_video";
const YOUNG_KOREAN_WOMAN_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/young_Korean_woman.mp4`;
const YOUNG_KOREAN_WOMAN_PROMPT = `Main subject: young Korean woman, early 20s, natural everyday appearance, faded charcoal-grey sleeveless crop top, loose high-waisted light-wash jeans, black canvas sneakers, black cord necklace, black wavy hair in a messy side ponytail with wispy bangs. Realistic skin texture, minimal makeup, warm and approachable personality. Maintain consistent identity, clothing, hairstyle, and appearance throughout the entire video.
Location: Authentic Korean residential neighborhood during a calm late morning. Narrow concrete alleys, low-rise homes, small terraces, potted plants, laundry lines, bicycles, utility poles, overhead wires, mature trees casting moving shadows, quiet residential atmosphere. No stores, advertisements, cafés, crowds, or commercial activity.
Visual Style: Ultra-realistic documentary realism. Genuine candid behavior. Natural body language. Unscripted slice-of-life feeling. Strong environmental authenticity. Rich real-world details and believable human motion.
Camera Style: Early-2000s consumer DV camcorder aesthetic. Friend casually recording everyday moments. Heavy handheld shake, imperfect framing, frequent autofocus hunting, lens breathing, exposure pumping when moving between sun and shade, occasional motion blur, subtle rolling shutter, mild digital compression artifacts, faded colors, soft contrast, slight sensor noise. No stabilization. No cinematic camera moves. No modern color grading.
00:00–00:02
Outside a small house entrance. She sits on a low concrete wall adjusting her ponytail with both hands raised. A light breeze moves loose strands of hair. She smiles naturally while the camera struggles to hold focus.
00:02–00:04
The camera follows her into a narrow alley lined with potted plants and concrete walls. She notices a stray cat approaching and crouches down. Framing drifts off-center as the operator tries to keep up.
00:04–00:06
She gently pets and feeds the cat. Autofocus repeatedly shifts between her face and the animal. Morning sunlight flickers through leaves overhead.
00:06–00:08
Small front yard beside her house. She hangs laundry on a clothesline while fabrics sway in the breeze. Exposure changes as clouds briefly pass overhead.
00:08–00:10
On a quiet terrace with a ceramic coffee cup. She sits comfortably watching the neighborhood, occasionally brushing hair behind her ear. Loose handheld side angle with natural camera drift.
00:10–00:12
Close side profile. Someone off-camera greets her. She turns, raises her hand, smiles warmly, and casually says, “Annyeong.” The camera catches the moment slightly late.
00:12–00:15
Walking slowly down a tree-lined residential lane holding her coffee cup. She notices the camera, gives a small genuine smile, then looks away and continues walking. Recording cuts abruptly to black mid-motion as if the camcorder was switched off.

Audio: Natural ambient sound only — morning birds, distant motorcycles, light wind, leaves rustling, faint neighborhood chatter, cat sounds, footsteps on concrete, fabric moving on clotheslines, subtle residential ambience. No music. No sound design. No narration.

Goal: Authentic Korean neighborhood life captured like a forgotten home video from the early 2000s — candid, imperfect, realistic, warm, and deeply believable.`;
const EASTBOURNE_KOREAN_WOMAN_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/A_young_Korean_woman.mp4`;
const EASTBOURNE_KOREAN_WOMAN_PROMPT = `Main Character:
A young Korean woman, around 25 years old, wearing refined, natural everyday makeup. She wears a wide-brim beige straw hat with a thick dark brown band around the brim, a light green off-shoulder cross-pleated dress, pearl earrings, and a delicate gold bracelet. Her long dark brown hair falls naturally beneath the hat or is loosely pinned back. She has a warm, friendly personality. Maintain the exact same identity, clothing, hairstyle, facial features, and overall appearance consistently throughout the entire video. Realistic skin texture with subtle natural makeup.

Location:
A bright afternoon at the real Eastbourne tennis tournament spectator stands. A lush green grass court is visible in the foreground. The seating consists of wooden and plastic spectator seats. In the background, other spectators wear light-colored suits and casual summer clothing. Strong natural sunlight shines from above, with occasional passing clouds creating subtle shifts in lighting, shadows, and exposure. The atmosphere is warm, relaxed, and authentically captures a live tennis event. The visual focus always remains on her genuine reactions and intimate personal moments.

Visual Style:
Ultra-realistic documentary realism. Authentic unscripted behavior. Natural body language. Feels like spontaneous everyday life captured without planning. Strong environmental authenticity. Rich real-world details with believable human movement and subtle imperfections.

Camera Style:
Shot entirely with the aesthetic of an early-2000s consumer DV camcorder. Feels like a friend casually recording everyday moments. Pronounced handheld shake, imperfect framing, frequent autofocus hunting, visible lens breathing, exposure fluctuations while moving between sunlight and shade, occasional motion blur, slight rolling shutter, moderate digital compression artifacts, faded colors, soft contrast, and light sensor noise. No stabilization. No cinematic camera movement. No modern color grading.

00:00–00:02
She sits on a green spectator seat, gently holding the brim of her straw hat with her right hand while smiling toward the tennis court. A light breeze softly moves the edge of the hat and a few strands of her hair. She smiles naturally as the handheld camera struggles slightly to keep focus on her face, with noticeable handheld shake.

00:02–00:04
The camera follows from her side. She subtly turns her body while watching the match and reacts to an exciting point with expressive facial expressions. The composition drifts slightly off-center as the camera operator tries to keep up with her spontaneous reaction. Autofocus repeatedly shifts between her face and the distant tennis court.

00:04–00:06
A close-up captures her warm smile as she appears amused by a great shot on the court, her shoulders trembling slightly with a quiet laugh. Sunlight filtering through the straw hat casts gently moving shadows across her face. Natural lens breathing and slight exposure fluctuations remain visible.

00:06–00:08
A slightly wider composition. She sits comfortably and relaxed in her seat, her left hand resting naturally on her lap while continuing to watch the match. Occasionally she brushes hair behind her ear or adjusts the hem of her dress. The handheld camera drifts naturally as passing clouds subtly change the lighting.

00:08–00:10
A close side-profile shot. She notices the camera—her friend filming—and turns toward it with a sincere, warm smile. She gently waves or lightly adjusts her hat. The camera catches the moment a fraction of a second late before naturally ending the recording.

Audio:
Natural location sound only. Gentle wind, the crisp sound of distant tennis racket hits, soft conversations among spectators, occasional applause, subtle creaking of stadium seats, and the rustling of grass or nearby flags. A delicate, authentic tennis tournament atmosphere. No music. No sound design. No narration.

Goal:
Capture a warm, authentic slice of life from a real tennis spectator, as if it were a forgotten home video recorded in the early 2000s. The footage should feel spontaneous, imperfect, genuine, warm, emotionally convincing, and unmistakably real.`;
const SPORTS_BROADCAST_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/Ultra-realistic_sports_broadcast.mp4`;
const SPORTS_BROADCAST_PROMPT = `Ultra-realistic sports broadcast still of a glamorous woman sitting in a packed football stadium crowd during a night match, wearing a dark brown sleeveless high-neck satin top and black square earrings, shoulder-length light brown/blonde hair styled in soft waves. She is casually drinking from a tall blue aluminum can while holding a half-eaten cheeseburger in the other hand. Around her are fans in bright yellow and blue football jerseys and scarves, creating strong team-color contrast. The scene feels candid and cinematic, captured mid-game from a TV broadcast camera angle with shallow depth of field. Include realistic stadium seating, crowded audience atmosphere, broadcast overlay graphics in the top-left corner showing a live football score and match timer, and a sports network watermark in the top-right. Natural arena lighting, detailed skin texture, sharp focus on the woman, slightly blurred background crowd, authentic live sports broadcast aesthetic, 16:9 composition.`;

const WORKSPACE_SHOWCASES: Array<{
  key: "baseball" | "cgi" | "tokyo" | "spectator";
  file: string;
  prompt: string;
  labelKey: string;
  titleKey: string;
  metaKey: string;
  desktopRatio?: "16x9" | "1x1";
}> = [
  {
    key: "baseball",
    file: "baseball-game-broadcast-shot",
    prompt: "A baseball game broadcast shot - person sits in stadium stands in a team jersey, watching the field and posing softly like a viral stargirl moment caught on live TV.",
    labelKey: "studio.workspace.showcase.baseball.label",
    titleKey: "studio.workspace.showcase.baseball.title",
    metaKey: "studio.workspace.showcase.baseball.meta"
  },
  {
    key: "cgi",
    file: "cgi-breakdown-reveal",
    prompt: "CGI breakdown reveal - mesh to beauty pass, each render layer cuts in sequence, turntable camera, ending on the final polished visual.",
    labelKey: "studio.workspace.showcase.cgi.label",
    titleKey: "studio.workspace.showcase.cgi.title",
    metaKey: "studio.workspace.showcase.cgi.meta"
  },
  {
    key: "tokyo",
    file: "tokyo-night-street-racing",
    prompt: "Tokyo night street racing - cars drift and donut around the character, low angles and 35mm film grain, blockbuster reveal.",
    labelKey: "studio.workspace.showcase.tokyo.label",
    titleKey: "studio.workspace.showcase.tokyo.title",
    metaKey: "studio.workspace.showcase.tokyo.meta"
  },
  {
    key: "spectator",
    file: "spectator-sprints-from-the-stands",
    prompt: "Spectator sprints from the stands, jumps fences, evades security, charges onto the pitch and strikes - all in one continuous telephoto take.",
    labelKey: "studio.workspace.showcase.spectator.label",
    titleKey: "studio.workspace.showcase.spectator.title",
    metaKey: "studio.workspace.showcase.spectator.meta",
    desktopRatio: "1x1"
  }
];

function workspaceShowcaseHref(prompt: string) {
  return `/studio?mode=video&workflow=text-to-video&duration=5s&prompt=${encodeURIComponent(prompt)}`;
}

function WorkspaceShowcaseVideo({
  file,
  desktopRatio = "16x9",
  mobileRatio = "1x1",
  className = ""
}: {
  file: string;
  desktopRatio?: "16x9" | "1x1";
  mobileRatio?: "16x9" | "1x1";
  className?: string;
}) {
  return (
    <video autoPlay muted loop playsInline preload="metadata" className={className}>
      <source media="(max-width: 639px)" src={`${WORKSPACE_VIDEO_BASE_URL}/${mobileRatio}/${file}-${mobileRatio}.mp4`} type="video/mp4" />
      <source src={`${WORKSPACE_VIDEO_BASE_URL}/${desktopRatio}/${file}-${desktopRatio}.mp4`} type="video/mp4" />
    </video>
  );
}

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
          <div key={example.key} className={`border border-black/[0.07] bg-white ${compact ? "rounded-xl px-2.5 py-2" : "rounded-2xl px-3 py-2.5"}`}>
            <p className={`${compact ? "text-lg" : "text-xl"} font-black leading-none tracking-tight text-[#151922]`}>
              {example.value.toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] font-semibold leading-[1.35] text-[#667085]">{example.label}</p>
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
const HAPPY_HORSE_VIDEO_RATIO_OPTIONS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21", "5:4", "4:5"];
const GROK_VIDEO_RATIO_OPTIONS = ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"];
const GROK_IMAGE_VIDEO_RATIO_OPTIONS = ["auto", ...GROK_VIDEO_RATIO_OPTIONS];
const GROK_VIDEO_RESOLUTION_OPTIONS = ["480p", "720p"];
const SEEDANCE_VIDEO_RESOLUTION_OPTIONS = ["480p", "720p", "1080p"];
const SEEDANCE_MINI_VIDEO_RESOLUTION_OPTIONS = ["480p", "720p"];
const HAPPY_HORSE_VIDEO_RESOLUTION_OPTIONS = ["720p", "1080p"];
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
  "nano-banana-lite": {
    label: "Nano Banana Lite",
    shortLabel: "Banana Lite",
    speed: "Fastest",
    quality: "Efficient edits",
    bestFor: "Low-cost prompt drafts, fast local edits, and 1K social visuals"
  },
  "nano-banana-2-lite": {
    label: "Nano Banana 2 Lite",
    shortLabel: "Banana 2 Lite",
    speed: "Fastest",
    quality: "Efficient 1K output",
    bestFor: "Cost-effective 1K text-to-image generation and rapid ideation"
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
  "seedance-mini-video": {
    label: "Seedance 2.0 Mini",
    shortLabel: "Seedance Mini",
    speed: "Fast",
    quality: "Lower-cost motion",
    bestFor: "Faster, cheaper text-to-video and image-to-video at 480p or 720p"
  },
  "happy-horse-video": {
    label: "Happy Horse 1.1",
    shortLabel: "Happy Horse",
    speed: "Medium",
    quality: "Native audio",
    bestFor: "Alibaba video with text-to-video, image-to-video, 720p/1080p, and native audio"
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
  },
  "minimax-music-2.6": {
    label: "MiniMax Music 2.6",
    shortLabel: "Music 2.6",
    speed: "Medium",
    quality: "Latest full song",
    bestFor: "Detailed arrangements, vocals, structure tags, and automatic lyrics"
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
    providers: ["chatgpt-image", "nano-banana-pro", "nano-banana-image", "nano-banana-2-lite", "nano-banana-lite", "flux-dev", "flux-image"]
  },
  "image-to-image": {
    label: "Image to Image",
    description: "Upload references and edit, restyle, or extend them.",
    recommendedProvider: "nano-banana-image",
    providers: ["nano-banana-image", "nano-banana-lite", "chatgpt-image", "nano-banana-pro"]
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
    label: "AI Talking",
    description: "Upload one image, type what it should say, and create a talking video.",
    recommendedProvider: "dreamface-io-video",
    providers: ["dreamface-io-video", "kling-avatar-standard", "kling-avatar-pro"]
  },
  "text-to-video": {
    label: "Text to Video",
    description: "Turn a written scene into a short video.",
    recommendedProvider: "dreamface-io-video",
    providers: ["dreamface-io-video", "grok-video", "seedance-mini-video", "happy-horse-video", "kling-video", "seedance-video", "veo-video"]
  },
  "image-to-video": {
    label: "Image to Video",
    description: "Animate a reference image into a short video.",
    recommendedProvider: "dreamface-io-video",
    providers: ["dreamface-io-video", "seedance-mini-video", "happy-horse-video", "kling-video", "seedance-video", "grok-video"]
  },
  "text-to-audio": {
    label: "Text to Audio",
    description: "Turn a written script into an AI voiceover.",
    recommendedProvider: "elevenlabs-tts",
    providers: ["elevenlabs-tts"]
  },
  "text-to-music": {
    label: "AI Music",
    description: "Create instrumental music or a complete song.",
    recommendedProvider: "minimax-music-2.6",
    providers: ["minimax-music-2.6"]
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

const PROMPT_IMPROVE_TEXT =
  "Optimize this prompt for a professional AI-generated image. Improve detail, lighting, composition, and overall quality while preserving intent.";

const TEXT_TO_IMAGE_SCENES = [
  { key: "paidAdCreative", icon: "rocket", glow: "radial-gradient(circle, rgba(255,138,0,.28), transparent 66%)" },
  { key: "ecommerceScene", icon: "shopping", glow: "radial-gradient(circle, rgba(244,94,198,.26), transparent 66%)" },
  { key: "appStoreAssets", icon: "app", glow: "radial-gradient(circle, rgba(37,99,255,.28), transparent 66%)" },
  { key: "aiAvatarStyle", icon: "portrait", glow: "radial-gradient(circle, rgba(24,199,243,.26), transparent 66%)" },
  { key: "videoCoverImage", icon: "video", glow: "radial-gradient(circle, rgba(112,92,255,.26), transparent 66%)" },
  { key: "fastImageEdit", icon: "cleanup", glow: "radial-gradient(circle, rgba(32,201,151,.25), transparent 66%)" },
  { key: "brandPoster", icon: "brand", glow: "radial-gradient(circle, rgba(255,176,46,.28), transparent 66%)" },
  { key: "styleReference", icon: "style", glow: "radial-gradient(circle, rgba(255,107,107,.24), transparent 66%)" }
] as const;

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

function taskEstimatedWaitRange(task: TaskItem) {
  const rawDuration = typeof task.settings?.duration === "string" ? task.settings.duration : "";
  const seconds = Number.parseInt(rawDuration, 10);
  if (Number.isFinite(seconds) && seconds >= 10) return "3-4";
  if (Number.isFinite(seconds) && seconds <= 5) return "2-3";
  return "2-4";
}

function regenerateHref(task: TaskItem) {
  const mode = task.type === "Image" ? "image" : task.type === "Audio" ? "audio" : "video";
  const workflow =
    task.type === "Image"
      ? "text-to-image"
      : task.type === "Audio"
        ? task.provider === "minimax-music-2.6"
          ? "text-to-music"
          : "text-to-audio"
        : "text-to-video";
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

const MINIMAX_MUSIC_DEFAULT_PROMPT = "City Pop, 80s retro, groovy synth bass, warm female vocal, 104 BPM, nostalgic urban night";

function defaultPromptForProvider(provider: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  if (provider === "kling-avatar-standard" || provider === "kling-avatar-pro") {
    return KLING_AVATAR_DEFAULT_SCRIPT;
  }
  if (provider === "minimax-music-2.6") {
    return localizedMusicPrompt;
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

function isProviderDefaultPrompt(value: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  return value === KLING_AVATAR_DEFAULT_SCRIPT || value === MINIMAX_MUSIC_DEFAULT_PROMPT || value === localizedMusicPrompt;
}

function promptForProviderChange(current: string, nextDefaultPrompt: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  if (!current.trim() || isProviderDefaultPrompt(current, localizedMusicPrompt)) {
    return nextDefaultPrompt;
  }
  return current;
}

function defaultImageSizeForProvider(provider: string) {
  if (provider === "flux-image" || provider === "flux-dev") return "landscape_16_9";
  if (isNanoBananaProvider(provider)) return "default_4_3";
  return "default_4_3";
}

function isNanoBananaProvider(provider: string) {
  return provider === "nano-banana-image" ||
    provider === "nano-banana-pro" ||
    provider === "nano-banana-edit" ||
    provider === "nano-banana-lite" ||
    provider === "nano-banana-2-lite";
}

function isNanoBananaLiteProvider(provider: string) {
  return provider === "nano-banana-lite" || provider === "nano-banana-2-lite";
}

function isNanoBananaImageToImageProvider(provider: string) {
  return provider === "nano-banana-image" ||
    provider === "nano-banana-pro" ||
    provider === "nano-banana-edit" ||
    provider === "nano-banana-lite";
}

function defaultImageRatioForProvider(provider: string, imageSize: string) {
  if (provider === "nano-banana-pro" || provider === "nano-banana-2-lite") return "1:1";
  if (isNanoBananaProvider(provider) || provider === "topaz-image" || provider === "bria-background-remove") return "auto";
  return ratioFromImageSize(imageSize);
}

function defaultVideoResolutionForProvider(provider: string) {
  if (provider === "dreamface-io-video") return "720p";
  if (provider === "happy-horse-video") return "720p";
  if (provider === "grok-video" || provider === "seedance-video" || provider === "seedance-mini-video") return "480p";
  return "720p";
}

function videoModelGroup(provider: string) {
  if (provider === "dreamface-io-video") return "freeDraft";
  if (provider === "seedance-video" || provider === "veo-video") return "premium";
  return "betterQuality";
}

function videoModelBadge(provider: string) {
  if (provider === "dreamface-io-video") return "free";
  if (provider === "seedance-mini-video") return "recommended";
  if (provider === "kling-video") return "pro";
  if (provider === "veo-video") return "premium";
  return "";
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
  if (mode === "image") return ["chatgpt-image", "nano-banana-image", "nano-banana-pro", "nano-banana-lite", "nano-banana-2-lite", "flux-image", "flux-dev", "nano-banana-edit", "recraft-image", "topaz-image", "bria-background-remove"].includes(provider);
  if (mode === "audio") return ["minimax-music-2.6", "elevenlabs-tts"].includes(provider);
  if (mode === "avatar") return ["dreamface-io-video", "kling-avatar-standard", "kling-avatar-pro"].includes(provider);
  return ["dreamface-io-video", "seedance-video", "seedance-mini-video", "happy-horse-video", "kling-video", "kling-avatar-standard", "kling-avatar-pro", "veo-video", "grok-video"].includes(provider);
}

function workflowForMode(mode: StudioMode, workflow: string | null): StudioWorkflow {
  if (mode === "audio") return workflow === "text-to-music" ? "text-to-music" : "text-to-audio";
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
  const initialAudioWorkflow: AudioWorkflow = initialWorkflow === "text-to-music" ? "text-to-music" : "text-to-audio";
  const initialReferenceUrl = sp.get("reference");
  const [prompt, setPrompt] = useState(() => defaultPromptForProvider(initialProvider, st("studio.music.defaultPrompt")));
  const [provider, setProvider] = useState(initialProvider);
  const [imageWorkflow, setImageWorkflow] = useState<ImageWorkflow>(initialImageWorkflow);
  const [videoWorkflow, setVideoWorkflow] = useState<VideoWorkflow>(initialVideoWorkflow);
  const [audioWorkflow, setAudioWorkflow] = useState<AudioWorkflow>(initialAudioWorkflow);
  const [ratio, setRatio] = useState(mode === "image" ? "1:1" : mode === "avatar" ? initialProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
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
  const [videoResolution, setVideoResolution] = useState(() => defaultVideoResolutionForProvider(initialProvider));
  const [generateAudio, setGenerateAudio] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("Rachel");
  const [avatarVoiceGender, setAvatarVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [audioVoiceGender, setAudioVoiceGender] = useState<(typeof ELEVENLABS_VOICE_GENDER_OPTIONS)[number]["value"]>("all");
  const [ttsStability, setTtsStability] = useState(0.5);
  const [ttsTimestamps, setTtsTimestamps] = useState(false);
  const [ttsLanguageCode, setTtsLanguageCode] = useState("");
  const [textNormalization, setTextNormalization] = useState("auto");
  const [musicLyrics, setMusicLyrics] = useState("[Verse]\nStreetlights flicker, the night breeze sighs\nShadows stretch as I walk alone\n\n[Chorus]\nWandering, longing, where should I go");
  const [lyricsOptimizer, setLyricsOptimizer] = useState(false);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [musicSampleRate, setMusicSampleRate] = useState(44100);
  const [musicBitrate, setMusicBitrate] = useState(256000);
  const [musicFormat, setMusicFormat] = useState<"mp3" | "wav" | "pcm">("mp3");
  const [musicAdvancedOpen, setMusicAdvancedOpen] = useState(false);
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
  const [isYoungKoreanWomanPlaying, setIsYoungKoreanWomanPlaying] = useState(false);
  const [isEastbourneKoreanWomanPlaying, setIsEastbourneKoreanWomanPlaying] = useState(false);
  const [isSportsBroadcastPlaying, setIsSportsBroadcastPlaying] = useState(false);
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
  const [mobileStudioMenuOpen, setMobileStudioMenuOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [loadingBillingItem, setLoadingBillingItem] = useState<string | null>(null);
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [toolbarModelSelectOpen, setToolbarModelSelectOpen] = useState(false);
  const [modelSelectPlacement, setModelSelectPlacement] = useState<"top" | "bottom" | "modal">("bottom");
  const [toolbarModelSelectPlacement, setToolbarModelSelectPlacement] = useState<"top" | "bottom" | "modal">("bottom");
  const [selectedBillingCycles, setSelectedBillingCycles] = useState<Record<string, BillingCycle>>(() =>
    Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, plan.defaultCycle]))
  );
  const billingModalScrollRef = useRef<HTMLDivElement | null>(null);
  const premiumLitePlanRef = useRef<HTMLElement | null>(null);
  const modelSelectRef = useRef<HTMLDivElement | null>(null);
  const modelSelectPanelRef = useRef<HTMLDivElement | null>(null);
  const toolbarModelSelectRef = useRef<HTMLDivElement | null>(null);
  const toolbarModelSelectPanelRef = useRef<HTMLDivElement | null>(null);
  const lastStudioModeRef = useRef<StudioMode>(mode);
  const restoredLoginDraftRef = useRef(false);
  const autoSubmitLoginDraftRef = useRef(false);
  const trackedStudioViewRef = useRef("");
  const trackedLoginSuccessRef = useRef<string | null>(null);
  const lastLocalizedMusicPromptRef = useRef(st("studio.music.defaultPrompt"));

  const getModelSelectPlacement = (element: HTMLElement | null): "top" | "bottom" | "modal" => {
    if (typeof window === "undefined") return "bottom";
    if (window.innerWidth < 640) return "modal";
    if (!element) return "bottom";
    const rect = element.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const comfortablePanelHeight = 430;
    return spaceBelow >= comfortablePanelHeight || spaceBelow >= spaceAbove ? "bottom" : "top";
  };

  useEffect(() => {
    const localizedPrompt = st("studio.music.defaultPrompt");
    if (provider === "minimax-music-2.6") {
      setPrompt((current) =>
        !current.trim() || current === MINIMAX_MUSIC_DEFAULT_PROMPT || current === lastLocalizedMusicPromptRef.current
          ? localizedPrompt
          : current
      );
    } else {
      setPrompt((current) =>
        current === MINIMAX_MUSIC_DEFAULT_PROMPT || current === lastLocalizedMusicPromptRef.current
          ? ""
          : current
      );
    }
    lastLocalizedMusicPromptRef.current = localizedPrompt;
  }, [provider, studioI18n.locale]);

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
    if (!modelSelectOpen) return;
    setModelSelectPlacement(getModelSelectPlacement(modelSelectRef.current));
    const handlePlacementUpdate = () => setModelSelectPlacement(getModelSelectPlacement(modelSelectRef.current));
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (modelSelectRef.current?.contains(event.target as Node)) return;
      if (modelSelectPanelRef.current?.contains(event.target as Node)) return;
      setModelSelectOpen(false);
    };
    window.addEventListener("resize", handlePlacementUpdate);
    window.addEventListener("scroll", handlePlacementUpdate, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      window.removeEventListener("resize", handlePlacementUpdate);
      window.removeEventListener("scroll", handlePlacementUpdate, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [modelSelectOpen]);

  useEffect(() => {
    if (!toolbarModelSelectOpen) return;
    setToolbarModelSelectPlacement(getModelSelectPlacement(toolbarModelSelectRef.current));
    const handlePlacementUpdate = () => setToolbarModelSelectPlacement(getModelSelectPlacement(toolbarModelSelectRef.current));
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (toolbarModelSelectRef.current?.contains(event.target as Node)) return;
      if (toolbarModelSelectPanelRef.current?.contains(event.target as Node)) return;
      setToolbarModelSelectOpen(false);
    };
    window.addEventListener("resize", handlePlacementUpdate);
    window.addEventListener("scroll", handlePlacementUpdate, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      window.removeEventListener("resize", handlePlacementUpdate);
      window.removeEventListener("scroll", handlePlacementUpdate, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [toolbarModelSelectOpen]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token || null;
      const nextUserId = data.session?.user.id || null;
      setAccessToken(token);
      setUserId(nextUserId);
      if (typeof window !== "undefined") {
        safeRemoveLocalStorage("nova_access_token");
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
        safeRemoveLocalStorage("nova_access_token");
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
    const workflow = mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow;
    const key = `${mode}:${provider}:${workflow}`;
    if (trackedStudioViewRef.current === key) return;
    trackedStudioViewRef.current = key;
    trackEvent("studio_view", { mode, provider, workflow, signed_in: Boolean(accessToken) }, accessToken);
  }, [accessToken, audioWorkflow, imageWorkflow, mode, provider, videoWorkflow]);

  useEffect(() => {
    const workflowParam = workflowForMode(mode, sp.get("workflow"));
    const providerParam = sp.get("provider");
    const modeChanged = lastStudioModeRef.current !== mode;
    lastStudioModeRef.current = mode;
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
    setAudioWorkflow(mode === "audio" && workflowParam === "text-to-music" ? "text-to-music" : "text-to-audio");
    const nextProvider = providerForWorkflow(
      workflowParam,
      isProviderAllowedForMode(providerParam, mode) ? providerParam : null
    );
    setProvider(nextProvider === "nano-banana-edit" ? "nano-banana-image" : nextProvider);
    if (modeChanged && !sp.get("prompt")) {
      setPrompt(defaultPromptForProvider(nextProvider, st("studio.music.defaultPrompt")));
    }
    const nextImageSize = mode === "image" ? defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? defaultImageRatioForProvider(nextProvider, nextImageSize) : mode === "avatar" ? nextProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
    setImageSize(nextImageSize);
    setDuration(mode === "video" || mode === "avatar" ? DEFAULT_VIDEO_DURATION : "single");
    setVideoResolution(defaultVideoResolutionForProvider(nextProvider));
    setStatusText("");
    setStatusTone("idle");
  }, [mode, sp]);

  useEffect(() => {
    if (mode !== "image") return;
    const nextImageSize = defaultImageSizeForProvider(provider);
    setImageSize(nextImageSize);
    setRatio(defaultImageRatioForProvider(provider, nextImageSize));
    if (provider === "flux-image") {
      setNumInferenceSteps(4);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "flux-dev") {
      setNumInferenceSteps(28);
      setOutputFormat((current) => (current === "webp" ? "jpeg" : current));
    }
    if (provider === "nano-banana-pro" || provider === "nano-banana-2-lite") {
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
    if (ratioParam && [...SEEDANCE_VIDEO_RATIO_OPTIONS, ...HAPPY_HORSE_VIDEO_RATIO_OPTIONS, ...GROK_IMAGE_VIDEO_RATIO_OPTIONS, ...KLING_TEXT_VIDEO_RATIO_OPTIONS, ...KLING_IMAGE_VIDEO_RATIO_OPTIONS, ...VEO_VIDEO_RATIO_OPTIONS].includes(ratioParam)) {
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
    if (resolutionParam && [...GROK_VIDEO_RESOLUTION_OPTIONS, ...SEEDANCE_VIDEO_RESOLUTION_OPTIONS, ...SEEDANCE_MINI_VIDEO_RESOLUTION_OPTIONS, ...HAPPY_HORSE_VIDEO_RESOLUTION_OPTIONS, ...VEO_VIDEO_RESOLUTION_OPTIONS].includes(resolutionParam)) {
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
      } else {
        setReferenceImagesText((current) => stripKlingAvatarDefaultReference(current));
        setPrompt((current) => (current.trim() === KLING_AVATAR_DEFAULT_SCRIPT ? "" : current));
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
    () => WORKFLOW_META[mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow].providers
      .filter((value) => value !== "dreamface-io-video" || dreamfaceIoEnabled !== false)
      .map((value) => ({ value, label: PROVIDER_META[value]?.label || value })),
    [audioWorkflow, dreamfaceIoEnabled, imageWorkflow, mode, videoWorkflow]
  );
  useEffect(() => {
    if (provider !== "dreamface-io-video" || dreamfaceIoEnabled !== false) return;
    setProvider(mode === "avatar" ? "kling-avatar-standard" : videoWorkflow === "image-to-video" ? "kling-video" : "grok-video");
  }, [dreamfaceIoEnabled, imageWorkflow, mode, provider, videoWorkflow]);
  const avatarVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => avatarVoiceGender === "all" || voice.gender === avatarVoiceGender).map((voice) => voice.name) as string[],
    [avatarVoiceGender]
  );
  const audioVoiceOptions = useMemo(
    () => ELEVENLABS_VOICE_META.filter((voice) => audioVoiceGender === "all" || voice.gender === audioVoiceGender).map((voice) => voice.name) as string[],
    [audioVoiceGender]
  );

  const activeWorkflow: StudioWorkflow = mode === "image" ? imageWorkflow : mode === "audio" ? audioWorkflow : mode === "avatar" ? "avatar-video" : videoWorkflow;
  const activeWorkflowMeta = WORKFLOW_META[activeWorkflow];
  const isPromptlessImageWorkflow = mode === "image" && (activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove");
  const allReferenceImageUrls = [
    ...referenceImagesText
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean),
    ...referenceImageFiles
  ];
  const referenceImageUrls = allReferenceImageUrls.slice(0, isPromptlessImageWorkflow ? 1 : 14);
  const isAvatarWorkflow = mode === "avatar" || activeWorkflow === "avatar-video";
  const isDreamfaceTalkingAvatar = isAvatarWorkflow && provider === "dreamface-io-video";
  const avatarNeedsImage = isAvatarWorkflow && referenceImageUrls.length === 0;
  const avatarScriptSeconds = isAvatarWorkflow ? estimateAvatarScriptSeconds(prompt) : 0;
  const avatarOutputSeconds = isAvatarWorkflow ? avatarScriptSeconds + (isDreamfaceTalkingAvatar ? 0 : AVATAR_KLING_BUFFER_SECONDS) : 0;
  const isDefaultAvatarScript = isAvatarWorkflow && prompt.trim() === KLING_AVATAR_DEFAULT_SCRIPT;
  const avatarDuration = isAvatarWorkflow
    ? isDreamfaceTalkingAvatar
      ? duration
      : avatarDurationFromPrompt(prompt)
    : duration;
  const avatarScriptTooLong = isAvatarWorkflow && !isDreamfaceTalkingAvatar && !isDefaultAvatarScript && avatarOutputSeconds > AVATAR_MAX_SECONDS;
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
  const isMiniMaxMusic = mode === "audio" && provider === "minimax-music-2.6";
  const isElevenLabsAudio = mode === "audio" && provider === "elevenlabs-tts";
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
    ? Math.max(1, Math.ceil((Number.parseInt(isAvatarWorkflow ? avatarDuration : duration, 10) || 5) / 5))
    : 0;
  const usesDreamfaceIoFreeAllowance =
    provider === "dreamface-io-video" &&
    dreamfaceIoEligible &&
    dreamfaceIoRemainingUnits >= dreamfaceIoUnits;
  const estCredits = usesDreamfaceIoFreeAllowance ? 0 : baseEstCredits;
  const hasEnoughCredits = creditBalance === null || creditBalance >= estCredits;
  const lowBalanceAfterGeneration = typeof creditBalance === "number" && creditBalance - estCredits < CREDIT_LOW_BALANCE_THRESHOLD;
  const estimatedSeconds = estimateTaskSeconds(modeForPricing(mode), provider, isAvatarWorkflow ? avatarDuration : duration);
  const hasMiniMaxLyrics = isInstrumental || lyricsOptimizer || musicLyrics.trim().length > 0;
  const isPromptValid = isPromptlessImageWorkflow || (
    isAvatarWorkflow
      ? prompt.trim().length > 0 && !avatarScriptTooLong
      : isMiniMaxMusic
        ? prompt.trim().length >= 10 && hasMiniMaxLyrics
        : prompt.trim().length > 0
  );
  const needsReferenceImage = activeWorkflow === "image-to-image" || activeWorkflow === "enhance-cleanup" || activeWorkflow === "background-remove" || activeWorkflow === "image-to-video" || activeWorkflow === "avatar-video";
  const hasRequiredReference = !needsReferenceImage || referenceImageUrls.length > 0;
  const canSubmit = isPromptValid && hasRequiredReference;
  const generateDisabled = accessToken ? !canSubmit || isSubmitting || !hasEnoughCredits : false;
  const activeTasks = tasks.filter((task) => task.status === "Queued" || task.status === "Running");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const hasCompletedCreation = completedTasks.length > 0;
  const failedTasks = tasks.filter((task) => task.status === "Failed");
  const selectedProjectId = sp.get("taskId");
  const selectedProjectTask = selectedProjectId
    ? tasks.find((task) => task.id === selectedProjectId) || tasks[0] || null
    : tasks[0] || null;
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
    "seedance-mini-video",
    "happy-horse-video",
    "kling-video",
    "veo-video",
    "elevenlabs-tts",
    "minimax-music-2.6"
  ].includes(provider)
    ? provider
    : "default";
  const providerNote = st(`studio.model.${providerNoteKey}`);
  const showVideoModelSelect = mode === "video" && (activeWorkflow === "text-to-video" || activeWorkflow === "image-to-video");
  const selectedProviderMeta = PROVIDER_META[provider] || {
    label: provider,
    shortLabel: provider,
    speed: "Standard",
    quality: "Balanced",
    bestFor: "General generation"
  };
  const videoModelGroups = [
    { key: "freeDraft", label: st("studio.modelSelect.group.freeDraft") },
    { key: "betterQuality", label: st("studio.modelSelect.group.betterQuality") },
    { key: "premium", label: st("studio.modelSelect.group.premium") }
  ];
  const videoRatioOptions = isAvatarProvider(provider)
    ? ["source"]
    : provider === "grok-video"
    ? activeWorkflow === "image-to-video"
      ? GROK_IMAGE_VIDEO_RATIO_OPTIONS
      : GROK_VIDEO_RATIO_OPTIONS
    : provider === "happy-horse-video"
      ? HAPPY_HORSE_VIDEO_RATIO_OPTIONS
    : provider === "seedance-video" || provider === "seedance-mini-video"
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
    : provider === "seedance-video" || provider === "seedance-mini-video"
        ? VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 4)
      : provider === "happy-horse-video"
        ? VIDEO_DURATION_OPTIONS
      : isAvatarProvider(provider)
        ? VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 3)
      : provider === "grok-video"
          ? GROK_VIDEO_DURATION_OPTIONS
          : VIDEO_DURATION_OPTIONS;
  const videoResolutionOptions =
    provider === "dreamface-io-video"
      ? ["720p"]
    : provider === "seedance-mini-video"
      ? SEEDANCE_MINI_VIDEO_RESOLUTION_OPTIONS
    : provider === "seedance-video"
      ? SEEDANCE_VIDEO_RESOLUTION_OPTIONS
      : provider === "happy-horse-video"
        ? HAPPY_HORSE_VIDEO_RESOLUTION_OPTIONS
      : provider === "veo-video"
        ? VEO_VIDEO_RESOLUTION_OPTIONS
        : GROK_VIDEO_RESOLUTION_OPTIONS;
  const showDreamfaceTalkingVideoControls = mode === "avatar" && provider === "dreamface-io-video";
  const showVideoResolutionControl = mode === "video" && (provider === "dreamface-io-video" || provider === "grok-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video");
  const showVideoAudioControl = mode === "video" && !isAvatarProvider(provider) && (provider === "seedance-video" || provider === "seedance-mini-video" || provider === "kling-video" || provider === "veo-video");
  const showTextToImageTemplates = !isAppsHome && !isProjectsView && mode === "image" && imageWorkflow === "text-to-image";
  const showImageToImageRedesign = !isAppsHome && !isProjectsView && mode === "image" && imageWorkflow === "image-to-image";
  const showImageUtilityRedesign = !isAppsHome && !isProjectsView && mode === "image" && (imageWorkflow === "enhance-cleanup" || imageWorkflow === "background-remove");
  const showVideoWorkbenchRedesign = !isAppsHome && !isProjectsView && mode === "video" && (videoWorkflow === "text-to-video" || videoWorkflow === "image-to-video");
  const showAudioWorkbenchRedesign = !isAppsHome && !isProjectsView && mode === "audio" && (audioWorkflow === "text-to-audio" || audioWorkflow === "text-to-music");
  const showAvatarWorkbenchRedesign = !isAppsHome && !isProjectsView && isAvatarWorkflow;
  const showImageWorkbenchRedesign = showTextToImageTemplates || showImageToImageRedesign || showImageUtilityRedesign;
  const showModernWorkbenchRedesign = showImageWorkbenchRedesign || showVideoWorkbenchRedesign || showAudioWorkbenchRedesign || showAvatarWorkbenchRedesign;
  const useWideStudioShell = showModernWorkbenchRedesign || isAppsHome || isProjectsView;
  const providerSettingsLabel =
    provider === "chatgpt-image"
      ? `${imageQuality} / ${outputFormat.toUpperCase()} / ${numImages}`
    : provider === "flux-image" || provider === "flux-dev"
        ? `${numInferenceSteps} / ${guidanceScale} / ${outputFormat.toUpperCase()}`
        : isNanoBananaLiteProvider(provider)
          ? `1K / ${safetyTolerance} / ${numImages}`
        : mode === "image"
          ? `${editResolution} / ${safetyTolerance} / ${numImages}`
          : isMiniMaxMusic
            ? `${isInstrumental ? "Instrumental" : lyricsOptimizer ? "Auto lyrics" : "Custom lyrics"} / ${musicSampleRate} Hz / ${musicFormat.toUpperCase()}`
          : mode === "audio"
            ? `${prompt.trim().length || 0} / ${ttsVoice} / ${ttsStability.toFixed(2)}`
          : isAvatarWorkflow
            ? isDreamfaceTalkingAvatar
              ? `${avatarDuration} / DreamFace IO`
              : `${avatarDuration} / ${ttsVoice}`
            : `${videoResolution} / ${duration}${showVideoAudioControl ? generateAudio ? " / ON" : " / OFF" : ""}`;

  useEffect(() => {
    if (mode !== "avatar") return;
    if (avatarVoiceOptions.includes(ttsVoice)) return;
    setTtsVoice(avatarVoiceOptions[0] || "Rachel");
  }, [avatarVoiceOptions, mode, ttsVoice]);

  useEffect(() => {
    if (!isElevenLabsAudio || audioVoiceOptions.includes(ttsVoice)) return;
    setTtsVoice(audioVoiceOptions[0] || "Rachel");
  }, [audioVoiceOptions, isElevenLabsAudio, ttsVoice]);

  useEffect(() => {
    if (!isAvatarWorkflow || !avatarAudioUrl.startsWith("data:audio/") || avatarAudioTrimSeconds === null) return;
    if (avatarAudioTrimSeconds === avatarSelectedSeconds) return;
    setAvatarAudioUrl("");
    setAvatarAudioTrimSeconds(null);
    setStatusTone("idle");
    setStatusText(st("studio.status.avatarDurationChanged", { seconds: avatarSelectedSeconds }));
  }, [avatarAudioTrimSeconds, avatarAudioUrl, avatarSelectedSeconds, isAvatarWorkflow]);

  useEffect(() => {
    if (mode !== "video" && !showDreamfaceTalkingVideoControls) return;
    if (!videoRatioOptions.includes(ratio)) {
      setRatio(showDreamfaceTalkingVideoControls ? "16:9" : videoRatioOptions.includes("auto") ? "auto" : videoRatioOptions[0] || "16:9");
    }
    if (!videoDurationOptions.includes(duration)) {
      setDuration(provider === "veo-video" ? DEFAULT_VEO_VIDEO_DURATION : DEFAULT_VIDEO_DURATION);
    }
    if (showVideoResolutionControl && !videoResolutionOptions.includes(videoResolution)) {
      setVideoResolution(defaultVideoResolutionForProvider(provider));
    }
  }, [duration, mode, provider, ratio, showDreamfaceTalkingVideoControls, showVideoResolutionControl, videoDurationOptions, videoRatioOptions, videoResolution, videoResolutionOptions]);

  useEffect(() => {
    if (!hasCompletedCreation) return;
    setPrompt((currentPrompt) => (isSamplePrompt(currentPrompt) ? "" : currentPrompt));
  }, [hasCompletedCreation]);

  function applyWorkflow(nextWorkflow: StudioWorkflow) {
    const nextMode =
      nextWorkflow === "text-to-image" || nextWorkflow === "image-to-image" || nextWorkflow === "enhance-cleanup" || nextWorkflow === "background-remove"
        ? "image"
        : nextWorkflow === "text-to-audio" || nextWorkflow === "text-to-music"
          ? "audio"
          : nextWorkflow === "avatar-video"
            ? "avatar"
            : "video";
    const nextProvider = providerForWorkflow(nextWorkflow, provider);
    if (nextMode === "image") {
      const nextImageWorkflow = nextWorkflow as ImageWorkflow;
      if (mode === "image" && imageWorkflow !== nextImageWorkflow) {
        setPrompt("");
      }
      setImageWorkflow(nextImageWorkflow);
      if (nextWorkflow === "text-to-image") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
      } else if (nextWorkflow === "background-remove") {
        setReferenceImageFiles((current) => current.slice(0, 1));
      }
      setImageQuality(nextProvider === "chatgpt-image" ? "low" : "high");
    } else if (nextMode === "video" || nextMode === "avatar") {
      setVideoWorkflow(nextWorkflow as VideoWorkflow);
      if (nextWorkflow === "text-to-video") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
        setAvatarAudioUrl("");
      } else if (nextWorkflow === "avatar-video") {
        setReferenceImagesText((current) => isAvatarProvider(nextProvider) ? current || KLING_AVATAR_DEFAULT_IMAGE_URL : stripKlingAvatarDefaultReference(current));
        setReferenceImageFiles([]);
      }
    } else {
      setAudioWorkflow(nextWorkflow as AudioWorkflow);
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      setAvatarAudioUrl("");
    }
    setProvider(nextProvider);
    if (isNanoBananaProvider(nextProvider) || nextProvider === "topaz-image" || nextProvider === "bria-background-remove") {
      setRatio(defaultImageRatioForProvider(nextProvider, defaultImageSizeForProvider(nextProvider)));
    }
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, st("studio.music.defaultPrompt"));
    setPrompt((current) =>
      nextMode === mode
        ? promptForProviderChange(current, !hasCompletedCreation ? nextDefaultPrompt : "", st("studio.music.defaultPrompt"))
        : !hasCompletedCreation
          ? nextDefaultPrompt
          : ""
    );
    const nextImageSize = nextMode === "image" ? defaultImageSizeForProvider(nextProvider) : imageSize;
    if (nextMode === "image") {
      setImageSize(nextImageSize);
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      setRatio(nextWorkflow === "avatar-video" ? nextProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
      setDuration(nextProvider === "veo-video" ? DEFAULT_VEO_VIDEO_DURATION : DEFAULT_VIDEO_DURATION);
      setVideoResolution(defaultVideoResolutionForProvider(nextProvider));
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
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      params.delete("imageSize");
      params.set("ratio", nextWorkflow === "avatar-video" ? nextProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
      if (nextProvider === "dreamface-io-video" || nextProvider === "grok-video" || nextProvider === "seedance-video" || nextProvider === "seedance-mini-video" || nextProvider === "happy-horse-video" || nextProvider === "veo-video") {
        params.set("resolution", defaultVideoResolutionForProvider(nextProvider));
      } else {
        params.delete("resolution");
      }
    } else {
      params.delete("imageSize");
      params.set("ratio", "16:9");
    }
    router.replace(`/studio?${params.toString()}`, { scroll: false });
  }

  function applyProvider(nextProvider: string) {
    trackEvent("studio_model_selected", { mode, provider: nextProvider, workflow: activeWorkflow }, accessToken);
    setProvider(nextProvider);
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, st("studio.music.defaultPrompt"));
    setPrompt((current) => promptForProviderChange(current, !hasCompletedCreation ? nextDefaultPrompt : "", st("studio.music.defaultPrompt")));
    if (isAvatarProvider(nextProvider)) {
      setReferenceImagesText((current) => current || KLING_AVATAR_DEFAULT_IMAGE_URL);
      setReferenceImageFiles([]);
    } else if (mode === "avatar" && nextProvider === "dreamface-io-video") {
      setReferenceImagesText((current) => stripKlingAvatarDefaultReference(current));
      setAvatarAudioUrl("");
    }
    if (mode === "image") {
      if (nextProvider !== "topaz-image" && nextProvider !== "bria-background-remove") {
        setReferenceImagesText("");
        setReferenceImageFiles([]);
      }
      if (nextProvider === "topaz-image") setImageWorkflow("enhance-cleanup");
      if (nextProvider === "bria-background-remove") setImageWorkflow("background-remove");
      if (nextProvider === "nano-banana-2-lite" && activeWorkflow === "image-to-image") setImageWorkflow("text-to-image");
      const nextImageSize = defaultImageSizeForProvider(nextProvider);
      setImageSize(nextImageSize);
      setImageQuality(nextProvider === "chatgpt-image" ? "low" : "high");
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "image");
      params.set("workflow", nextProvider === "topaz-image" ? "enhance-cleanup" : nextProvider === "bria-background-remove" ? "background-remove" : nextProvider === "nano-banana-2-lite" && activeWorkflow === "image-to-image" ? "text-to-image" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("imageSize", nextImageSize);
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    } else if (mode === "audio") {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
      setDuration("single");
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "audio");
      params.set("workflow", audioWorkflow);
      params.set("provider", nextProvider);
      params.delete("imageSize");
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    } else {
      const nextRatio =
        mode === "avatar" && nextProvider === "dreamface-io-video"
          ? "16:9"
        : isAvatarProvider(nextProvider)
          ? "source"
        : nextProvider === "kling-video" && activeWorkflow === "image-to-video"
          ? "source"
          : nextProvider === "grok-video" && activeWorkflow === "image-to-video" && ratio === "source"
            ? "auto"
          : nextProvider === "happy-horse-video" && !HAPPY_HORSE_VIDEO_RATIO_OPTIONS.includes(ratio)
            ? "16:9"
          : nextProvider === "kling-video" && !KLING_TEXT_VIDEO_RATIO_OPTIONS.includes(ratio)
            ? "16:9"
            : nextProvider === "veo-video" && !VEO_VIDEO_RATIO_OPTIONS.includes(ratio)
              ? "16:9"
              : ratio === "source"
                ? "auto"
                : ratio;
      if (mode !== "avatar" && (nextProvider === "seedance-video" || nextProvider === "seedance-mini-video") && Number.parseInt(duration, 10) < 4) {
        setDuration("4s");
      }
      if (mode !== "avatar" && nextProvider === "veo-video" && !VEO_VIDEO_DURATION_OPTIONS.includes(duration)) {
        setDuration(DEFAULT_VEO_VIDEO_DURATION);
      }
      const nextResolution = defaultVideoResolutionForProvider(nextProvider);
      setVideoResolution(nextResolution);
      setRatio(nextRatio);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", mode === "avatar" ? "avatar" : "video");
      params.set("workflow", mode === "avatar" ? "avatar-video" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("ratio", nextRatio);
      if (nextProvider === "grok-video" || nextProvider === "seedance-video" || nextProvider === "seedance-mini-video" || nextProvider === "happy-horse-video" || nextProvider === "veo-video") {
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
      audioWorkflow,
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
      voiceGender: audioVoiceGender,
      lyrics: musicLyrics,
      lyricsOptimizer,
      isInstrumental,
      musicSampleRate,
      musicBitrate,
      musicFormat,
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
    setAudioWorkflow(draft.audioWorkflow || "text-to-audio");
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
    setAudioVoiceGender(draft.voiceGender || "all");
    setMusicLyrics(draft.lyrics || "");
    setLyricsOptimizer(Boolean(draft.lyricsOptimizer));
    setIsInstrumental(Boolean(draft.isInstrumental));
    setMusicSampleRate(draft.musicSampleRate || 44100);
    setMusicBitrate(draft.musicBitrate || 256000);
    setMusicFormat(draft.musicFormat || "mp3");
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
      if (isAvatarProvider(provider) && avatarAudioUrl.trim()) {
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
      const liveToken = data.session?.access_token || null;
      if (!liveToken) {
        setAccessToken(null);
        setUserId(null);
        if (typeof window !== "undefined") {
          safeRemoveLocalStorage("nova_access_token");
        }
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
        audioWorkflow: mode === "audio" ? audioWorkflow : undefined,
        provider,
        ratio: isAvatarWorkflow ? isDreamfaceTalkingAvatar ? ratio : "source" : ratio,
        duration: requestDuration,
        prompt: isPromptlessImageWorkflow ? "" : prompt,
        imageSize: mode === "image" ? imageSize : undefined,
        imageUrls:
          (mode === "image" && referenceImageUrls.length > 0) || (mode === "avatar" || (mode === "video" && videoWorkflow === "image-to-video"))
            ? referenceImageUrls
            : undefined,
        audioUrl: isAvatarProvider(provider) && avatarAudioUrl.trim() ? avatarAudioUrl.trim() : undefined,
        resolution:
          mode === "image"
            ? editResolution
            : mode === "video" && (provider === "dreamface-io-video" || provider === "grok-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video")
              ? videoResolution
              : undefined,
        generateAudio: mode === "video" ? generateAudio : undefined,
        outputFormat: mode === "image" && provider !== "bria-background-remove" ? outputFormat : undefined,
        quality: mode === "image" && !isPromptlessImageWorkflow ? imageQuality : undefined,
        numImages: mode === "image" && !isPromptlessImageWorkflow ? numImages : undefined,
        guidanceScale: mode === "image" && !isPromptlessImageWorkflow ? guidanceScale : undefined,
        numInferenceSteps: mode === "image" && !isPromptlessImageWorkflow ? numInferenceSteps : undefined,
        enableSafetyChecker: (mode === "image" && !isPromptlessImageWorkflow) || (mode === "video" && provider === "happy-horse-video") ? enableSafetyChecker : undefined,
        acceleration: mode === "image" && !isPromptlessImageWorkflow ? acceleration : undefined,
        limitGenerations: mode === "image" && !isPromptlessImageWorkflow ? limitGenerations : undefined,
        seed: Number.isSafeInteger(parsedSeed) && (mode === "image" || provider === "dreamface-io-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video") ? parsedSeed : undefined,
        safetyTolerance: mode === "image" && !isPromptlessImageWorkflow ? safetyTolerance : undefined,
        systemPrompt: mode === "image" && !isPromptlessImageWorkflow && systemPrompt.trim() ? systemPrompt.trim() : undefined,
        enableWebSearch: mode === "image" && !isPromptlessImageWorkflow ? enableWebSearch : undefined,
        thinkingLevel: mode === "image" && !isPromptlessImageWorkflow && thinkingLevel ? thinkingLevel : undefined,
        voice: isElevenLabsAudio || isAvatarProvider(provider) ? ttsVoice : undefined,
        stability: isElevenLabsAudio || isAvatarProvider(provider) ? ttsStability : undefined,
        timestamps: isElevenLabsAudio ? ttsTimestamps : undefined,
        languageCode: (isElevenLabsAudio || isAvatarProvider(provider)) && ttsLanguageCode ? ttsLanguageCode : undefined,
        textNormalization: isElevenLabsAudio || isAvatarProvider(provider) ? textNormalization : undefined,
        lyrics: isMiniMaxMusic ? musicLyrics : undefined,
        lyricsOptimizer: isMiniMaxMusic ? lyricsOptimizer : undefined,
        isInstrumental: isMiniMaxMusic ? isInstrumental : undefined,
        musicSampleRate: isMiniMaxMusic ? musicSampleRate : undefined,
        musicBitrate: isMiniMaxMusic ? musicBitrate : undefined,
        musicFormat: isMiniMaxMusic ? musicFormat : undefined
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
      router.push(studioProjectHref(payload.taskId));
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
      // The task is accepted by the backend now. Release the button so users can queue
      // another generation while this task continues updating in the background.
      setIsSubmitting(false);
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

  function handleGenerateClick() {
    if (!accessToken) {
      trackEvent("generate_login_required", { mode, provider, workflow: activeWorkflow }, accessToken);
      if (typeof window !== "undefined") {
        window.location.href = STUDIO_SIGN_IN_URL;
      }
      return;
    }
    handleGenerate();
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
    setSelectedBillingCycles(Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, "monthly" as BillingCycle])));
    setBillingModalOpen(true);
    setBillingMessage("");
    trackEvent("studio_billing_modal_opened", { source, balance: creditBalance, mode, provider }, accessToken);
  }

  function improveTextToImagePrompt() {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${PROMPT_IMPROVE_TEXT}` : PROMPT_IMPROVE_TEXT;
    });
    trackEvent("studio_prompt_improved", { mode, provider, workflow: activeWorkflow }, accessToken);
  }

  useEffect(() => {
    if (!billingModalOpen || typeof window === "undefined" || window.innerWidth >= 768) return;
    const frame = window.requestAnimationFrame(() => {
      const scrollContainer = billingModalScrollRef.current;
      const target = premiumLitePlanRef.current;
      if (!scrollContainer || !target) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      scrollContainer.scrollTop += targetRect.top - containerRect.top - 12;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [billingModalOpen]);

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
    <main
      dir={isRtlLocale(studioI18n.locale) ? "rtl" : "ltr"}
      className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(189,224,254,0.42),transparent_34%),radial-gradient(circle_at_74%_14%,rgba(255,200,221,0.28),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fbfcff_54%,#f7f9fd_100%)] pb-10 text-[#1f2430]"
    >
      <div className="pointer-events-none absolute left-[18%] top-10 h-72 w-72 rounded-full bg-[#bde0fe]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[14%] top-6 h-80 w-80 rounded-full bg-[#ffc8dd]/24 blur-3xl" />
      <div className={useWideStudioShell ? "mx-auto my-3 w-[calc(100vw-24px)] max-w-[1760px] md:my-7 md:w-[calc(100vw-56px)]" : "mx-auto w-full max-w-[1540px] px-2 pt-2 md:px-8 md:pt-5"}>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/70 p-3 backdrop-blur-[6px] md:p-6"
            onClick={() => {
              if (!loadingBillingItem) setBillingModalOpen(false);
            }}
          >
            <section
              className="relative max-h-[92vh] w-full max-w-[1180px] overflow-hidden rounded-[1.65rem] border border-white bg-[#f8fafc] shadow-[0_36px_120px_rgba(2,6,23,0.42)] md:rounded-[2.15rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[5px] bg-[linear-gradient(90deg,#4f46e5,#06b6d4)]" />
              <div className="pointer-events-none absolute left-0 right-0 top-[5px] h-80 overflow-hidden bg-white">
                <span className="absolute -left-20 -top-36 h-96 w-96 rounded-full bg-[#eef2ff] blur-3xl" />
                <span className="absolute -right-16 -top-32 h-96 w-96 rounded-full bg-[#ecfeff] blur-3xl" />
              </div>
              <button
                type="button"
                aria-label={st("studio.billing.close")}
                onClick={() => {
                  if (!loadingBillingItem) setBillingModalOpen(false);
                }}
                disabled={Boolean(loadingBillingItem)}
                className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white/85 text-xl leading-none text-[#64748b] shadow-[0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur transition hover:bg-white hover:text-[#111827] disabled:opacity-50"
              >
                x
              </button>

              <div ref={billingModalScrollRef} className="relative max-h-[92vh] overflow-y-auto px-4 pb-7 pt-8 sm:px-6 md:px-8 md:pb-8 md:pt-9">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-[1.15rem] border border-[#dbeafe] bg-white shadow-[0_12px_28px_rgba(79,70,229,0.12)]">
                    <span className="relative block h-5 w-6">
                      <span className="absolute left-1/2 top-0 h-3 w-4 -translate-x-1/2 rounded-t-sm bg-[#ffd45d]" />
                      <span className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-[#f6a91f]" />
                    </span>
                  </div>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#06a8c7]">{st("studio.billing.premium")}</p>
                  <h2 className="mt-2 text-3xl font-black leading-[1.04] tracking-[-0.045em] text-[#0f172a] md:text-[2.65rem]">{st("studio.billing.plansTitle")}</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
                    {st("studio.billing.description")}
                  </p>
                  <div className="mt-5 inline-flex rounded-full border border-[#dbe1ea] bg-[#eef2f7] p-1">
                    {STUDIO_BILLING_CYCLES.map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() =>
                          setSelectedBillingCycles(
                            Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, cycle]))
                          )
                        }
                        className={`rounded-full px-5 py-2 text-xs font-black transition ${
                          SUBSCRIPTION_PLANS.every((plan) => selectedBillingCycles[plan.id] === cycle)
                            ? "bg-white text-[#0f172a] shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
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

                <div className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.08fr_1.08fr]">
                  <article className="flex min-h-[430px] flex-col rounded-[1.6rem] border border-[#e2e8f0] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
                    <h3 className="text-2xl font-black text-[#151922]">{st("studio.billing.free")}</h3>
                    <p className="mt-4 text-5xl font-black">$0</p>
                    <p className="mt-2 text-sm font-semibold text-[#667085]">{st("studio.billing.trialCredits")}</p>
                    <div className="mt-4 rounded-[1.25rem] border border-[#dbeafe] bg-[#f8fdff] px-4 py-3.5">
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
                      className="mt-5 rounded-xl bg-[#e9edf3] px-5 py-3 text-sm font-black text-[#a1a8b3]"
                    >
                      {st("studio.billing.currentPlan")}
                    </button>
                    <div className="mt-5 space-y-2.5 text-sm font-semibold leading-5 text-[#394150]">
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
                        ref={plan.id === "premium-lite" ? premiumLitePlanRef : null}
                        className={`relative flex min-h-[430px] flex-col rounded-[1.6rem] border p-5 shadow-[0_18px_52px_rgba(15,23,42,0.08)] ${
                          plan.highlight
                            ? "border-2 border-[#06b6d4]/60 bg-white shadow-[0_20px_50px_rgba(6,182,212,0.12)]"
                            : "border-[#ddd6fe] bg-[radial-gradient(circle_at_95%_0%,rgba(99,102,241,0.12),transparent_40%),#fff]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`inline-flex rounded-full px-3 py-2 text-xs font-black ${plan.highlight ? "bg-[#ecfeff] text-[#0891b2]" : "bg-[#f5f3ff] text-[#7c3aed]"}`}>
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

                        <div className="mt-5">
                          <p className="text-[2.65rem] font-black tracking-tight">
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

                        <div className="mt-4 rounded-[1.25rem] border border-[#dbeafe] bg-[#f8fdff] px-4 py-3.5">
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
                          className={`mt-5 rounded-xl px-5 py-3 text-sm font-black transition active:scale-[0.98] disabled:opacity-60 ${
                            plan.highlight ? "bg-[linear-gradient(135deg,#4f46e5,#06b6d4)] text-white shadow-[0_12px_24px_rgba(79,70,229,0.2)]" : "bg-[#0f172a] text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
                          }`}
                        >
                          {loading ? st("studio.billing.openingCheckout") : st(`studio.billing.plan.${plan.id}.cta`)}
                        </button>

                        <div className="mt-5 space-y-2.5 text-sm font-semibold leading-5 text-[#394150]">
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

                <section className="mt-6 rounded-[1.75rem] border border-[#e5e7eb] bg-[#f8fafc]/80 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
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
                        <article key={pack.id} className="rounded-[1.35rem] border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
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

        <section className={`relative w-full max-w-full overflow-hidden border bg-white/72 shadow-[0_20px_60px_rgba(71,85,105,0.10)] backdrop-blur-2xl md:shadow-[0_32px_120px_rgba(71,85,105,0.14)] ${showModernWorkbenchRedesign ? "min-h-[calc(100vh-24px)] rounded-[1.75rem] border-[#8092b2]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.38))] md:min-h-[calc(100vh-56px)] md:rounded-[2.375rem]" : "min-h-[calc(100vh-1rem)] rounded-[1.35rem] border-black/[0.06] md:rounded-[2.25rem]"}`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7dd3fc]/50 to-transparent" />
          <div className="grid min-h-[calc(100vh-1rem)] min-w-0 lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[96px_minmax(0,1fr)]">
            <aside className={`hidden border-r lg:flex lg:flex-col lg:items-center ${showModernWorkbenchRedesign ? "border-[#758bac]/15 bg-[#f5faff]/60 px-3 py-5" : "border-black/[0.06] bg-white/64 px-3 py-5"}`}>
              <a href="https://dreamface.io" aria-label={st("studio.menu.dreamfaceHome")} className="block h-12 w-12 overflow-hidden rounded-2xl shadow-[0_16px_36px_rgba(16,130,101,0.22)] transition hover:-translate-y-0.5">
                <img src="/icons/icon-512x512.png" alt="" width={48} height={48} className="h-full w-full object-cover" />
              </a>
              <nav className={showModernWorkbenchRedesign ? "mt-[26px] grid w-full gap-2.5" : "mt-9 flex w-full flex-col items-center gap-4"}>
                {[
                  { label: "Home", display: st("studio.nav.home"), href: "/studio?view=home", icon: "home" as StudioIconName },
                  { label: "Avatar", display: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "video" as StudioIconName },
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
                          className={`flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                            active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#6b7280] hover:bg-black/[0.035] hover:text-[#202633]"
                          }`}
                        >
                          <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${
                            active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/70 text-[#667085]"
                          }`}>
                            <StudioIcon name={item.icon} className="h-4 w-4" />
                          </span>
                          <span className="block max-w-full text-center leading-tight [overflow-wrap:anywhere]">{item.display}</span>
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
                      className={`group flex w-full min-w-0 flex-col items-center gap-1 overflow-hidden rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                        active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#6b7280] hover:bg-black/[0.035] hover:text-[#202633]"
                      }`}
                    >
                      <span className={`grid h-8 w-8 place-items-center rounded-xl border text-sm ${
                        active ? "border-[#bae6fd] bg-white text-[#0ea5e9]" : "border-black/[0.06] bg-white/70 text-[#667085]"
                      }`}>
                        <StudioIcon name={item.icon} className="h-4 w-4" />
                      </span>
                      <span className="block max-w-full text-center leading-tight [overflow-wrap:anywhere]">{item.display}</span>
                    </Link>
                  );
                })}
              </nav>
              <Link href="/billing" className="mt-5 flex w-full items-center justify-center rounded-2xl bg-[#ecfeff] px-2 py-2 text-center text-[11px] font-semibold leading-tight text-[#06b6d4]">
                {st("studio.billing.open")}
              </Link>
            </aside>

            <nav className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-6 gap-0.5 rounded-[1.25rem] border border-black/[0.08] bg-white/94 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:inset-x-3 sm:bottom-3 sm:gap-1 sm:rounded-[1.4rem] sm:p-1.5 lg:hidden">
              {[
                { label: st("studio.nav.home"), href: "/studio?view=home", icon: "home" as StudioIconName, active: isAppsHome },
                { label: st("studio.nav.image"), href: "/studio?mode=image&workflow=text-to-image", icon: "image" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "image" },
                { label: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "avatar" },
                { label: st("studio.nav.video"), href: "/studio?mode=video&workflow=text-to-video", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "video" },
                { label: st("studio.nav.audio"), href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "audio" },
                { label: st("studio.nav.projects"), href: "/studio?view=projects", icon: "projects" as StudioIconName, active: isProjectsView }
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`min-w-0 flex flex-col items-center justify-center gap-1 rounded-[0.9rem] px-0.5 py-2 text-[9px] font-semibold transition sm:rounded-[1rem] sm:px-2 sm:text-[11px] ${
                    item.active ? "bg-[#e8f7ff] text-[#0ea5e9]" : "text-[#667085]"
                  }`}
                >
                  <StudioIcon name={item.icon} className="h-4 w-4" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className={`relative min-w-0 max-w-full ${showModernWorkbenchRedesign ? "px-[18px] pb-[90px] pt-6 md:px-[clamp(22px,3vw,52px)] md:pb-[42px] md:pt-7" : "px-3 pb-24 pt-3 md:px-8 md:py-5 lg:px-12"}`}>
              <div className={`gap-3 md:gap-4 ${showModernWorkbenchRedesign ? "mb-4 flex items-start justify-between md:mb-9 md:items-center" : "flex items-start justify-between md:items-center"}`}>
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
                        <a
                          href="https://dreamface.io/"
                          onClick={() => setMobileStudioMenuOpen(false)}
                          className="mb-1 flex items-center gap-3 border-b border-black/[0.06] px-2.5 pb-3 pt-1.5 text-base font-black tracking-tight text-[#202633]"
                        >
                          <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[13px] shadow-[0_9px_22px_rgba(16,130,101,0.18)]">
                            <img src="/icons/icon-512x512.png" alt="" width={40} height={40} className="h-full w-full object-cover" />
                          </span>
                          DreamFace
                        </a>
                        {[
                          { label: st("studio.menu.studioHome"), href: "/studio?view=home", icon: "home" as StudioIconName, active: isAppsHome },
                          { label: st("studio.nav.avatar"), href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "video" as StudioIconName, active: !isAppsHome && !isProjectsView && mode === "avatar" },
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
                        {!accessToken ? (
                          <Link
                            href={STUDIO_SIGN_IN_URL}
                            onClick={() => setMobileStudioMenuOpen(false)}
                            className="mt-1 flex items-center justify-center rounded-[1rem] bg-[#202633] px-3 py-3 text-sm font-semibold text-white shadow-sm"
                          >
                            {st("studio.auth.signIn")}
                          </Link>
                        ) : null}
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
                  <div className={`min-w-0 ${showModernWorkbenchRedesign ? "hidden md:block" : ""}`}>
                    <p className={showModernWorkbenchRedesign ? "text-xs font-black uppercase tracking-[0.22em] text-[#92a0b5]" : "hidden text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7] sm:block"}>{st("studio.header.apps")}</p>
                    <h1 className={showModernWorkbenchRedesign ? "mt-[7px] flex items-center gap-3 text-[clamp(26px,2.1vw,36px)] font-black leading-none tracking-[-0.045em] text-[#151827]" : "truncate text-lg font-semibold tracking-tight text-[#202633] sm:text-xl md:text-3xl"}>
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
                    <p className={showModernWorkbenchRedesign ? "mt-[9px] text-[15px] leading-[1.45] text-[#8794aa]" : "mt-1 hidden text-sm text-[#8b95a7] sm:block"}>
                      {isProjectsView
                        ? st("studio.header.projectsDescription")
                        : isAppsHome
                        ? st("studio.header.toolkitDescription")
                        : mode === "image"
                          ? st("studio.header.imageDescription")
                          : mode === "avatar"
                            ? st("studio.header.avatarDescription")
                            : mode === "audio"
                              ? st("studio.header.audioDescription")
                            : st("studio.header.videoDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => openBillingModal("balance")}
                    className="rounded-full border border-black/[0.06] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#485164] shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-[#08bff1]/45 hover:text-[#0f172a] hover:shadow-[0_16px_36px_rgba(8,191,241,0.14)] sm:px-3 sm:text-xs md:rounded-2xl md:px-4 md:text-sm"
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
                    className="inline-flex h-10 items-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#06b6d4)] px-3 text-xs font-black text-white shadow-[0_12px_28px_rgba(79,70,229,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(79,70,229,0.3)] sm:gap-2 sm:px-3.5 md:px-4 md:text-sm"
                  >
                    <span className="relative hidden h-4 w-5 shrink-0 sm:block">
                      <span className="absolute left-1/2 top-0 h-2.5 w-3.5 -translate-x-1/2 rounded-t-sm bg-[#fde68a]" />
                      <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-[#fbbf24]" />
                    </span>
                    <span>{st("studio.workspace.upgrade")}</span>
                  </button>
                  {accessToken ? (
                    <Link href="/studio?view=projects" className="hidden rounded-2xl bg-[#202633] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] sm:inline-flex">
                      {st("studio.nav.projects")}
                    </Link>
                  ) : mode === "audio" ? (
                    <button
                      type="button"
                      onClick={() => applyWorkflow(audioWorkflow)}
                      className="rounded-full border border-[#bae6fd] bg-[#e8f7ff] px-4 py-2 text-sm font-semibold text-[#0284c7] shadow-sm"
                    >
                      {st(`studio.workflow.${audioWorkflow}`)}
                    </button>
                  ) : (
                    <Link href={STUDIO_SIGN_IN_URL} className="hidden rounded-full bg-[#202633] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(32,38,51,0.18)] sm:inline-flex md:rounded-2xl md:px-4 md:text-sm">
                      {st("studio.auth.signIn")}
                    </Link>
                  )}
                </div>
              </div>
              {creditNote ? (
                <p className="mt-3 rounded-2xl border border-black/[0.06] bg-white/76 px-4 py-3 text-xs font-semibold text-[#667085] shadow-sm">
                  {!accessToken && creditNote === st("studio.status.signInCredit") ? (
                    <>
                      <Link href={STUDIO_SIGN_IN_URL} className="font-black text-[#1c6be1] underline-offset-4 hover:underline">
                        {st("studio.auth.signIn")}
                      </Link>
                      {creditNote.replace(st("studio.auth.signIn"), "")}
                    </>
                  ) : (
                    creditNote
                  )}
                </p>
              ) : null}

              {isAppsHome ? (
                <div className="mx-auto mt-5 w-full min-w-0 max-w-7xl pb-8 md:mt-8">
                  <section className="grid gap-5 lg:grid-cols-[1.06fr_0.94fr]">
                    <div className="relative flex min-h-[430px] flex-col justify-between overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(242,244,255,0.94)_48%,rgba(232,252,255,0.92))] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.09)] md:p-11">
                      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.2),transparent_66%)]" />
                      <div className="relative">
                        <span className="inline-flex rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#2563eb]">
                          {st("studio.workspace.badge")}
                        </span>
                        <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-[#94a3b8]">{st("studio.workspace.eyebrow")}</p>
                        <h2 className="mt-3 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#0f172a] md:text-6xl">
                          {st("studio.workspace.heroTitle")}{" "}
                          <span className="bg-[linear-gradient(100deg,#4f46e5,#06b6d4)] bg-clip-text text-transparent">
                            {st("studio.workspace.heroAccent")}
                          </span>
                        </h2>
                        <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#526174] md:text-lg">
                          {st("studio.workspace.heroBody")}
                        </p>
                      </div>
                      <div className="relative mt-9">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Link
                            href="/studio?mode=video&workflow=text-to-video&duration=5s"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f172a] px-6 py-4 text-sm font-black text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5"
                          >
                            {st("studio.workspace.start")}
                            <StudioIcon name="chevron-right" className="h-4 w-4" />
                          </Link>
                          <a
                            href="#workspace-examples"
                            className="inline-flex items-center justify-center rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-4 text-sm font-black text-[#334155] transition hover:bg-white"
                          >
                            {st("studio.workspace.examples")}
                          </a>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {["studio.workflow.image-to-video", "studio.workspace.productAds", "studio.nav.avatar", "studio.workflow.enhance-cleanup"].map((key) => (
                            <span key={key} className="rounded-full border border-black/[0.06] bg-white/74 px-3 py-2 text-xs font-black text-[#526174] shadow-sm">
                              {st(key)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:hidden">
                      {WORKSPACE_SHOWCASES.map((item) => (
                        <Link
                          key={`mobile-${item.key}`}
                          href={workspaceShowcaseHref(item.prompt)}
                          className="group relative block aspect-video overflow-hidden rounded-[1.5rem] bg-[#0f172a] shadow-[0_18px_46px_rgba(15,23,42,0.14)]"
                        >
                          <WorkspaceShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} mobileRatio={item.desktopRatio} className="absolute inset-0 h-full w-full object-cover" />
                          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.02),rgba(15,23,42,0.84))]" />
                          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                            {st(item.labelKey)}
                          </span>
                          <span className="absolute inset-x-4 bottom-4 text-white">
                            <strong className="block text-lg font-black leading-tight">{st(item.titleKey)}</strong>
                            <span className="mt-1 block text-xs font-semibold text-white/72">{st(item.metaKey)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>

                    <div className="hidden grid-cols-2 gap-3 md:gap-4 lg:grid">
                      {WORKSPACE_SHOWCASES.map((item) => (
                        <Link
                          key={item.key}
                          href={workspaceShowcaseHref(item.prompt)}
                          className="group relative min-h-[205px] overflow-hidden rounded-[1.5rem] bg-[#0f172a] shadow-[0_16px_42px_rgba(15,23,42,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(15,23,42,0.18)] md:min-h-[240px]"
                        >
                          <WorkspaceShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.04),rgba(15,23,42,0.86))]" />
                          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/16 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                            {st(item.labelKey)}
                          </span>
                          <span className="absolute inset-x-4 bottom-4 text-white">
                            <strong className="block text-base font-black leading-tight md:text-lg">{st(item.titleKey)}</strong>
                            <span className="mt-1 block text-xs font-semibold text-white/72">{st(item.metaKey)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section className="mt-10">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black tracking-tight text-[#0f172a] md:text-3xl">{st("studio.workspace.intentTitle")}</h2>
                      <p className="mt-2 text-sm font-semibold text-[#8490a3]">{st("studio.workspace.intentHint")}</p>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { title: "studio.workspace.intent.video", body: "studio.workspace.intent.videoBody", href: "/studio?mode=video&workflow=text-to-video&duration=5s", icon: "film" as StudioIconName, color: "bg-[#eef2ff] text-[#4f46e5]", tools: ["studio.workflow.text-to-video", "studio.workflow.image-to-video"] },
                        { title: "studio.workspace.intent.image", body: "studio.workspace.intent.imageBody", href: "/studio?mode=image&workflow=text-to-image", icon: "sparkles" as StudioIconName, color: "bg-[#ecfeff] text-[#0891b2]", tools: ["studio.workflow.text-to-image", "studio.workflow.image-to-image"] },
                        { title: "studio.workspace.intent.avatar", body: "studio.workspace.intent.avatarBody", href: "/studio?mode=avatar&workflow=avatar-video&provider=dreamface-io-video", icon: "video" as StudioIconName, color: "bg-[#fdf2f8] text-[#db2777]", tools: ["studio.nav.avatar"] },
                        { title: "studio.workspace.intent.enhance", body: "studio.workspace.intent.enhanceBody", href: "/studio?mode=image&workflow=enhance-cleanup&provider=topaz-image", icon: "cleanup" as StudioIconName, color: "bg-[#f0fdf4] text-[#16a34a]", tools: ["studio.workflow.enhance-cleanup"] },
                        { title: "studio.workflow.background-remove", body: "studio.home.quick.remove", href: "/studio?mode=image&workflow=background-remove&provider=bria-background-remove", icon: "cleanup" as StudioIconName, color: "bg-[#fff7ed] text-[#ea580c]", tools: ["studio.workflow.background-remove"] },
                        { title: "studio.workflow.text-to-audio", body: "studio.home.quick.audio", href: "/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts", icon: "audio" as StudioIconName, color: "bg-[#f5f3ff] text-[#7c3aed]", tools: ["studio.workflow.text-to-audio"] },
                        { title: "studio.workflow.text-to-music", body: "studio.music.promptDescription", href: "/studio?mode=audio&workflow=text-to-music&provider=minimax-music-2.6", icon: "audio" as StudioIconName, color: "bg-[#fefce8] text-[#ca8a04]", tools: ["studio.workflow.text-to-music"] }
                      ].map((item) => (
                        <Link key={item.title} href={item.href} className="group rounded-[1.5rem] border border-black/[0.06] bg-white/76 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-[#c7d2fe] hover:bg-white hover:shadow-[0_22px_52px_rgba(15,23,42,0.09)]">
                          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${item.color}`}>
                            <StudioIcon name={item.icon} className="h-6 w-6" />
                          </span>
                          <h3 className="mt-5 text-xl font-black tracking-tight text-[#0f172a]">{st(item.title)}</h3>
                          <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-[#667085]">{st(item.body)}</p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            {item.tools.map((tool) => (
                              <span key={tool} className="rounded-full bg-[#f1f5f9] px-2.5 py-1.5 text-[11px] font-black text-[#64748b]">{st(tool)}</span>
                            ))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section id="workspace-examples" className="mt-12 hidden scroll-mt-24 lg:block">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight text-[#0f172a] md:text-3xl">{st("studio.workspace.featuredTitle")}</h2>
                        <p className="mt-2 text-sm font-semibold text-[#8490a3]">{st("studio.workspace.featuredHint")}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {WORKSPACE_SHOWCASES.map((item) => (
                        <Link key={`featured-${item.key}`} href={workspaceShowcaseHref(item.prompt)} className="group relative aspect-[16/10] overflow-hidden rounded-[1.65rem] bg-[#0f172a] shadow-[0_14px_38px_rgba(15,23,42,0.1)] transition hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(15,23,42,0.16)] sm:aspect-video">
                          <WorkspaceShowcaseVideo file={item.file} desktopRatio={item.desktopRatio} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
                          <span className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_28%,rgba(15,23,42,0.9))]" />
                          <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/16 text-white backdrop-blur-md">
                            <StudioIcon name="chevron-right" className="h-4 w-4" />
                          </span>
                          <span className="absolute inset-x-5 bottom-5 text-white">
                            <span className="inline-flex rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur-md">{st(item.labelKey)}</span>
                            <strong className="mt-3 block text-xl font-black md:text-2xl">{st(item.titleKey)}</strong>
                            <span className="mt-1 block text-sm font-semibold text-white/72">{st(item.metaKey)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <div className="mt-12 grid gap-5">
                    <section className="flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#0f172a,#1e1b4b)] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:p-7 md:flex-row md:items-center md:rounded-[1.8rem] md:p-9">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-black leading-tight tracking-tight md:text-3xl">{st("studio.workspace.premiumTitle")}</h2>
                        <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#cbd5e1]">{st("studio.workspace.premiumBody")}</p>
                        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          {["studio.workspace.premiumCredits", "studio.workspace.premiumQueue", "studio.workspace.premiumModels", "studio.workspace.premiumWatermark"].map((key) => (
                            <span key={key} className="min-w-0 truncate rounded-full border border-white/10 bg-white/10 px-3 py-2 text-center text-[11px] font-black text-[#e0f2fe] sm:text-xs">{st(key)}</span>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => openBillingModal("workspace_upgrade")} className="w-full shrink-0 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#0f172a] shadow-lg transition hover:-translate-y-0.5 md:w-auto">
                        {st("studio.workspace.premiumCta")}
                      </button>
                    </section>

                    <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/80 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] sm:p-6 md:rounded-[1.8rem]">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[#0f172a]">{st("studio.workspace.recentTitle")}</h2>
                        <Link href="/studio?view=projects" className="shrink-0 text-[11px] font-black text-[#4f46e5] sm:text-xs">{st("studio.workspace.viewProjects")}</Link>
                      </div>
                      <div className="mt-4">
                        {tasks.length ? tasks.slice(0, 3).map((task) => (
                          <Link key={`recent-${task.id}`} href={`/studio?view=projects&taskId=${encodeURIComponent(task.id)}`} className="flex min-w-0 items-center gap-3 border-t border-black/[0.05] py-3 first:border-t-0">
                            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#c7d2fe,#67e8f9)] text-[#334155]">
                              {task.mediaUrl && task.type === "Image" ? <img src={task.mediaUrl} alt="" className="h-full w-full object-cover" /> : <StudioIcon name={task.type === "Audio" ? "audio" : task.type === "Video" ? "video" : "image"} className="h-5 w-5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm font-black text-[#253044]">{task.title || task.prompt || taskTypeLabel(task.type)}</strong>
                              <span className="mt-1 block text-xs font-semibold text-[#94a3b8]">{taskStatusLabel(task.status)}</span>
                            </span>
                          </Link>
                        )) : (
                          <p className="break-words rounded-2xl bg-[#f8fafc] px-4 py-6 text-sm font-semibold leading-6 text-[#8490a3]">{st("studio.workspace.recentEmpty")}</p>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              ) : null}

              {isProjectsView ? (
                <div className="mx-auto mt-4 w-full min-w-0 max-w-7xl overflow-hidden md:mt-10">
                  <div className="mb-4 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b95a7]">{st("studio.projects.eyebrow")}</p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#202633] md:text-5xl">
                        {st("studio.projects.title")}
                      </h2>
                      <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-[#7a8496] md:mt-3">
                        {st("studio.projects.description")}
                      </p>
                    </div>
                    <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 rounded-[1.25rem] border border-black/[0.06] bg-white/72 p-1.5 shadow-sm sm:gap-2 sm:rounded-[1.5rem] sm:p-2 md:w-auto md:min-w-[300px]">
                      {[
                        [st("studio.projects.active"), activeTasks.length],
                        [st("studio.projects.done"), completedTasks.length],
                        [st("studio.projects.failed"), failedTasks.length]
                      ].map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-[1rem] bg-[#f8fbff] px-1.5 py-2.5 text-center sm:rounded-2xl sm:px-3 md:px-4 md:py-3">
                          <p className="text-lg font-semibold text-[#202633]">{value}</p>
                          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8b95a7] sm:text-[11px] sm:tracking-[0.14em]">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {taskHistoryNote ? (
                    <p className="mb-5 rounded-2xl border border-black/[0.06] bg-white/76 px-4 py-3 text-sm font-medium text-[#667085] shadow-sm">
                      {taskHistoryNote}
                    </p>
                  ) : null}

                  <div className="grid min-w-0 gap-4 md:gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                    <aside className="order-2 min-w-0 rounded-[1.35rem] border border-black/[0.06] bg-white/76 p-2.5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-3 md:rounded-[2rem] xl:order-1">
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

                    <section className="order-1 min-w-0 overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[linear-gradient(135deg,#fbfdff,#f7f9fd)] p-2 shadow-[0_18px_54px_rgba(15,23,42,0.09)] sm:p-3 md:rounded-[2rem] md:p-6 md:shadow-[0_26px_86px_rgba(15,23,42,0.10)] xl:order-2 xl:min-h-[680px]">
                      {selectedProjectTask ? (
                        <div className="grid h-full min-w-0 gap-3 md:gap-4 lg:grid-cols-[minmax(0,1.1fr)_360px] lg:gap-5">
                          <article className="relative min-w-0 overflow-hidden rounded-[1.15rem] bg-[#111827] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_rgba(15,23,42,0.2)] sm:p-3 md:rounded-[1.75rem] md:p-4 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(15,23,42,0.22)]">
                            <div className="pointer-events-none absolute -left-20 top-10 h-60 w-60 rounded-full bg-[#60a5fa]/20 blur-3xl" />
                            <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[#c084fc]/18 blur-3xl" />
                            <div className="relative mb-3 flex min-w-0 items-start justify-between gap-2 px-1 pt-1 sm:mb-4 sm:gap-3 sm:px-0 sm:pt-0">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{st("studio.projects.preview")}</p>
                                <h3 className="mt-1 line-clamp-2 max-w-xl break-words text-sm font-semibold leading-5 text-white sm:text-base md:text-lg">{taskTitle(selectedProjectTask)}</h3>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 sm:px-3 sm:py-1.5 sm:text-xs ${statusPillClass(selectedProjectTask.status)}`}>
                                {taskStatusLabel(selectedProjectTask.status)}
                              </span>
                            </div>
                            <div className="relative grid min-h-[220px] w-full min-w-0 place-items-center overflow-hidden rounded-[0.95rem] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(96,165,250,0.16),transparent_35%),linear-gradient(180deg,#182131,#0d121d)] sm:min-h-[380px] sm:rounded-[1.1rem] md:min-h-[520px] md:rounded-[1.35rem]">
                              {selectedProjectTask.mediaUrl ? (
                                selectedProjectTask.type === "Video" ? (
                                  <video src={selectedProjectTask.mediaUrl} controls playsInline preload="metadata" className="block max-h-[68dvh] w-full min-w-0 max-w-full bg-black object-contain sm:max-h-[520px] md:max-h-[620px]" />
                                ) : selectedProjectTask.type === "Audio" ? (
                                  <div className="m-2 w-[calc(100%-1rem)] min-w-0 max-w-xl rounded-[1.2rem] border border-white/10 bg-white/[0.08] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:m-0 sm:w-full sm:rounded-[1.4rem] sm:p-6">
                                    <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/45">{st("studio.projects.voiceover")}</p>
                                    <audio src={selectedProjectTask.mediaUrl} controls className="w-full min-w-0 max-w-full" />
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
                                      : selectedProjectTask.type === "Video"
                                        ? st("studio.projects.videoWaitHint", { range: taskEstimatedWaitRange(selectedProjectTask) })
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

                          <aside className="min-w-0 space-y-2.5 md:space-y-4">
                            <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-3 shadow-sm sm:p-4 md:rounded-[1.75rem] md:p-5">
                              <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                {selectedProjectTask.mediaUrl ? (
                                  <a
                                    href={`/api/generate/download?taskId=${encodeURIComponent(selectedProjectTask.id)}&name=${encodeURIComponent(selectedProjectTask.id)}`}
                                    className="flex min-w-0 items-center justify-center rounded-xl bg-[#202633] px-3 py-2.5 text-center text-xs font-semibold text-white sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
                                  >
                                    {st("studio.projects.download")}
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedProjectTask.prompt) navigator.clipboard.writeText(selectedProjectTask.prompt).catch(() => null);
                                  }}
                                  className="min-w-0 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
                                >
                                  {st("studio.projects.copyPrompt")}
                                </button>
                                <Link href={regenerateHref(selectedProjectTask)} className="flex min-w-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">
                                  {selectedProjectTask.status === "Failed" ? st("studio.projects.retry") : st("studio.projects.regenerate")}
                                </Link>
                                {selectedProjectTask.mediaUrl && selectedProjectTask.type !== "Audio" ? (
                                  <Link href={useAsReferenceHref(selectedProjectTask)} className="flex min-w-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-center text-xs font-semibold text-[#202633] sm:rounded-full sm:px-4 sm:py-2 sm:text-sm">
                                    {st("studio.projects.useReference")}
                                  </Link>
                                ) : null}
                              </div>
                            </div>

                            <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-sm md:rounded-[1.75rem] md:p-5">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b95a7]">{st("studio.projects.prompt")}</p>
                              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#354052]">
                                {selectedProjectTask.prompt || st("studio.projects.noPrompt")}
                              </p>
                            </div>

                            <div className="min-w-0 rounded-[1.25rem] border border-black/[0.06] bg-white p-4 shadow-sm md:rounded-[1.75rem] md:p-5">
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
                                  <div key={label} className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 border-b border-black/[0.05] pb-3 last:border-0 last:pb-0">
                                    <dt className="min-w-0 break-words font-medium text-[#8b95a7]">{label}</dt>
                                    <dd className="min-w-0 break-words text-right font-semibold text-[#202633]">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </aside>
                        </div>
                      ) : (
                        <div className="grid min-h-[430px] place-items-center rounded-[1.25rem] border border-dashed border-black/[0.08] bg-white/70 px-5 text-center sm:min-h-[520px] md:min-h-[620px] md:rounded-[1.75rem]">
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

              <div className={`${showModernWorkbenchRedesign ? "mx-auto mb-6 w-full text-center" : "mx-auto mt-5 max-w-5xl text-center md:mt-16"} ${isAppsHome || isProjectsView ? "hidden" : ""}`}>
                <h2 className={showModernWorkbenchRedesign ? "mx-auto max-w-[900px] text-[34px] font-black leading-[0.98] tracking-[-0.06em] text-[#151827] sm:text-[clamp(42px,4.15vw,66px)]" : "hidden text-3xl font-semibold tracking-tight text-[#202633] sm:block md:text-5xl"}>
                  {st("studio.heading.createToday")}
                </h2>
                {showModernWorkbenchRedesign ? (
                  <p className="mx-auto mt-[15px] max-w-[690px] text-[15px] leading-[1.55] text-[#7d8aa0] sm:text-[17px]">
                    {showImageToImageRedesign
                      ? st("studio.imageImage.heroDescription")
                      : showImageUtilityRedesign
                        ? st(imageWorkflow === "background-remove" ? "studio.utilityImage.backgroundHeroDescription" : "studio.utilityImage.enhanceHeroDescription")
                        : showVideoWorkbenchRedesign
                          ? st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.imageHeroDescription" : "studio.videoWorkbench.textHeroDescription")
                          : showAudioWorkbenchRedesign
                            ? st(audioWorkflow === "text-to-music" ? "studio.audioWorkbench.musicHeroDescription" : "studio.audioWorkbench.voiceHeroDescription")
                            : showAvatarWorkbenchRedesign
                              ? st("studio.avatarWorkbench.heroDescription")
                              : st("studio.textImage.heroDescription")}
                  </p>
                ) : null}
                <div className={showModernWorkbenchRedesign ? "mx-auto mt-6 flex justify-center" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
                  {mode === "image" ? (
                    <>
                      <div className={showImageWorkbenchRedesign ? "flex w-full max-w-[900px] gap-1 overflow-x-auto rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] lg:grid lg:w-fit lg:grid-cols-4 lg:overflow-visible lg:rounded-full" : "grid w-full max-w-[720px] grid-cols-2 rounded-2xl border border-black/[0.06] bg-white/82 p-1 shadow-sm sm:inline-grid sm:w-auto sm:max-w-none sm:grid-cols-4 sm:rounded-full"}>
                        {(["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"] as StudioWorkflow[]).map((workflow) => {
                          const active = imageWorkflow === workflow;
                          return (
                            <button
                              key={workflow}
                              type="button"
                              onClick={() => applyWorkflow(workflow)}
                              className={`${showImageWorkbenchRedesign ? "min-w-[132px] shrink-0 rounded-[17px] px-4 py-[13px] text-sm font-black lg:min-w-[142px] lg:rounded-full" : "rounded-full px-4 py-2.5 text-sm font-semibold sm:py-2"} transition ${
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
                    <div className={showVideoWorkbenchRedesign ? "grid w-full max-w-[520px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] sm:rounded-full" : "mt-2 flex flex-wrap items-center justify-center gap-2 sm:mt-5 md:mt-7"}>
                      {(["text-to-video", "image-to-video"] as StudioWorkflow[]).map((workflow) => {
                        const active = activeWorkflow === workflow;
                        return (
                          <button
                            key={workflow}
                            type="button"
                            onClick={() => applyWorkflow(workflow)}
                            className={`${showVideoWorkbenchRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-black sm:rounded-full" : "rounded-full border px-4 py-2 text-sm font-semibold"} transition ${
                              active
                                ? showVideoWorkbenchRedesign
                                  ? "bg-[#202633] text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]"
                                  : "border-[#bae6fd] bg-[#e8f7ff] text-[#0284c7] shadow-sm"
                                : showVideoWorkbenchRedesign
                                  ? "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"
                                  : "border-black/[0.06] bg-white/78 text-[#667085] hover:bg-white hover:text-[#202633]"
                            }`}
                          >
                            {st(`studio.workflow.${workflow}`)}
                          </button>
                        );
                      })}
                    </div>
                  ) : mode === "audio" ? (
                    <div className={showAudioWorkbenchRedesign ? "grid w-full max-w-[560px] grid-cols-2 gap-1 overflow-visible rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)] sm:rounded-full" : "grid w-full max-w-[560px] grid-cols-2 rounded-full border border-black/[0.06] bg-white/82 p-1 shadow-sm sm:w-auto"}>
                      {(["text-to-audio", "text-to-music"] as AudioWorkflow[]).map((workflow) => {
                        const active = audioWorkflow === workflow;
                        return (
                          <button
                            key={workflow}
                            type="button"
                            onClick={() => applyWorkflow(workflow)}
                            className={`${showAudioWorkbenchRedesign ? "min-w-0 rounded-[17px] px-4 py-[13px] text-sm font-black sm:rounded-full" : "rounded-full px-5 py-2.5 text-sm font-semibold"} transition ${
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
                  ) : mode === "avatar" ? (
                    <div className="inline-flex rounded-[22px] border border-[#7689a8]/20 bg-[#edf3fd]/75 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_10px_24px_rgba(52,73,112,0.08)]">
                      <button type="button" className="min-w-[172px] rounded-[17px] bg-[#202633] px-5 py-[13px] text-sm font-black text-white shadow-[0_10px_24px_rgba(32,38,51,0.16)]">
                        {st("studio.avatarWorkbench.tab")}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className={`overflow-visible border border-black/[0.06] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.09)] md:shadow-[0_28px_80px_rgba(15,23,42,0.12)] ${showModernWorkbenchRedesign ? `${TEXT_IMAGE_PAGE_INNER_CLASS} mt-7 rounded-[28px] sm:rounded-[34px]` : "mt-4 rounded-[1.7rem] sm:mt-5 md:mt-7 md:rounded-[2rem]"}`}>
                  <div className={showModernWorkbenchRedesign ? "text-left" : "p-5 text-left md:p-7"}>
                    {showTextToImageTemplates ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              {"\u2726"}
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">{st("studio.textImage.promptStudio")}</strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">{st("studio.textImage.promptStudioDescription")}</span>
                            </div>
                          </div>
                          <div className="inline-flex h-[34px] items-center gap-2 rounded-full bg-[#20c997]/10 px-3 text-xs font-black text-[#17916e]">
                            <span className="h-2 w-2 rounded-full bg-[#20c997] shadow-[0_0_0_5px_rgba(32,201,151,0.12)]" />
                            {canSubmit ? st("studio.textImage.ready") : st("studio.textImage.waiting")}
                          </div>
                        </div>

                        <div className="px-[18px] pb-5 pt-7 md:px-7">
                          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.textImage.yourPrompt")}</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={improveTextToImagePrompt}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                              >
                                <span aria-hidden="true">{"\u2728"}</span>
                                {st("studio.textImage.improve")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrompt("")}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                              >
                                <span aria-hidden="true">{"\u21ba"}</span>
                                {st("studio.action.clear")}
                              </button>
                              <Link
                                href={TEXT_IMAGE_GALLERY_URL}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                              >
                                <span aria-hidden="true">{"\u2318"}</span>
                                {st("studio.textImage.templates")}
                              </Link>
                            </div>
                          </div>
                          <textarea
                            dir="auto"
                            rows={7}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="min-h-[220px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[255px] md:text-[22px]"
                            placeholder={st("studio.textImage.placeholder")}
                          />
                          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
                            <span>{st("studio.textImage.tip")}</span>
                            <span>{prompt.length.toLocaleString()} characters</span>
                          </div>
                        </div>
                      </div>
                    ) : showImageToImageRedesign ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              +
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">{st("studio.imageImage.referenceStudio")}</strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">{st("studio.imageImage.referenceStudioDescription")}</span>
                            </div>
                          </div>
                          <div className="inline-flex h-[34px] items-center gap-2 rounded-full bg-[#20c997]/10 px-3 text-xs font-black text-[#17916e]">
                            <span className="h-2 w-2 rounded-full bg-[#20c997] shadow-[0_0_0_5px_rgba(32,201,151,0.12)]" />
                            {referenceImageUrls.length ? st("studio.imageImage.ready") : st("studio.imageImage.addReference")}
                          </div>
                        </div>

                        <div className="grid gap-5 px-[18px] pb-5 pt-7 md:px-7 lg:grid-cols-[0.95fr_1.05fr]">
                          <div
                            className="rounded-[28px] border border-dashed border-[#8fb6e8]/45 bg-[linear-gradient(135deg,rgba(232,247,255,0.72),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.imageImage.referenceImages")}</div>
                                <p className="mt-1 max-w-md text-xs font-bold leading-5 text-[#8290a7]">{st("studio.imageImage.referenceHint")}</p>
                              </div>
                              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#758bac]/15 bg-white px-4 text-xs font-black text-[#187be6] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-0.5 hover:bg-white">
                                {st("studio.action.chooseImage")}
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                                />
                              </label>
                            </div>
                            <input
                              value={referenceImagesText}
                              onChange={(event) => setReferenceImagesText(event.target.value)}
                              placeholder="https://.../image.jpg"
                              className="mt-4 h-11 w-full rounded-2xl border border-[#758bac]/15 bg-white/85 px-4 text-sm font-bold text-[#43516a] outline-none placeholder:text-[#9aa8bd]"
                            />
                            {referenceImageUrls.length ? (
                              <div className="mt-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="text-xs font-black text-[#66758b]">
                                    {st("studio.reference.count", {
                                      count: referenceImageUrls.length,
                                      label: st(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReferenceImagesText("");
                                      setReferenceImageFiles([]);
                                    }}
                                    className="text-xs font-black text-[#ef4444] transition hover:text-[#dc2626]"
                                  >
                                    {st("studio.action.clear")}
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                  {referenceImageUrls.slice(0, 8).map((url, index) => (
                                    <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                                      <img src={url} alt={st("studio.reference.image")} className="h-full w-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 grid min-h-[132px] place-items-center rounded-[24px] border border-[#758bac]/15 bg-white/55 px-5 text-center">
                                <p className="max-w-xs text-sm font-bold leading-6 text-[#8290a7]">{st("studio.imageImage.emptyReference")}</p>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                              <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.imageImage.editPrompt")}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPrompt("")}
                                  className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                                >
                                  {st("studio.action.clear")}
                                </button>
                                <Link
                                  href="/gallery"
                                  className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                                >
                                  {st("studio.textImage.templates")}
                                </Link>
                              </div>
                            </div>
                            <textarea
                              dir="auto"
                              rows={7}
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              className="min-h-[300px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:text-[22px]"
                              placeholder={st("studio.imageImage.placeholder")}
                            />
                            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
                              <span>{st("studio.imageImage.tip")}</span>
                              <span>{prompt.length.toLocaleString()} characters</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : showImageUtilityRedesign ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              {"\u2726"}
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">
                                {st(imageWorkflow === "background-remove" ? "studio.utilityImage.backgroundStudio" : "studio.utilityImage.enhanceStudio")}
                              </strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">
                                {st(imageWorkflow === "background-remove" ? "studio.utilityImage.backgroundStudioDescription" : "studio.utilityImage.enhanceStudioDescription")}
                              </span>
                            </div>
                          </div>
                          <div className="inline-flex h-[34px] items-center gap-2 rounded-full bg-[#20c997]/10 px-3 text-xs font-black text-[#17916e]">
                            <span className="h-2 w-2 rounded-full bg-[#20c997] shadow-[0_0_0_5px_rgba(32,201,151,0.12)]" />
                            {referenceImageUrls.length ? st("studio.utilityImage.ready") : st("studio.imageImage.addReference")}
                          </div>
                        </div>

                        <div className="grid gap-5 px-[18px] pb-5 pt-7 md:px-7 lg:grid-cols-[0.95fr_1.05fr]">
                          <div
                            className="rounded-[28px] border border-dashed border-[#8fb6e8]/45 bg-[linear-gradient(135deg,rgba(232,247,255,0.72),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.imageImage.referenceImages")}</div>
                                <p className="mt-1 max-w-md text-xs font-bold leading-5 text-[#8290a7]">
                                  {st(imageWorkflow === "background-remove" ? "studio.utilityImage.backgroundReferenceHint" : "studio.utilityImage.enhanceReferenceHint")}
                                </p>
                              </div>
                              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#758bac]/15 bg-white px-4 text-xs font-black text-[#187be6] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-0.5 hover:bg-white">
                                {st("studio.action.chooseImage")}
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple={!isPromptlessImageWorkflow}
                                  className="hidden"
                                  onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                                />
                              </label>
                            </div>
                            <input
                              value={referenceImagesText}
                              onChange={(event) => setReferenceImagesText(event.target.value)}
                              placeholder="https://.../image.jpg"
                              className="mt-4 h-11 w-full rounded-2xl border border-[#758bac]/15 bg-white/85 px-4 text-sm font-bold text-[#43516a] outline-none placeholder:text-[#9aa8bd]"
                            />
                            {referenceImageUrls.length ? (
                              <div className="mt-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <span className="text-xs font-black text-[#66758b]">
                                    {st("studio.reference.count", {
                                      count: referenceImageUrls.length,
                                      label: st(referenceImageUrls.length === 1 ? "studio.reference.image" : "studio.reference.images")
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReferenceImagesText("");
                                      setReferenceImageFiles([]);
                                    }}
                                    className="text-xs font-black text-[#ef4444] transition hover:text-[#dc2626]"
                                  >
                                    {st("studio.action.clear")}
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                  {referenceImageUrls.slice(0, isPromptlessImageWorkflow ? 1 : 8).map((url, index) => (
                                    <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                                      <img src={url} alt={st("studio.reference.image")} className="h-full w-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 grid min-h-[132px] place-items-center rounded-[24px] border border-[#758bac]/15 bg-white/55 px-5 text-center">
                                <p className="max-w-xs text-sm font-bold leading-6 text-[#8290a7]">{st("studio.imageImage.emptyReference")}</p>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            {imageWorkflow === "enhance-cleanup" ? (
                              <div className="flex min-h-[300px] flex-col justify-between rounded-[28px] border border-[#758bac]/15 bg-[linear-gradient(145deg,#f5faff,#ffffff)] p-5 shadow-[0_10px_28px_rgba(35,58,97,0.06)] md:p-6">
                                <div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2886d3]">Topaz image enhancement</p>
                                      <h3 className="mt-2 text-xl font-black text-[#283249]">Standard V2</h3>
                                    </div>
                                    <span className="rounded-full bg-[#e9f7ff] px-3 py-1.5 text-xs font-black text-[#1787c4]">2x</span>
                                  </div>
                                  <p className="mt-4 text-sm font-bold leading-6 text-[#7b899f]">{st("studio.model.topaz-image")}</p>
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-3">
                                  {[
                                    ["Subject", "All"],
                                    ["Face enhancement", "80%"],
                                    ["Upscale", "2x"],
                                    ["Output", outputFormat === "png" ? "PNG" : "JPEG"]
                                  ].map(([label, value]) => (
                                    <div key={label} className="rounded-[18px] border border-[#758bac]/12 bg-white px-4 py-3 shadow-[0_6px_16px_rgba(35,58,97,0.04)]">
                                      <span className="block text-[10px] font-black uppercase tracking-[0.1em] text-[#98a4b6]">{label}</span>
                                      <strong className="mt-1 block text-sm font-black text-[#42516a]">{value}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="grid min-h-[300px] place-items-center rounded-[28px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-6 text-center shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                                <div>
                                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-xl font-black text-[#187be6]">
                                    {"\u2726"}
                                  </div>
                                  <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#283249]">{st("studio.utilityImage.backgroundReadyTitle")}</h3>
                                  <p className="mx-auto mt-2 max-w-sm text-sm font-bold leading-6 text-[#8290a7]">{st("studio.utilityImage.backgroundReadyBody")}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : showAudioWorkbenchRedesign ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              {"\u266b"}
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">
                                {st(audioWorkflow === "text-to-music" ? "studio.audioWorkbench.musicStudio" : "studio.audioWorkbench.voiceStudio")}
                              </strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">
                                {st(audioWorkflow === "text-to-music" ? "studio.audioWorkbench.musicStudioDescription" : "studio.audioWorkbench.voiceStudioDescription")}
                              </span>
                            </div>
                          </div>
                          <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-black ${canSubmit ? "bg-[#20c997]/10 text-[#17916e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
                            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
                            {canSubmit ? st("studio.audioWorkbench.ready") : st("studio.audioWorkbench.waiting")}
                          </div>
                        </div>

                        <div className="px-[18px] pb-5 pt-7 md:px-7">
                          <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">
                              {st(audioWorkflow === "text-to-music" ? "studio.audioWorkbench.musicPrompt" : "studio.audioWorkbench.voiceScript")}
                            </div>
                            <button
                              type="button"
                              onClick={() => setPrompt("")}
                              className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                            >
                              {st("studio.action.clear")}
                            </button>
                          </div>
                          <textarea
                            dir="auto"
                            rows={7}
                            maxLength={isMiniMaxMusic ? 2000 : undefined}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[310px] md:text-[22px]"
                            placeholder={audioWorkflow === "text-to-music" ? st("studio.music.defaultPrompt") : st("studio.placeholder.audio")}
                          />
                          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
                            <span>{st(audioWorkflow === "text-to-music" ? "studio.music.promptDescription" : "studio.audioWorkbench.voiceTip")}</span>
                            <span>{prompt.length.toLocaleString()} / {isMiniMaxMusic ? "2,000" : "∞"}</span>
                          </div>

                          {isMiniMaxMusic ? (
                            <div className="mt-5 rounded-[24px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-4 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                              <button
                                type="button"
                                onClick={() => setMusicAdvancedOpen((value) => !value)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span>
                                  <span className="block text-sm font-black text-[#283249]">{st("studio.music.additionalSettings")}</span>
                                  <span className="mt-1 block text-xs font-bold text-[#8290a7]">{st("studio.music.additionalSettingsDescription")}</span>
                                </span>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#66758b]">{musicAdvancedOpen ? st("studio.music.less") : st("studio.music.more")}</span>
                              </button>
                              {musicAdvancedOpen ? (
                                <div className="mt-4 grid gap-3">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#758bac]/15 bg-white p-4">
                                      <span>
                                        <span className="block text-sm font-black text-[#485164]">{st("studio.music.instrumental")}</span>
                                        <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.music.instrumentalDescription")}</span>
                                      </span>
                                      <input type="checkbox" checked={isInstrumental} onChange={(e) => setIsInstrumental(e.target.checked)} className="h-5 w-5" />
                                    </label>
                                    <label className={`flex items-center justify-between gap-4 rounded-2xl border border-[#758bac]/15 bg-white p-4 ${isInstrumental ? "opacity-50" : ""}`}>
                                      <span>
                                        <span className="block text-sm font-black text-[#485164]">{st("studio.music.autoLyrics")}</span>
                                        <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.music.autoLyricsDescription")}</span>
                                      </span>
                                      <input type="checkbox" checked={lyricsOptimizer} disabled={isInstrumental} onChange={(e) => setLyricsOptimizer(e.target.checked)} className="h-5 w-5" />
                                    </label>
                                  </div>
                                  {!isInstrumental ? (
                                    <label className="rounded-2xl border border-[#758bac]/15 bg-white p-3">
                                      <span className="mb-2 block text-xs font-black text-[#667085]">{st("studio.music.lyrics")}</span>
                                      <textarea
                                        rows={7}
                                        maxLength={3500}
                                        value={musicLyrics}
                                        onChange={(e) => setMusicLyrics(e.target.value)}
                                        disabled={lyricsOptimizer}
                                        placeholder={st("studio.music.lyricsPlaceholder")}
                                        className="w-full resize-y rounded-xl border border-black/[0.06] bg-[#fbfcfe] px-3 py-3 text-sm leading-6 text-[#485164] outline-none disabled:opacity-50"
                                      />
                                      <span className="mt-2 block text-xs leading-5 text-[#8b95a7]">{st("studio.music.lyricsDescription")}</span>
                                      <span className="mt-2 block text-right text-xs text-[#98a2b3]">{musicLyrics.length.toLocaleString()} / 3,500</span>
                                    </label>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : showVideoWorkbenchRedesign ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              {"\u25b6"}
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">
                                {st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.motionStudio" : "studio.videoWorkbench.promptStudio")}
                              </strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">
                                {st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.motionStudioDescription" : "studio.videoWorkbench.promptStudioDescription")}
                              </span>
                            </div>
                          </div>
                          <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-black ${canSubmit ? "bg-[#20c997]/10 text-[#17916e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
                            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
                            {canSubmit ? st("studio.videoWorkbench.ready") : st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.waitingImage" : "studio.videoWorkbench.waitingPrompt")}
                          </div>
                        </div>

                        <div className={`grid gap-5 px-[18px] pb-5 pt-7 md:px-7 ${videoWorkflow === "image-to-video" ? "lg:grid-cols-[0.95fr_1.05fr]" : ""}`}>
                          {videoWorkflow === "image-to-video" ? (
                            <div
                              className="rounded-[28px] border border-dashed border-[#8fb6e8]/45 bg-[linear-gradient(135deg,rgba(232,247,255,0.72),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                              }}
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.videoWorkbench.referenceImage")}</p>
                                  <p className="mt-1 text-xs font-bold leading-5 text-[#8290a7]">{st("studio.videoWorkbench.referenceHint")}</p>
                                </div>
                                <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-xs font-black text-[#187be6] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-0.5">
                                  {st("studio.action.chooseImage")}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                                  />
                                </label>
                              </div>
                              <input
                                value={referenceImagesText}
                                onChange={(event) => setReferenceImagesText(event.target.value)}
                                placeholder="https://.../image.jpg"
                                className="h-12 w-full rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                              />
                              {referenceImageUrls.length ? (
                                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                  {referenceImageUrls.slice(0, 4).map((url, index) => (
                                    <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                                      <img src={url} alt={`Video reference ${index + 1}`} className="h-full w-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-4 grid min-h-[132px] place-items-center rounded-[24px] border border-[#758bac]/15 bg-white/55 px-5 text-center">
                                  <p className="max-w-xs text-sm font-bold leading-6 text-[#8290a7]">{st("studio.videoWorkbench.emptyReference")}</p>
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="min-w-0">
                            <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                              <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">
                                {st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.motionPrompt" : "studio.videoWorkbench.yourPrompt")}
                              </div>
                              <button
                                type="button"
                                onClick={() => setPrompt("")}
                                className="inline-flex h-8 items-center rounded-full border border-[#758bac]/15 bg-[#f7f9fd] px-3 text-xs font-black text-[#66758b] transition hover:bg-white hover:text-[#202633]"
                              >
                                {st("studio.action.clear")}
                              </button>
                            </div>
                            <textarea
                              dir="auto"
                              rows={7}
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[310px] md:text-[22px]"
                              placeholder={st(videoWorkflow === "image-to-video" ? "studio.placeholder.imageVideo" : "studio.placeholder.video")}
                            />
                            <div className="mt-[18px] flex flex-wrap items-center justify-between gap-4 text-xs font-extrabold text-[#96a2b7]">
                              <span>{st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.motionTip" : "studio.videoWorkbench.promptTip")}</span>
                              <span>{prompt.length.toLocaleString()} characters</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : showAvatarWorkbenchRedesign ? (
                      <div>
                        <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#758bac]/10 bg-[linear-gradient(90deg,rgba(248,251,255,0.98),rgba(255,255,255,0.75)),radial-gradient(circle_at_12%_50%,rgba(24,199,243,0.16),transparent_34%)] px-[18px] py-[18px] md:px-7">
                          <div className="flex items-center gap-3">
                            <span className="grid h-[34px] w-[34px] place-items-center rounded-[13px] bg-[linear-gradient(135deg,rgba(37,99,255,0.12),rgba(24,199,243,0.18))] text-sm font-black text-[#187be6]">
                              {"\u25b6"}
                            </span>
                            <div>
                              <strong className="block text-[15px] font-black tracking-[-0.01em] text-[#283249]">{st("studio.avatarWorkbench.studio")}</strong>
                              <span className="mt-0.5 block text-xs font-bold text-[#91a0b6]">{st("studio.avatarWorkbench.studioDescription")}</span>
                            </div>
                          </div>
                          <div className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-xs font-black ${canSubmit ? "bg-[#20c997]/10 text-[#17916e]" : "bg-[#fff7ed] text-[#c2410c]"}`}>
                            <span className={`h-2 w-2 rounded-full shadow-[0_0_0_5px_rgba(32,201,151,0.12)] ${canSubmit ? "bg-[#20c997]" : "bg-[#fb923c]"}`} />
                            {canSubmit ? st("studio.avatarWorkbench.ready") : st("studio.avatarWorkbench.waiting")}
                          </div>
                        </div>

                        <div className="grid gap-5 px-[18px] pb-5 pt-7 md:px-7 lg:grid-cols-[0.95fr_1.05fr]">
                          <div
                            className="rounded-[28px] border border-dashed border-[#8fb6e8]/45 bg-[linear-gradient(135deg,rgba(232,247,255,0.72),rgba(255,255,255,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleReferenceFiles(event.dataTransfer.files).catch(() => setStatusText(st("studio.status.fileReadFailed")));
                            }}
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.field.avatarImage")}</p>
                                <p className="mt-1 text-xs font-bold leading-5 text-[#8290a7]">{st("studio.reference.avatarHint")}</p>
                              </div>
                              <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-xs font-black text-[#187be6] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-0.5">
                                {st("studio.action.chooseImage")}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => handleReferenceFiles(event.target.files).catch(() => setStatusText(st("studio.status.fileReadFailed")))}
                                />
                              </label>
                            </div>
                            <input
                              value={referenceImagesText}
                              onChange={(event) => setReferenceImagesText(event.target.value)}
                              placeholder="https://.../avatar.jpg"
                              className="h-12 w-full rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none transition focus:border-[#77a8e8]"
                            />
                            {referenceImageUrls.length ? (
                              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {referenceImageUrls.slice(0, 4).map((url, index) => (
                                  <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-2xl border border-white bg-white shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                                    <img src={url} alt={`Avatar input ${index + 1}`} className="h-full w-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={startAvatarImageGuide}
                                className="mt-4 block w-full rounded-[24px] border border-[#758bac]/15 bg-white/55 px-5 py-5 text-left transition hover:bg-white"
                              >
                                <span className="text-xs font-black uppercase tracking-[0.12em] text-[#2563eb]">{st("studio.avatar.guideEyebrow")}</span>
                                <span className="mt-2 block text-sm font-black text-[#283249]">{st("studio.avatar.guideTitle")}</span>
                                <span className="mt-1 block text-xs font-bold leading-5 text-[#8290a7]">{st("studio.avatar.guideDescription")}</span>
                              </button>
                            )}
                            {!isDreamfaceTalkingAvatar ? (
                              <div className="mt-4 overflow-hidden rounded-[24px] border border-[#758bac]/15 bg-[#0f172a] shadow-[0_8px_20px_rgba(35,58,97,0.08)]">
                                <video src={KLING_AVATAR_PREVIEW_VIDEO_URL} controls muted playsInline preload="metadata" className="aspect-video w-full bg-black object-cover" />
                                <div className="border-t border-white/10 px-4 py-3">
                                  <p className="text-xs font-black text-white/82">{st("studio.avatar.example")}</p>
                                  <p className="mt-1 text-xs leading-5 text-white/48">{st("studio.avatar.exampleDescription")}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="min-w-0">
                            <div className="mb-[13px] flex flex-wrap items-center justify-between gap-3">
                              <div className="text-[13px] font-black uppercase tracking-[0.08em] text-[#2d374c]">{st("studio.avatarWorkbench.script")}</div>
                              <span className={`rounded-full px-3 py-1 text-xs font-black ${avatarScriptTooLong ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
                                {avatarScriptMeta}
                              </span>
                            </div>
                            <textarea
                              dir="auto"
                              rows={7}
                              value={prompt}
                              onChange={(e) => setPrompt(e.target.value)}
                              className="min-h-[260px] w-full resize-y bg-transparent p-0 text-[18px] leading-[1.62] tracking-[-0.02em] text-[#182033] outline-none placeholder:text-[#a6b2c7] md:min-h-[310px] md:text-[22px]"
                              placeholder={st("studio.placeholder.avatar")}
                            />
                            <div className={`mt-[18px] text-xs font-extrabold leading-5 ${avatarScriptTooLong ? "text-[#e11d48]" : "text-[#96a2b7]"}`}>
                              {avatarScriptTooLong
                                ? st("studio.avatar.scriptTooLong")
                                : isDreamfaceTalkingAvatar
                                  ? st("studio.avatarWorkbench.dreamfaceHint")
                                  : st("studio.avatar.billingHint", { duration: avatarDuration })}
                            </div>

                            {!isDreamfaceTalkingAvatar ? (
                              <div className="mt-5 rounded-[24px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-4 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                  <span className="text-sm font-black text-[#283249]">{st("studio.avatar.voice")}</span>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#66758b]">{ttsVoice}</span>
                                </div>
                                <div className="mb-3 inline-grid grid-cols-3 rounded-full border border-[#758bac]/15 bg-white p-1 shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                                  {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => setAvatarVoiceGender(option.value)}
                                      className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                                        avatarVoiceGender === option.value
                                          ? "bg-[#202633] text-white shadow-[0_8px_20px_rgba(32,38,51,0.14)]"
                                          : "text-[#667085] hover:bg-[#f3f8ff] hover:text-[#202633]"
                                      }`}
                                    >
                                      {st(`studio.voiceGender.${option.value}`)}
                                    </button>
                                  ))}
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                  <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="min-h-12 rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none">
                                    {avatarVoiceOptions.map((voice) => (
                                      <option key={voice} value={voice}>{voice}</option>
                                    ))}
                                  </select>
                                  <select value={ttsLanguageCode} onChange={(e) => setTtsLanguageCode(e.target.value)} className="min-h-12 rounded-2xl border border-[#758bac]/15 bg-white px-4 text-sm font-bold text-[#485164] outline-none">
                                    {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                                      <option key={item.value || "auto"} value={item.value}>
                                        {st(`studio.languageOption.${item.value || "auto"}`)}
                                      </option>
                                    ))}
                                  </select>
                                  <label className="rounded-2xl border border-[#758bac]/15 bg-white px-4 py-2.5">
                                    <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-[#8791a3]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                                    <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(e) => setTtsStability(Number(e.target.value))} className="mt-1 w-full accent-[#202633]" />
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : isPromptlessImageWorkflow ? (
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
                        dir="auto"
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
                    {!showModernWorkbenchRedesign && referenceImageUrls.length ? (
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
                    {!showModernWorkbenchRedesign && isAvatarWorkflow ? (
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

                        {!isDreamfaceTalkingAvatar ? (
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
                        ) : null}

                        {!isDreamfaceTalkingAvatar ? (
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
                        ) : (
                          <div className="mb-4 rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-[#202633]">Talking script</span>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${avatarScriptTooLong ? "bg-[#fff1f2] text-[#e11d48]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
                                {avatarScriptMeta}
                              </span>
                            </div>
                            <p className={`text-xs leading-5 ${avatarScriptTooLong ? "text-[#e11d48]" : "text-[#667085]"}`}>
                              {avatarScriptTooLong
                                ? st("studio.avatar.scriptTooLong")
                                : "DreamFace IO will animate only the uploaded image and make the visible subject say your script. No separate voice URL is needed."}
                            </p>
                          </div>
                        )}

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

                  <div className={showModernWorkbenchRedesign ? "hidden" : "grid grid-cols-2 gap-2.5 border-t border-black/[0.06] bg-[#fbfcff] px-5 py-4 sm:flex sm:flex-wrap sm:items-center md:px-7"}>
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
                    {showVideoModelSelect ? (
                      <div className="relative z-[80] col-span-2 w-full sm:col-span-1 sm:w-[290px]" ref={toolbarModelSelectRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setToolbarModelSelectPlacement(getModelSelectPlacement(toolbarModelSelectRef.current));
                            setToolbarModelSelectOpen((open) => !open);
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-black/[0.06] bg-white px-4 py-2 text-left text-sm font-semibold text-[#485164] shadow-sm outline-none transition hover:bg-[#f8fafc]"
                          aria-haspopup="listbox"
                          aria-expanded={toolbarModelSelectOpen}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{selectedProviderMeta.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#8b95a7]">{st(`studio.modelSelect.desc.${provider}`)}</span>
                          </span>
                          <span className={`shrink-0 text-base text-[#64748b] transition ${toolbarModelSelectOpen ? "rotate-180" : ""}`}>v</span>
                        </button>
                        {toolbarModelSelectOpen ? (
                          <div
                            ref={toolbarModelSelectPanelRef}
                            onMouseDown={(event) => event.stopPropagation()}
                            onTouchStart={(event) => event.stopPropagation()}
                            className={`z-[200] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-black/[0.08] bg-white/95 text-[#263244] shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl ${
                              toolbarModelSelectPlacement === "modal"
                                ? "fixed left-1/2 top-20 max-h-[calc(100vh-6rem)] w-[min(calc(100vw-2rem),520px)] -translate-x-1/2"
                                : `absolute left-0 max-h-[min(68vh,520px)] w-full sm:w-[480px] ${
                                    toolbarModelSelectPlacement === "top" ? "bottom-[52px]" : "top-[52px]"
                                  }`
                            }`}
                            role="listbox"
                          >
                            {videoModelGroups.map((group) => {
                              const groupOptions = options.filter((option) => videoModelGroup(option.value) === group.key);
                              if (!groupOptions.length) return null;
                              return (
                                <div key={group.key}>
                                  <div className="bg-gradient-to-b from-[#f8fafc] to-white/0 px-4 py-3 pb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#9aa6b8]">
                                    {group.label}
                                  </div>
                                  {groupOptions.map((option) => {
                                    const meta = PROVIDER_META[option.value] || {
                                      label: option.label,
                                      shortLabel: option.label,
                                      speed: "Standard",
                                      quality: "Balanced",
                                      bestFor: "General generation"
                                    };
                                    const active = provider === option.value;
                                    const modelCredits = estimateGenerationCredits({
                                      mode: "video",
                                      provider: option.value,
                                      duration,
                                      hasReferences: activeWorkflow === "image-to-video",
                                      resolution: defaultVideoResolutionForProvider(option.value)
                                    });
                                    const badge = videoModelBadge(option.value);
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onTouchStart={(event) => event.stopPropagation()}
                                        onClick={() => {
                                          applyProvider(option.value);
                                          setToolbarModelSelectOpen(false);
                                        }}
                                        className={`flex w-full items-center justify-between gap-4 border-t border-[#e2e8f0]/80 px-4 py-3.5 text-left transition hover:bg-[#f5f9ff] ${active ? "bg-gradient-to-r from-[#eef8ff] to-white" : "bg-transparent"}`}
                                      >
                                        <span className="min-w-0">
                                          <span className="block text-[15px] font-black text-[#263244]">{meta.label}</span>
                                          <span className="mt-1 block text-xs leading-5 text-[#7f8ca3]">{st(`studio.modelSelect.desc.${option.value}`)}</span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2">
                                          {option.value !== "dreamface-io-video" ? (
                                            <span className="text-xs font-bold text-[#64748b]">{st("studio.modelSelect.credits", { credits: modelCredits })}</span>
                                          ) : null}
                                          {badge ? (
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                              badge === "free"
                                                ? "bg-[#eef2f7] text-[#536071]"
                                                : badge === "recommended"
                                                  ? "bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white"
                                                  : badge === "pro"
                                                    ? "bg-[#f3e8ff] text-[#7e22ce]"
                                                    : "bg-[#fff4ce] text-[#9a6412]"
                                            }`}>
                                              {st(`studio.modelSelect.badge.${badge}`)}
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : (
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
                    )}
                    {mode === "image" ? (
                      isNanoBananaProvider(provider) ? (
                        <select
                          value={ratio}
                          onChange={(e) => {
                            trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                            setRatio(e.target.value);
                          }}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {(provider === "nano-banana-pro" || provider === "nano-banana-2-lite" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS).map((item) => (
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
                      isElevenLabsAudio ? (
                        <select
                          value={ttsVoice}
                          onChange={(e) => setTtsVoice(e.target.value)}
                          className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto"
                        >
                          {audioVoiceOptions.map((voice) => (
                            <option key={voice} value={voice}>{voice}</option>
                          ))}
                        </select>
                      ) : null
                    ) : mode === "avatar" ? (
                      isDreamfaceTalkingAvatar ? (
                        <>
                          <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto">
                            {videoDurationOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                          <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="w-full rounded-full border border-black/[0.06] bg-white px-4 py-2 text-sm font-semibold text-[#667085] outline-none sm:w-auto">
                            {videoRatioOptions.map((item) => (
                              <option key={item} value={item}>{item === "source" ? st("studio.option.sourceImage") : item}</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className={`rounded-full border px-4 py-2.5 text-center text-sm font-semibold sm:py-2 ${avatarScriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-black/[0.06] bg-white text-[#667085]"}`}>
                          {avatarDuration} {st("studio.option.automatic")}
                        </span>
                      )
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
                      onClick={handleGenerateClick}
                      disabled={generateDisabled}
                      className="col-span-2 min-h-12 rounded-full bg-[#171a22] px-7 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,26,34,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(23,26,34,0.26)] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:min-h-11"
                    >
                      {isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}
                    </button>
                    {isSubmitting ? (
                      <p className="col-span-2 -mt-1 text-center text-xs font-medium leading-5 text-[#7a8496] sm:text-right">
                        {st("studio.generate.projectsHint")}{" "}
                        <Link href="/studio?view=projects" className="font-semibold text-[#1c6be1] underline-offset-4 hover:underline">
                          {st("studio.nav.projects")}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  {provider === "dreamface-io-video" ? (
                    <p className="border-t border-black/[0.05] bg-amber-50/55 px-5 py-2.5 text-center text-xs font-medium text-amber-800/80 md:px-7">
                      {st("studio.dreamfaceIo.qualityHint")}
                    </p>
                  ) : null}
                  {mode === "audio" && !showAudioWorkbenchRedesign ? (
                    <div className="border-t border-black/[0.06] bg-white/70 px-5 py-4 text-left md:px-7">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">{st("studio.field.modelSettings")}</p>
                        <p className="text-xs font-medium text-[#8b95a7]">{providerSettingsLabel}</p>
                      </div>
                      {isElevenLabsAudio ? (
                      <>
                      <div className="grid gap-3 lg:grid-cols-5">
                        <div className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.music.voiceGender")}</span>
                          <div className="grid grid-cols-3 gap-1">
                            {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setAudioVoiceGender(option.value)}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold transition ${audioVoiceGender === option.value ? "bg-[#202633] text-white" : "bg-white text-[#667085] hover:bg-[#eff6ff]"}`}
                              >
                                {st(`studio.music.${option.value}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                          <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.field.voice")}</span>
                          <select
                            value={ttsVoice}
                            onChange={(e) => setTtsVoice(e.target.value)}
                            className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none"
                          >
                            {audioVoiceOptions.map((voice) => (
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
                      </>
                      ) : (
                        <div className="grid gap-3">
                          <button
                            type="button"
                            onClick={() => setMusicAdvancedOpen((value) => !value)}
                            className="flex w-full items-center justify-between rounded-2xl border border-black/[0.06] bg-[#fbfdff] px-4 py-3 text-left"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-[#485164]">{st("studio.music.additionalSettings")}</span>
                              <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.music.additionalSettingsDescription")}</span>
                            </span>
                            <span className="text-sm font-semibold text-[#667085]">{musicAdvancedOpen ? st("studio.music.less") : st("studio.music.more")}</span>
                          </button>
                          {musicAdvancedOpen ? (
                          <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-4">
                              <span>
                                <span className="block text-sm font-semibold text-[#485164]">{st("studio.music.instrumental")}</span>
                                <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.music.instrumentalDescription")}</span>
                              </span>
                              <input type="checkbox" checked={isInstrumental} onChange={(e) => setIsInstrumental(e.target.checked)} className="h-5 w-5" />
                            </label>
                            <label className={`flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-4 ${isInstrumental ? "opacity-50" : ""}`}>
                              <span>
                                <span className="block text-sm font-semibold text-[#485164]">{st("studio.music.autoLyrics")}</span>
                                <span className="mt-1 block text-xs text-[#8b95a7]">{st("studio.music.autoLyricsDescription")}</span>
                              </span>
                              <input type="checkbox" checked={lyricsOptimizer} disabled={isInstrumental} onChange={(e) => setLyricsOptimizer(e.target.checked)} className="h-5 w-5" />
                            </label>
                          </div>
                          {!isInstrumental ? (
                            <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.music.lyrics")}</span>
                              <textarea
                                rows={8}
                                maxLength={3500}
                                value={musicLyrics}
                                onChange={(e) => setMusicLyrics(e.target.value)}
                                disabled={lyricsOptimizer}
                                placeholder={st("studio.music.lyricsPlaceholder")}
                                className="w-full resize-y rounded-xl border border-black/[0.06] bg-white px-3 py-3 text-sm leading-6 text-[#485164] outline-none disabled:opacity-50"
                              />
                              <span className="mt-2 block text-xs leading-5 text-[#8b95a7]">{st("studio.music.lyricsDescription")}</span>
                              <span className="mt-2 block text-right text-xs text-[#98a2b3]">{musicLyrics.length.toLocaleString()} / 3,500</span>
                            </label>
                          ) : null}
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.music.sampleRate")}</span>
                              <select value={musicSampleRate} onChange={(e) => setMusicSampleRate(Number(e.target.value))} className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none">
                                {[16000, 24000, 32000, 44100].map((value) => <option key={value} value={value}>{value} Hz</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[#8b95a7]">{st("studio.music.sampleRateDescription")}</span>
                            </label>
                            <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.music.bitrate")}</span>
                              <select value={musicBitrate} onChange={(e) => setMusicBitrate(Number(e.target.value))} className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold text-[#485164] outline-none">
                                {[32000, 64000, 128000, 256000].map((value) => <option key={value} value={value}>{value / 1000} kbps</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[#8b95a7]">{st("studio.music.bitrateDescription")}</span>
                            </label>
                            <label className="rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                              <span className="mb-2 block text-xs font-semibold text-[#667085]">{st("studio.music.format")}</span>
                              <select value={musicFormat} onChange={(e) => setMusicFormat(e.target.value as "mp3" | "wav" | "pcm")} className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm font-semibold uppercase text-[#485164] outline-none">
                                {(["mp3", "wav", "pcm"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                              <span className="mt-2 block text-xs text-[#8b95a7]">{st("studio.music.formatDescription")}</span>
                            </label>
                          </div>
                          </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : showImageWorkbenchRedesign ? (
                    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
                      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={provider}
                            onChange={(e) => applyProvider(e.target.value)}
                            className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {PROVIDER_META[option.value]?.label || option.label}
                              </option>
                            ))}
                          </select>
                          {showImageUtilityRedesign ? (
                            imageWorkflow === "enhance-cleanup" ? (
                              <>
                                <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-sm font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                                  Standard V2 / 2x
                                </span>
                                <select
                                  value={outputFormat === "png" ? "png" : "jpeg"}
                                  onChange={(e) => setOutputFormat(e.target.value)}
                                  className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-sm font-black uppercase text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                                  aria-label={st("studio.field.outputFormat")}
                                >
                                  <option value="jpeg">JPEG</option>
                                  <option value="png">PNG</option>
                                </select>
                              </>
                            ) : null
                          ) : isNanoBananaProvider(provider) ? (
                            <select
                              value={ratio}
                              onChange={(e) => {
                                trackEvent("studio_size_selected", { mode, provider, ratio: e.target.value }, accessToken);
                                setRatio(e.target.value);
                              }}
                              className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                            >
                              {(provider === "nano-banana-pro" || provider === "nano-banana-2-lite" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS).map((item) => (
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
                              className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                            >
                              {IMAGE_SIZE_PRESETS.map((preset) => (
                                <option key={preset.value} value={preset.value}>
                                  {preset.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          disabled={generateDisabled}
                          className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]"
                        >
                          <span>{isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}</span>
                          {accessToken ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">
                              {estCredits} {st("studio.common.credits")}
                            </span>
                          ) : null}
                          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
                        </button>
                      </div>

                      <div className={showImageUtilityRedesign ? "hidden" : "grid gap-3 md:grid-cols-2 lg:grid-cols-[1.05fr_1fr_0.95fr_0.95fr]"}>
                        {provider === "chatgpt-image" ? (
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.field.quality")}</span>
                              <span>{st("studio.textImage.costOptimized")}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(["auto", "low", "medium", "high"] as const).map((quality) => (
                                <button key={quality} type="button" onClick={() => setImageQuality(quality)} className={`h-10 rounded-[0.9rem] text-xs font-black capitalize transition ${imageQuality === quality ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                  {quality}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {showImageToImageRedesign && (provider === "nano-banana-image" || provider === "nano-banana-pro") ? (
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.field.resolution")}</span>
                              <span>{editResolution}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(provider === "nano-banana-pro" ? ["1K", "2K", "4K"] : ["0.5K", "1K", "2K", "4K"]).map((resolution) => (
                                <button key={resolution} type="button" onClick={() => setEditResolution(resolution)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${editResolution === resolution ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                  {resolution}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {showImageToImageRedesign && (provider === "flux-image" || provider === "flux-dev") ? (
                          <>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.steps")}</span>
                                <span>{numInferenceSteps}</span>
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {(provider === "flux-image" ? [1, 2, 4, 8, 12] : [4, 8, 16, 28, 50]).map((steps) => (
                                  <button key={steps} type="button" onClick={() => setNumInferenceSteps(steps)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${numInferenceSteps === steps ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                    {steps}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.guidance")}</span>
                                <span>{guidanceScale}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="20"
                                step="0.5"
                                value={guidanceScale}
                                onChange={(e) => setGuidanceScale(Number(e.target.value))}
                                className="w-full accent-[#151b2a]"
                              />
                            </div>
                          </>
                        ) : null}
                        <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                          <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                            <span>{st("studio.field.output")}</span>
                            <span>{st("studio.field.outputFormat")}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(provider === "flux-image" || provider === "flux-dev" ? ["jpeg", "png"] : ["png", "jpeg", "webp"]).map((format) => (
                              <button key={format} type="button" onClick={() => setOutputFormat(format)} className={`h-10 rounded-[0.9rem] text-xs font-black uppercase transition ${outputFormat === format ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                {format}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                          <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                            <span>{st("studio.field.count")}</span>
                            <span>{st("studio.textImage.images")}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[1, 2, 3, 4].map((count) => (
                              <button key={count} type="button" onClick={() => setNumImages(count)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${numImages === count ? "bg-[#151b2a] text-white shadow-[0_10px_18px_rgba(17,24,39,0.18)]" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                {count}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                          <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                            <span>{st("studio.field.seed")}</span>
                            <span>{st("studio.textImage.optional")}</span>
                          </div>
                          <input
                            value={seed}
                            onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, "").slice(0, 12))}
                            placeholder={st("studio.placeholder.random")}
                            inputMode="numeric"
                            className="h-10 w-full rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 text-sm font-black text-[#66758b] outline-none placeholder:text-[#8b98ad]"
                          />
                        </div>
                        {showImageToImageRedesign && (provider === "flux-image" || provider === "flux-dev") ? (
                          <>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.safety")}</span>
                                <span>{enableSafetyChecker ? st("studio.state.enabled") : st("studio.state.disabled")}</span>
                              </div>
                              <button type="button" onClick={() => setEnableSafetyChecker((value) => !value)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${enableSafetyChecker ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                {enableSafetyChecker ? st("studio.state.enabled") : st("studio.state.disabled")}
                              </button>
                            </div>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.acceleration")}</span>
                                <span className="capitalize">{acceleration}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {["none", "regular", "high"].map((item) => (
                                  <button key={item} type="button" onClick={() => setAcceleration(item)} className={`h-10 rounded-[0.9rem] text-xs font-black capitalize transition ${acceleration === item ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                    {item}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}
                        {showImageToImageRedesign && isNanoBananaProvider(provider) ? (
                          <>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.safetyTolerance")}</span>
                                <span>{safetyTolerance}</span>
                              </div>
                              <div className="grid grid-cols-6 gap-1.5">
                                {["1", "2", "3", "4", "5", "6"].map((item) => (
                                  <button key={item} type="button" onClick={() => setSafetyTolerance(item)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${safetyTolerance === item ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                    {item}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                              <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                                <span>{st("studio.field.limitGenerations")}</span>
                                <span>{limitGenerations ? st("studio.state.on") : st("studio.state.off")}</span>
                              </div>
                              <button type="button" onClick={() => setLimitGenerations((value) => !value)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${limitGenerations ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                {limitGenerations ? st("studio.state.on") : st("studio.state.off")}
                              </button>
                            </div>
                          </>
                        ) : null}
                        {showImageToImageRedesign && (provider === "nano-banana-image" || provider === "nano-banana-pro") ? (
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.field.webSearch")}</span>
                              <span>{enableWebSearch ? st("studio.state.enabled") : st("studio.state.disabled")}</span>
                            </div>
                            <button type="button" onClick={() => setEnableWebSearch((value) => !value)} className={`h-10 w-full rounded-[0.9rem] text-xs font-black transition ${enableWebSearch ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                              {enableWebSearch ? st("studio.state.enabled") : st("studio.state.disabled")}
                            </button>
                          </div>
                        ) : null}
                        {showImageToImageRedesign && (provider === "nano-banana-image" || isNanoBananaLiteProvider(provider)) ? (
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.field.thinking")}</span>
                              <span>{thinkingLevel || st("studio.state.off")}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { value: "", label: st("studio.state.off") },
                                { value: "minimal", label: st("studio.state.minimal") },
                                { value: "high", label: st("studio.state.high") }
                              ].map((item) => (
                                <button key={item.value || "off"} type="button" onClick={() => setThinkingLevel(item.value)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${thinkingLevel === item.value ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {showImageToImageRedesign && isNanoBananaProvider(provider) ? (
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)] lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.field.systemPrompt")}</span>
                              <span>{st("studio.textImage.optional")}</span>
                            </div>
                            <textarea
                              dir="auto"
                              rows={2}
                              value={systemPrompt}
                              onChange={(e) => setSystemPrompt(e.target.value)}
                              placeholder={st("studio.placeholder.system")}
                              className="w-full resize-none rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 py-2 text-sm font-bold leading-5 text-[#66758b] outline-none placeholder:text-[#8b98ad]"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3.5 grid gap-3 md:grid-cols-3">
                        {[
                          {
                            icon: "$",
                            title: st("studio.textImage.hintCostTitle"),
                            body: st(showImageUtilityRedesign ? "studio.utilityImage.hintCostBody" : "studio.textImage.hintCostBody")
                          },
                          {
                            icon: "@",
                            title: st(showImageUtilityRedesign ? "studio.utilityImage.hintReferenceTitle" : "studio.textImage.hintPromptTitle"),
                            body: st(showImageUtilityRedesign ? "studio.utilityImage.hintReferenceBody" : "studio.textImage.hintPromptBody")
                          },
                          {
                            icon: "*",
                            title: st(showImageUtilityRedesign ? "studio.utilityImage.hintOutputTitle" : "studio.textImage.hintPaidTitle"),
                            body: st(showImageUtilityRedesign ? "studio.utilityImage.hintOutputBody" : "studio.textImage.hintPaidBody")
                          }
                        ].map((card) => (
                          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-3.5 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,138,0,0.13),rgba(255,61,129,0.13))]">{card.icon}</span>
                            <span>
                              <strong className="block text-[13px] font-black text-[#33405a]">{card.title}</strong>
                              <span className="mt-1 block text-xs font-bold leading-[1.35] text-[#8390a6]">{card.body}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : showAudioWorkbenchRedesign ? (
                    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
                      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={provider}
                            onChange={(e) => applyProvider(e.target.value)}
                            className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {PROVIDER_META[option.value]?.label || option.label}
                              </option>
                            ))}
                          </select>
                          {isElevenLabsAudio ? (
                            <>
                              <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {audioVoiceOptions.map((voice) => (
                                  <option key={voice} value={voice}>{voice}</option>
                                ))}
                              </select>
                              <select value={ttsLanguageCode} onChange={(e) => setTtsLanguageCode(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {ELEVENLABS_LANGUAGE_OPTIONS.map((item) => (
                                  <option key={item.value || "auto"} value={item.value}>
                                    {st(`studio.languageOption.${item.value || "auto"}`)}
                                  </option>
                                ))}
                              </select>
                              <button type="button" onClick={() => setTtsTimestamps((value) => !value)} className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${ttsTimestamps ? "border-[#20c997]/25 bg-[#20c997]/10 text-[#17916e]" : "border-[#758bac]/15 bg-white text-[#66758b]"}`}>
                                {st("studio.field.wordTimestamps")}: {ttsTimestamps ? st("studio.state.on") : st("studio.state.off")}
                              </button>
                            </>
                          ) : (
                            <>
                              <select value={musicSampleRate} onChange={(e) => setMusicSampleRate(Number(e.target.value))} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {[16000, 24000, 32000, 44100].map((value) => <option key={value} value={value}>{value} Hz</option>)}
                              </select>
                              <select value={musicBitrate} onChange={(e) => setMusicBitrate(Number(e.target.value))} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {[32000, 64000, 128000, 256000].map((value) => <option key={value} value={value}>{value / 1000} kbps</option>)}
                              </select>
                              <select value={musicFormat} onChange={(e) => setMusicFormat(e.target.value as "mp3" | "wav" | "pcm")} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black uppercase text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {(["mp3", "wav", "pcm"] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                              </select>
                            </>
                          )}
                          <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                            {estCredits} {st("studio.common.credits")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          disabled={generateDisabled}
                          className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]"
                        >
                          <span>{isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}</span>
                          {accessToken ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">
                              {estCredits} {st("studio.common.credits")}
                            </span>
                          ) : null}
                          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
                        </button>
                      </div>

                      {isElevenLabsAudio ? (
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <div className="mb-3 flex items-center justify-between text-xs font-black text-[#6e7d95]">
                              <span>{st("studio.music.voiceGender")}</span>
                              <span>{st(`studio.music.${audioVoiceGender}`)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {ELEVENLABS_VOICE_GENDER_OPTIONS.map((option) => (
                                <button key={option.value} type="button" onClick={() => setAudioVoiceGender(option.value)} className={`h-10 rounded-[0.9rem] text-xs font-black transition ${audioVoiceGender === option.value ? "bg-[#151b2a] text-white" : "bg-[#f8fafd] text-[#758399] hover:bg-white"}`}>
                                  {st(`studio.music.${option.value}`)}
                                </button>
                              ))}
                            </div>
                          </div>
                          <label className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <span className="mb-3 block text-xs font-black text-[#6e7d95]">{st("studio.field.stability", { value: ttsStability.toFixed(2) })}</span>
                            <input type="range" min="0" max="1" step="0.05" value={ttsStability} onChange={(e) => setTtsStability(Number(e.target.value))} className="w-full accent-[#151b2a]" />
                          </label>
                          <label className="rounded-[22px] border border-[#758bac]/15 bg-white p-4 shadow-[0_8px_20px_rgba(35,58,97,0.045)]">
                            <span className="mb-3 block text-xs font-black text-[#6e7d95]">{st("studio.field.textNormalization")}</span>
                            <select value={textNormalization} onChange={(e) => setTextNormalization(e.target.value)} className="h-10 w-full rounded-[0.9rem] border border-black/[0.06] bg-[#fbfcfe] px-3 text-sm font-black text-[#66758b] outline-none">
                              {TEXT_NORMALIZATION_OPTIONS.map((item) => (
                                <option key={item.value} value={item.value}>{st(`studio.textNormalization.${item.value}`)}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : showVideoWorkbenchRedesign ? (
                    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
                      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative z-[70] w-full sm:w-auto" ref={modelSelectRef}>
                            <button
                              type="button"
                              onClick={() => {
                                setModelSelectPlacement(getModelSelectPlacement(modelSelectRef.current));
                                setModelSelectOpen((open) => !open);
                              }}
                              className="inline-flex min-h-[58px] w-full items-center justify-between gap-4 rounded-[18px] border border-[#758bac]/20 bg-white px-5 text-left text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none transition hover:bg-[#fbfdff] sm:min-h-[45px] sm:w-auto sm:min-w-[240px] sm:rounded-full"
                              aria-haspopup="listbox"
                              aria-expanded={modelSelectOpen}
                            >
                              <span className="block min-w-0 truncate">{selectedProviderMeta.label}</span>
                              <span className={`shrink-0 text-base transition ${modelSelectOpen ? "rotate-180" : ""}`}>v</span>
                            </button>
                            {modelSelectOpen ? createPortal((
                              <>
                              <button
                                type="button"
                                aria-label="Close model selector"
                                onClick={() => setModelSelectOpen(false)}
                                className="fixed inset-0 z-[190] cursor-default bg-[#111827]/55 backdrop-blur-[2px]"
                              />
                              <div
                                ref={modelSelectPanelRef}
                                onMouseDown={(event) => event.stopPropagation()}
                                onTouchStart={(event) => event.stopPropagation()}
                                className="fixed inset-x-3 bottom-3 z-[200] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-[#758bac]/20 bg-white text-[#263244] shadow-[0_24px_70px_rgba(8,20,42,0.35)] sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[min(76vh,620px)] sm:w-[min(calc(100vw-2rem),640px)] sm:-translate-x-1/2 sm:-translate-y-1/2"
                                role="listbox"
                              >
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce5f0] bg-white px-5 py-4 sm:hidden">
                                  <div>
                                    <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#8c9ab0]">Current model</span>
                                    <strong className="mt-1 block text-lg font-black text-[#263244]">{selectedProviderMeta.label}</strong>
                                  </div>
                                  <button type="button" onClick={() => setModelSelectOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-[#eef3f9] text-xl font-bold text-[#526176]" aria-label="Close model selector">x</button>
                                </div>
                                {videoModelGroups.map((group) => {
                                  const groupOptions = options.filter((option) => videoModelGroup(option.value) === group.key);
                                  if (!groupOptions.length) return null;
                                  return (
                                    <div key={group.key}>
                                      <div className="border-y border-[#e4eaf2] bg-[#f3f6fa] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#8795aa]">
                                        {group.label}
                                      </div>
                                      {groupOptions.map((option) => {
                                        const meta = PROVIDER_META[option.value] || {
                                          label: option.label,
                                          shortLabel: option.label,
                                          speed: "Standard",
                                          quality: "Balanced",
                                          bestFor: "General generation"
                                        };
                                        const active = provider === option.value;
                                        const modelCredits = estimateGenerationCredits({
                                          mode: "video",
                                          provider: option.value,
                                          duration,
                                          hasReferences: activeWorkflow === "image-to-video",
                                          resolution: defaultVideoResolutionForProvider(option.value),
                                          promptText: undefined
                                        });
                                        const badge = videoModelBadge(option.value);
                                        return (
                                          <button
                                            key={option.value}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onTouchStart={(event) => event.stopPropagation()}
                                            onClick={() => {
                                              applyProvider(option.value);
                                              setModelSelectOpen(false);
                                            }}
                                            className={`flex w-full items-center justify-between gap-4 border-b border-[#e2e8f0] px-5 py-4 text-left transition hover:bg-[#f5f9ff] ${active ? "bg-[#eaf4ff] shadow-[inset_4px_0_0_#2585e8]" : "bg-white"}`}
                                          >
                                            <span className="min-w-0">
                                              <span className="block text-[15px] font-black text-[#263244]">{meta.label}</span>
                                              <span className="mt-1 block text-xs leading-5 text-[#7f8ca3]">{st(`studio.modelSelect.desc.${option.value}`)}</span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                              {active ? <span className="rounded-full bg-[#1677d2] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white">Active</span> : null}
                                              {option.value !== "dreamface-io-video" ? (
                                                <span className="text-xs font-bold text-[#64748b]">{st("studio.modelSelect.credits", { credits: modelCredits })}</span>
                                              ) : null}
                                              {badge ? (
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                                  badge === "free"
                                                    ? "bg-[#eef2f7] text-[#536071]"
                                                    : badge === "recommended"
                                                      ? "bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white"
                                                      : badge === "pro"
                                                        ? "bg-[#f3e8ff] text-[#7e22ce]"
                                                        : "bg-[#fff4ce] text-[#9a6412]"
                                                }`}>
                                                  {st(`studio.modelSelect.badge.${badge}`)}
                                                </span>
                                              ) : null}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                              </>
                            ), document.body) : null}
                          </div>
                          <select value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                            {videoDurationOptions.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                          <select value={ratio} onChange={(e) => setRatio(e.target.value)} disabled={provider === "kling-video" && activeWorkflow === "image-to-video"} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none disabled:opacity-70">
                            {videoRatioOptions.map((item) => (
                              <option key={item} value={item}>{item === "source" ? st("studio.option.sourceImage") : item}</option>
                            ))}
                          </select>
                          {showVideoResolutionControl ? (
                            <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                              {videoResolutionOptions.map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          ) : null}
                          {showVideoAudioControl ? (
                            <button
                              type="button"
                              onClick={() => setGenerateAudio((value) => !value)}
                              className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${generateAudio ? "border-[#20c997]/25 bg-[#20c997]/10 text-[#17916e]" : "border-[#758bac]/15 bg-white text-[#66758b]"}`}
                            >
                              {st("studio.field.nativeAudio")}: {generateAudio ? st("studio.state.on") : st("studio.state.off")}
                            </button>
                          ) : null}
                          <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                            {estCredits} {st("studio.common.credits")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          disabled={generateDisabled}
                          className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]"
                        >
                          <span>{isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}</span>
                          {accessToken ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">
                              {estCredits} {st("studio.common.credits")}
                            </span>
                          ) : null}
                          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
                        </button>
                      </div>

                      {videoWorkflow === "text-to-video" ? (
                        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          <article className="group relative overflow-hidden rounded-[22px] border border-[#758bac]/15 bg-[#e7eef5] shadow-[0_12px_30px_rgba(35,58,97,0.08)]">
                            <video
                              src={YOUNG_KOREAN_WOMAN_VIDEO_URL}
                              poster="/images/video-examples/young-korean-neighborhood.png"
                              controls
                              muted
                              playsInline
                              preload="none"
                              onPlay={() => setIsYoungKoreanWomanPlaying(true)}
                              onPause={() => setIsYoungKoreanWomanPlaying(false)}
                              onEnded={() => setIsYoungKoreanWomanPlaying(false)}
                              className="aspect-video w-full bg-black object-cover"
                            />
                            <div className={`pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-[#0b1528]/75 via-transparent to-transparent p-3 transition sm:flex ${isYoungKoreanWomanPlaying ? "opacity-0" : "opacity-0 sm:group-hover:opacity-100"}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(YOUNG_KOREAN_WOMAN_PROMPT);
                                  setDuration("15s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="pointer-events-auto inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white/95 px-4 text-sm font-black text-[#2468ad] shadow-[0_8px_22px_rgba(3,16,38,0.2)] backdrop-blur transition hover:bg-white"
                              >
                                Copy Prompt
                              </button>
                            </div>
                            <div className="border-t border-[#758bac]/12 bg-white p-3 sm:hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(YOUNG_KOREAN_WOMAN_PROMPT);
                                  setDuration("15s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition active:bg-[#e1f0ff]"
                              >
                                Copy Prompt
                              </button>
                            </div>
                          </article>
                          <article className="group relative overflow-hidden rounded-[22px] border border-[#758bac]/15 bg-[#e7eef5] shadow-[0_12px_30px_rgba(35,58,97,0.08)]">
                            <video
                              src={EASTBOURNE_KOREAN_WOMAN_VIDEO_URL}
                              poster="/images/video-examples/eastbourne-tennis.png"
                              controls
                              muted
                              playsInline
                              preload="none"
                              onPlay={() => setIsEastbourneKoreanWomanPlaying(true)}
                              onPause={() => setIsEastbourneKoreanWomanPlaying(false)}
                              onEnded={() => setIsEastbourneKoreanWomanPlaying(false)}
                              className="aspect-video w-full bg-black object-cover"
                            />
                            <div className={`pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-[#0b1528]/75 via-transparent to-transparent p-3 transition sm:flex ${isEastbourneKoreanWomanPlaying ? "opacity-0" : "opacity-0 sm:group-hover:opacity-100"}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(EASTBOURNE_KOREAN_WOMAN_PROMPT);
                                  setDuration("10s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="pointer-events-auto inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white/95 px-4 text-sm font-black text-[#2468ad] shadow-[0_8px_22px_rgba(3,16,38,0.2)] backdrop-blur transition hover:bg-white"
                              >
                                Copy Prompt
                              </button>
                            </div>
                            <div className="border-t border-[#758bac]/12 bg-white p-3 sm:hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(EASTBOURNE_KOREAN_WOMAN_PROMPT);
                                  setDuration("10s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition active:bg-[#e1f0ff]"
                              >
                                Copy Prompt
                              </button>
                            </div>
                          </article>
                          <article className="group relative overflow-hidden rounded-[22px] border border-[#758bac]/15 bg-[#e7eef5] shadow-[0_12px_30px_rgba(35,58,97,0.08)]">
                            <video
                              src={SPORTS_BROADCAST_VIDEO_URL}
                              poster="/images/video-examples/sports-broadcast.png"
                              controls
                              muted
                              playsInline
                              preload="none"
                              onPlay={() => setIsSportsBroadcastPlaying(true)}
                              onPause={() => setIsSportsBroadcastPlaying(false)}
                              onEnded={() => setIsSportsBroadcastPlaying(false)}
                              className="aspect-video w-full bg-black object-cover"
                            />
                            <div className={`pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-[#0b1528]/75 via-transparent to-transparent p-3 transition sm:flex ${isSportsBroadcastPlaying ? "opacity-0" : "opacity-0 sm:group-hover:opacity-100"}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(SPORTS_BROADCAST_PROMPT);
                                  setDuration("15s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="pointer-events-auto inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white/95 px-4 text-sm font-black text-[#2468ad] shadow-[0_8px_22px_rgba(3,16,38,0.2)] backdrop-blur transition hover:bg-white"
                              >
                                Copy Prompt
                              </button>
                            </div>
                            <div className="border-t border-[#758bac]/12 bg-white p-3 sm:hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  applyProvider("seedance-video");
                                  setPrompt(SPORTS_BROADCAST_PROMPT);
                                  setDuration("15s");
                                  setRatio("16:9");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#eef7ff] px-4 text-sm font-black text-[#2468ad] transition active:bg-[#e1f0ff]"
                              >
                                Copy Prompt
                              </button>
                            </div>
                          </article>
                        </div>
                      ) : null}

                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          {
                            icon: "$",
                            title: st("studio.textImage.hintCostTitle"),
                            body: st("studio.videoWorkbench.hintCostBody")
                          },
                          {
                            icon: "@",
                            title: st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.hintReferenceTitle" : "studio.videoWorkbench.hintPromptTitle"),
                            body: st(videoWorkflow === "image-to-video" ? "studio.videoWorkbench.hintReferenceBody" : "studio.videoWorkbench.hintPromptBody")
                          },
                          {
                            icon: "*",
                            title: st("studio.videoWorkbench.hintOutputTitle"),
                            body: st("studio.videoWorkbench.hintOutputBody")
                          }
                        ].map((card) => (
                          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-3.5 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,138,0,0.13),rgba(255,61,129,0.13))]">{card.icon}</span>
                            <span>
                              <strong className="block text-[13px] font-black text-[#33405a]">{card.title}</strong>
                              <span className="mt-1 block text-xs font-bold leading-[1.35] text-[#8390a6]">{card.body}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : showAvatarWorkbenchRedesign ? (
                    <div className="border-t border-[#758bac]/10 bg-[linear-gradient(180deg,rgba(250,252,255,0.82),rgba(255,255,255,0.95))] px-[18px] py-5 text-left md:px-7 md:pb-7">
                      <div className="mb-4 grid gap-3 lg:flex lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={provider}
                            onChange={(e) => applyProvider(e.target.value)}
                            className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none"
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {PROVIDER_META[option.value]?.label || option.label}
                              </option>
                            ))}
                          </select>
                          {isDreamfaceTalkingAvatar ? (
                            <>
                              <select value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {videoDurationOptions.map((item) => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                              <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="min-h-[45px] rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)] outline-none">
                                {videoRatioOptions.map((item) => (
                                  <option key={item} value={item}>{item === "source" ? st("studio.option.sourceImage") : item}</option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <span className={`inline-flex min-h-[45px] items-center rounded-full border px-5 text-base font-black shadow-[0_8px_24px_rgba(42,67,112,0.08)] ${avatarScriptTooLong ? "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]" : "border-[#758bac]/15 bg-white text-[#43516a]"}`}>
                              {avatarDuration} {st("studio.option.automatic")}
                            </span>
                          )}
                          <span className="inline-flex min-h-[45px] items-center rounded-full border border-[#758bac]/15 bg-white px-5 text-base font-black text-[#43516a] shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                            {estCredits} {st("studio.common.credits")}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateClick}
                          disabled={generateDisabled}
                          className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,#ff8a00_0%,#ff3d81_45%,#7c3cff_100%)] px-6 text-base font-black text-white shadow-[0_22px_48px_rgba(255,61,129,0.28),0_10px_28px_rgba(124,60,255,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 lg:w-auto lg:min-w-[248px]"
                        >
                          <span>{isSubmitting ? st("studio.generate.creating") : accessToken ? st("studio.generate.button") : st("studio.auth.signInToGenerate")}</span>
                          {accessToken ? (
                            <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/20 px-3 text-xs font-black text-white/95 backdrop-blur">
                              {estCredits} {st("studio.common.credits")}
                            </span>
                          ) : null}
                          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/20">-&gt;</span>
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {[
                          {
                            icon: "$",
                            title: st("studio.textImage.hintCostTitle"),
                            body: st("studio.avatarWorkbench.hintCostBody")
                          },
                          {
                            icon: "@",
                            title: st("studio.avatarWorkbench.hintImageTitle"),
                            body: st("studio.avatarWorkbench.hintImageBody")
                          },
                          {
                            icon: "*",
                            title: st("studio.avatarWorkbench.hintVoiceTitle"),
                            body: st(isDreamfaceTalkingAvatar ? "studio.avatarWorkbench.dreamfaceHint" : "studio.avatar.billingHint", { duration: avatarDuration })
                          }
                        ].map((card) => (
                          <div key={card.title} className="grid min-h-[74px] grid-cols-[36px_1fr] items-start gap-3 rounded-[22px] border border-[#758bac]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,251,255,0.86))] p-3.5 shadow-[0_8px_18px_rgba(35,58,97,0.045)]">
                            <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,138,0,0.13),rgba(255,61,129,0.13))]">{card.icon}</span>
                            <span>
                              <strong className="block text-[13px] font-black text-[#33405a]">{card.title}</strong>
                              <span className="mt-1 block text-xs font-bold leading-[1.35] text-[#8390a6]">{card.body}</span>
                            </span>
                          </div>
                        ))}
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
                        {isNanoBananaProvider(provider) ? (
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
                        {isNanoBananaProvider(provider) ? (
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
                        {provider === "nano-banana-image" || isNanoBananaLiteProvider(provider) ? (
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
                        {isNanoBananaProvider(provider) ? (
                          <div className="lg:col-span-2 rounded-2xl border border-black/[0.06] bg-[#fbfdff] p-3">
                            <p className="mb-2 text-xs font-semibold text-[#667085]">{st("studio.field.systemPrompt")}</p>
                            <textarea
                              dir="auto"
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

                {!showModernWorkbenchRedesign ? (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(mode === "image"
                    ? [
                        { label: st("studio.suggestion.productCampaign"), prompt: "Product campaign" },
                        { label: st("studio.suggestion.socialAd"), prompt: "Social ad" },
                        { label: st("studio.suggestion.brandPoster"), prompt: "Brand poster" },
                        { label: st("studio.suggestion.referenceEdit"), prompt: "Reference edit" }
                      ]
                    : activeWorkflow === "avatar-video"
                      ? [
                          { label: "Product intro", prompt: "Hi, I'm here to introduce our new product. It is designed to help you save time, look more professional, and create better results with less effort." },
                          { label: "Social hook", prompt: "Stop scrolling. If you want to create better AI videos from just one image, here is the easiest way to start." },
                          { label: "Course explainer", prompt: "Welcome back. In this short lesson, I'll explain the key idea step by step so you can understand it quickly and use it right away." },
                          { label: "Real estate intro", prompt: "Welcome to this beautiful property. In the next few seconds, I'll show you why this home is comfortable, modern, and worth a closer look." }
                        ]
                    : activeWorkflow === "image-to-video"
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
                ) : null}

                <div className={showModernWorkbenchRedesign ? "hidden" : "mt-10 grid gap-4 text-left md:grid-cols-3"}>
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
                  <section className={`${TEXT_IMAGE_PAGE_INNER_CLASS} mt-[26px] text-left`} aria-label={st("studio.textImage.sceneSectionLabel")}>
                    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black tracking-[-0.04em] text-[#202a42]">{st("studio.textImage.sceneTitle")}</h3>
                        <p className="mt-1.5 max-w-3xl text-[13px] font-bold leading-5 text-[#8290a7]">{st("studio.textImage.sceneDescription")}</p>
                      </div>
                      <Link href={TEXT_IMAGE_GALLERY_URL} className="inline-flex h-[38px] items-center rounded-full border border-[#758bac]/15 bg-white/70 px-3.5 text-[13px] font-black text-[#66758b] shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:bg-white hover:text-[#202633]">
                        {st("studio.textImage.viewAllTemplates")}
                      </Link>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {TEXT_TO_IMAGE_SCENES.map((scene) => (
                        <button
                          key={scene.key}
                          type="button"
                          onClick={() => {
                            setPrompt(st(`studio.textImage.scene.${scene.key}.prompt`));
                            setImageWorkflow("text-to-image");
                            setReferenceImagesText("");
                            setReferenceImageFiles([]);
                            trackEvent("text_image_scene_applied", { scene: scene.key, surface: "studio" }, accessToken);
                          }}
                          className="group relative min-h-[186px] overflow-hidden rounded-[28px] border border-[#758bac]/15 bg-white/70 p-[19px] text-left shadow-[0_8px_24px_rgba(42,67,112,0.08)] transition hover:-translate-y-1 hover:bg-white/85 hover:shadow-[0_16px_36px_rgba(42,67,112,0.14)]"
                        >
                          <span className="pointer-events-none absolute -right-[52px] -top-[60px] h-[168px] w-[168px] rounded-full opacity-85 blur-[3px] transition group-hover:scale-110" style={{ background: scene.glow }} />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.52))]" />
                          <span className="relative z-[1] grid h-[42px] w-[42px] place-items-center rounded-2xl border border-[#758bac]/15 bg-white/75 text-lg shadow-[0_8px_24px_rgba(42,67,112,0.08)]">
                            {st(`studio.textImage.scene.${scene.key}.icon`)}
                          </span>
                          <span className="relative z-[1] mt-3.5 inline-flex h-7 items-center rounded-full border border-[#758bac]/15 bg-white/75 px-2.5 text-xs font-black text-[#617087]">
                            {st(`studio.textImage.scene.${scene.key}.kicker`)}
                          </span>
                          <h4 className="relative z-[1] my-2 text-[19px] font-black tracking-[-0.035em] text-[#24304a]">{st(`studio.textImage.scene.${scene.key}.title`)}</h4>
                          <p className="relative z-[1] max-w-[300px] text-[13px] font-bold leading-[1.45] text-[#8290a7]">{st(`studio.textImage.scene.${scene.key}.body`)}</p>
                          <div className="relative z-[1] mt-[15px] flex flex-wrap gap-[7px]">
                            {[0, 1, 2].map((index) => (
                              <span key={index} className="inline-flex h-[25px] items-center rounded-full border border-[#758bac]/15 bg-[#f6f8fc]/90 px-2.5 text-[11px] font-black text-[#6c7a91]">
                                {st(`studio.textImage.scene.${scene.key}.tag.${index}`)}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
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
                {(mode === "image"
                  ? ["text-to-image", "image-to-image", "enhance-cleanup", "background-remove"]
                  : mode === "audio"
                    ? ["text-to-audio", "text-to-music"]
                    : mode === "avatar"
                      ? ["avatar-video"]
                      : ["text-to-video", "image-to-video"]).map((workflow) => {
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
              {showVideoModelSelect ? (
                <div className="relative z-[80] mt-3 max-w-xl" ref={modelSelectRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setModelSelectPlacement(getModelSelectPlacement(modelSelectRef.current));
                      setModelSelectOpen((open) => !open);
                    }}
                    className="flex min-h-[58px] w-full items-center justify-between gap-4 rounded-full border border-white/12 bg-white/[0.09] px-5 py-3 text-left shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition hover:bg-white/[0.12]"
                    aria-haspopup="listbox"
                    aria-expanded={modelSelectOpen}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-white">{selectedProviderMeta.label}</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-white/46">{st(`studio.modelSelect.desc.${provider}`)}</span>
                    </span>
                    <span className={`shrink-0 text-lg text-white/58 transition ${modelSelectOpen ? "rotate-180" : ""}`}>v</span>
                  </button>
                  {modelSelectOpen ? (
                    <div
                      ref={modelSelectPanelRef}
                      onMouseDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      className={`z-[200] overflow-y-auto overscroll-contain rounded-[1.35rem] border border-white/14 bg-[#fbfdff]/95 text-[#263244] shadow-[0_24px_70px_rgba(0,0,0,0.26)] backdrop-blur-xl ${
                        modelSelectPlacement === "modal"
                          ? "fixed left-1/2 top-20 max-h-[calc(100vh-6rem)] w-[min(calc(100vw-2rem),520px)] -translate-x-1/2"
                          : `absolute left-0 max-h-[min(68vh,520px)] w-full sm:w-[480px] ${
                              modelSelectPlacement === "top" ? "bottom-[68px]" : "top-[68px]"
                            }`
                      }`}
                      role="listbox"
                    >
                      {videoModelGroups.map((group) => {
                        const groupOptions = options.filter((option) => videoModelGroup(option.value) === group.key);
                        if (!groupOptions.length) return null;
                        return (
                          <div key={group.key}>
                            <div className="bg-gradient-to-b from-[#f8fafc] to-white/0 px-4 py-3 pb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#9aa6b8]">
                              {group.label}
                            </div>
                            {groupOptions.map((option) => {
                              const meta = PROVIDER_META[option.value] || {
                                label: option.label,
                                shortLabel: option.label,
                                speed: "Standard",
                                quality: "Balanced",
                                bestFor: "General generation"
                              };
                              const active = provider === option.value;
                              const modelCredits = estimateGenerationCredits({
                                mode: "video",
                                provider: option.value,
                                duration,
                                hasReferences: activeWorkflow === "image-to-video",
                                resolution: defaultVideoResolutionForProvider(option.value),
                                promptText: undefined
                              });
                              const badge = videoModelBadge(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onTouchStart={(event) => event.stopPropagation()}
                                  onClick={() => {
                                    applyProvider(option.value);
                                    setModelSelectOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-4 border-t border-[#e2e8f0]/80 px-4 py-3.5 text-left transition hover:bg-[#f5f9ff] ${active ? "bg-gradient-to-r from-[#eef8ff] to-white" : "bg-transparent"}`}
                                >
                                  <span className="min-w-0">
                                    <span className="block text-[15px] font-black text-[#263244]">{meta.label}</span>
                                    <span className="mt-1 block text-xs leading-5 text-[#7f8ca3]">{st(`studio.modelSelect.desc.${option.value}`)}</span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    {option.value !== "dreamface-io-video" ? (
                                      <span className="text-xs font-bold text-[#64748b]">{st("studio.modelSelect.credits", { credits: modelCredits })}</span>
                                    ) : null}
                                    {badge ? (
                                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                                        badge === "free"
                                          ? "bg-[#eef2f7] text-[#536071]"
                                          : badge === "recommended"
                                            ? "bg-gradient-to-br from-[#2563eb] to-[#0ea5e9] text-white"
                                            : badge === "pro"
                                              ? "bg-[#f3e8ff] text-[#7e22ce]"
                                              : "bg-[#fff4ce] text-[#9a6412]"
                                      }`}>
                                        {st(`studio.modelSelect.badge.${badge}`)}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {provider === "dreamface-io-video" ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-50/95 to-white/80 px-4 py-3 text-sm leading-6 text-amber-900 shadow-sm">
                      {st("studio.modelSelect.upgradeHint")}{" "}
                      {options.some((option) => option.value === "seedance-mini-video") ? (
                        <button
                          type="button"
                          onClick={() => applyProvider("seedance-mini-video")}
                          className="ml-1 rounded-full bg-[#111827] px-3 py-1.5 text-xs font-black text-white transition hover:-translate-y-0.5"
                        >
                          {st("studio.modelSelect.switchModel")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
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
              )}
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
                    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, st("studio.music.defaultPrompt"));
                    setPrompt((current) => promptForProviderChange(current, !hasCompletedCreation ? nextDefaultPrompt : "", st("studio.music.defaultPrompt")));
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
                      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
                      const params = new URLSearchParams(sp.toString());
                      params.set("mode", "image");
                      params.set("provider", nextProvider);
                      params.set("imageSize", nextImageSize);
                      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
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
                <span className="text-sm text-[#5f6779]">{mode === "image" && !isNanoBananaLiteProvider(provider) && isNanoBananaImageToImageProvider(provider) ? "Resolution" : "Duration"}</span>
                {mode === "image" && !isNanoBananaLiteProvider(provider) && isNanoBananaImageToImageProvider(provider) ? (
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
                  {mode === "image" && isNanoBananaProvider(provider) ? isNanoBananaLiteProvider(provider) ? "1K" : editResolution : mode === "video" ? videoResolution : "High"}
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

            {mode === "video" && provider === "happy-horse-video" ? (
              <div className="mb-4 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_30px_rgba(0,0,0,0.12)]">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] px-3 py-2 shadow-sm">
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">{st("studio.field.safety")}</span>
                    <p className="mt-1 text-sm font-semibold text-white">Enable Safety Checker</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableSafetyChecker((value) => !value)}
                    className={`min-w-20 rounded-full px-4 py-2 text-xs font-bold transition ${
                      enableSafetyChecker ? "bg-[#bfdbfe] text-[#12315d]" : "bg-white/[0.08] text-white/58"
                    }`}
                  >
                    {enableSafetyChecker ? st("studio.state.enabled") : st("studio.state.disabled")}
                  </button>
                </div>
              </div>
            ) : null}

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
                        dir="auto"
                        rows={mode === "image" ? 7 : 8}
                        maxLength={isMiniMaxMusic ? 2000 : undefined}
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

                    {!isDreamfaceTalkingAvatar ? (
                    <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                      <video
                        src={KLING_AVATAR_PREVIEW_VIDEO_URL}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full bg-black object-cover"
                      />
                      {isMiniMaxMusic ? (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-3 text-xs text-[#8b95a7]">
                          <span>{st("studio.music.promptDescription")}</span>
                          <span className={prompt.trim().length < 10 ? "font-semibold text-amber-600" : ""}>{prompt.length.toLocaleString()} / 2,000</span>
                        </div>
                      ) : null}
                      <div className="border-t border-white/10 px-3 py-2">
                        <p className="text-xs font-semibold text-white/72">{st("studio.avatar.example")}</p>
                        <p className="mt-1 text-xs leading-5 text-white/38">Uses the default avatar image and sample script.</p>
                      </div>
                    </div>
                    ) : null}

                    {!isDreamfaceTalkingAvatar ? (
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
                    ) : (
                      <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white/82">Talking script</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${avatarScriptTooLong ? "bg-[#be123c]/25 text-[#fecdd3]" : "bg-[#15803d]/25 text-[#bbf7d0]"}`}>{avatarScriptMeta}</span>
                        </div>
                        <p className="text-xs leading-5 text-white/38">
                          DreamFace IO will animate only the uploaded image and make the visible subject say your script. No separate voice URL is needed.
                        </p>
                      </div>
                    )}

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

                  {mode === "image" && !isNanoBananaLiteProvider(provider) && isNanoBananaImageToImageProvider(provider) ? (
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
                  ) : mode === "video" || showDreamfaceTalkingVideoControls ? (
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
                    dir="auto"
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
                onClick={handleGenerateClick}
                disabled={generateDisabled}
                className="min-h-[64px] w-full rounded-[1.35rem] bg-gradient-to-br from-[#1c6be1] to-[#3f86ff] text-base shadow-[0_18px_42px_rgba(28,107,225,0.34),0_0_0_1px_rgba(255,255,255,0.14)_inset] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(28,107,225,0.42)] active:translate-y-0 active:shadow-[0_16px_34px_rgba(28,107,225,0.34)]"
              >
                {isSubmitting
                  ? st("studio.generate.creating")
                  : accessToken
                    ? st("studio.generate.buttonWithCredits", { credits: estCredits })
                    : st("studio.auth.signInToGenerate")}
              </AppButton>
              {isSubmitting ? (
                <p className="mt-2 text-center text-xs font-medium leading-5 text-white/52">
                  {st("studio.generate.projectsHint")}{" "}
                  <Link href="/studio?view=projects" className="font-semibold text-white underline-offset-4 hover:underline">
                    {st("studio.nav.projects")}
                  </Link>
                </p>
              ) : null}
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
              {!isAvatarWorkflow && isMiniMaxMusic && !isPromptValid
                ? st("studio.music.promptDescription")
                : !isAvatarWorkflow && !isPromptValid
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
                          : isNanoBananaProvider(provider)
                            ? `${PROVIDER_META[provider]?.shortLabel || "Nano Banana"} sample`
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
                          href={`/api/generate/download?taskId=${encodeURIComponent(task.id)}&name=${encodeURIComponent(task.id)}`}
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
