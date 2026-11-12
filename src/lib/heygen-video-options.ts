export const HEYGEN_HD_ASPECT_RATIOS = ["16:9", "9:16"] as const;

// I2V/Avatar do not send an aspect_ratio field; their existing source-image
// behavior is separate from the explicit T2V/reference output settings.
export function heygenRequiresHdAspectRatio(workflow: string, resolution?: string) {
  return (workflow === "text-to-video" || workflow === "reference-to-video") &&
    (resolution === "1080p" || resolution === "2k");
}

export function heygenAspectRatioError(workflow: string, resolution: string | undefined, ratio: string) {
  return heygenRequiresHdAspectRatio(workflow, resolution) && !HEYGEN_HD_ASPECT_RATIOS.some(value => value === ratio)
    ? "HeyGen Video at 1080p and 2K supports only 16:9 and 9:16. Choose a supported aspect ratio, or use 480p/768p."
    : null;
}

export function preferredHeygenHdRatio(current: string) {
  return current === "9:16" || current === "3:4" ? "9:16" : "16:9";
}
