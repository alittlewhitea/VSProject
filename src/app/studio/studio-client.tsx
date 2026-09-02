"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "../../lib/analytics";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  formatApproximateCreditValue,
  type BillingCycle
} from "../../lib/billing";
import { isRtlLocale, type Locale } from "../../i18n/routing";
import { CREDIT_LOW_BALANCE_THRESHOLD, estimateGenerationCredits } from "../../lib/model-pricing";
import { useStudioI18n } from "../../lib/studio-i18n";
import { createBrowserSupabaseClient } from "../../lib/supabase-client";
import { AudioWorkbench } from "../../features/studio/audio-workbench";
import { AvatarWorkbench } from "../../features/studio/avatar-workbench";
import { ImageWorkbench } from "../../features/studio/image-workbench";
import { ImageSettings } from "../../features/studio/image-settings";
import { AudioSettings } from "../../features/studio/audio-settings";
import { VideoSettings, type PromptShowcase } from "../../features/studio/video-settings";
import { AvatarSettings } from "../../features/studio/avatar-settings";
import { UnifiedWorkbenchLayout } from "../../features/studio/unified-workbench-layout";
import { ModelPicker } from "../../features/studio/model-picker";
import {
  StudioBottomNavigation,
  StudioIcon,
  StudioSidebar,
  type StudioIconName
} from "../../features/studio/studio-navigation";
import { StudioHeader } from "../../features/studio/studio-header";
import { WorkflowSwitcher } from "../../features/studio/workflow-switcher";
import { StudioBillingModal, type GenerationBillingContext } from "../../features/studio/studio-billing-modal";
import { StudioHome } from "../../features/studio/studio-home";
import { StudioProjects } from "../../features/studio/studio-projects";
import {
  clearPersistentIdempotency,
  clearStudioLoginDraft,
  createIdempotencyFingerprint,
  getPersistentIdempotency,
  mergeTasks,
  pickMediaUrl,
  readSessionTasks,
  readStudioLoginDraft,
  safeRemoveLocalStorage,
  safeSetLocalStorage,
  scopedSessionKey,
  sessionTasksKey,
  writeSessionTasksCache,
  writeStudioLoginDraft,
  type StudioMode,
  type TaskItem
} from "../../features/studio/studio-storage";
import {
  formatSeconds,
  readAudioDurationFromUrl,
  trimAudioFileToDataUrl
} from "../../features/studio/studio-audio-utils";
import { useFloatingPanel } from "../../features/studio/use-floating-panel";
import { ImagePromptGallery } from "../../features/studio/image-prompt-gallery";
import {
  VIDEO_EXAMPLE_PROMPTS,
  VIDEO_EXAMPLE_SOURCE_IMAGES,
  VIDEO_PROVIDER_META,
  VIDEO_PROVIDERS_BY_WORKFLOW,
  isKnownVideoDuration,
  isKnownVideoRatio,
  isKnownVideoResolution,
  videoExampleFor,
  videoExampleSourceFor,
  videoModelBadge,
  videoModelConfig,
  videoModelDefaultDuration,
  videoModelDefaultResolution,
  videoModelDurations,
  videoModelGroup,
  videoModelRatios,
  videoModelResolutions
} from "../../features/studio/video-models";

type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";
type VideoWorkflow = "avatar-video" | "text-to-video" | "image-to-video";
type AudioWorkflow = "text-to-audio" | "text-to-music";
type StudioWorkflow = ImageWorkflow | VideoWorkflow | AudioWorkflow;

const SESSION_CREDIT_BALANCE_KEY = "nova_session_credit_balance";
const LAST_MODEL_STORAGE_PREFIX = "dreamface_studio_last_model_v1";
const TEXT_IMAGE_PAGE_INNER_CLASS = "mx-auto w-full max-w-[1220px]";
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

const KLING_AVATAR_DEFAULT_SCRIPT =
  "Welcome to Cat Facts, where we explore the fascinating world of our feline friends. Did you know that cats spend 70% of their lives sleeping, which means a three-year-old cat has only been awake for about nine months of its life?";
const KLING_AVATAR_DEFAULT_IMAGE_URL = "https://storage.googleapis.com/falserverless/example_inputs/kling_ai_avatar_input.jpg";
const KLING_AVATAR_PREVIEW_VIDEO_URL = "https://v3.fal.media/files/penguin/ln3x7H1p1jL0Pwo7675NI_output.mp4";
const MINIMAX_H3_MAX_AVATAR_PROMPT = "I heard something. MiniMax H3 Max is here?.. Is that true?";

