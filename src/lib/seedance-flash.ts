import { isPublicReferenceUrl } from "./heygen-reference-video";

export const SEEDANCE_FLASH_PROVIDER = "seedance-2.5-flash-video";
export const SEEDANCE_FLASH_GUIDE_PATH = "/video/seedance-2-5-flash";
export const SEEDANCE_FLASH_BASE = "bytedance/seedance-2.5/flash";
export const SEEDANCE_FLASH_DURATIONS = [...Array.from({ length: 27 }, (_, i) => `${i + 4}s`), "auto"];
export const SEEDANCE_FLASH_RATIOS = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
export const SEEDANCE_FLASH_RESOLUTIONS = ["480p", "720p"];
export const SEEDANCE_FLASH_IMAGE_LIMIT = 10;
export const SEEDANCE_FLASH_MEDIA_LIMIT = 5;
export const SEEDANCE_FLASH_REFERENCE_SECONDS = 30.2;

export type SeedanceFlashOptions = {
  task: "auto" | "reference" | "editing" | "extension";
  bitrateMode: "standard" | "high";
  codec: "auto" | "H264" | "H265";
  audioUrls: string;
};
export const DEFAULT_SEEDANCE_FLASH_OPTIONS: SeedanceFlashOptions = {
  task: "reference", bitrateMode: "standard", codec: "auto", audioUrls: ""
};

export function seedanceFlashStudioHref(workflow: "text-to-video" | "image-to-video" | "reference-to-video" = "text-to-video", settings: { duration?: string; prompt?: string } = {}) {
  return `/studio?${new URLSearchParams({ mode: "video", workflow, provider: SEEDANCE_FLASH_PROVIDER, duration: "5s", resolution: "720p", ...settings })}`;
}

export function parseReferenceMediaUrls(value: string) {
  return value.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
}

type FlashRequest = {
  mode?: string; provider?: string; videoWorkflow?: string; prompt?: string;
  duration: string; ratio: string; resolution?: string;
  imageUrls?: string[]; videoUrls?: string[]; audioUrls?: string[];
  seedanceTask?: string; bitrateMode?: string; codec?: string;
  generateAudio?: boolean; seed?: number;
};

export function seedanceFlashEndpoint(workflow = "text-to-video") {
  return `${SEEDANCE_FLASH_BASE}/${workflow}`;
}

export function seedanceFlashDuration(value?: string | null) {
  if (value === "auto") return "auto";
  const match = /^(\d+)(?:s)?$/.exec(value || "5s");
  const seconds = match ? Number(match[1]) : 5;
  return String(seconds >= 4 && seconds <= 30 ? seconds : 5);
}

export function seedanceFlashResolution(value?: string | null) {
  return value === "480p" ? "480p" : "720p";
}

export function seedanceFlashQuoteSeconds(duration?: string | null, task?: string | null) {
  const value = task === "editing" || task === "auto" ? "auto" : seedanceFlashDuration(duration);
  return value === "auto" ? 30 : Number(value);
}

