import { GEMINI_TTS_PROVIDER } from "../../lib/gemini-tts";
import { HEYGEN_VOICE_PROVIDER } from "../../lib/heygen-voice";
import { GPT_IMAGE_EXAMPLE_PROMPTS,GPT_IMAGE_SIZES,isGptImageProvider,normalizeGptImageProvider } from "../../lib/gpt-image-models";
import { parseStudioReferenceImages } from "../../lib/studio-workspace-inputs";
import {
type StudioMode
} from "./studio-storage";
import {
VIDEO_EXAMPLE_PROMPTS,
VIDEO_EXAMPLE_SOURCE_IMAGES,
VIDEO_PROVIDER_META,
VIDEO_PROVIDERS_BY_WORKFLOW,
videoExampleSourceFor,
videoModelBadge,
videoModelConfig,
videoModelDefaultResolution,
videoModelGroup
} from "./video-models";

export type ImageWorkflow = "text-to-image" | "image-to-image" | "enhance-cleanup" | "background-remove";

export type VideoWorkflow = "avatar-video" | "text-to-video" | "image-to-video" | "reference-to-video";

export type AudioWorkflow = "text-to-audio" | "text-to-music";

export type StudioWorkflow = ImageWorkflow | VideoWorkflow | AudioWorkflow;

export const SESSION_CREDIT_BALANCE_KEY = "nova_session_credit_balance";

export const LAST_MODEL_STORAGE_PREFIX = "dreamface_studio_last_model_v1";

export const TEXT_IMAGE_PAGE_INNER_CLASS = "mx-auto w-full max-w-[1220px]";

export const STUDIO_SIGN_IN_URL = "/auth";

export const WORKSPACE_VIDEO_BASE_URL = "https://media.dreamface.io/ai_video";

export const YOUNG_KOREAN_WOMAN_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/young_Korean_woman.mp4`;

export const YOUNG_KOREAN_WOMAN_PROMPT = `Main subject: young Korean woman, early 20s, natural everyday appearance, faded charcoal-grey sleeveless crop top, loose high-waisted light-wash jeans, black canvas sneakers, black cord necklace, black wavy hair in a messy side ponytail with wispy bangs. Realistic skin texture, minimal makeup, warm and approachable personality. Maintain consistent identity, clothing, hairstyle, and appearance throughout the entire video.
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

export const EASTBOURNE_KOREAN_WOMAN_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/A_young_Korean_woman.mp4`;

export const EASTBOURNE_KOREAN_WOMAN_PROMPT = `Main Character:
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

export const SPORTS_BROADCAST_VIDEO_URL = `${WORKSPACE_VIDEO_BASE_URL}/16x9/Ultra-realistic_sports_broadcast.mp4`;

export const SPORTS_BROADCAST_PROMPT = `Ultra-realistic sports broadcast still of a glamorous woman sitting in a packed football stadium crowd during a night match, wearing a dark brown sleeveless high-neck satin top and black square earrings, shoulder-length light brown/blonde hair styled in soft waves. She is casually drinking from a tall blue aluminum can while holding a half-eaten cheeseburger in the other hand. Around her are fans in bright yellow and blue football jerseys and scarves, creating strong team-color contrast. The scene feels candid and cinematic, captured mid-game from a TV broadcast camera angle with shallow depth of field. Include realistic stadium seating, crowded audience atmosphere, broadcast overlay graphics in the top-left corner showing a live football score and match timer, and a sports network watermark in the top-right. Natural arena lighting, detailed skin texture, sharp focus on the woman, slightly blurred background crowd, authentic live sports broadcast aesthetic, 16:9 composition.`;

export const KLING_AVATAR_DEFAULT_SCRIPT =
  "Welcome to Cat Facts, where we explore the fascinating world of our feline friends. Did you know that cats spend 70% of their lives sleeping, which means a three-year-old cat has only been awake for about nine months of its life?";

export const KLING_AVATAR_DEFAULT_IMAGE_URL = "https://storage.googleapis.com/falserverless/example_inputs/kling_ai_avatar_input.jpg";

export const KLING_AVATAR_PREVIEW_VIDEO_URL = "https://v3.fal.media/files/penguin/ln3x7H1p1jL0Pwo7675NI_output.mp4";

export const MINIMAX_H3_MAX_AVATAR_PROMPT = "I heard something. MiniMax H3 Max is here?.. Is that true?";