const IMAGE_SIZE_PRESETS = [
  { value: "default_4_3", label: "Default 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "square_hd", label: "Square HD", dimensions: "1024 x 1024", width: 1024, height: 1024 },
  { value: "square", label: "Square", dimensions: "512 x 512", width: 512, height: 512 },
  { value: "portrait_4_3", label: "Portrait 3:4", dimensions: "768 x 1024", width: 768, height: 1024 },
  { value: "portrait_16_9", label: "Portrait 9:16", dimensions: "576 x 1024", width: 576, height: 1024 },
  { value: "landscape_4_3", label: "Landscape 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "landscape_16_9", label: "Landscape 16:9", dimensions: "1024 x 576", width: 1024, height: 576 }
];

const DEFAULT_VIDEO_DURATION = "5s";
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
  ...VIDEO_PROVIDER_META,
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
    recommendedProvider: "minimax-h3-max-video",
    providers: ["minimax-h3-max-video", "dreamface-io-video", "kling-avatar-standard", "kling-avatar-pro"]
  },
  "text-to-video": {
    label: "Text to Video",
    description: "Turn a written scene into a short video.",
    recommendedProvider: "minimax-h3-max-video",
    providers: VIDEO_PROVIDERS_BY_WORKFLOW["text-to-video"]
  },
  "image-to-video": {
    label: "Image to Video",
    description: "Animate a reference image into a short video.",
    recommendedProvider: "minimax-h3-max-video",
    providers: VIDEO_PROVIDERS_BY_WORKFLOW["image-to-video"]
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

function lastModelStorageKey(workflow: StudioWorkflow) {
  return `${LAST_MODEL_STORAGE_PREFIX}:${workflow}`;
}

function readRememberedModel(workflow: StudioWorkflow) {
  if (typeof window === "undefined") return null;
  try {
    const remembered = window.localStorage.getItem(lastModelStorageKey(workflow));
    return remembered && WORKFLOW_META[workflow].providers.includes(remembered) ? remembered : null;
  } catch {
    return null;
  }
}

function modelPickerGroup(mode: StudioMode, workflow: StudioWorkflow, provider: string, recommendedProvider: string) {
  if (provider === recommendedProvider) return "studio.modelPicker.group.recommended";
  if (mode === "video") {
    const group = videoModelGroup(provider);
    if (group === "premium") return "studio.modelPicker.group.premium";
    if (group === "betterQuality") return "studio.modelPicker.group.better";
    return "studio.modelPicker.group.fast";
  }
  if (mode === "image") {
    if (provider === "chatgpt-image" || provider === "nano-banana-pro") return "studio.modelPicker.group.highQuality";
    return workflow === "image-to-image" ? "studio.modelPicker.group.editing" : "studio.modelPicker.group.efficient";
  }
  if (mode === "avatar") return provider === "kling-avatar-pro" ? "studio.modelPicker.group.premiumAvatar" : "studio.modelPicker.group.avatar";
  return "studio.modelPicker.group.available";
}

function modelPickerBadge(mode: StudioMode, provider: string, recommendedProvider: string) {
  if (provider === recommendedProvider) return "studio.modelSelect.badge.recommended";
  if (mode === "video") {
    const badge = videoModelBadge(provider);
    if (badge === "free") return "studio.modelSelect.badge.free";
    if (badge === "pro") return "studio.modelSelect.badge.pro";
    if (badge === "premium") return "studio.modelSelect.badge.premium";
  }
  if (provider === "kling-avatar-pro" || provider === "nano-banana-pro") return "studio.modelSelect.badge.pro";
  return undefined;
}

function modelPickerSpeedKey(speed: string) {
  const normalized = speed.toLowerCase();
  if (normalized === "fastest") return "studio.modelPicker.speed.fastest";
  if (normalized === "fast") return "studio.modelPicker.speed.fast";
  if (normalized === "balanced") return "studio.modelPicker.speed.balanced";
  if (normalized === "medium") return "studio.modelPicker.speed.medium";
  if (normalized === "slower") return "studio.modelPicker.speed.slower";
  return "studio.modelPicker.speed.standard";
}

const PROMPT_IMPROVE_TEXT =
  "Optimize this prompt for a professional AI-generated image. Improve detail, lighting, composition, and overall quality while preserving intent.";

function providerLabel(provider?: string) {
  return provider ? PROVIDER_META[provider]?.label || provider : "Auto routed";
}

function studioProjectHref(taskId?: string) {
  return `/studio?view=projects${taskId ? `&taskId=${encodeURIComponent(taskId)}` : ""}`;
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

function defaultPromptForProvider(provider: string, workflow?: StudioWorkflow, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  if (provider === "kling-avatar-standard" || provider === "kling-avatar-pro") {
    return KLING_AVATAR_DEFAULT_SCRIPT;
  }
  if (provider === "minimax-music-2.6") {
    return localizedMusicPrompt;
  }
  if (provider === "minimax-h3-max-video" && workflow === "avatar-video") {
    return MINIMAX_H3_MAX_AVATAR_PROMPT;
  }
  if (provider === "minimax-h3-max-video" && (workflow === "text-to-video" || workflow === "image-to-video")) {
    return videoExampleFor(provider, workflow)?.prompts[0] || "";
  }
  return "";
}

function isSamplePrompt(value: string) {
  return [
    YOUNG_KOREAN_WOMAN_PROMPT,
    EASTBOURNE_KOREAN_WOMAN_PROMPT,
    SPORTS_BROADCAST_PROMPT,
    ...VIDEO_EXAMPLE_PROMPTS
  ].includes(value);
}

function modelSampleReferenceForProvider(provider: string) {
  return videoExampleSourceFor(provider);
}

function isModelSampleReference(value: string) {
  return VIDEO_EXAMPLE_SOURCE_IMAGES.includes(value.trim());
}

function isProviderDefaultPrompt(value: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  return isSamplePrompt(value) || value === MINIMAX_H3_MAX_AVATAR_PROMPT || value === KLING_AVATAR_DEFAULT_SCRIPT || value === MINIMAX_MUSIC_DEFAULT_PROMPT || value === localizedMusicPrompt;
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
  return videoModelDefaultResolution(provider);
}

function isAvatarProvider(provider: string) {
  return provider === "kling-avatar-standard" || provider === "kling-avatar-pro";
}

function isH3MaxProvider(provider: string) {
  return provider === "minimax-h3-max-video";
}

function stripAvatarDefaultReferences(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter((url) => url && url !== KLING_AVATAR_DEFAULT_IMAGE_URL && !VIDEO_EXAMPLE_SOURCE_IMAGES.includes(url))
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

function shortInputValue(value: string) {
  if (!value.trim()) return "";
  if (value.startsWith("data:")) return "Uploaded local file";
  return value;
}

function isProviderAllowedForMode(provider: string | null, mode: StudioMode) {
  if (!provider) return false;
  if (mode === "image") return ["chatgpt-image", "nano-banana-image", "nano-banana-pro", "nano-banana-lite", "nano-banana-2-lite", "flux-image", "flux-dev", "nano-banana-edit", "recraft-image", "topaz-image", "bria-background-remove"].includes(provider);
  if (mode === "audio") return ["minimax-music-2.6", "elevenlabs-tts"].includes(provider);
  if (mode === "avatar") return ["minimax-h3-max-video", "dreamface-io-video", "kling-avatar-standard", "kling-avatar-pro"].includes(provider);
  return Boolean(videoModelConfig(provider)) || isAvatarProvider(provider);
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
  const [prompt, setPrompt] = useState(() => defaultPromptForProvider(initialProvider, initialWorkflow, st("studio.music.defaultPrompt")));
  const [provider, setProvider] = useState(initialProvider);
  const [imageWorkflow, setImageWorkflow] = useState<ImageWorkflow>(initialImageWorkflow);
  const [videoWorkflow, setVideoWorkflow] = useState<VideoWorkflow>(initialVideoWorkflow);
  const [videoSidebarCollapsed, setVideoSidebarCollapsed] = useState(false);
  const [audioWorkflow, setAudioWorkflow] = useState<AudioWorkflow>(initialAudioWorkflow);
  const [ratio, setRatio] = useState(mode === "image" ? "1:1" : mode === "avatar" ? initialProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
  const [imageSize, setImageSize] = useState("default_4_3");
  const [referenceImagesText, setReferenceImagesText] = useState(() =>
    (mode === "image" || mode === "video" || mode === "avatar") &&
    initialReferenceUrl
      ? initialReferenceUrl
      : isAvatarProvider(initialProvider)
        ? KLING_AVATAR_DEFAULT_IMAGE_URL
      : initialWorkflow === "avatar-video" && isH3MaxProvider(initialProvider)
        ? modelSampleReferenceForProvider(initialProvider)
      : initialVideoWorkflow === "image-to-video" && modelSampleReferenceForProvider(initialProvider)
        ? modelSampleReferenceForProvider(initialProvider)
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
  const [duration, setDuration] = useState(
    mode === "video" || mode === "avatar"
      ? videoModelDefaultDuration(initialProvider)
      : "single"
  );
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
  const [mobileStudioMenuOpen, setMobileStudioMenuOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingGenerationContext, setBillingGenerationContext] = useState<GenerationBillingContext | null>(null);
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

  useFloatingPanel({
    open: modelSelectOpen,
    triggerRef: modelSelectRef,
    panelRef: modelSelectPanelRef,
    setOpen: setModelSelectOpen,
    onPlacementChange: setModelSelectPlacement
  });

  useFloatingPanel({
    open: toolbarModelSelectOpen,
    triggerRef: toolbarModelSelectRef,
    panelRef: toolbarModelSelectPanelRef,
    setOpen: setToolbarModelSelectOpen,
    onPlacementChange: setToolbarModelSelectPlacement
  });

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
    const validProviderParam = isProviderAllowedForMode(providerParam, mode) ? providerParam : null;
    const rememberedProvider = validProviderParam ? null : readRememberedModel(workflowParam);
    const nextProvider = providerForWorkflow(
      workflowParam,
      validProviderParam || rememberedProvider
    );
    setProvider(nextProvider === "nano-banana-edit" ? "nano-banana-image" : nextProvider);
    if (!sp.get("prompt") && (modeChanged || nextProvider !== initialProvider)) {
      setPrompt(defaultPromptForProvider(nextProvider, workflowParam, st("studio.music.defaultPrompt")));
    }
    if (modeChanged && mode === "image" && !sp.get("reference")) {
      setReferenceImagesText("");
      setReferenceImageFiles([]);
    }
    const nextImageSize = mode === "image" ? defaultImageSizeForProvider(nextProvider) : "default_4_3";
    setRatio(mode === "image" ? defaultImageRatioForProvider(nextProvider, nextImageSize) : mode === "avatar" ? nextProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
    setImageSize(nextImageSize);
    setDuration(
      mode === "video" || mode === "avatar"
        ? videoModelDefaultDuration(nextProvider)
        : "single"
    );
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

    const ratioParam = sp.get("ratio");
    if (ratioParam && isKnownVideoRatio(ratioParam)) {
      setRatio(ratioParam);
    }

    const imageSizeParam = sp.get("imageSize");
    if (provider !== "topaz-image" && imageSizeParam && IMAGE_SIZE_PRESETS.some((preset) => preset.value === imageSizeParam)) {
      setImageSize(imageSizeParam);
      setRatio(ratioFromImageSize(imageSizeParam));
    }

    const durationParam = sp.get("duration");
    if (durationParam && (mode === "image" ? durationParam === "single" : isKnownVideoDuration(durationParam))) {
      setDuration(durationParam);
    }

    const resolutionParam = sp.get("resolution");
    if (resolutionParam && isKnownVideoResolution(resolutionParam)) {
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
      } else if (isH3MaxProvider(avatarProvider || "")) {
        setPrompt((current) => promptForProviderChange(current, MINIMAX_H3_MAX_AVATAR_PROMPT, st("studio.music.defaultPrompt")));
        setReferenceImagesText((current) => {
          const customReference = stripAvatarDefaultReferences(current);
          return customReference || modelSampleReferenceForProvider("minimax-h3-max-video");
        });
      } else {
        setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
        setPrompt((current) => isProviderDefaultPrompt(current, st("studio.music.defaultPrompt")) ? "" : current);
      }
    } else {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
      setPrompt((current) => current.trim() === KLING_AVATAR_DEFAULT_SCRIPT || current.trim() === MINIMAX_H3_MAX_AVATAR_PROMPT ? "" : current);
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
    const tasksKey = sessionTasksKey(userId);
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
  const isH3MaxAvatar = isAvatarWorkflow && isH3MaxProvider(provider);
  const h3MaxAvatarExample = isH3MaxAvatar ? videoExampleFor("minimax-h3-max-video", "image-to-video") : null;
  const avatarNeedsImage = isAvatarWorkflow && referenceImageUrls.length === 0;
  const avatarScriptSeconds = isAvatarWorkflow ? estimateAvatarScriptSeconds(prompt) : 0;
  const avatarOutputSeconds = isAvatarWorkflow ? avatarScriptSeconds + (isDreamfaceTalkingAvatar ? 0 : AVATAR_KLING_BUFFER_SECONDS) : 0;
  const isDefaultAvatarScript = isAvatarWorkflow && prompt.trim() === KLING_AVATAR_DEFAULT_SCRIPT;
  const avatarDuration = isAvatarWorkflow
    ? isDreamfaceTalkingAvatar || isH3MaxAvatar
      ? duration
      : avatarDurationFromPrompt(prompt)
    : duration;
  const avatarScriptTooLong = isAvatarWorkflow && !isDreamfaceTalkingAvatar && !isH3MaxAvatar && !isDefaultAvatarScript && avatarOutputSeconds > AVATAR_MAX_SECONDS;
  const avatarScriptMeta = isAvatarWorkflow
    ? prompt.trim()
      ? isH3MaxAvatar
        ? st("studio.workbench.characters", { count: prompt.length.toLocaleString() })
        : isDefaultAvatarScript
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
  const recommendedProvider = WORKFLOW_META[activeWorkflow].recommendedProvider;
  const modelPickerOptions = options.map((option) => {
    const meta = PROVIDER_META[option.value] || {
      label: option.label,
      shortLabel: option.label,
      speed: "Standard",
      quality: "Balanced",
      bestFor: "General generation"
    };
    const optionDurationOptions = mode === "video" ? videoModelDurations(option.value) : [];
    const optionAvatarPrompt = isAvatarWorkflow
      ? promptForProviderChange(prompt, defaultPromptForProvider(option.value, activeWorkflow, st("studio.music.defaultPrompt")), st("studio.music.defaultPrompt"))
      : prompt;
    const optionDuration = isAvatarWorkflow
      ? option.value === "dreamface-io-video" || isH3MaxProvider(option.value) ? videoModelDefaultDuration(option.value) : avatarDurationFromPrompt(optionAvatarPrompt)
      : mode === "video"
        ? optionDurationOptions.includes(duration) ? duration : videoModelDefaultDuration(option.value)
        : duration;
    const optionResolution = mode === "image"
      ? editResolution
      : defaultVideoResolutionForProvider(option.value);
    const optionGenerateAudio = mode === "video" && Boolean(videoModelConfig(option.value)?.showAudioControl) && generateAudio;
    const optionImageSize = mode === "image" ? defaultImageSizeForProvider(option.value) : imageSize;
    const rawOptionCredits = option.value === provider
      ? estCredits
      : estimateGenerationCredits({
          mode: modeForPricing(mode),
          provider: option.value,
          imageSize: optionImageSize,
          duration: optionDuration,
          hasReferences: referenceImageUrls.length > 0,
          resolution: optionResolution,
          generateAudio: optionGenerateAudio,
          quality: option.value === "chatgpt-image" ? "low" : "high",
          numImages: mode === "image" ? numImages : 1,
          enableWebSearch,
          thinkingLevel,
          promptText: prompt
        });
    const optionDreamfaceUnits = option.value === "dreamface-io-video"
      ? Math.max(1, Math.ceil((Number.parseInt(optionDuration, 10) || 5) / 5))
      : 0;
    const optionCredits = option.value === "dreamface-io-video" && dreamfaceIoEligible && dreamfaceIoRemainingUnits >= optionDreamfaceUnits
      ? 0
      : rawOptionCredits;
    const groupKey = modelPickerGroup(mode, activeWorkflow, option.value, recommendedProvider);
    const badgeKey = modelPickerBadge(mode, option.value, recommendedProvider);
    return {
      value: option.value,
      label: meta.label,
      description: st(groupKey),
      speed: st(modelPickerSpeedKey(meta.speed)),
      quality: meta.quality,
      credits: optionCredits,
      badge: badgeKey ? st(badgeKey) : undefined,
      group: st(groupKey)
    };
  });
  const hasEnoughCredits = creditBalance === null || creditBalance >= estCredits;
  const lowBalanceAfterGeneration = typeof creditBalance === "number" && creditBalance - estCredits < CREDIT_LOW_BALANCE_THRESHOLD;
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
  const generateDisabled = accessToken ? !canSubmit || isSubmitting : false;
  const activeTasks = tasks.filter((task) => task.status === "Queued" || task.status === "Running");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const hasCompletedCreation = completedTasks.length > 0;
  const selectedProjectId = sp.get("taskId");
  const selectedProjectTask = selectedProjectId
    ? tasks.find((task) => task.id === selectedProjectId) || tasks[0] || null
    : tasks[0] || null;
  const selectedImageSize = getImageSizePreset(imageSize);
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
    "gemini-omni-flash-video",
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
  const selectedVideoModelConfig = videoModelConfig(provider);
  const configuredVideoWorkflow = videoWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
  const selectedH3MaxExample = provider === "minimax-h3-max-video"
    ? videoExampleFor(provider, configuredVideoWorkflow)
    : null;
  const videoPromptShowcases: PromptShowcase[] = selectedH3MaxExample
    ? [{
        videoUrl: selectedH3MaxExample.videoUrl,
        posterUrl: selectedH3MaxExample.posterUrl,
        prompt: selectedH3MaxExample.prompts[0] || "",
        duration: selectedH3MaxExample.settings.duration,
        provider: selectedH3MaxExample.provider,
        ratio: selectedH3MaxExample.settings.ratio,
        resolution: selectedH3MaxExample.settings.resolution
      }]
    : [
        { videoUrl: YOUNG_KOREAN_WOMAN_VIDEO_URL, posterUrl: "/images/video-examples/young-korean-neighborhood.png", prompt: YOUNG_KOREAN_WOMAN_PROMPT, duration: "15s", provider: "seedance-video", ratio: "16:9" },
        { videoUrl: EASTBOURNE_KOREAN_WOMAN_VIDEO_URL, posterUrl: "/images/video-examples/eastbourne-tennis.png", prompt: EASTBOURNE_KOREAN_WOMAN_PROMPT, duration: "10s", provider: "seedance-video", ratio: "16:9" },
        { videoUrl: SPORTS_BROADCAST_VIDEO_URL, posterUrl: "/images/video-examples/sports-broadcast.png", prompt: SPORTS_BROADCAST_PROMPT, duration: "15s", provider: "seedance-video", ratio: "16:9" }
      ];
  const videoRatioOptions = isAvatarProvider(provider) || isH3MaxAvatar
    ? ["source"]
    : videoModelRatios(provider, configuredVideoWorkflow);
  const videoDurationOptions = isAvatarProvider(provider)
    ? Array.from({ length: 13 }, (_, index) => `${index + 3}s`)
    : videoModelDurations(provider);
  const videoResolutionOptions = videoModelResolutions(provider);
  const showDreamfaceTalkingVideoControls = mode === "avatar" && provider === "dreamface-io-video";
  const showVideoResolutionControl = (mode === "video" || isH3MaxAvatar) && Boolean(selectedVideoModelConfig?.showResolutionControl);
  const showVideoAudioControl = mode === "video" && !isAvatarProvider(provider) && Boolean(selectedVideoModelConfig?.showAudioControl);
  const showTextToImageTemplates = !isAppsHome && !isProjectsView && mode === "image" && imageWorkflow === "text-to-image";
  const showImageToImageRedesign = !isAppsHome && !isProjectsView && mode === "image" && imageWorkflow === "image-to-image";
  const showImageUtilityRedesign = !isAppsHome && !isProjectsView && mode === "image" && (imageWorkflow === "enhance-cleanup" || imageWorkflow === "background-remove");
  const showVideoWorkbenchRedesign = !isAppsHome && !isProjectsView && mode === "video" && (videoWorkflow === "text-to-video" || videoWorkflow === "image-to-video");
  const showAudioWorkbenchRedesign = !isAppsHome && !isProjectsView && mode === "audio" && (audioWorkflow === "text-to-audio" || audioWorkflow === "text-to-music");
  const showAvatarWorkbenchRedesign = !isAppsHome && !isProjectsView && isAvatarWorkflow;
  const showImageWorkbenchRedesign = showTextToImageTemplates || showImageToImageRedesign || showImageUtilityRedesign;
  const showModernWorkbenchRedesign = showImageWorkbenchRedesign || showVideoWorkbenchRedesign || showAudioWorkbenchRedesign || showAvatarWorkbenchRedesign;
  const showModernStudioChrome = showModernWorkbenchRedesign || isProjectsView || isAppsHome;
  const useWideStudioShell = showModernStudioChrome || isAppsHome;
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
              : isH3MaxAvatar
                ? `${videoResolution} / ${avatarDuration}`
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
    if (mode !== "video" && !showDreamfaceTalkingVideoControls && !isH3MaxAvatar) return;
    if (!videoRatioOptions.includes(ratio)) {
      setRatio(showDreamfaceTalkingVideoControls ? "16:9" : videoRatioOptions.includes("auto") ? "auto" : videoRatioOptions[0] || "16:9");
    }
    if (!videoDurationOptions.includes(duration)) {
      setDuration(videoModelDefaultDuration(provider));
    }
    if (showVideoResolutionControl && !videoResolutionOptions.includes(videoResolution)) {
      setVideoResolution(defaultVideoResolutionForProvider(provider));
    }
  }, [duration, isH3MaxAvatar, mode, provider, ratio, showDreamfaceTalkingVideoControls, showVideoResolutionControl, videoDurationOptions, videoRatioOptions, videoResolution, videoResolutionOptions]);

  useEffect(() => {
    if (!hasCompletedCreation || provider === "minimax-h3-max-video") return;
    setPrompt((currentPrompt) => (isSamplePrompt(currentPrompt) ? "" : currentPrompt));
  }, [hasCompletedCreation, provider]);

  function applyWorkflow(nextWorkflow: StudioWorkflow) {
    const nextMode =
      nextWorkflow === "text-to-image" || nextWorkflow === "image-to-image" || nextWorkflow === "enhance-cleanup" || nextWorkflow === "background-remove"
        ? "image"
        : nextWorkflow === "text-to-audio" || nextWorkflow === "text-to-music"
          ? "audio"
          : nextWorkflow === "avatar-video"
            ? "avatar"
            : "video";
    const rememberedProvider = readRememberedModel(nextWorkflow);
    const nextProvider = providerForWorkflow(nextWorkflow, nextMode === "video" ? rememberedProvider : rememberedProvider || provider);
    if (nextMode === "image") {
      const nextImageWorkflow = nextWorkflow as ImageWorkflow;
      if (mode === "image" && imageWorkflow !== nextImageWorkflow) {
        setPrompt("");
      }
      setImageWorkflow(nextImageWorkflow);
      if (mode !== "image" || nextWorkflow === "text-to-image") {
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
        setReferenceImagesText((current) => {
          const customReference = stripAvatarDefaultReferences(current);
          if (customReference || referenceImageFiles.length) return customReference;
          if (isAvatarProvider(nextProvider)) return KLING_AVATAR_DEFAULT_IMAGE_URL;
          if (isH3MaxProvider(nextProvider)) return modelSampleReferenceForProvider(nextProvider);
          return "";
        });
        setReferenceImageFiles([]);
      } else if (nextWorkflow === "image-to-video") {
        const shouldUseModelSample = isModelSampleReference(referenceImagesText) || (!referenceImagesText.trim() && referenceImageFiles.length === 0);
        if (shouldUseModelSample) {
          setReferenceImagesText(modelSampleReferenceForProvider(nextProvider));
          setReferenceImageFiles([]);
        }
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
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, nextWorkflow, st("studio.music.defaultPrompt"));
    const shouldApplyDefaultPrompt = !hasCompletedCreation || nextProvider === "minimax-h3-max-video";
    setPrompt((current) =>
      nextMode === mode
        ? promptForProviderChange(current, shouldApplyDefaultPrompt ? nextDefaultPrompt : "", st("studio.music.defaultPrompt"))
        : shouldApplyDefaultPrompt
          ? nextDefaultPrompt
          : ""
    );
    const nextImageSize = nextMode === "image" ? defaultImageSizeForProvider(nextProvider) : imageSize;
    if (nextMode === "image") {
      setImageSize(nextImageSize);
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
    } else if (nextMode === "video" || nextMode === "avatar") {
      setRatio(nextWorkflow === "avatar-video" ? nextProvider === "dreamface-io-video" ? "16:9" : "source" : "16:9");
      setDuration(videoModelDefaultDuration(nextProvider));
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
      if (videoModelConfig(nextProvider)?.showResolutionControl) {
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

  function applyProvider(nextProvider: string, videoOverrides?: { duration?: string; ratio?: string; resolution?: string }) {
    trackEvent("studio_model_selected", { mode, provider: nextProvider, workflow: activeWorkflow }, accessToken);
    safeSetLocalStorage(lastModelStorageKey(activeWorkflow), nextProvider);
    setProvider(nextProvider);
    const nextDefaultPrompt = defaultPromptForProvider(nextProvider, activeWorkflow, st("studio.music.defaultPrompt"));
    setPrompt((current) => promptForProviderChange(current, !hasCompletedCreation || nextProvider === "minimax-h3-max-video" ? nextDefaultPrompt : "", st("studio.music.defaultPrompt")));
    if (isAvatarProvider(nextProvider)) {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current) || KLING_AVATAR_DEFAULT_IMAGE_URL);
      setReferenceImageFiles([]);
    } else if (mode === "avatar" && isH3MaxProvider(nextProvider)) {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current) || modelSampleReferenceForProvider(nextProvider));
      setReferenceImageFiles([]);
      setAvatarAudioUrl("");
    } else if (mode === "avatar" && nextProvider === "dreamface-io-video") {
      setReferenceImagesText((current) => stripAvatarDefaultReferences(current));
      setAvatarAudioUrl("");
    } else if (mode === "video" && activeWorkflow === "image-to-video") {
      const shouldUseModelSample = isModelSampleReference(referenceImagesText) || (!referenceImagesText.trim() && referenceImageFiles.length === 0);
      if (shouldUseModelSample) {
        setReferenceImagesText(modelSampleReferenceForProvider(nextProvider));
        setReferenceImageFiles([]);
      }
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
      const nextConfiguredWorkflow = activeWorkflow === "image-to-video" ? "image-to-video" : "text-to-video";
      const nextRatioOptions = videoModelRatios(nextProvider, nextConfiguredWorkflow);
      const requestedRatio = videoOverrides?.ratio || ratio;
      const nextRatio =
        mode === "avatar" && nextProvider === "dreamface-io-video"
          ? "16:9"
        : isAvatarProvider(nextProvider) || (mode === "avatar" && isH3MaxProvider(nextProvider))
          ? "source"
        : nextRatioOptions.includes(requestedRatio)
          ? requestedRatio
          : nextRatioOptions.includes("auto")
            ? "auto"
            : nextRatioOptions[0] || "16:9";
      const nextDurationOptions = videoModelDurations(nextProvider);
      const requestedDuration = videoOverrides?.duration || duration;
      const nextDuration = nextDurationOptions.includes(requestedDuration)
        ? requestedDuration
        : videoModelDefaultDuration(nextProvider);
      if (mode !== "avatar") {
        setDuration(nextDuration);
      }
      const nextResolutionOptions = videoModelResolutions(nextProvider);
      const nextResolution = videoOverrides?.resolution && nextResolutionOptions.includes(videoOverrides.resolution)
        ? videoOverrides.resolution
        : defaultVideoResolutionForProvider(nextProvider);
      setVideoResolution(nextResolution);
      setRatio(nextRatio);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", mode === "avatar" ? "avatar" : "video");
      params.set("workflow", mode === "avatar" ? "avatar-video" : activeWorkflow);
      params.set("provider", nextProvider);
      params.set("ratio", nextRatio);
      if (mode !== "avatar") {
        params.set("duration", nextDuration);
      }
      if (videoModelConfig(nextProvider)?.showResolutionControl) {
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
    const singleReferenceWorkflow = isPromptlessImageWorkflow || mode === "video" || mode === "avatar";
    const maxFiles = singleReferenceWorkflow ? 1 : 4;
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
    if (mode === "video" || mode === "avatar") {
      setReferenceImagesText("");
    }
    setReferenceImageFiles((prev) => (singleReferenceWorkflow ? nextFiles.slice(0, 1) : [...prev, ...nextFiles].slice(0, 4)));
    if (mode === "image" && imageWorkflow === "text-to-image") {
      const nextWorkflow: StudioWorkflow = "image-to-image";
      const nextProvider = providerForWorkflow(nextWorkflow, readRememberedModel(nextWorkflow) || provider);
      const nextImageSize = defaultImageSizeForProvider(nextProvider);
      setImageWorkflow("image-to-image");
      setProvider(nextProvider);
      setImageSize(nextImageSize);
      setImageQuality(nextProvider === "chatgpt-image" ? "low" : "high");
      setRatio(defaultImageRatioForProvider(nextProvider, nextImageSize));
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "image");
      params.set("workflow", nextWorkflow);
      params.set("provider", nextProvider);
      params.set("imageSize", nextImageSize);
      params.set("ratio", defaultImageRatioForProvider(nextProvider, nextImageSize));
      router.replace(`/studio?${params.toString()}`, { scroll: false });
    }
    if (mode === "avatar") {
      setVideoWorkflow("avatar-video");
    }
    if (mode === "video" && videoWorkflow !== "image-to-video") {
      const nextWorkflow: StudioWorkflow = "image-to-video";
      const nextProvider = WORKFLOW_META[nextWorkflow].recommendedProvider;
      const nextDurations = videoModelDurations(nextProvider);
      const nextDuration = nextDurations.includes(duration) ? duration : videoModelDefaultDuration(nextProvider);
      const nextRatios = videoModelRatios(nextProvider, nextWorkflow);
      const nextRatio = nextRatios.includes(ratio) ? ratio : nextRatios.includes("auto") ? "auto" : nextRatios[0] || "16:9";
      const nextResolution = defaultVideoResolutionForProvider(nextProvider);
      setVideoWorkflow("image-to-video");
      setProvider(nextProvider);
      const nextDefaultPrompt = defaultPromptForProvider(nextProvider, nextWorkflow, st("studio.music.defaultPrompt"));
      setPrompt((current) => promptForProviderChange(current, nextDefaultPrompt, st("studio.music.defaultPrompt")));
      setDuration(nextDuration);
      setRatio(nextRatio);
      setVideoResolution(nextResolution);
      const params = new URLSearchParams(sp.toString());
      params.set("mode", "video");
      params.set("workflow", nextWorkflow);
      params.set("provider", nextProvider);
      params.set("duration", nextDuration);
      params.set("ratio", nextRatio);
      if (videoModelConfig(nextProvider)?.showResolutionControl) params.set("resolution", nextResolution);
      else params.delete("resolution");
      router.replace(`/studio?${params.toString()}`, { scroll: false });
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
    const draft = readStudioLoginDraft<ImageWorkflow, VideoWorkflow, AudioWorkflow>();
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
    if (accessToken && !hasEnoughCredits) {
      openInsufficientCreditsModal();
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
            : (mode === "video" || isH3MaxAvatar) && (provider === "minimax-h3-max-video" || provider === "dreamface-io-video" || provider === "grok-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video")
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
        seed: Number.isSafeInteger(parsedSeed) && (mode === "image" || provider === "minimax-h3-max-video" || provider === "dreamface-io-video" || provider === "seedance-video" || provider === "seedance-mini-video" || provider === "happy-horse-video" || provider === "veo-video") ? parsedSeed : undefined,
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
    setBillingGenerationContext(null);
    setBillingModalOpen(true);
    setBillingMessage("");
    trackEvent("studio_billing_modal_opened", { source, balance: creditBalance, mode, provider }, accessToken);
  }

  function openInsufficientCreditsModal() {
    if (typeof creditBalance !== "number") return;
    const context: GenerationBillingContext = {
      requiredCredits: estCredits,
      balance: creditBalance,
      providerLabel: selectedProviderMeta.label
    };
    setSelectedBillingCycles(Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, "monthly" as BillingCycle])));
    setBillingGenerationContext(context);
    setBillingMessage("");
    setBillingModalOpen(true);
    trackEvent("generation_insufficient_credits_shown", {
      mode,
      provider,
      workflow: activeWorkflow,
      required_credits: estCredits,
      balance: creditBalance,
      shortfall: Math.max(0, estCredits - creditBalance)
    }, accessToken);
  }

  function improveTextToImagePrompt() {
    setPrompt((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n\n${PROMPT_IMPROVE_TEXT}` : PROMPT_IMPROVE_TEXT;
    });
    trackEvent("studio_prompt_improved", { mode, provider, workflow: activeWorkflow }, accessToken);
  }

  async function startStudioCreditCheckout(packId: string) {
    const checkoutSurface = billingGenerationContext ? "generation_insufficient_modal" : "studio_modal";
    if (!accessToken) {
      trackEvent("checkout_login_required", { pack_id: packId, surface: checkoutSurface });
      const nextPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/studio?view=home";
      router.push(`/auth?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const pack = CREDIT_PACKS.find((item) => item.id === packId);
    setLoadingBillingItem(`credits:${packId}`);
    setBillingMessage("");
    trackEvent(
      "checkout_started",
      { surface: checkoutSurface, pack_id: packId, credits: pack?.credits || null, amount_cents: pack?.amountCents || null },
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
    const checkoutSurface = billingGenerationContext ? "generation_insufficient_modal" : "studio_modal";
    if (!accessToken) {
      trackEvent("checkout_login_required", { plan_id: planId, cycle, surface: checkoutSurface });
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
        surface: checkoutSurface,
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

  const imageSettingsPanel = showImageWorkbenchRedesign ? (
    <ImageSettings
      provider={provider}
      providerOptions={modelPickerOptions}
      utilityWorkflow={showImageUtilityRedesign ? imageWorkflow === "enhance-cleanup" ? "enhance-cleanup" : "background-remove" : null}
      isImageToImage={showImageToImageRedesign}
      isNanoBanana={isNanoBananaProvider(provider)}
      isNanoBananaLite={isNanoBananaLiteProvider(provider)}
      ratio={ratio}
      ratioOptions={provider === "nano-banana-pro" || provider === "nano-banana-2-lite" ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item)) : NANO_ASPECT_RATIO_OPTIONS}
      imageSize={imageSize}
      imageSizePresets={IMAGE_SIZE_PRESETS}
      outputFormat={outputFormat}
      imageQuality={imageQuality}
      editResolution={editResolution}
      numInferenceSteps={numInferenceSteps}
      guidanceScale={guidanceScale}
      numImages={numImages}
      seed={seed}
      enableSafetyChecker={enableSafetyChecker}
      acceleration={acceleration}
      safetyTolerance={safetyTolerance}
      limitGenerations={limitGenerations}
      enableWebSearch={enableWebSearch}
      thinkingLevel={thinkingLevel}
      systemPrompt={systemPrompt}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      estimatedCredits={estCredits}
      creditBalance={creditBalance}
      translate={st}
      onProviderChange={applyProvider}
      onRatioChange={(value) => {
        trackEvent("studio_size_selected", { mode, provider, ratio: value }, accessToken);
        setRatio(value);
      }}
      onImageSizeChange={(value) => {
        trackEvent("studio_size_selected", { mode, provider, image_size: value, ratio: ratioFromImageSize(value) }, accessToken);
        setImageSize(value);
        setRatio(ratioFromImageSize(value));
      }}
      onOutputFormatChange={setOutputFormat}
      onImageQualityChange={setImageQuality}
      onEditResolutionChange={setEditResolution}
      onNumInferenceStepsChange={setNumInferenceSteps}
      onGuidanceScaleChange={setGuidanceScale}
      onNumImagesChange={setNumImages}
      onSeedChange={setSeed}
      onEnableSafetyCheckerChange={setEnableSafetyChecker}
      onAccelerationChange={setAcceleration}
      onSafetyToleranceChange={setSafetyTolerance}
      onLimitGenerationsChange={setLimitGenerations}
      onEnableWebSearchChange={setEnableWebSearch}
      onThinkingLevelChange={setThinkingLevel}
      onSystemPromptChange={setSystemPrompt}
      onGenerate={handleGenerateClick}
    />
  ) : null;

  const audioSettingsPanel = showAudioWorkbenchRedesign ? (
    <AudioSettings
      provider={provider}
      providerOptions={modelPickerOptions}
      isElevenLabs={isElevenLabsAudio}
      audioVoiceOptions={audioVoiceOptions}
      languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
      voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
      ttsVoice={ttsVoice}
      ttsLanguageCode={ttsLanguageCode}
      ttsTimestamps={ttsTimestamps}
      audioVoiceGender={audioVoiceGender}
      ttsStability={ttsStability}
      textNormalization={textNormalization}
      textNormalizationOptions={TEXT_NORMALIZATION_OPTIONS}
      musicSampleRate={musicSampleRate}
      musicBitrate={musicBitrate}
      musicFormat={musicFormat}
      estimatedCredits={estCredits}
      creditBalance={creditBalance}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      translate={st}
      onProviderChange={applyProvider}
      onTtsVoiceChange={setTtsVoice}
      onTtsLanguageCodeChange={setTtsLanguageCode}
      onTtsTimestampsChange={setTtsTimestamps}
      onAudioVoiceGenderChange={setAudioVoiceGender}
      onTtsStabilityChange={setTtsStability}
      onTextNormalizationChange={setTextNormalization}
      onMusicSampleRateChange={setMusicSampleRate}
      onMusicBitrateChange={setMusicBitrate}
      onMusicFormatChange={setMusicFormat}
      onGenerate={handleGenerateClick}
    />
  ) : null;

  const avatarSettingsPanel = showAvatarWorkbenchRedesign ? (
    <AvatarSettings
      isDreamfaceTalkingAvatar={isDreamfaceTalkingAvatar}
      isH3MaxAvatar={isH3MaxAvatar}
      duration={duration}
      durationOptions={videoDurationOptions}
      resolution={videoResolution}
      resolutionOptions={videoResolutionOptions}
      ratio={ratio}
      ratioOptions={videoRatioOptions}
      automaticDuration={avatarDuration}
      scriptTooLong={avatarScriptTooLong}
      estimatedCredits={estCredits}
      creditBalance={creditBalance}
      generateDisabled={generateDisabled}
      isSubmitting={isSubmitting}
      isAuthenticated={Boolean(accessToken)}
      translate={st}
      onDurationChange={setDuration}
      onResolutionChange={setVideoResolution}
      onRatioChange={setRatio}
      onGenerate={handleGenerateClick}
    />
  ) : null;
  const avatarModelSelector = showAvatarWorkbenchRedesign ? (
    <ModelPicker value={provider} options={modelPickerOptions} translate={st} onChange={applyProvider} />
  ) : null;

  return (
    <main
      dir={isRtlLocale(studioI18n.locale) ? "rtl" : "ltr"}
      className={`relative min-h-screen w-full max-w-full overflow-x-hidden text-[#1f2430] ${showModernStudioChrome ? "bg-[radial-gradient(1200px_500px_at_92%_-10%,rgba(106,90,249,0.05),transparent_45%),radial-gradient(900px_380px_at_10%_-20%,rgba(176,77,255,0.04),transparent_38%),#fafafc]" : "bg-[radial-gradient(circle_at_50%_0%,rgba(189,224,254,0.42),transparent_34%),radial-gradient(circle_at_74%_14%,rgba(255,200,221,0.28),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fbfcff_54%,#f7f9fd_100%)] pb-10"}`}
    >
      <div className="pointer-events-none absolute left-[18%] top-10 h-72 w-72 rounded-full bg-[#bde0fe]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-[14%] top-6 h-80 w-80 rounded-full bg-[#ffc8dd]/24 blur-3xl" />
      <div className={showModernStudioChrome ? "w-full" : useWideStudioShell ? "mx-auto my-3 w-[calc(100vw-24px)] max-w-[1760px] md:my-7 md:w-[calc(100vw-56px)]" : "mx-auto w-full max-w-[1540px] px-2 pt-2 md:px-8 md:pt-5"}>
        {!authReady && !showModernStudioChrome ? (
          <section className="mb-4 rounded-2xl border border-black/[0.06] bg-white/82 p-6 text-sm text-[#667085] shadow-sm">
            {st("studio.checkingSession")}
          </section>
        ) : null}

        <StudioBillingModal
          open={billingModalOpen}
          t={st}
          loadingItem={loadingBillingItem}
          message={billingMessage}
          creditBalance={creditBalance}
          generationContext={billingGenerationContext}
          selectedCycles={selectedBillingCycles}
          scrollRef={billingModalScrollRef}
          premiumLitePlanRef={premiumLitePlanRef}
          onClose={() => {
            setBillingModalOpen(false);
            setBillingGenerationContext(null);
          }}
          onAllCyclesChange={(cycle) =>
            setSelectedBillingCycles(Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.id, cycle])))
          }
          onPlanCycleChange={(planId, cycle) =>
            setSelectedBillingCycles((current) => ({ ...current, [planId]: cycle }))
          }
          onSubscriptionCheckout={startStudioSubscriptionCheckout}
          onCreditCheckout={startStudioCreditCheckout}
        />

        <section className={showModernStudioChrome ? "relative min-h-screen w-full max-w-full bg-transparent" : "relative min-h-[calc(100vh-1rem)] w-full max-w-full overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white/72 shadow-[0_20px_60px_rgba(71,85,105,0.10)] backdrop-blur-2xl md:rounded-[2.25rem] md:shadow-[0_32px_120px_rgba(71,85,105,0.14)]"}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7dd3fc]/50 to-transparent" />
          <div className={`grid min-h-screen min-w-0 transition-[grid-template-columns] duration-300 ease-out ${showModernStudioChrome ? videoSidebarCollapsed ? "lg:grid-cols-[76px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]" : "lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[96px_minmax(0,1fr)]"}`}>
            <StudioSidebar
              t={st}
              modern={showModernStudioChrome}
              videoStudio={showModernStudioChrome}
              collapsed={videoSidebarCollapsed}
              creditBalance={creditBalance}
              signedIn={Boolean(accessToken)}
              onCollapsedChange={setVideoSidebarCollapsed}
              mode={mode}
              isAppsHome={isAppsHome}
              isProjectsView={isProjectsView}
              onImageWorkflowSelected={(workflowLabel) =>
                trackEvent("studio_workflow_selected", { mode: "image", workflow: workflowLabel, surface: "sidebar_hover" }, accessToken)
              }
            />

            <StudioBottomNavigation t={st} mode={mode} isAppsHome={isAppsHome} isProjectsView={isProjectsView} />
            <div className={`relative min-w-0 max-w-full ${showModernStudioChrome ? "px-3.5 pb-[calc(90px+env(safe-area-inset-bottom))] lg:px-[22px] lg:pb-[22px]" : "px-3 pb-24 pt-3 md:px-8 md:py-5 lg:px-12"}`}>
              <StudioHeader
                t={st}
                modern={showModernStudioChrome}
                videoStudio={showModernStudioChrome}
                mode={mode}
                isAppsHome={isAppsHome}
                isProjectsView={isProjectsView}
                mobileMenuOpen={mobileStudioMenuOpen}
                signedIn={Boolean(accessToken)}
                signInUrl={STUDIO_SIGN_IN_URL}
                locale={studioI18n.locale}
                locales={studioI18n.locales}
                localeLabels={studioI18n.localeLabels}
                creditBalance={creditBalance}
                audioWorkflow={audioWorkflow}
                onMobileMenuOpenChange={setMobileStudioMenuOpen}
                onLocaleChange={studioI18n.setLocale}
                onBillingOpen={openBillingModal}
                onAudioWorkflowSelect={applyWorkflow}
              />
              {creditNote && !showModernStudioChrome ? (
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
                <StudioHome t={st} tasks={tasks} onUpgrade={() => openBillingModal("workspace_upgrade")} />
              ) : null}

              {isProjectsView ? (
                <StudioProjects
                  t={st}
                  tasks={tasks}
                  selectedTask={selectedProjectTask}
                  historyNote={taskHistoryNote}
                  duration={duration}
                  providerLabel={providerLabel}
                  onPreviewImage={(url) => setPreviewModal({ url, type: "Image" })}
                />
              ) : null}


              <div className={`${showModernWorkbenchRedesign ? "w-full" : "mx-auto mt-5 max-w-5xl text-center md:mt-16"} ${isAppsHome || isProjectsView ? "hidden" : ""}`}>
              <WorkflowSwitcher
                t={st}
                mode={mode}
                imageWorkflow={imageWorkflow}
                videoWorkflow={videoWorkflow}
                audioWorkflow={audioWorkflow}
                modern={showModernWorkbenchRedesign}
                imageRedesign={showImageWorkbenchRedesign}
                videoRedesign={showVideoWorkbenchRedesign}
                audioRedesign={showAudioWorkbenchRedesign}
                avatarRedesign={showAvatarWorkbenchRedesign}
                imageToImageRedesign={showImageToImageRedesign}
                imageUtilityRedesign={showImageUtilityRedesign}
                hasReferenceImages={Boolean(referenceImageUrls.length)}
                onWorkflowChange={applyWorkflow}
              />
                <div className={showModernWorkbenchRedesign ? "w-full max-w-none overflow-visible" : "mt-4 overflow-visible rounded-[1.7rem] border border-black/[0.06] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.09)] sm:mt-5 md:mt-7 md:rounded-[2rem] md:shadow-[0_28px_80px_rgba(15,23,42,0.12)]"}>
                  <div className={showModernWorkbenchRedesign ? "text-left" : "p-5 text-left md:p-7"}>
                    {showImageWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        mode="image"
                        tasks={tasks}
                        translate={st}
                        editor={<ImageWorkbench
                          workflow={imageWorkflow}
                          canSubmit={canSubmit}
                          prompt={prompt}
                          referenceImagesText={referenceImagesText}
                          referenceImageUrls={referenceImageUrls}
                          isPromptlessWorkflow={isPromptlessImageWorkflow}
                          outputFormat={outputFormat}
                          templatesUrl="/gallery"
                          translate={st}
                          onPromptChange={setPrompt}
                          onImprovePrompt={improveTextToImagePrompt}
                          onReferenceImagesTextChange={setReferenceImagesText}
                          onReferenceFiles={handleReferenceFiles}
                          onReferenceClear={() => {
                            setReferenceImagesText("");
                            setReferenceImageFiles([]);
                          }}
                          onFileError={() => setStatusText(st("studio.status.fileReadFailed"))}
                        />}
                        settings={imageSettingsPanel}
                      />
                    ) : showAudioWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        mode="audio"
                        tasks={tasks}
                        translate={st}
                        editor={<AudioWorkbench
                          workflow={audioWorkflow}
                          canSubmit={canSubmit}
                          prompt={prompt}
                          isMiniMaxMusic={isMiniMaxMusic}
                          musicAdvancedOpen={musicAdvancedOpen}
                          isInstrumental={isInstrumental}
                          lyricsOptimizer={lyricsOptimizer}
                          musicLyrics={musicLyrics}
                          translate={st}
                          onPromptChange={setPrompt}
                          onAdvancedOpenChange={setMusicAdvancedOpen}
                          onInstrumentalChange={setIsInstrumental}
                          onLyricsOptimizerChange={setLyricsOptimizer}
                          onMusicLyricsChange={setMusicLyrics}
                        />}
                        settings={audioSettingsPanel}
                      />
                    ) : showVideoWorkbenchRedesign ? (
                      null
                    ) : showAvatarWorkbenchRedesign ? (
                      <UnifiedWorkbenchLayout
                        mode="avatar"
                        tasks={tasks}
                        translate={st}
                        modelSelector={avatarModelSelector}
                        avatarSamplePreviewUrl={isH3MaxAvatar ? h3MaxAvatarExample?.videoUrl : isAvatarProvider(provider) ? KLING_AVATAR_PREVIEW_VIDEO_URL : undefined}
                        avatarSamplePreviewLabel={isH3MaxAvatar ? "MiniMax H3 Max" : isAvatarProvider(provider) ? "Kling Avatar" : undefined}
                        editor={<AvatarWorkbench
                          canSubmit={canSubmit}
                          prompt={prompt}
                          referenceImagesText={referenceImagesText}
                          referenceImageUrls={referenceImageUrls}
                          isDreamfaceTalkingAvatar={isDreamfaceTalkingAvatar}
                          isH3MaxAvatar={isH3MaxAvatar}
                          avatarScriptTooLong={avatarScriptTooLong}
                          avatarScriptMeta={avatarScriptMeta}
                          avatarDuration={avatarDuration}
                          avatarVoiceGender={avatarVoiceGender}
                          avatarVoiceOptions={avatarVoiceOptions}
                          ttsVoice={ttsVoice}
                          ttsLanguageCode={ttsLanguageCode}
                          ttsStability={ttsStability}
                          voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
                          languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
                          translate={st}
                          onPromptChange={setPrompt}
                          onReferenceImagesTextChange={setReferenceImagesText}
                          onReferenceFiles={handleReferenceFiles}
                          onFileError={() => setStatusText(st("studio.status.fileReadFailed"))}
                          onStartImageGuide={startAvatarImageGuide}
                          onAvatarVoiceGenderChange={setAvatarVoiceGender}
                          onTtsVoiceChange={setTtsVoice}
                          onTtsLanguageCodeChange={setTtsLanguageCode}
                          onTtsStabilityChange={setTtsStability}
                        />}
                        settings={avatarSettingsPanel}
                      />
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
                      <span className="ms-1.5 font-bold text-[#7868df]">· ≈{formatApproximateCreditValue(estCredits)}</span>
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
                  {provider === "dreamface-io-video" && !showVideoWorkbenchRedesign ? (
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
                          <span className="ms-1.5 font-bold text-[#7868df]">· ≈{formatApproximateCreditValue(estCredits)}</span>
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
                  ) : (showImageWorkbenchRedesign || showAudioWorkbenchRedesign || showAvatarWorkbenchRedesign) ? null : showImageWorkbenchRedesign ? (
                    <ImageSettings
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      utilityWorkflow={
                        showImageUtilityRedesign
                          ? imageWorkflow === "enhance-cleanup"
                            ? "enhance-cleanup"
                            : "background-remove"
                          : null
                      }
                      isImageToImage={showImageToImageRedesign}
                      isNanoBanana={isNanoBananaProvider(provider)}
                      isNanoBananaLite={isNanoBananaLiteProvider(provider)}
                      ratio={ratio}
                      ratioOptions={
                        provider === "nano-banana-pro" || provider === "nano-banana-2-lite"
                          ? NANO_ASPECT_RATIO_OPTIONS.filter((item) => !["4:1", "1:4", "8:1", "1:8"].includes(item))
                          : NANO_ASPECT_RATIO_OPTIONS
                      }
                      imageSize={imageSize}
                      imageSizePresets={IMAGE_SIZE_PRESETS}
                      outputFormat={outputFormat}
                      imageQuality={imageQuality}
                      editResolution={editResolution}
                      numInferenceSteps={numInferenceSteps}
                      guidanceScale={guidanceScale}
                      numImages={numImages}
                      seed={seed}
                      enableSafetyChecker={enableSafetyChecker}
                      acceleration={acceleration}
                      safetyTolerance={safetyTolerance}
                      limitGenerations={limitGenerations}
                      enableWebSearch={enableWebSearch}
                      thinkingLevel={thinkingLevel}
                      systemPrompt={systemPrompt}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      translate={st}
                      onProviderChange={applyProvider}
                      onRatioChange={(value) => {
                        trackEvent("studio_size_selected", { mode, provider, ratio: value }, accessToken);
                        setRatio(value);
                      }}
                      onImageSizeChange={(value) => {
                        trackEvent("studio_size_selected", {
                          mode,
                          provider,
                          image_size: value,
                          ratio: ratioFromImageSize(value)
                        }, accessToken);
                        setImageSize(value);
                        setRatio(ratioFromImageSize(value));
                      }}
                      onOutputFormatChange={setOutputFormat}
                      onImageQualityChange={setImageQuality}
                      onEditResolutionChange={setEditResolution}
                      onNumInferenceStepsChange={setNumInferenceSteps}
                      onGuidanceScaleChange={setGuidanceScale}
                      onNumImagesChange={setNumImages}
                      onSeedChange={setSeed}
                      onEnableSafetyCheckerChange={setEnableSafetyChecker}
                      onAccelerationChange={setAcceleration}
                      onSafetyToleranceChange={setSafetyTolerance}
                      onLimitGenerationsChange={setLimitGenerations}
                      onEnableWebSearchChange={setEnableWebSearch}
                      onThinkingLevelChange={setThinkingLevel}
                      onSystemPromptChange={setSystemPrompt}
                      onGenerate={handleGenerateClick}
                    />
                  ) : showAudioWorkbenchRedesign ? (
                    <AudioSettings
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      isElevenLabs={isElevenLabsAudio}
                      audioVoiceOptions={audioVoiceOptions}
                      languageOptions={ELEVENLABS_LANGUAGE_OPTIONS}
                      voiceGenderOptions={ELEVENLABS_VOICE_GENDER_OPTIONS}
                      ttsVoice={ttsVoice}
                      ttsLanguageCode={ttsLanguageCode}
                      ttsTimestamps={ttsTimestamps}
                      audioVoiceGender={audioVoiceGender}
                      ttsStability={ttsStability}
                      textNormalization={textNormalization}
                      textNormalizationOptions={TEXT_NORMALIZATION_OPTIONS}
                      musicSampleRate={musicSampleRate}
                      musicBitrate={musicBitrate}
                      musicFormat={musicFormat}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      translate={st}
                      onProviderChange={applyProvider}
                      onTtsVoiceChange={setTtsVoice}
                      onTtsLanguageCodeChange={setTtsLanguageCode}
                      onTtsTimestampsChange={setTtsTimestamps}
                      onAudioVoiceGenderChange={setAudioVoiceGender}
                      onTtsStabilityChange={setTtsStability}
                      onTextNormalizationChange={setTextNormalization}
                      onMusicSampleRateChange={setMusicSampleRate}
                      onMusicBitrateChange={setMusicBitrate}
                      onMusicFormatChange={setMusicFormat}
                      onGenerate={handleGenerateClick}
                    />
                  ) : showVideoWorkbenchRedesign ? (
                    <VideoSettings
                      workflow={configuredVideoWorkflow}
                      prompt={prompt}
                      referenceImageUrls={referenceImageUrls}
                      provider={provider}
                      providerOptions={modelPickerOptions}
                      duration={duration}
                      durationOptions={videoDurationOptions}
                      ratio={ratio}
                      ratioOptions={videoRatioOptions}
                      ratioDisabled={(provider === "kling-video" || provider === "minimax-h3-max-video") && activeWorkflow === "image-to-video"}
                      showResolutionControl={showVideoResolutionControl}
                      resolution={videoResolution}
                      resolutionOptions={videoResolutionOptions}
                      showAudioControl={showVideoAudioControl}
                      generateAudio={generateAudio}
                      seed={seed}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      recentTasks={tasks}
                      promptShowcases={videoPromptShowcases}
                      translate={st}
                      onPromptChange={setPrompt}
                      onReferenceClear={() => {
                        setReferenceImagesText("");
                        setReferenceImageFiles([]);
                      }}
                      onReferenceFiles={handleReferenceFiles}
                      onFileError={() => setStatusText(st("studio.status.fileReadFailed"))}
                      onProviderChange={applyProvider}
                      onDurationChange={setDuration}
                      onRatioChange={setRatio}
                      onResolutionChange={setVideoResolution}
                      onGenerateAudioChange={setGenerateAudio}
                      onSeedChange={setSeed}
                      onUsePromptShowcase={(showcase) => {
                        applyProvider(showcase.provider || "seedance-video", { duration: showcase.duration, ratio: showcase.ratio || "16:9", resolution: showcase.resolution });
                        setPrompt(showcase.prompt);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      onGenerate={handleGenerateClick}
                    />
                  ) : showAvatarWorkbenchRedesign ? (
                    <AvatarSettings
                      isDreamfaceTalkingAvatar={isDreamfaceTalkingAvatar}
                      isH3MaxAvatar={isH3MaxAvatar}
                      duration={duration}
                      durationOptions={videoDurationOptions}
                      resolution={videoResolution}
                      resolutionOptions={videoResolutionOptions}
                      ratio={ratio}
                      ratioOptions={videoRatioOptions}
                      automaticDuration={avatarDuration}
                      scriptTooLong={avatarScriptTooLong}
                      estimatedCredits={estCredits}
                      creditBalance={creditBalance}
                      generateDisabled={generateDisabled}
                      isSubmitting={isSubmitting}
                      isAuthenticated={Boolean(accessToken)}
                      translate={st}
                      onDurationChange={setDuration}
                      onResolutionChange={setVideoResolution}
                      onRatioChange={setRatio}
                      onGenerate={handleGenerateClick}
                    />
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
                  <ImagePromptGallery
                    translate={st}
                    onPromptCopied={(item) => {
                      trackEvent("gallery_prompt_copied", { gallery_item_id: item.id, category: item.category, surface: "studio" }, accessToken);
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
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
