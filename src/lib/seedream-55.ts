import { isPublicReferenceUrl } from "./heygen-reference-video";

export const SEEDREAM_55_PROVIDER = "seedream-5.5-image";
export const SEEDREAM_55_BASE = "bytedance/seedream/v5.5";
export const SEEDREAM_55_SIZES = ["auto_1K", "auto_1.5K", "auto_2K", "custom"];
export const SEEDREAM_55_REFERENCE_LIMIT = 10;

type SeedreamRequest = {
  mode?: string; imageWorkflow?: string; prompt?: string;
  imageSize?: string | null; imageWidth?: number | null; imageHeight?: number | null;
  imageUrls?: string[]; numImages?: number | null;
  outputFormat?: string | null; background?: string | null;
};
export function seedream55Endpoint(edit = false) {
  return `${SEEDREAM_55_BASE}/${edit ? "edit" : "text-to-image"}`;
}
export function seedream55Size(body: SeedreamRequest): string | { width: number; height: number } {
  if (body.imageSize === "custom") return { width: body.imageWidth!, height: body.imageHeight! };
  return SEEDREAM_55_SIZES.includes(body.imageSize || "") ? body.imageSize! : "auto_2K";
}
export function seedream55OutputCost(body: SeedreamRequest) {
  const size = seedream55Size(body);
  return typeof size === "string" ? size === "auto_2K" ? 0.0405 : 0.03 : size.width * size.height > 2_610_000 ? 0.0405 : 0.03;
}
export function seedream55Error(body: SeedreamRequest): string | null {
  if (body.mode !== "image" || !["text-to-image", "image-to-image"].includes(body.imageWorkflow || "text-to-image")) return "Seedream 5.5 requires an image generation or editing workflow.";
  if (!body.prompt?.trim()) return "Prompt is required.";
  if (body.imageSize !== undefined && !SEEDREAM_55_SIZES.includes(body.imageSize || "")) return "Select a Seedream 5.5 image size.";
  if (body.imageSize === "custom") {
    const { imageWidth: w, imageHeight: h } = body;
    if (!Number.isInteger(w) || !Number.isInteger(h) || !w || !h || w < 1 || h < 1 || w > 14142 || h > 14142 || w * h < 921600 || w * h > 4624220 || w / h < 1 / 16 || w / h > 16) return "Custom dimensions require 921,600–4,624,220 pixels and an aspect ratio between 1:16 and 16:1.";
  }
  if (body.numImages !== undefined && (!Number.isInteger(body.numImages) || !body.numImages || body.numImages < 1 || body.numImages > 6)) return "Seedream 5.5 supports 1–6 output images.";
  if (body.outputFormat !== undefined && !["png", "jpeg"].includes(body.outputFormat || "")) return "Seedream 5.5 supports PNG or JPEG.";
  if (body.background !== undefined && !["auto", "opaque", "transparent"].includes(body.background || "")) return "Invalid image background.";
  if (body.background === "transparent" && body.outputFormat && body.outputFormat !== "png") return "Transparent backgrounds require PNG output.";
  if (body.imageUrls !== undefined && (!Array.isArray(body.imageUrls) || body.imageUrls.length > 10 || body.imageUrls.some(url => !(isPublicReferenceUrl(url) || typeof url === "string" && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(url))))) return "Seedream 5.5 accepts up to 10 reference images.";
  if (body.imageWorkflow === "image-to-image" && !body.imageUrls?.length) return "Image editing requires at least one reference image.";
  return null;
}
export function buildSeedream55Input(body: SeedreamRequest, prompt: string) {
  return {
    prompt, image_size: seedream55Size(body), num_images: body.numImages ?? 1,
    output_format: body.outputFormat || "png", background: body.background || "auto",
    enable_safety_checker: true, sync_mode: false, watermark: false,
    ...(body.imageUrls?.length ? { image_urls: body.imageUrls.map(url => url.trim()) } : {})
  };
}
