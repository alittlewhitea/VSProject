import { referencePromptAssets, referencePromptParts } from "./reference-prompt";
import { studioMediaBytes } from "./studio-media";

// fal OpenAPI: HeygenVideoReferenceToVideoInput (checked 2026-11-16).
export const HEYGEN_REFERENCE_IMAGE_LIMIT = 9;
export const HEYGEN_REFERENCE_VIDEO_LIMIT = 3;
export const HEYGEN_REFERENCE_AUDIO_LIMIT = 3;
export const HEYGEN_REFERENCE_PROMPT_LIMIT = 32000;
// Upload budgets belong to this platform, not the supplier schema.
export const HEYGEN_REFERENCE_IMAGE_BYTES = 30 * 1024 * 1024;
export const HEYGEN_REFERENCE_UPLOAD_BYTES = 40 * 1024 * 1024;
export const HEYGEN_PROMPT_ENHANCEMENTS = ["turbo", "quality", "ultraquality", "disabled"] as const;
export type HeygenReferenceOptions = { audioUrls: string; promptEnhancement: typeof HEYGEN_PROMPT_ENHANCEMENTS[number] };
export const DEFAULT_HEYGEN_REFERENCE_OPTIONS: HeygenReferenceOptions = { audioUrls: "", promptEnhancement: "turbo" };
export const HEYGEN_REFERENCE_RATIOS = ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;

export function heygenReferenceMediaUrls(value: string) {
  return value.split(/\r?\n/).map(url => url.trim()).filter(Boolean);
}

export function prepareHeygenReferencePrompt(prompt: string, images?: string[], videos?: string[], audio?: string[]) {
  const parts = referencePromptParts(prompt, referencePromptAssets(images ?? [], videos, audio));
  const labels = { image: "Picture", video: "Video", audio: "Audio" };
  return {
    prompt: parts.map(({ text, asset }) => asset ? `<${labels[asset.kind]} ${asset.index}>` : text).join(""),
    missing: parts.some(part => part.missing)
  };
}

export function heygenReferenceImageBytes(url: string) {
  if (!/^data:/i.test(url)) return studioMediaBytes(url, "image");
  const comma = url.indexOf(",");
  return comma < 0 ? 0 : Math.floor((url.length - comma - 1) * 3 / 4) - (url.endsWith("==") ? 2 : url.endsWith("=") ? 1 : 0);
}

export function heygenReferenceUploadIssue(files: ReadonlyArray<{ type: string; size: number }>, images: string[]) {
  if (files.length + images.length > HEYGEN_REFERENCE_IMAGE_LIMIT || files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return "images";
  if (files.some(file => file.size > HEYGEN_REFERENCE_IMAGE_BYTES) || files.reduce((total, file) => total + file.size, 0) + images.reduce((total, url) => total + heygenReferenceImageBytes(url), 0) > HEYGEN_REFERENCE_UPLOAD_BYTES) return "upload";
  return null;
}

export function isPublicReferenceUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 8192) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password &&
      host.includes(".") && !host.endsWith(".local") && !host.endsWith(".localhost") &&
      !/^(?:localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
  } catch { return false; }
}

type ReferenceIssue = "videos" | "images" | "audio" | "upload";
function validReferenceImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (isPublicReferenceUrl(value)) return true;
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+)(={0,2})$/i.exec(value);
  return Boolean(match && (match[1].length + match[2].length) % 4 === 0);
}
export function heygenReferenceIssue(videoUrls: unknown, imageUrls: unknown, audioUrls?: unknown): ReferenceIssue | null {
  if (videoUrls !== undefined && (!Array.isArray(videoUrls) || videoUrls.length > HEYGEN_REFERENCE_VIDEO_LIMIT || videoUrls.some(url => !isPublicReferenceUrl(url)))) return "videos";
  if (audioUrls !== undefined && (!Array.isArray(audioUrls) || audioUrls.length > HEYGEN_REFERENCE_AUDIO_LIMIT || audioUrls.some(url => !isPublicReferenceUrl(url)))) return "audio";
  if (imageUrls !== undefined && (!Array.isArray(imageUrls) || imageUrls.length > HEYGEN_REFERENCE_IMAGE_LIMIT || imageUrls.some(url => !validReferenceImage(url)))) {
    return "images";
  }
  if (Array.isArray(imageUrls) && (imageUrls.some(url => heygenReferenceImageBytes(url) > HEYGEN_REFERENCE_IMAGE_BYTES) || imageUrls.reduce((total: number, url: string) => total + heygenReferenceImageBytes(url), 0) > HEYGEN_REFERENCE_UPLOAD_BYTES)) return "upload";
  return null;
}

export function heygenReferenceValidationKey(videoUrls: unknown, imageUrls: unknown, audioUrls?: unknown) {
  const issue = heygenReferenceIssue(videoUrls, imageUrls, audioUrls);
  return issue ? `studio.heygen.reference.error.${issue}` : null;
}

export function validateHeygenReferences(videoUrls: unknown, imageUrls: unknown, audioUrls?: unknown): string | null {
  const issue = heygenReferenceIssue(videoUrls, imageUrls, audioUrls);
  return issue ? {
    videos: "Use up to 3 publicly accessible HTTP(S) video URLs, or leave video references empty.",
    images: "Use up to 9 reference images: JPEG, PNG or WebP uploads, or public image URLs.",
    audio: "Use up to 3 publicly accessible HTTP(S) audio URLs, or leave audio references empty.",
    upload: "Platform image upload limits: 30 MB per image and 40 MB total.",
  }[issue] : null;
}
