export type StudioVideoWorkflow = "text-to-video" | "image-to-video";
export type VideoModelGroup = "freeDraft" | "betterQuality" | "premium";
export type VideoModelBadge = "free" | "recommended" | "pro" | "premium";

export type VideoExampleSettings = {
  duration: string;
  ratio: string;
  resolution?: string;
  generateAudio?: boolean;
};

export type VideoExample = {
  provider: string;
  workflow: StudioVideoWorkflow;
  modelLabel: string;
  prompts: string[];
  videoUrl: string;
  posterUrl: string;
  sourceImageUrl?: string;
  sourceImageShape?: "landscape" | "portrait";
  videoShape?: "landscape" | "portrait";
  videoFit?: "cover" | "contain";
  badgeParts: string[];
  badgeHasAudio?: boolean;
  badgeHasResolutionLabel?: boolean;
  settings: VideoExampleSettings;
};

export type VideoProviderMeta = {
  label: string;
  shortLabel: string;
  speed: string;
  quality: string;
  bestFor: string;
};

type VideoWorkflowCapabilities = {
  ratios: readonly string[];
};

export type VideoModelConfig = {
  id: string;
  meta: VideoProviderMeta;
  group: VideoModelGroup;
  badge?: VideoModelBadge;
  workflows: Partial<Record<StudioVideoWorkflow, VideoWorkflowCapabilities>>;
  durations: readonly string[];
  resolutions: readonly string[];
  defaultDuration: string;
  defaultResolution: string;
  showResolutionControl?: boolean;
  showAudioControl?: boolean;
  examples?: Partial<Record<StudioVideoWorkflow, VideoExample>>;
};

const VIDEO_DURATION_OPTIONS = ["3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s", "11s", "12s", "13s", "14s", "15s"] as const;
const DEFAULT_VIDEO_RATIOS = ["16:9", "9:16", "1:1"] as const;
const DREAMFACE_IO_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
const SEEDANCE_RATIOS = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
const HAPPY_HORSE_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21", "5:4", "4:5"] as const;
const GROK_TEXT_RATIOS = ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"] as const;
const GROK_IMAGE_RATIOS = ["auto", ...GROK_TEXT_RATIOS] as const;

const GEMINI_TEXT_PROMPT = `A high-fashion model stands in a stark concrete gallery space, wearing a sculptural avant-garde garment with exaggerated architectural shoulders, asymmetric matte-black and oxblood draping, and structured folds that catch the light like origami. She moves through slow, deliberate poses while the camera circles her in a slow orbital dolly, then cuts to a locked-off low-angle hero shot. Hard directional light creates deep shadows and sharp highlights, with a single rim light separating her from a void-black background. High-contrast, desaturated editorial fashion-film aesthetic with one deep-red accent. Include subtle fabric movement and synchronized gallery ambience.`;
const GEMINI_IMAGE_PROMPT = `The old woman laughs warmly, looks toward the camera, and says, "I love my grandchildren." Preserve her identity and the natural window light. Add subtle head and shoulder movement, realistic facial motion, and synchronized room ambience.`;
const GEMINI_IMAGE_URL = "https://v3b.fal.media/files/b/0aa064f8/Ns1NaGtZjYY1FM8790JSo_rY21Z0TByUVwyJt0vYr74_GK97jl1Q.jpg";

const GROK_TEXT_PROMPT = "Anime schoolgirl bursting out of house door, cherry blossoms blowing, morning light, speed lines indicating rush, chibi-ready expressions, classic shojo aesthetic, vibrant colors";
const GROK_IMAGE_PROMPT = "Medieval knight in ornate armor walking through a mystical forest, bioluminescent plants pulsing with light, ancient stone ruins overgrown with glowing vines, over-the-shoulder camera, dark fantasy aesthetic, volumetric fog and Lumen lighting";
const GROK_IMAGE_URL = "https://v3b.fal.media/files/b/0a8b90e0/BFLE9VDlZqsryU-UA3BoD_image_004.png";

const SEEDANCE_MINI_TEXT_PROMPT = "An octopus finds a football in the ocean and excitedly calls its octopus friends to come and play. Cut scene to an octopus football game under the sea.";
const SEEDANCE_MINI_IMAGE_PROMPT = "A dreamy scene, a mother teaches her daughter how to dance";
const SEEDANCE_MINI_IMAGE_URL = "https://v3b.fal.media/files/b/0a9f9237/8suPAQC2A91XnQqbY63oj_141_edgar-degas-mary-cassatt.png";

