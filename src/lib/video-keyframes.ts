/** Only enable documented start/end-frame endpoints; other models stay single-image. */
export function videoSupportsEndFrame(provider: string): boolean {
  return ["minimax-h3-max-video", "minimax-h3-max-turbo-video", "seedance-video", "gemini-omni-flash-video"].includes(provider);
}

export function validateVideoImages(provider: string, images: unknown): string | null {
  if (images === undefined) return null;
  if (!Array.isArray(images) || images.some(url => typeof url !== "string" || !url.trim())) return "Invalid video image URLs.";
  const limit = videoSupportsEndFrame(provider) ? 2 : 1;
  if (images.length > limit) return limit === 2 ? "This model accepts a start frame and an optional end frame (2 images maximum)." : "This model accepts only one image.";
  return null;
}

export function videoEndFrameInput(provider: string, images?: string[]): { end_image_url?: string } {
  return videoSupportsEndFrame(provider) && images?.[1]?.trim() ? { end_image_url: images[1].trim() } : {};
}
