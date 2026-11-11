// Billing normalization: the credit estimate and the provider payload must be
// derived from the same values. Browser input is normalized here once, before
// pricing, to exactly what each provider payload will submit. Without this, a
// request such as Veo "1s" was priced as 1 second but generated as 8 seconds.

export const IMAGE_SIZE_PRESETS = new Set([
  "default_4_3",
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9"
]);
export const EDIT_RESOLUTIONS = new Set(["1K", "2K", "4K"]);
export const MINIMAX_H3_MAX_VIDEO_RESOLUTIONS = new Set(["480p", "768p", "1080p"]);
export const GROK_VIDEO_RESOLUTIONS = new Set(["480p", "720p", "1080p"]);
export const SEEDANCE_VIDEO_RESOLUTIONS = new Set(["480p", "720p", "1080p", "4k"]);
export const SEEDANCE_MINI_VIDEO_RESOLUTIONS = new Set(["480p", "720p"]);
export const HAPPY_HORSE_VIDEO_RESOLUTIONS = new Set(["720p", "1080p"]);
export const VEO_VIDEO_RESOLUTIONS = new Set(["720p", "1080p", "4k"]);
export const VEO_VIDEO_DURATIONS = new Set(["4s", "6s", "8s"]);

export function getFalImageSize(ratio: string, imageSize?: string) {
  if (imageSize === "default_4_3") return "landscape_4_3";
  if (imageSize && IMAGE_SIZE_PRESETS.has(imageSize)) return imageSize;
  if (ratio === "16:9") return "landscape_16_9";
  if (ratio === "4:3") return "landscape_4_3";
  if (ratio === "3:4") return "portrait_4_3";
  if (ratio === "9:16") return "portrait_16_9";
  return "square_hd";
}

export type BillableRequest = {
  mode: string;
  provider: string;
  duration: string;
  ratio: string;
  resolution?: string;
  imageSize?: string;
};

function wholeSeconds(duration: string, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(duration, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function pick(value: string | undefined, allowed: Set<string>, fallback: string) {
  return value && allowed.has(value) ? value : fallback;
}

/**
 * Rewrites duration/resolution/imageSize to the exact values the provider payload
 * uses, so pricing cannot be lowered (or raised) by out-of-range input. Mutates and
 * returns the request. Providers not listed already normalize before pricing.
 */
export function normalizeBillableRequest<T extends BillableRequest>(body: T): T {
  const video = body.mode === "video" || body.mode === "avatar";
  const p = body.provider;
  if (video && (p === "seedance-video" || p === "seedance-mini-video")) {
    body.duration = `${wholeSeconds(body.duration, 4, 15, 5)}s`;
    body.resolution = pick(body.resolution, p === "seedance-mini-video" ? SEEDANCE_MINI_VIDEO_RESOLUTIONS : SEEDANCE_VIDEO_RESOLUTIONS, "480p");
  } else if (video && p === "kling-video") {
    body.duration = `${wholeSeconds(body.duration, 3, 15, 5)}s`;
    // Kling v3 Pro has no resolution input; price it at its single (HD) output tier.
    body.resolution = undefined;
  } else if (video && p === "veo-video") {
    body.duration = VEO_VIDEO_DURATIONS.has(body.duration) ? body.duration : "8s";
    body.resolution = pick(body.resolution, VEO_VIDEO_RESOLUTIONS, "720p");
  } else if (video && p === "happy-horse-video") {
    body.duration = `${wholeSeconds(body.duration, 3, 15, 5)}s`;
    body.resolution = pick(body.resolution, HAPPY_HORSE_VIDEO_RESOLUTIONS, "720p");
  } else if (video && p === "grok-video") {
    body.duration = `${wholeSeconds(body.duration, 1, 15, 5)}s`;
    body.resolution = pick(body.resolution, GROK_VIDEO_RESOLUTIONS, "480p");
  } else if (video && (p === "minimax-h3-max-video" || p === "minimax-h3-max-turbo-video")) {
    // The H3 payload clamps (20s -> 15s) rather than falling back.
    const parsed = Number.parseInt(body.duration, 10);
    body.duration = `${Number.isFinite(parsed) ? Math.min(15, Math.max(5, parsed)) : 5}s`;
    body.resolution = pick(body.resolution, MINIMAX_H3_MAX_VIDEO_RESOLUTIONS, "480p");
  } else if (video && p === "flux-3-max-video") {
    body.duration = `${wholeSeconds(body.duration, 5, 20, 5)}s`;
    body.resolution = body.resolution === "1080p" ? "1080p" : "720p";
  } else if (body.mode === "image" && (p === "nano-banana-image" || p === "nano-banana-edit" || p === "nano-banana-pro")) {
    body.resolution = pick(body.resolution, EDIT_RESOLUTIONS, "1K");
  } else if (body.mode === "image" && (p === "flux-image" || p === "flux-dev")) {
    body.imageSize = getFalImageSize(body.ratio, body.imageSize);
  }
  return body;
}

/** Duration of a PCM WAV data URL, read from its header. Null for any other format. */
export function wavDataUrlSeconds(dataUrl: string): number | null {
  const match = /^data:audio\/(?:wav|wave|x-wav);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl.trim());
  if (!match || match[1].length > 40 * 1024 * 1024) return null;
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(match[1]), value => value.charCodeAt(0)); } catch { return null; }
  const view = new DataView(bytes.buffer), label = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 44 || label(0) !== "RIFF" || label(8) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.length) return null;
  let sampleRate = 0, blockAlign = 0, dataBytes: number | null = null, formatSeen = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = label(offset), size = view.getUint32(offset + 4, true), next = offset + 8 + size;
    if (next > bytes.length) return null;
    if (id === "fmt ") {
      if (formatSeen || size < 16) return null;
      formatSeen = true;
      const codec = view.getUint16(offset + 8, true), channels = view.getUint16(offset + 10, true), bits = view.getUint16(offset + 22, true);
      sampleRate = view.getUint32(offset + 12, true); blockAlign = view.getUint16(offset + 20, true);
      if (![1, 3].includes(codec) || channels < 1 || channels > 8 || ![8,16,24,32,64].includes(bits) || sampleRate < 8000 || sampleRate > 384000 || blockAlign !== channels * bits / 8 || view.getUint32(offset + 16, true) !== sampleRate * blockAlign) return null;
    } else if (id === "data") {
      if (dataBytes !== null) return null;
      dataBytes = size;
    }
    offset = next + (size % 2);
  }
  return sampleRate && blockAlign && dataBytes && dataBytes % blockAlign === 0 ? dataBytes / blockAlign / sampleRate : null;
}

/**
 * Kling Avatar output length follows the supplied audio. WAV uploads are measured;
 * Other audio must pass the server's decoded-audio verification before quoting.
 */
export function avatarAudioBillableSeconds(audioUrl: string, maxSeconds: number): { seconds: number } | { error: string } {
  const measured = wavDataUrlSeconds(audioUrl);
  if (measured === null) return {error:/^data:audio\/(?:wav|wave|x-wav);/i.test(audioUrl)?"Invalid WAV audio. Please upload the audio again.":"Audio must be verified by the server before pricing."};
  if (measured > maxSeconds + 0.5) return { error: `AI Avatar audio must be ${maxSeconds} seconds or shorter.` };
  return { seconds: Math.min(maxSeconds, Math.max(1, Math.ceil(measured - 0.05))) };
}