const MINIMAX_H3_MAX_TEXT_PROMPT = "An aging warrior-monk in scorched ceremonial armor, a split ceramic mask and a humming prayer-band on his forearm + 0–4s: climbs silently along a cliffside terrace as insect-like surveyor drones comb the sun-bleached ruins, standing alone under as the camera rises over the ruined monastery. Sun-blasted post-apocalyptic sci-fi action, dust, heat haze, practical debris, sweeping crane tracking, silence broken only by wind.";
const MINIMAX_H3_MAX_IMAGE_PROMPT = "She is saying \"I heard something. MiniMax H3 Max is here?.. Is that true?\"";
const MINIMAX_H3_MAX_IMAGE_URL = "https://v3b.fal.media/files/b/0aa7ec53/dEJsS9nnNZ-1emO63isC8_50zjcHYr.png";
const MINIMAX_H3_MAX_TEXT_VIDEO_URL = "https://v3b.fal.media/files/b/0aa7ecbd/cJvT63jq0mDi8-E8fYXHq_minimax-h3.mp4";
const MINIMAX_H3_MAX_IMAGE_VIDEO_URL = "https://v3b.fal.media/files/b/0aa7ec74/bNpa9-5B0ZKqsrGfdqxZt_minimax-h3.mp4";
const MINIMAX_H3_MAX_TEXT_POSTER_URL = "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0aa7ecbd%2FcJvT63jq0mDi8-E8fYXHq_minimax-h3.mp4/tr:so-0,w-1024,q-80/cJvT63jq0mDi8-E8fYXHq_minimax-h3.webp";
const MINIMAX_H3_MAX_IMAGE_POSTER_URL = "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0aa7ec74%2FbNpa9-5B0ZKqsrGfdqxZt_minimax-h3.mp4/tr:so-0,w-1024,q-80/bNpa9-5B0ZKqsrGfdqxZt_minimax-h3.webp";

const HAPPY_HORSE_TEXT_PROMPT = `Medium shot of a professional news anchor at a sleek desk in a modern broadcast studio, cool blue lighting, softly glowing screens behind. 0-5s: He looks into the camera and says in a clear measured voice, "Good evening. Tonight, a breakthrough that could change how millions of us work." 5-10s: He turns slightly toward a second camera, "We'll have the full story, and what it means for you, right after this." Precise lip-sync, subtle studio room tone, crisp broadcast quality, shallow depth of field.`;
const HAPPY_HORSE_IMAGE_PROMPT = `character1 in a cozy dim room strums once, looks up and says in English: "This next one I wrote at three in the morning." Warm practical light, intimate, cinematic, precise lip-sync.`;
const HAPPY_HORSE_IMAGE_URL = "https://v3b.fal.media/files/b/0a9eaaaa/A5Z-Bbuk0cZondKU0Cksq_eGkoZngK.png";

const KLING_TEXT_PROMPT = "Close-up of glowing fireflies dancing in a dark forest at twilight. Soft bioluminescent particles float through the air. Shallow depth of field, bokeh lights in background. Magical atmosphere, gentle movement.";
const KLING_IMAGE_PROMPT = "Slow cinematic push-in through the empty ancient temple. Fog drifts lazily through the valley below. Golden light catches dust particles floating between stone pillars. Wind sways hanging moss and vines on crumbling archways. A flock of birds takes flight in the distance. Atmospheric, still, haunting. No people.";
const KLING_ELEMENT_PROMPT = "@Element1 walks slowly into frame from the left, stepping onto the stone path toward the cliff edge. His cloak billows in the wind. Camera follows him from behind, then he stops at the edge and slowly turns, revealing his scarred face. Golden hour light hits his features. Cinematic, dramatic, anamorphic lens flare.";
const KLING_IMAGE_URL = "https://v3b.fal.media/files/b/0a92706d/h2V27DeUiMH1Pa6lgQ5F4_Frtd4z3L.png";

const VEO_TEXT_PROMPT = `Two person street interview in New York City.
Sample Dialogue:
Host: "Did you hear the news?"
Person: "Yes! Veo 3.1 is now available on fal. If you want to see it, go check their website."`;

