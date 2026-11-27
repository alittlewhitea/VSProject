import { estimateGenerationCredits } from "../../lib/model-pricing";
import { SEEDANCE_FLASH_PROVIDER } from "../../lib/seedance-flash";
import {
  videoModelConfig,
  videoModelDefaultDuration,
  videoModelDefaultResolution,
  videoModelDurations,
  videoModelRatios,
  videoModelResolutions
} from "./video-models";

export type StudioAppId = "pet-sing-dance";
export type PetTemplateCategory = "dance" | "sing";

export type PetSingDanceTemplate = {
  id:
    | "tiktok-shuffle"
    | "disco-paw"
    | "hiphop-street"
    | "kpop-idol"
    | "salsa-fiesta"
    | "breakdance-spin"
    | "cowboy-country"
    | "ballet-tutu"
    | "dj-neon-rave"
    | "pop-star-sing"
    | "opera-diva"
    | "birthday-song"
    | "rock-guitar"
    | "rap-mic"
    | "jazz-lounge"
    | "karaoke-duet";
  category: PetTemplateCategory;
  emoji: string;
  badge?: "hot" | "viral" | "new" | "funny" | "gift";
  accent: string;
  coverUrl: string;
  recommendedDuration: string;
  prompt: string;
};

export const PET_APP_COVER_BASE_URL = "https://media.dreamface.io/apps/pet-sing-dance";

export const PET_APP_ID: StudioAppId = "pet-sing-dance";

export const PET_APP_DEFAULT_PROVIDER = "heygen-video";

export const PET_APP_PROVIDER_IDS = [
  "heygen-video",
  "minimax-h3-max-turbo-video",
  "gemini-omni-flash-video",
  SEEDANCE_FLASH_PROVIDER
] as const;

export type PetAppProviderId = (typeof PET_APP_PROVIDER_IDS)[number];

const MAX_PET_APP_DURATION_SECONDS = 15;