export const MINIMAX_H3_MAX_TURBO_AVATAR_PROMPT = "H3 Max Turbo. Faster than waves.";

export const IMAGE_SIZE_PRESETS = [
  { value: "default_4_3", label: "Default 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "square_hd", label: "Square HD", dimensions: "1024 x 1024", width: 1024, height: 1024 },
  { value: "square", label: "Square", dimensions: "512 x 512", width: 512, height: 512 },
  { value: "portrait_4_3", label: "Portrait 3:4", dimensions: "768 x 1024", width: 768, height: 1024 },
  { value: "portrait_16_9", label: "Portrait 9:16", dimensions: "576 x 1024", width: 576, height: 1024 },
  { value: "landscape_4_3", label: "Landscape 4:3", dimensions: "1024 x 768", width: 1024, height: 768 },
  { value: "landscape_16_9", label: "Landscape 16:9", dimensions: "1024 x 576", width: 1024, height: 576 }
];

export const DEFAULT_VIDEO_DURATION = "5s";

export const NANO_ASPECT_RATIO_OPTIONS = ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8"];

export const ELEVENLABS_VOICE_META = [
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

export const ELEVENLABS_VOICES: string[] = ELEVENLABS_VOICE_META.map((voice) => voice.name);

export const ELEVENLABS_VOICE_GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" }
] as const;

export const ELEVENLABS_LANGUAGE_OPTIONS = [
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

export const TEXT_NORMALIZATION_OPTIONS = [
  { value: "auto", label: "Auto normalize" },
  { value: "on", label: "Normalize on" },
  { value: "off", label: "Normalize off" }
];

export const PROVIDER_META: Record<
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
    label: "GPT Image 2.6 Flare",
    shortLabel: "GPT Image 2.6 Flare",
    speed: "Fast",
    quality: "Highest text fidelity",
    bestFor: "Ads, infographics, product visuals, readable typography"
  },
  "gpt-image-2.6-sunburst": {
    label: "GPT Image 2.6 Sunburst",
    shortLabel: "GPT Image 2.6 Sunburst",
    speed: "Slower",
    quality: "Pro",
    bestFor: "Precision editing, intricate layouts and typography"
  },
  "nano-banana-image": {
    label: "Nano Banana 2.1",
    shortLabel: "Nano Banana 2.1",
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
  [GEMINI_TTS_PROVIDER]: { label: "Gemini 3.8 Flash TTS", shortLabel: "Gemini Flash TTS", speed: "Fast", quality: "Expressive speech", bestFor: "30 voices, delivery instructions and two-speaker dialogue in WAV" },
  [HEYGEN_VOICE_PROVIDER]: {label:"HeyGen Voice Turbo",shortLabel:"HeyGen Voice Turbo",speed:"Fast",quality:"Natural speech",bestFor:"24 voices, 39 languages and voice cloning · 44.1 kHz WAV"},
  "elevenlabs-tts": {
    label: "ElevenLabs Eleven v4 Turbo",
    shortLabel: "Eleven v4 Turbo",
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

export const WORKFLOW_META: Record<
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
    providers: ["chatgpt-image", "gpt-image-2.6-sunburst", "nano-banana-pro", "nano-banana-image", "nano-banana-2-lite", "nano-banana-lite", "flux-dev", "flux-image"]
  },
  "image-to-image": {
    label: "Image to Image",
    description: "Upload references and edit, restyle, or extend them.",
    recommendedProvider: "nano-banana-image",
    providers: ["chatgpt-image", "gpt-image-2.6-sunburst", "nano-banana-image", "nano-banana-lite", "nano-banana-pro"]
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
    recommendedProvider: "heygen-video",
    providers: ["heygen-video", "minimax-h3-max-turbo-video", "minimax-h3-max-video", "kling-avatar-standard", "kling-avatar-pro"]
  },
  "text-to-video": {
    label: "Text to Video",
    description: "Turn a written scene into a short video.",
    recommendedProvider: "heygen-video",
    providers: VIDEO_PROVIDERS_BY_WORKFLOW["text-to-video"]
  },
  "image-to-video": {
    label: "Image to Video",
    description: "Animate a reference image into a short video.",
    recommendedProvider: "heygen-video",
    providers: VIDEO_PROVIDERS_BY_WORKFLOW["image-to-video"]
  },
  "reference-to-video": {
    label: "Reference Video", description: "Create a new video using a reference video and optional subject images.",
    recommendedProvider: "heygen-video", providers: VIDEO_PROVIDERS_BY_WORKFLOW["reference-to-video"]
  },
  "text-to-audio": {
    label: "Text to Audio",
    description: "Turn a written script into an AI voiceover.",
    recommendedProvider: GEMINI_TTS_PROVIDER,
    providers: [GEMINI_TTS_PROVIDER, HEYGEN_VOICE_PROVIDER, "elevenlabs-tts"]
  },
  "text-to-music": {
    label: "AI Music",
    description: "Create instrumental music or a complete song.",
    recommendedProvider: "minimax-music-2.6",
    providers: ["minimax-music-2.6"]
  }
};

export function lastModelStorageKey(workflow: StudioWorkflow) {
  // Introduce updated defaults once, then continue remembering explicit choices.
  return `${LAST_MODEL_STORAGE_PREFIX}:${workflow}${["text-to-video", "image-to-video", "text-to-audio"].includes(workflow) ? ":v2" : ""}`;
}

export function readRememberedModel(workflow: StudioWorkflow) {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(lastModelStorageKey(workflow));
    const remembered = stored ? normalizeGptImageProvider(stored) : null;
    return remembered && WORKFLOW_META[workflow].providers.includes(remembered) ? remembered : null;
  } catch {
    return null;
  }
}