const SEEDANCE_TEXT_PROMPT = `Ultra-detailed 4K wildlife macro video of a Bengal tiger resting in golden morning light. The camera begins inches from the tiger’s striped fur, revealing individual hairs, subtle color variation, dust particles, and tiny movements from breathing. Slowly rack focus from the fur texture to the tiger’s amber eye in the background.

Camera: 100mm macro lens, slow lateral slide, shallow depth of field, natural handheld micro-movement.
Lighting: Warm sunrise light, soft shadows, realistic highlights on fur.
Motion: Fur shifts slightly with breathing, whiskers twitch, eye blinks once near the end.
Style: BBC wildlife documentary, photorealistic, no CGI look.
Constraints: No distorted face, no extra eyes, no cartoon fur, no text, no watermark.`;
const SEEDANCE_IMAGE_PROMPT = "Ultra high-end commercial product shot, photorealistic, 8K, cinematic lighting, macro detail, shallow depth of field, premium advertising aesthetic, VR headset suspended by invisible wires against a deep navy backdrop, slow vertical tilt down across the visor, magenta and cyan accent lighting, studio-grade color grading, immaculate reflections, subtle camera motion";
const SEEDANCE_IMAGE_URL = "https://v3b.fal.media/files/b/0a95971b/bFYVNRi647e2hEFdbeU2Z_jMhj1ueK.jpg";

