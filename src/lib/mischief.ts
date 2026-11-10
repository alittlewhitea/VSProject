import { isPublicReferenceUrl } from "./heygen-reference-video";

export const MISCHIEF_PROVIDER = "mischief-video";
export const MISCHIEF_MODEL = "tbc/mischief-1/image-to-video";
export const MISCHIEF_RESOLUTIONS = ["480p", "720p"] as const;
export const MISCHIEF_DURATIONS = ["3s", "5s"] as const;
export const MISCHIEF_MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function mischiefResolution(value?: string | null) {
  return value?.toLowerCase() === "480p" ? "480p" : "720p";
}

export function mischiefDuration(value?: string | null) {
  return value === "3s" ? 3 : 5;
}

export function mischiefCostUsd(duration?: string | null, resolution?: string | null) {
  return mischiefDuration(duration) * (mischiefResolution(resolution) === "480p" ? 0.005 : 0.01);
}

export function mischiefImageError(value: string) {
  if (value.startsWith("data:") && value.length > Math.ceil(MISCHIEF_MAX_IMAGE_BYTES / 3) * 4 + 100) return "Mischief 1 images must be no larger than 25 MiB.";
  const match = value.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return isPublicReferenceUrl(value) ? null : "Mischief 1 requires a JPEG, PNG or WebP upload, or a public HTTP(S) image URL.";
  const bytes = match[1].length * 3 / 4 - (match[1].endsWith("==") ? 2 : match[1].endsWith("=") ? 1 : 0);
  return bytes > MISCHIEF_MAX_IMAGE_BYTES ? "Mischief 1 images must be no larger than 25 MiB." : null;
}
