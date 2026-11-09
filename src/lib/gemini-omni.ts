/** Gemini Omni Flash 1.2: supplied text/image endpoint specifications. */
export const GEMINI_OMNI_TEXT_MODEL = "google/gemini-omni-flash/v1.2/text-to-video";
export const GEMINI_OMNI_IMAGE_MODEL = "google/gemini-omni-flash/v1.2/image-to-video";
export const GEMINI_OMNI_RESOLUTIONS = ["360p", "720p", "1080p", "4k"] as const;

const SECOND_PRICES = { "360p": 0.0273, "720p": 0.0819, "1080p": 0.1229, "4k": 0.2457 };

export function geminiOmniResolution(value?: string | null) {
  const resolution = value?.trim().toLowerCase();
  return GEMINI_OMNI_RESOLUTIONS.find(item => item === resolution) || "720p";
}

export function geminiOmniDuration(value?: string | null, hasEndFrame = false) {
  const seconds = Number.parseInt(value || "", 10);
  return Math.min(hasEndFrame ? 10 : 15, Math.max(3, Number.isFinite(seconds) ? seconds : 8));
}

export function geminiOmniSecondPrice(resolution?: string | null) {
  return SECOND_PRICES[geminiOmniResolution(resolution)];
}