function validImages(value: unknown, maximum: number) {
  return value === undefined || Array.isArray(value) && value.length <= maximum && value.every(url =>
    isPublicReferenceUrl(url) || typeof url === "string" && /^data:image\/(?:jpeg|png|webp|bmp|tiff|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/i.test(url));
}
function validMedia(value: unknown) {
  return value === undefined || Array.isArray(value) && value.length <= SEEDANCE_FLASH_MEDIA_LIMIT && value.every(isPublicReferenceUrl);
}

const SEEDANCE_FLASH_ERRORS = {
  workflow: "Seedance 2.5 Flash requires a video workflow.",
  duration: "Seedance 2.5 Flash supports 4–30 seconds or auto.",
  resolution: "Seedance 2.5 Flash supports 480p or 720p.",
  ratio: "Unsupported Seedance 2.5 Flash aspect ratio.",
  bitrate: "Invalid video bitrate mode.", codec: "Invalid video codec.",
  audio: "Invalid audio option.", seed: "Seed must be an integer.",
  task: "Invalid reference video task.",
  media: "Use up to 10 images, 5 public video URLs and 5 public audio URLs.",
  referenceVideo: "Video editing and extension require a reference video.",
  emptyReference: "Add a prompt or reference media.",
  referenceWorkflow: "Select Reference to Video to use video or audio references.",
  images: "Use one start image and an optional end image in Image to Video.",
  startImage: "Image to Video requires a start image.",
  prompt: "Prompt is required."
} as const;

/** A stable code lets the UI describe the actual validation failure. */
function seedanceFlashIssue(body: FlashRequest): keyof typeof SEEDANCE_FLASH_ERRORS | null {
  if (body.mode !== "video" || !["text-to-video", "image-to-video", "reference-to-video"].includes(body.videoWorkflow || "")) return "workflow";
  if (!SEEDANCE_FLASH_DURATIONS.includes(body.duration) && !/^(?:[4-9]|[12]\d|30)$/.test(body.duration)) return "duration";
  if (body.resolution !== undefined && !SEEDANCE_FLASH_RESOLUTIONS.includes(body.resolution)) return "resolution";
  if (!SEEDANCE_FLASH_RATIOS.includes(body.ratio) && !(body.videoWorkflow === "image-to-video" && body.ratio === "source")) return "ratio";
  if (body.bitrateMode !== undefined && !["standard", "high"].includes(body.bitrateMode)) return "bitrate";
  if (body.codec !== undefined && !["auto", "H264", "H265"].includes(body.codec)) return "codec";
  if (body.generateAudio !== undefined && typeof body.generateAudio !== "boolean") return "audio";
  if (body.seed !== undefined && !Number.isSafeInteger(body.seed)) return "seed";
  if (body.videoWorkflow === "reference-to-video") {
    if (body.seedanceTask !== undefined && !["auto", "reference", "editing", "extension"].includes(body.seedanceTask)) return "task";
    if (!validImages(body.imageUrls, 10) || !validMedia(body.videoUrls) || !validMedia(body.audioUrls)) return "media";
    if ((body.seedanceTask === "editing" || body.seedanceTask === "extension") && !body.videoUrls?.length) return "referenceVideo";
    if (!body.prompt?.trim() && !body.imageUrls?.length && !body.videoUrls?.length && !body.audioUrls?.length) return "emptyReference";
  } else {
    if (body.videoUrls?.length || body.audioUrls?.length) return "referenceWorkflow";
    if (!validImages(body.imageUrls, body.videoWorkflow === "image-to-video" ? 2 : 0)) return "images";
    if (body.videoWorkflow === "image-to-video" && !body.imageUrls?.length) return "startImage";
    if (body.videoWorkflow === "text-to-video" && !body.prompt?.trim()) return "prompt";
  }
  return null;
}

/** Validate before pricing or submission; never silently drop chargeable references. */
export function seedanceFlashError(body: FlashRequest): string | null {
  const issue = seedanceFlashIssue(body);
  return issue ? SEEDANCE_FLASH_ERRORS[issue] : null;
}

export function seedanceFlashValidationKey(body: FlashRequest): string | null {
  const issue = seedanceFlashIssue(body);
  return issue ? `studio.seedance.validation.${issue}` : null;
}

export function seedanceFlashNoticeKeys(workflow: string, duration: string, task?: string) {
  const automatic = duration === "auto" || workflow === "reference-to-video" && (task === "editing" || task === "auto");
  return [
    automatic ? "studio.seedance.quote.automatic" : "studio.seedance.quote.selected",
    ...(workflow === "image-to-video" ? ["studio.seedance.quote.sourceRatio"] : []),
    "studio.seedance.quote.audio"
  ];
}

export function buildSeedanceFlashInput(body: FlashRequest, prompt: string, endUserId?: string) {
  const reference = body.videoWorkflow === "reference-to-video";
  const image = body.videoWorkflow === "image-to-video";
  const editing = reference && body.seedanceTask === "editing";
  const input: Record<string, unknown> = {
    ...(prompt.trim() ? { prompt } : {}),
    duration: editing ? "auto" : seedanceFlashDuration(body.duration),
    resolution: seedanceFlashResolution(body.resolution),
    aspect_ratio: image || editing || reference && body.seedanceTask === "extension" ? "auto" : body.ratio,
    generate_audio: body.generateAudio !== false,
    bitrate_mode: body.bitrateMode || "standard",
    codec: body.codec || "auto",
    ...(endUserId ? { end_user_id: endUserId } : {})
  };
  if (image) {
    input.image_url = body.imageUrls![0].trim();
    if (body.imageUrls?.[1]) input.end_image_url = body.imageUrls[1].trim();
  }
  if (reference) {
    input.task = body.seedanceTask || "reference";
    if (body.imageUrls?.length) input.image_urls = body.imageUrls.map(url => url.trim());
    if (body.videoUrls?.length) input.video_urls = body.videoUrls.map(url => url.trim());
    if (body.audioUrls?.length) input.audio_urls = body.audioUrls.map(url => url.trim());
    if (body.seed !== undefined) input.seed = body.seed;
  }
  return input;
}
