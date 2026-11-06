// Initial application limits; these are not claims about supplier limits.
export const HEYGEN_REFERENCE_IMAGE_LIMIT = 4;
export const HEYGEN_REFERENCE_RATIOS = ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;

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

export function validateHeygenReferences(videoUrls: unknown, imageUrls: unknown): string | null {
  if (!Array.isArray(videoUrls) || videoUrls.length !== 1 || !isPublicReferenceUrl(videoUrls[0])) {
    return "Reference to Video requires one publicly accessible HTTP(S) video URL.";
  }
  if (imageUrls !== undefined && (!Array.isArray(imageUrls) || imageUrls.length > HEYGEN_REFERENCE_IMAGE_LIMIT || imageUrls.some(url =>
    typeof url !== "string" || !(isPublicReferenceUrl(url) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(url))))) {
    return "Reference to Video supports up to 4 reference images (JPEG, PNG or WebP uploads, or public image URLs).";
  }
  return null;
}