export function modelPickerGroup(mode: StudioMode, workflow: StudioWorkflow, provider: string, recommendedProvider: string) {
  if (provider === recommendedProvider) return "studio.modelPicker.group.recommended";
  if (mode === "video") {
    const group = videoModelGroup(provider);
    if (group === "premium") return "studio.modelPicker.group.premium";
    if (group === "betterQuality") return "studio.modelPicker.group.better";
    return "studio.modelPicker.group.fast";
  }
  if (mode === "image") {
    if (isGptImageProvider(provider) || provider === "nano-banana-pro") return "studio.modelPicker.group.highQuality";
    return workflow === "image-to-image" ? "studio.modelPicker.group.editing" : "studio.modelPicker.group.efficient";
  }
  if (mode === "avatar") return provider === "kling-avatar-pro" ? "studio.modelPicker.group.premiumAvatar" : "studio.modelPicker.group.avatar";
  return "studio.modelPicker.group.available";
}

export function modelPickerBadge(mode: StudioMode, provider: string, recommendedProvider: string) {
  if (provider === recommendedProvider) return "studio.modelSelect.badge.recommended";
  if (mode === "video") {
    const badge = videoModelBadge(provider);
    if (badge === "free") return "studio.modelSelect.badge.free";
    if (badge === "pro") return "studio.modelSelect.badge.pro";
    if (badge === "premium") return "studio.modelSelect.badge.premium";
  }
  if (provider === "gpt-image-2.6-sunburst" || provider === "kling-avatar-pro" || provider === "nano-banana-pro") return "studio.modelSelect.badge.pro";
  return undefined;
}

export function modelPickerSpeedKey(speed: string) {
  const normalized = speed.toLowerCase();
  if (normalized === "fastest") return "studio.modelPicker.speed.fastest";
  if (normalized === "fast") return "studio.modelPicker.speed.fast";
  if (normalized === "balanced") return "studio.modelPicker.speed.balanced";
  if (normalized === "medium") return "studio.modelPicker.speed.medium";
  if (normalized === "slower") return "studio.modelPicker.speed.slower";
  return "studio.modelPicker.speed.standard";
}

export function h3PerformanceNote(provider: string, workflow: StudioWorkflow) {
  const isTextToVideo = workflow === "text-to-video";
  if (provider === "minimax-h3-max-turbo-video") {
    return isTextToVideo ? "Just 1.55 seconds" : "Just 1.68 seconds";
  }
  if (provider === "minimax-h3-max-video") {
    return isTextToVideo ? "Just 2.53 seconds" : "Just 2.77 seconds";
  }
  return undefined;
}

export const PROMPT_IMPROVE_TEXT =
  "Optimize this prompt for a professional AI-generated image. Improve detail, lighting, composition, and overall quality while preserving intent.";

export function providerLabel(provider?: string) {
  if (provider === "mischief-video") return "TBC mischief 1";
  return provider ? PROVIDER_META[provider]?.label || provider : "Auto routed";
}