export const PET_SING_DANCE_TEMPLATES: readonly PetSingDanceTemplate[] = [
  {
    id: "tiktok-shuffle",
    category: "dance",
    emoji: "🔥",
    badge: "viral",
    accent: "linear-gradient(135deg, #e76f51 0%, #f4a261 52%, #e9c46a 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/tiktok-shuffle.webp`,
    recommendedDuration: "5s",
    prompt:
      "Keep the exact pet from the uploaded photo with identical breed, fur texture, coat markings, eye color, and facial proportions. The pet stands playfully upright in a cozy sunlit living room and performs an adorable viral TikTok dance challenge: crisp rhythmic paw waves, bouncy side-to-side hip wiggles, joyful head bobs, and a cute half-spin right on the beat. Natural soft daylight, crisp 9:16 vertical phone-camera framing with subtle energetic beat bounce, realistic fur physics, no extra limbs, no text, no watermark. Synchronized native audio: catchy upbeat pop dance beat with crisp finger snaps, bouncy synth bass, and cheerful clapping in perfect rhythm with every move."
  },
  {
    id: "disco-paw",
    category: "dance",
    emoji: "🪩",
    badge: "hot",
    accent: "linear-gradient(135deg, #2a9d8f 0%, #264653 55%, #e9c46a 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/disco-paw.webp`,
    recommendedDuration: "5s",
    prompt:
      "Preserve the exact pet from the uploaded image with faithful fur detail, color patterns, ears, and face identity. The pet grooves upright under shimmering warm disco-ball reflections and soft teal-and-gold party beams, pointing one paw up and stepping rhythmically left and right with lively shoulder bounces, happy expression, and ears bobbing to the groove. Smooth medium vertical tracking shot, cinematic bokeh sparkles, realistic fur motion, no distortions, no text. Synchronized native audio: funky upbeat 70s disco groove with punchy bassline, bright funky guitar chops, crisp handclaps, and infectious dancefloor energy."
  },
  {
    id: "hiphop-street",
    category: "dance",
    emoji: "🕶️",
    badge: "new",
    accent: "linear-gradient(135deg, #1f3943 0%, #2a9d8f 50%, #f4a261 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/hiphop-street.webp`,
    recommendedDuration: "8s",
    prompt:
      "Keep the exact pet from the reference photo with 100% consistent breed, face, fur markings, and proportions. The pet stands upright on a sun-drenched urban sidewalk bathed in golden-hour rim light, performing a confident street hip-hop routine: sharp rhythmic head nods, slick shoulder pops, cool alternating paw steps, and an energetic bounce with playful attitude. Dynamic low-angle vertical handheld camera with subtle rhythm punch-ins, shallow depth of field, lifelike fur movement, no text or watermark. Synchronized native audio: crisp boom-bap hip-hop dance track with punchy 808 kick drums, snappy snares, and upbeat funky brass stabs locked to the choreography."
  },
  {
    id: "kpop-idol",
    category: "dance",
    emoji: "✨",
    badge: "new",
    accent: "linear-gradient(135deg, #6d28d9 0%, #db2777 56%, #f4a261 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/kpop-idol.webp`,
    recommendedDuration: "8s",
    prompt:
      "Maintain exact identity fidelity of the pet from the input image, preserving its exact face, ears, coat pattern, and fur texture. The pet performs crisp, upbeat K-Pop idol choreography on a glossy pastel-and-neon concert stage with warm rim spotlights and floating golden confetti sparkles: sharp alternating paw choreography, cheerful jump-step on the chorus drop, adorable paw-to-cheek pose, and bright sparkling eyes toward the camera. Smooth broadcast camera push-in, glossy stage reflections, photorealistic fur physics, no extra paws, no text. Synchronized native audio: energetic bright K-Pop dance-pop chorus with sparkling synths, tight electronic drums, and exuberant concert crowd ambience."
  },
  {
    id: "salsa-fiesta",
    category: "dance",
    emoji: "💃",
    accent: "linear-gradient(135deg, #c2391d 0%, #e76f51 50%, #e9c46a 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/salsa-fiesta.webp`,
    recommendedDuration: "5s",
    prompt:
      "Preserve the exact pet from the uploaded photo including every fur marking, ear shape, and facial detail. The pet dances a joyful Latin salsa twist on a warm sunlit terracotta patio decorated with softly glowing string lights: playful rhythmic hip shimmy, quick alternating paw taps, cheerful spin, and happy expressive face moving seamlessly to the music. Warm golden sunset lighting, steady medium vertical shot, lifelike motion, no artifacts or text. Synchronized native audio: lively upbeat Latin salsa percussion with bright congas, brass horn accents, acoustic guitar strums, and cheerful rhythmic claps."
  },
  {
    id: "breakdance-spin",
    category: "dance",
    emoji: "🧢",
    badge: "viral",
    accent: "linear-gradient(135deg, #b45309 0%, #f59e0b 55%, #1f3943 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/breakdance-spin.webp`,
    recommendedDuration: "6s",
    prompt:
      "Keep the exact pet from the uploaded photo with faithful breed, coat pattern, ears, and facial proportions. Inside a cozy warm-lit brick loft apartment on a flattened cardboard dance mat, the pet performs an energetic playful b-boy breakdance routine: rhythmic bouncy footwork, quick playful spin, confident paw freeze toward the camera, and joyful grin synced tightly to the beat. Low-angle handheld 9:16 camera with warm tungsten bokeh lamps, realistic fur physics, no extra limbs, no text, no watermark. Synchronized native audio: funky old-school breakbeat hip-hop loop with snappy snares, vinyl turntable scratches, and upbeat bassline."
  },
  {
    id: "cowboy-country",
    category: "dance",
    emoji: "🤠",
    badge: "funny",
    accent: "linear-gradient(135deg, #92400e 0%, #d97706 55%, #fde68a 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/cowboy-country.webp`,
    recommendedDuration: "6s",
    prompt:
      "Preserve the exact pet from the reference photo with 100% consistent face, fur texture, and markings. Inside a sun-drenched rustic wooden barn with golden sunbeams and drifting dust motes, the pet stands upright doing a cheerful country line dance: rhythmic heel-toe paw hops, happy side-step shuffle, playful tail wag, and joyful grin looking toward the lens. Warm golden cinematic lighting, steady vertical medium shot, realistic fur motion, no extra paws, no text. Synchronized native audio: lively upbeat country line-dance hoedown with bright acoustic guitar twang, cheerful fiddle melody, and crisp rhythmic stomps and claps."
  },
  {
    id: "ballet-tutu",
    category: "dance",
    emoji: "🩰",
    badge: "new",
    accent: "linear-gradient(135deg, #f472b6 0%, #fbcfe8 55%, #fef3c7 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/ballet-tutu.webp`,
    recommendedDuration: "6s",
    prompt:
      "Keep the exact pet from the uploaded image with identical coat colors, eyes, ears, and facial features. In a bright sunlit classic wooden dance studio with tall arched windows, the pet gracefully stands upright on its hind legs performing a charming whimsical ballet routine: elegant slow pirouette spin, delicate curved front paws lifted overhead, light playful tip-toe bounces, and serene happy expression. Soft diffused morning sunlight, smooth vertical tracking shot, realistic fur movement, no extra limbs, no text. Synchronized native audio: light whimsical classical ballet waltz played on playful strings, delicate celesta chimes, and gentle flute."
  },
  {
    id: "dj-neon-rave",
    category: "dance",
    emoji: "🎧",
    badge: "hot",
    accent: "linear-gradient(135deg, #06b6d4 0%, #6366f1 52%, #ec4899 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/dj-neon-rave.webp`,
    recommendedDuration: "6s",
    prompt:
      "Preserve the exact pet from the uploaded photo including every fur detail, color pattern, and facial identity. The pet stands upright behind an illuminated DJ turntable booth in a glowing neon rave club with pulsing cyan and magenta laser beams and dancing crowd bokeh, bobbing its head vigorously to the drop, scratching the decks with both front paws, and grinning wildly with pure party energy. Dynamic vertical concert-club camera with subtle beat-synced pulse, realistic fur reflections, no text or watermark. Synchronized native audio: high-energy festival EDM house drop with booming synth bassline, crisp hi-hats, riser sweep, and euphoric dancefloor energy."
  },
  {
    id: "pop-star-sing",
    category: "sing",
    emoji: "🎤",
    badge: "hot",
    accent: "linear-gradient(135deg, #e76f51 0%, #2a9d8f 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/pop-star-sing.webp`,
    recommendedDuration: "8s",
    prompt:
      "Preserve the exact pet from the uploaded photo with identical breed, fur markings, eyes, and natural proportions. Close-to-medium vertical portrait of the pet passionately singing a joyful pop chorus into a sleek vintage chrome studio microphone under warm amber and teal concert spotlights with soft bokeh lights behind. Natural expressive mouth opening, jaw movement, ear twitches, and emotional head sway tightly synced to each melodic phrase as the pet holds the spotlight like a superstar. Photorealistic fur detail, cinematic shallow depth of field, no distorted anatomy, no text. Synchronized native audio: upbeat catchy pop vocal chorus with a playful cute singing voice, bright acoustic guitar strums, warm bass, and crisp drums."
  },
  {
    id: "opera-diva",
    category: "sing",
    emoji: "🎭",
    badge: "funny",
    accent: "linear-gradient(135deg, #172b32 0%, #b0851a 58%, #e9c46a 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/opera-diva.webp`,
    recommendedDuration: "8s",
    prompt:
      "Keep the exact pet from the uploaded photo with faithful coat colors, facial structure, and fur texture. The pet performs a hilariously dramatic grand opera aria under a single warm golden theater spotlight against rich crimson velvet curtains: lifting its chin proudly, wide expressive eyes, rhythmic dramatic mouth and jaw motion holding a high vibrato note, and raising one paw passionately to its chest. Slow cinematic vertical dolly-in, theatrical golden rim light, realistic fur and whiskers, no text or watermark. Synchronized native audio: lush dramatic orchestral strings and grand concert hall acoustics accompanying a soaring, playfully comedic operatic singing voice."
  },
  {
    id: "birthday-song",
    category: "sing",
    emoji: "🎂",
    badge: "gift",
    accent: "linear-gradient(135deg, #2a9d8f 0%, #e9c46a 55%, #e76f51 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/birthday-song.webp`,
    recommendedDuration: "8s",
    prompt:
      "Keep the exact pet from the uploaded image with identical face, fur texture, and markings. The pet sits warmly in a festive birthday celebration setting surrounded by glowing golden candle bokeh, soft fairy lights, and gentle floating pastel confetti, bobbing its head cheerfully and singing a happy birthday serenade directly into the camera with cute rhythmic mouth movements, sparkling eyes, and happy energy. Warm cozy cinematic lighting, steady vertical medium close-up, photorealistic fur physics, no extra limbs, no text. Synchronized native audio: cheerful heartwarming acoustic birthday celebration song with playful upbeat singing vocals, warm ukulele strums, and gentle celebratory handclaps."
  },
  {
    id: "rock-guitar",
    category: "sing",
    emoji: "🎸",
    badge: "hot",
    accent: "linear-gradient(135deg, #991b1b 0%, #ea580c 55%, #fbbf24 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/rock-guitar.webp`,
    recommendedDuration: "6s",
    prompt:
      "Preserve the exact pet from the uploaded photo with identical breed, face, ears, and fur markings. The pet stands upright on a smoky arena rock concert stage under glowing amber and cool blue stage spotlights, strumming a mini electric guitar with its front paws while enthusiastically singing and headbanging to a stadium rock anthem with expressive rhythmic mouth motion and fierce hilarious joy. Dynamic low-angle vertical concert shot, drifting stage haze, photorealistic fur detail, no extra limbs, no text. Synchronized native audio: energetic stadium rock anthem with crunchy electric guitar power chords, pounding live drums, and playful high-energy rock singing vocals."
  },
  {
    id: "rap-mic",
    category: "sing",
    emoji: "🎙️",
    badge: "viral",
    accent: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 52%, #f59e0b 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/rap-mic.webp`,
    recommendedDuration: "6s",
    prompt:
      "Keep the exact pet from the reference photo with 100% consistent face, fur texture, and markings. Inside a moody purple-and-amber recording studio booth, the pet stands upright spitting a fast rhythmic freestyle rap verse into a suspended black studio condenser microphone with pop filter: crisp rhythmic mouth movement, confident head nods, and one front paw gesturing dynamically on the beat. Cinematic shallow depth of field, warm studio tube glow, lifelike fur and whiskers, no extra paws, no text. Synchronized native audio: hard-hitting modern hip-hop trap beat with punchy 808 bass, crisp hi-hat rolls, and playful rhythmic freestyle rap vocal flow."
  },
  {
    id: "jazz-lounge",
    category: "sing",
    emoji: "🎷",
    accent: "linear-gradient(135deg, #451a03 0%, #b45309 55%, #f59e0b 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/jazz-lounge.webp`,
    recommendedDuration: "8s",
    prompt:
      "Preserve the exact pet from the uploaded photo including exact fur texture, eyes, and facial proportions. Inside an intimate candlelit vintage jazz lounge with warm golden bokeh lamps, the pet leans smoothly toward a gleaming retro gold ribbon microphone, gently swaying its head with eyes softly blinking as it croons a soulful smooth jazz ballad with expressive rhythmic mouth motion. Warm filmic amber lighting, slow gentle vertical push-in, lifelike fur physics, no text or watermark. Synchronized native audio: velvety smooth jazz lounge ballad with warm tenor saxophone, walking upright bass, soft brushed snare drums, and charming crooning vocals."
  },
  {
    id: "karaoke-duet",
    category: "sing",
    emoji: "🎶",
    badge: "funny",
    accent: "linear-gradient(135deg, #db2777 0%, #7c3aed 55%, #06b6d4 100%)",
    coverUrl: `${PET_APP_COVER_BASE_URL}/karaoke-duet.webp`,
    recommendedDuration: "6s",
    prompt:
      "Keep the exact pet from the uploaded image with identical face, fur patterns, and natural proportions. Sitting upright on a plush sofa inside a vibrant colorful KTV karaoke lounge lit by rainbow disco reflections and warm fairy lights, the pet grips a shiny wireless karaoke microphone with both front paws and belts out an emotional upbeat pop sing-along chorus with wide expressive mouth motion, bobbing ears, and joyful party energy. Candid vertical handheld party framing, photorealistic fur detail, no extra limbs, no text. Synchronized native audio: lively upbeat KTV party pop chorus with expressive playful singing vocals, bright synth chords, and cheerful clapping in the room."
  }
];