export const VIDEO_MODEL_CONFIGS: Record<string, VideoModelConfig> = {
  "minimax-h3-max-video": {
    id: "minimax-h3-max-video",
    meta: { label: "MiniMax H3 Max", shortLabel: "H3 Max", speed: "Fast", quality: "Frontier value", bestFor: "Affordable frontier text-to-video and image-to-video with strong prompt adherence and aesthetics" },
    group: "freeDraft",
    badge: "recommended",
    workflows: {
      "text-to-video": { ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] },
      "image-to-video": { ratios: ["source"] }
    },
    durations: VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 5),
    resolutions: ["480p", "768p"],
    defaultDuration: "5s",
    defaultResolution: "480p",
    showResolutionControl: true,
    examples: {
      "text-to-video": { provider: "minimax-h3-max-video", workflow: "text-to-video", modelLabel: "MiniMax H3 Max", prompts: [MINIMAX_H3_MAX_TEXT_PROMPT], videoUrl: MINIMAX_H3_MAX_TEXT_VIDEO_URL, posterUrl: MINIMAX_H3_MAX_TEXT_POSTER_URL, badgeParts: ["480p"], settings: { duration: "5s", ratio: "16:9", resolution: "480p" } },
      "image-to-video": { provider: "minimax-h3-max-video", workflow: "image-to-video", modelLabel: "MiniMax H3 Max", prompts: [MINIMAX_H3_MAX_IMAGE_PROMPT], videoUrl: MINIMAX_H3_MAX_IMAGE_VIDEO_URL, posterUrl: MINIMAX_H3_MAX_IMAGE_POSTER_URL, sourceImageUrl: MINIMAX_H3_MAX_IMAGE_URL, sourceImageShape: "landscape", videoFit: "contain", badgeParts: ["480p"], settings: { duration: "5s", ratio: "source", resolution: "480p" } }
    }
  },
  "dreamface-io-video": {
    id: "dreamface-io-video",
    meta: { label: "DreamFace IO", shortLabel: "DreamFace IO", speed: "Fast", quality: "Video 2.5 Flash", bestFor: "Fast 720p text-to-video and image-to-video creation with a free daily allowance" },
    group: "freeDraft",
    badge: "free",
    workflows: { "text-to-video": { ratios: DREAMFACE_IO_RATIOS }, "image-to-video": { ratios: DREAMFACE_IO_RATIOS } },
    durations: ["5s", "10s"],
    resolutions: ["720p"],
    defaultDuration: "5s",
    defaultResolution: "720p",
    showResolutionControl: true
  },
  "grok-video": {
    id: "grok-video",
    meta: { label: "Grok Imagine Video", shortLabel: "Grok", speed: "Fast", quality: "Expressive", bestFor: "Fast text-to-video and image-to-video ideas with 480p/720p output" },
    group: "betterQuality",
    workflows: { "text-to-video": { ratios: GROK_TEXT_RATIOS }, "image-to-video": { ratios: GROK_IMAGE_RATIOS } },
    durations: ["1s", "2s", ...VIDEO_DURATION_OPTIONS],
    resolutions: ["480p", "720p"],
    defaultDuration: "5s",
    defaultResolution: "480p",
    showResolutionControl: true,
    examples: {
      "text-to-video": { provider: "grok-video", workflow: "text-to-video", modelLabel: "Grok Imagine Video", prompts: [GROK_TEXT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a8b90e4/RUAbFYlssdqnbjNLmE8qP_IX7BNYGP.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a8b90e4%2FRUAbFYlssdqnbjNLmE8qP_IX7BNYGP.mp4/tr:so-0,w-1024,q-80/RUAbFYlssdqnbjNLmE8qP_IX7BNYGP.webp", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "6s", ratio: "16:9", resolution: "720p" } },
      "image-to-video": { provider: "grok-video", workflow: "image-to-video", modelLabel: "Grok Imagine Video", prompts: [GROK_IMAGE_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a8b90e0/0Ci1dviuSnEyUZzBUq-_5_nu7MrAAa.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a8b90e0%2F0Ci1dviuSnEyUZzBUq-_5_nu7MrAAa.mp4/tr:so-0,w-1024,q-80/0Ci1dviuSnEyUZzBUq-_5_nu7MrAAa.webp", sourceImageUrl: GROK_IMAGE_URL, sourceImageShape: "landscape", videoFit: "contain", badgeParts: ["6s", "720p"], badgeHasAudio: true, settings: { duration: "6s", ratio: "auto", resolution: "720p" } }
    }
  },
  "gemini-omni-flash-video": {
    id: "gemini-omni-flash-video",
    meta: { label: "Gemini Omni Flash", shortLabel: "Gemini Omni", speed: "Fast", quality: "Synchronized audio", bestFor: "Fast 720p text-to-video and image-to-video with motion, speech, and ambient audio" },
    group: "betterQuality",
    workflows: { "text-to-video": { ratios: ["16:9", "9:16"] }, "image-to-video": { ratios: ["16:9", "9:16"] } },
    durations: VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) <= 10),
    resolutions: ["720p"],
    defaultDuration: "8s",
    defaultResolution: "720p",
    examples: {
      "text-to-video": { provider: "gemini-omni-flash-video", workflow: "text-to-video", modelLabel: "Gemini Omni Flash", prompts: [GEMINI_TEXT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0aa06549/SqtFBfF9UAqFt1vfdpHIN_a7c736c69b4f4c0486dbef648a7fa496.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0aa06549%2FSqtFBfF9UAqFt1vfdpHIN_a7c736c69b4f4c0486dbef648a7fa496.mp4/tr:so-0,w-1024,q-80/SqtFBfF9UAqFt1vfdpHIN_a7c736c69b4f4c0486dbef648a7fa496.webp", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "8s", ratio: "16:9" } },
      "image-to-video": { provider: "gemini-omni-flash-video", workflow: "image-to-video", modelLabel: "Gemini Omni Flash", prompts: [GEMINI_IMAGE_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0aa064fd/Vzo9a0G9fkd2RRZwAQDx5_aa98f069192f4c9c9d59a16962d0929d.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0aa064fd%2FVzo9a0G9fkd2RRZwAQDx5_aa98f069192f4c9c9d59a16962d0929d.mp4/tr:so-0,w-1024,q-80/Vzo9a0G9fkd2RRZwAQDx5_aa98f069192f4c9c9d59a16962d0929d.webp", sourceImageUrl: GEMINI_IMAGE_URL, sourceImageShape: "landscape", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "8s", ratio: "16:9" } }
    }
  },
  "seedance-mini-video": {
    id: "seedance-mini-video",
    meta: { label: "Seedance 2.0 Mini", shortLabel: "Seedance Mini", speed: "Fast", quality: "Lower-cost motion", bestFor: "Faster, cheaper text-to-video and image-to-video at 480p or 720p" },
    group: "betterQuality",
    badge: "recommended",
    workflows: { "text-to-video": { ratios: SEEDANCE_RATIOS }, "image-to-video": { ratios: SEEDANCE_RATIOS } },
    durations: VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 4),
    resolutions: ["480p", "720p"],
    defaultDuration: "5s",
    defaultResolution: "480p",
    showResolutionControl: true,
    showAudioControl: true,
    examples: {
      "text-to-video": { provider: "seedance-mini-video", workflow: "text-to-video", modelLabel: "Seedance 2.0 Mini", prompts: [SEEDANCE_MINI_TEXT_PROMPT], videoUrl: "https://storage.googleapis.com/falserverless/example_outputs/bytedance/seedance_2/output.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fstorage.googleapis.com%2Ffalserverless%2Fexample_outputs%2Fbytedance%2Fseedance_2%2Foutput.mp4/tr:so-0,w-1024,q-80/output.webp", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "12s", ratio: "16:9", resolution: "720p", generateAudio: true } },
      "image-to-video": { provider: "seedance-mini-video", workflow: "image-to-video", modelLabel: "Seedance 2.0 Mini", prompts: [SEEDANCE_MINI_IMAGE_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a9f9246/qy5wvmB3-oP9hk-2PmI7U_video.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a9f9246%2Fqy5wvmB3-oP9hk-2PmI7U_video.mp4/tr:so-0,w-1024,q-80/qy5wvmB3-oP9hk-2PmI7U_video.webp", sourceImageUrl: SEEDANCE_MINI_IMAGE_URL, sourceImageShape: "landscape", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "11s", ratio: "16:9", resolution: "720p", generateAudio: true } }
    }
  },
  "happy-horse-video": {
    id: "happy-horse-video",
    meta: { label: "Happy Horse 1.1", shortLabel: "Happy Horse", speed: "Medium", quality: "Native audio", bestFor: "Alibaba video with text-to-video, image-to-video, 720p/1080p, and native audio" },
    group: "betterQuality",
    workflows: { "text-to-video": { ratios: HAPPY_HORSE_RATIOS }, "image-to-video": { ratios: HAPPY_HORSE_RATIOS } },
    durations: VIDEO_DURATION_OPTIONS,
    resolutions: ["720p", "1080p"],
    defaultDuration: "5s",
    defaultResolution: "720p",
    showResolutionControl: true,
    examples: {
      "text-to-video": { provider: "happy-horse-video", workflow: "text-to-video", modelLabel: "Happy Horse 1.1", prompts: [HAPPY_HORSE_TEXT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a9f3a12/VUE_7oBMkmCcKNawH0G_a_922UfRwW.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a9f3a12%2FVUE_7oBMkmCcKNawH0G_a_922UfRwW.mp4/tr:so-0,w-1024,q-80/VUE_7oBMkmCcKNawH0G_a_922UfRwW.webp", badgeParts: ["1080p"], badgeHasAudio: true, settings: { duration: "10s", ratio: "16:9", resolution: "1080p" } },
      "image-to-video": { provider: "happy-horse-video", workflow: "image-to-video", modelLabel: "Happy Horse 1.1", prompts: [HAPPY_HORSE_IMAGE_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a9f39fd/N9U9ZDVOZvX13yQTzx0wN_NrDUbOAF.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a9f39fd%2FN9U9ZDVOZvX13yQTzx0wN_NrDUbOAF.mp4/tr:so-0,w-1024,q-80/N9U9ZDVOZvX13yQTzx0wN_NrDUbOAF.webp", sourceImageUrl: HAPPY_HORSE_IMAGE_URL, sourceImageShape: "portrait", videoShape: "portrait", badgeParts: ["1080p", "3:4"], badgeHasAudio: true, settings: { duration: "10s", ratio: "3:4", resolution: "1080p", generateAudio: true } }
    }
  },
  "kling-video": {
    id: "kling-video",
    meta: { label: "Kling v3 Pro", shortLabel: "Kling", speed: "Medium", quality: "Premium motion", bestFor: "Premium text-to-video or image-to-video with stronger camera movement" },
    group: "betterQuality",
    badge: "pro",
    workflows: { "text-to-video": { ratios: ["16:9", "9:16", "1:1"] }, "image-to-video": { ratios: ["source"] } },
    durations: VIDEO_DURATION_OPTIONS,
    resolutions: ["720p"],
    defaultDuration: "5s",
    defaultResolution: "720p",
    showAudioControl: true,
    examples: {
      "text-to-video": { provider: "kling-video", workflow: "text-to-video", modelLabel: "Kling v3 Pro", prompts: [KLING_TEXT_PROMPT], videoUrl: "https://storage.googleapis.com/falserverless/example_outputs/kling-v3/pro-t2v/out.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fstorage.googleapis.com%2Ffalserverless%2Fexample_outputs%2Fkling-v3%2Fpro-t2v%2Fout.mp4/tr:so-0,w-1024,q-80/out.webp", badgeParts: ["1080p"], badgeHasAudio: true, settings: { duration: "5s", ratio: "16:9", generateAudio: true } },
      "image-to-video": { provider: "kling-video", workflow: "image-to-video", modelLabel: "Kling v3 Pro", prompts: [KLING_IMAGE_PROMPT, KLING_ELEMENT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a9270c0/M0OE5-o3n7Pj85CWWpGt2_output.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a9270c0%2FM0OE5-o3n7Pj85CWWpGt2_output.mp4/tr:so-0,w-1024,q-80/M0OE5-o3n7Pj85CWWpGt2_output.webp", sourceImageUrl: KLING_IMAGE_URL, sourceImageShape: "landscape", videoFit: "contain", badgeParts: ["10s", "16:9"], badgeHasAudio: true, settings: { duration: "10s", ratio: "source", generateAudio: true } }
    }
  },
  "seedance-video": {
    id: "seedance-video",
    meta: { label: "Seedance 2.0", shortLabel: "Seedance", speed: "Medium", quality: "Cinematic motion", bestFor: "Cinematic text-to-video and image-to-video with native audio" },
    group: "premium",
    workflows: { "text-to-video": { ratios: SEEDANCE_RATIOS }, "image-to-video": { ratios: SEEDANCE_RATIOS } },
    durations: VIDEO_DURATION_OPTIONS.filter((item) => Number.parseInt(item, 10) >= 4),
    resolutions: ["480p", "720p", "1080p", "4k"],
    defaultDuration: "5s",
    defaultResolution: "480p",
    showResolutionControl: true,
    showAudioControl: true,
    examples: {
      "text-to-video": { provider: "seedance-video", workflow: "text-to-video", modelLabel: "Seedance 2.0", prompts: [SEEDANCE_TEXT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a9f7ecf/jQvhuOlh8iQrO38GC4K_0_video.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a9f7ecf%2FjQvhuOlh8iQrO38GC4K_0_video.mp4/tr:so-0,w-1024,q-80/jQvhuOlh8iQrO38GC4K_0_video.webp", badgeParts: ["4K"], badgeHasAudio: true, badgeHasResolutionLabel: true, settings: { duration: "10s", ratio: "16:9", resolution: "4k", generateAudio: true } },
      "image-to-video": { provider: "seedance-video", workflow: "image-to-video", modelLabel: "Seedance 2.0", prompts: [SEEDANCE_IMAGE_PROMPT], videoUrl: "https://v3b.fal.media/files/b/0a95998b/Y2JKGGVWMyjhMKf_FoqS5_video.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2F0a95998b%2FY2JKGGVWMyjhMKf_FoqS5_video.mp4/tr:so-0,w-1024,q-80/Y2JKGGVWMyjhMKf_FoqS5_video.webp", sourceImageUrl: SEEDANCE_IMAGE_URL, sourceImageShape: "landscape", badgeParts: ["4K"], badgeHasAudio: true, badgeHasResolutionLabel: true, settings: { duration: "10s", ratio: "16:9", resolution: "4k", generateAudio: true } }
    }
  },
  "veo-video": {
    id: "veo-video",
    meta: { label: "Veo 3.1", shortLabel: "Veo 3.1", speed: "Slower", quality: "Premium", bestFor: "High-end prompt-led video with audio, 1080p, and 4k options" },
    group: "premium",
    badge: "premium",
    workflows: { "text-to-video": { ratios: ["16:9", "9:16"] } },
    durations: ["4s", "6s", "8s"],
    resolutions: ["720p", "1080p", "4k"],
    defaultDuration: "8s",
    defaultResolution: "720p",
    showResolutionControl: true,
    showAudioControl: true,
    examples: {
      "text-to-video": { provider: "veo-video", workflow: "text-to-video", modelLabel: "Veo 3.1", prompts: [VEO_TEXT_PROMPT], videoUrl: "https://v3b.fal.media/files/b/kangaroo/oUCiZjQwEy6bIQdPUSLDF_output.mp4", posterUrl: "https://refinery.fal.media/url/https%3A%2F%2Fv3b.fal.media%2Ffiles%2Fb%2Fkangaroo%2FoUCiZjQwEy6bIQdPUSLDF_output.mp4/tr:so-0,w-1024,q-80/oUCiZjQwEy6bIQdPUSLDF_output.webp", badgeParts: ["720p"], badgeHasAudio: true, settings: { duration: "8s", ratio: "16:9", resolution: "720p", generateAudio: true } }
    }
  }
};

export const VIDEO_PROVIDER_META: Record<string, VideoProviderMeta> = {
  ...Object.fromEntries(Object.values(VIDEO_MODEL_CONFIGS).map((config) => [config.id, config.meta])),
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
  }
};

export const VIDEO_PROVIDERS_BY_WORKFLOW: Record<StudioVideoWorkflow, string[]> = {
  "text-to-video": ["minimax-h3-max-video", "dreamface-io-video", "grok-video", "gemini-omni-flash-video", "seedance-mini-video", "happy-horse-video", "kling-video", "seedance-video", "veo-video"],
  "image-to-video": ["minimax-h3-max-video", "dreamface-io-video", "gemini-omni-flash-video", "seedance-mini-video", "happy-horse-video", "kling-video", "seedance-video", "grok-video"]
};

export const VIDEO_EXAMPLE_PROMPTS = Object.values(VIDEO_MODEL_CONFIGS)
  .flatMap((config) => Object.values(config.examples || {}))
  .flatMap((example) => example?.prompts || []);

export const VIDEO_EXAMPLE_SOURCE_IMAGES = Object.values(VIDEO_MODEL_CONFIGS)
  .flatMap((config) => Object.values(config.examples || {}))
  .map((example) => example?.sourceImageUrl)
  .filter((value): value is string => Boolean(value));

export function videoModelConfig(provider: string) {
  return VIDEO_MODEL_CONFIGS[provider];
}

export function videoModelDefaultDuration(provider: string) {
  return VIDEO_MODEL_CONFIGS[provider]?.defaultDuration || "5s";
}

export function videoModelDefaultResolution(provider: string) {
  return VIDEO_MODEL_CONFIGS[provider]?.defaultResolution || "720p";
}

export function videoModelRatios(provider: string, workflow: StudioVideoWorkflow) {
  return [...(VIDEO_MODEL_CONFIGS[provider]?.workflows[workflow]?.ratios || DEFAULT_VIDEO_RATIOS)];
}

export function videoModelDurations(provider: string) {
  return [...(VIDEO_MODEL_CONFIGS[provider]?.durations || VIDEO_DURATION_OPTIONS)];
}

export function videoModelResolutions(provider: string) {
  return [...(VIDEO_MODEL_CONFIGS[provider]?.resolutions || ["480p", "720p"])];
}

export function videoModelGroup(provider: string): VideoModelGroup {
  return VIDEO_MODEL_CONFIGS[provider]?.group || "betterQuality";
}

export function videoModelBadge(provider: string) {
  return VIDEO_MODEL_CONFIGS[provider]?.badge;
}

export function isKnownVideoRatio(value: string) {
  return Object.values(VIDEO_MODEL_CONFIGS).some((config) =>
    Object.values(config.workflows).some((workflow) => workflow?.ratios.includes(value))
  );
}

export function isKnownVideoDuration(value: string) {
  return Object.values(VIDEO_MODEL_CONFIGS).some((config) => config.durations.includes(value));
}

export function isKnownVideoResolution(value: string) {
  return Object.values(VIDEO_MODEL_CONFIGS).some((config) => config.resolutions.includes(value));
}

export function videoExampleFor(provider: string, workflow: StudioVideoWorkflow) {
  return VIDEO_MODEL_CONFIGS[provider]?.examples?.[workflow] || null;
}

export function videoExampleSourceFor(provider: string) {
  return VIDEO_MODEL_CONFIGS[provider]?.examples?.["image-to-video"]?.sourceImageUrl || "";
}