export function studioProjectHref(taskId?: string) {
  return `/studio?view=projects${taskId ? `&taskId=${encodeURIComponent(taskId)}` : ""}`;
}

export function getImageSizePreset(value: string) {
  const preset=IMAGE_SIZE_PRESETS.find((preset) => preset.value === value)||GPT_IMAGE_SIZES.find(preset=>preset.value===value)||IMAGE_SIZE_PRESETS[0];
  return {...preset,dimensions:`${preset.width} x ${preset.height}`};
}

export function ratioFromImageSize(value: string) {
  if(value==="auto"||value==="custom")return "auto";
  const preset = getImageSizePreset(value);
  const ratio = preset.width / preset.height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  if (ratio > 1.5) return "16:9";
  if (ratio > 1.2) return "4:3";
  if (ratio < 0.7) return "9:16";
  return "3:4";
}

export const MINIMAX_MUSIC_DEFAULT_PROMPT = "City Pop, 80s retro, groovy synth bass, warm female vocal, 104 BPM, nostalgic urban night";

export function defaultPromptForProvider(provider: string, workflow?: StudioWorkflow, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  if (workflow === "avatar-video" || isAvatarProvider(provider)) return "";
  if (provider === "minimax-music-2.6") {
    return localizedMusicPrompt;
  }
  if ((provider === "minimax-h3-max-video" || provider === "minimax-h3-max-turbo-video") && (workflow === "text-to-video" || workflow === "image-to-video")) {
    return "";
  }
  return "";
}

export function isSamplePrompt(value: string) {
  return [
    YOUNG_KOREAN_WOMAN_PROMPT,
    EASTBOURNE_KOREAN_WOMAN_PROMPT,
    SPORTS_BROADCAST_PROMPT,
    ...VIDEO_EXAMPLE_PROMPTS
  ].includes(value);
}

export function modelSampleReferenceForProvider(provider: string) {
  return videoExampleSourceFor(provider);
}

export function isModelSampleReference(value: string) {
  return VIDEO_EXAMPLE_SOURCE_IMAGES.includes(value.trim());
}

export function isProviderDefaultPrompt(value: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  return GPT_IMAGE_EXAMPLE_PROMPTS.includes(value) || isSamplePrompt(value) || value === MINIMAX_H3_MAX_AVATAR_PROMPT || value === MINIMAX_H3_MAX_TURBO_AVATAR_PROMPT || value === KLING_AVATAR_DEFAULT_SCRIPT || value === MINIMAX_MUSIC_DEFAULT_PROMPT || value === localizedMusicPrompt;
}

export function promptForProviderChange(current: string, nextDefaultPrompt: string, localizedMusicPrompt = MINIMAX_MUSIC_DEFAULT_PROMPT) {
  if (!current.trim() || isProviderDefaultPrompt(current, localizedMusicPrompt)) {
    return nextDefaultPrompt;
  }
  return current;
}

export function defaultImageSizeForProvider(provider: string) {
  if(provider === "gpt-image-2.6-sunburst") return "landscape_16_9";
  if (provider === "flux-image" || provider === "flux-dev") return "landscape_16_9";
  if (isNanoBananaProvider(provider)) return "default_4_3";
  return "default_4_3";
}

export function isNanoBananaProvider(provider: string) {
  return provider === "nano-banana-image" ||
    provider === "nano-banana-pro" ||
    provider === "nano-banana-edit" ||
    provider === "nano-banana-lite" ||
    provider === "nano-banana-2-lite";
}

export function isNanoBananaLiteProvider(provider: string) {
  return provider === "nano-banana-lite" || provider === "nano-banana-2-lite";
}

export function isNanoBananaImageToImageProvider(provider: string) {
  return provider === "nano-banana-image" ||
    provider === "nano-banana-pro" ||
    provider === "nano-banana-edit" ||
    provider === "nano-banana-lite";
}

export function defaultImageRatioForProvider(provider: string, imageSize: string) {
  if (provider === "nano-banana-pro" || provider === "nano-banana-2-lite") return "1:1";
  if (isNanoBananaProvider(provider) || provider === "topaz-image" || provider === "bria-background-remove") return "auto";
  return ratioFromImageSize(imageSize);
}

