// Replace null with a public HTTPS MP4/WebM and optional poster URL after review.
// Only enter the model/settings that actually produced the uploaded clip.
export type TextVideoMedia = {
  videoUrl: string;
  posterUrl?: string;
  model?: string;
  duration?: string;
  resolution?: string;
  prompt: string;
};

export const textVideoMedia: Record<"hero" | "product" | "cinema" | "illustration" | "nature", TextVideoMedia | null> = {
  hero: null,
  product: null,
  cinema: null,
  illustration: null,
  nature: null
};