export function isPetAppProvider(provider: string): provider is PetAppProviderId {
  return (PET_APP_PROVIDER_IDS as readonly string[]).includes(provider);
}

export function petAppTemplateById(id?: string | null): PetSingDanceTemplate {
  return PET_SING_DANCE_TEMPLATES.find((item) => item.id === id) || PET_SING_DANCE_TEMPLATES[0];
}

export function petAppDurationsForProvider(provider: PetAppProviderId): string[] {
  const supported = videoModelDurations(provider);
  const bounded = supported.filter((value) => {
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds <= MAX_PET_APP_DURATION_SECONDS;
  });
  return bounded.length > 0 ? bounded : supported;
}

export function petAppResolutionsForProvider(provider: PetAppProviderId): string[] {
  return videoModelResolutions(provider);
}

export function petAppRatioForProvider(provider: PetAppProviderId): string {
  const ratios = videoModelRatios(provider, "image-to-video");
  if (ratios.includes("9:16")) return "9:16";
  if (ratios.includes("source")) return "source";
  return ratios[0] || "source";
}

export function normalizePetAppDuration(provider: PetAppProviderId, current: string): string {
  const options = petAppDurationsForProvider(provider);
  if (options.includes(current)) return current;
  const fallback = videoModelDefaultDuration(provider);
  return options.includes(fallback) ? fallback : options[0] || "5s";
}

export function normalizePetAppResolution(provider: PetAppProviderId, current: string): string {
  const options = petAppResolutionsForProvider(provider);
  if (options.includes(current)) return current;
  const fallback = videoModelDefaultResolution(provider);
  return options.includes(fallback) ? fallback : options[0] || "480p";
}

export function petAppProviderLabel(provider: PetAppProviderId): string {
  return videoModelConfig(provider)?.meta.shortLabel || videoModelConfig(provider)?.meta.label || provider;
}

export function estimatePetAppCredits({
  provider,
  duration,
  resolution,
  pricingTime
}: {
  provider: PetAppProviderId;
  duration: string;
  resolution: string;
  pricingTime?: number;
}): number {
  return estimateGenerationCredits({
    mode: "video",
    provider,
    videoWorkflow: "image-to-video",
    duration,
    resolution,
    generateAudio: true,
    hasReferences: true,
    referenceCount: 1,
    pricingTime
  });
}