export function defaultVideoResolutionForProvider(provider: string) {
  return videoModelDefaultResolution(provider);
}

export function isAvatarProvider(provider: string) {
  return provider === "kling-avatar-standard" || provider === "kling-avatar-pro";
}

export function isH3MaxProvider(provider: string) {
  return provider === "minimax-h3-max-video" || provider === "minimax-h3-max-turbo-video";
}

export function isH3VideoProvider(provider: string) {
  return provider === "minimax-h3-max-video" || provider === "minimax-h3-max-turbo-video";
}

export function stripAvatarDefaultReferences(value: string) {
  return parseStudioReferenceImages(value)
    .filter((url) => url && url !== KLING_AVATAR_DEFAULT_IMAGE_URL && !VIDEO_EXAMPLE_SOURCE_IMAGES.includes(url))
    .join("\n");
}

export function estimateAvatarScriptSeconds(text: string) {
  if (text.trim() === KLING_AVATAR_DEFAULT_SCRIPT) return AVATAR_MAX_SECONDS - AVATAR_KLING_BUFFER_SECONDS;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  const cjkCount = (cleaned.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latinWords = (cleaned.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || []).length;
  const nonSpaceCount = cleaned.replace(/\s/g, "").length;
  return Math.max(3, Math.ceil(Math.max(cjkCount / 4.2, latinWords / 2.55, nonSpaceCount / 12)));
}

export const AVATAR_MAX_SECONDS = 15;

export const AVATAR_KLING_BUFFER_SECONDS = 2;

export function avatarDurationFromPrompt(text: string) {
  const speechSeconds = estimateAvatarScriptSeconds(text);
  const outputSeconds = Math.min(AVATAR_MAX_SECONDS, Math.max(3, speechSeconds + AVATAR_KLING_BUFFER_SECONDS));
  return `${outputSeconds}s`;
}

export function modeForPricing(mode: StudioMode): "image" | "video" | "audio" {
  return mode === "avatar" ? "video" : mode;
}

export function isProbablyUrl(value: string) {
  if (/^data:audio\//i.test(value.trim())) return true;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function shortInputValue(value: string) {
  if (!value.trim()) return "";
  if (value.startsWith("data:")) return "Uploaded local file";
  return value;
}

export function isProviderAllowedForMode(provider: string | null, mode: StudioMode) {
  if (!provider) return false;
  provider=normalizeGptImageProvider(provider);

  if (mode === "image") return ["gpt-image-2.6-sunburst", "chatgpt-image", "nano-banana-image", "nano-banana-pro", "nano-banana-lite", "nano-banana-2-lite", "flux-image", "flux-dev", "nano-banana-edit", "recraft-image", "topaz-image", "bria-background-remove"].includes(provider);
  if (mode === "audio") return [GEMINI_TTS_PROVIDER, HEYGEN_VOICE_PROVIDER, "minimax-music-2.6", "elevenlabs-tts"].includes(provider);
  if (mode === "avatar") return ["heygen-video", "minimax-h3-max-turbo-video", "minimax-h3-max-video", "kling-avatar-standard", "kling-avatar-pro"].includes(provider);
  return Boolean(videoModelConfig(provider)) || isAvatarProvider(provider);
}

export function workflowForMode(mode: StudioMode, workflow: string | null): StudioWorkflow {
  if (mode === "audio") return workflow === "text-to-music" ? "text-to-music" : "text-to-audio";
  if (mode === "avatar") return "avatar-video";
  if (mode === "image") {
    if (workflow === "image-to-image" || workflow === "enhance-cleanup" || workflow === "background-remove") return workflow;
    return "text-to-image";
  }
  if (workflow === "avatar-video") return "avatar-video";
  return workflow === "reference-to-video" ? "reference-to-video" : workflow === "image-to-video" ? "image-to-video" : "text-to-video";
}

export function providerForWorkflow(workflow: StudioWorkflow, requestedProvider?: string | null) {
  if(requestedProvider) requestedProvider=normalizeGptImageProvider(requestedProvider);
  const meta = WORKFLOW_META[workflow];
  if (requestedProvider && meta.providers.includes(requestedProvider)) return requestedProvider;
  return meta.recommendedProvider;
}

export function frontendPollAttempts(mode: "image" | "video" | "audio", provider: string) {
  if (mode === "video" || isAvatarProvider(provider)) return 240;
  return 100;
}
