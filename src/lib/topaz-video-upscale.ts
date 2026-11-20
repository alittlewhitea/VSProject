import { seedModelCreditsFromCostUsd } from "./seed-model-pricing";

export const TOPAZ_VIDEO_PROVIDER = "topaz-video";
export const TOPAZ_VIDEO_ENDPOINT = "topaz/upscale/video/precision";
export const TOPAZ_VIDEO_WORKFLOW = "video-upscale";
export const MAX_TOPAZ_VIDEO_SECONDS = 300;
const TOPAZ_VIDEO_TARGET_MARGIN = 0.50;

export const topazVideoModels = [
  "Proteus", "Proteus Natural", "Iris", "Iris Low Quality", "Dione DV", "Dione TV", "Dione Robust",
  "Dione Dehalo", "Dione Robust Dehalo", "Artemis High Quality", "Artemis Medium Quality",
  "Artemis Low Quality", "Artemis Strong Halo", "Artemis Medium Halo", "Artemis Aliasing & Moire",
  "Gaia HQ", "Gaia CG", "Gaia 2", "Rhea", "Theia Fine Tune Detail", "Theia Fine Tune Fidelity"
] as const;

export const topazVideoAdjustments = {
  compression: 1, noise: 1, halo: 1, grain: 0.1, recover_detail: 1
};
export type TopazVideoAdjustment = keyof typeof topazVideoAdjustments;
export type TopazVideoOptions = {
  model: (typeof topazVideoModels)[number];
  upscale_factor: number;
  target_fps?: number;
  H264_output: boolean;
} & Partial<Record<TopazVideoAdjustment, number>>;
export type TopazVideoMetadata = { width: number; height: number; duration: number; fps: number };
export type TopazVideoSource = TopazVideoMetadata & { url: string; proof: string };

export const defaultTopazVideoOptions: TopazVideoOptions = {
  model: "Proteus", upscale_factor: 2, H264_output: true
};

export function topazVideoNeeds2x(model: TopazVideoOptions["model"]) {
  return model === "Proteus Natural" || model === "Gaia 2";
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function parseTopazVideoOptions(value: unknown): TopazVideoOptions | null {
  if (value === undefined) return { ...defaultTopazVideoOptions };
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const model = input.model as TopazVideoOptions["model"];
  const factor = input.upscale_factor;
  if (!topazVideoModels.includes(model) || !inRange(factor, 1, 4) ||
    (topazVideoNeeds2x(model) && factor !== 2) || typeof input.H264_output !== "boolean") return null;
  const options: TopazVideoOptions = { model, upscale_factor: factor, H264_output: input.H264_output };
  if (input.target_fps !== undefined) {
    if (!inRange(input.target_fps, 16, 60) || !Number.isInteger(input.target_fps)) return null;
    options.target_fps = input.target_fps;
  }
  for (const key of Object.keys(topazVideoAdjustments) as TopazVideoAdjustment[]) {
    const amount = input[key];
    if (amount === undefined) continue;
    if (!inRange(amount, 0, topazVideoAdjustments[key])) return null;
    if (key === "grain" && Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-9) return null;
    options[key] = amount;
  }
  return options;
}

export function validTopazVideoMetadata(video: TopazVideoMetadata) {
  return inRange(video.width, 1, 16384) && inRange(video.height, 1, 16384) &&
    inRange(video.duration, Number.EPSILON, MAX_TOPAZ_VIDEO_SECONDS) && inRange(video.fps, Number.EPSILON, 240);
}

export function topazVideoQuote(video: TopazVideoMetadata, options: TopazVideoOptions) {
  if (!validTopazVideoMetadata(video)) return null;
  const width = Math.ceil(video.width * options.upscale_factor / 2) * 2;
  const height = Math.ceil(video.height * options.upscale_factor / 2) * 2;
  const fps = options.target_fps ?? video.fps;
  const pixels = width * height;
  if (pixels > 3840 * 2160 || Math.max(width, height) > 4096) return null;

  // Estimate from fal's published 30 fps examples with one rounding step per
  // job. Intermediate sizes/frame rates are application estimates.
  const rate = options.model === "Gaia 2" ? 0.5 : options.model === "Proteus Natural" ? 0.9 : 1;
  const rawCost = 0.0515 * (pixels / (3840 * 2160)) * (fps / 30) * video.duration * rate;
  const cost = Math.max(0.1, Math.ceil(rawCost * 10 - 1e-9) / 10);
  return { width, height, fps, cost, credits: seedModelCreditsFromCostUsd(cost, TOPAZ_VIDEO_TARGET_MARGIN) };
}

function videoResolutionScale(video: TopazVideoMetadata, longEdge: number, shortEdge: number) {
  const scale = Math.min(longEdge / Math.max(video.width, video.height), shortEdge / Math.min(video.width, video.height));
  return Math.floor(scale * 1e8) / 1e8;
}

export function topazVideoResolutionOptions(video: TopazVideoMetadata) {
  const resolutions = [
    { label: "720p", shortEdge: 720 },
    { label: "1080p", shortEdge: 1080 },
    { label: "1440p", shortEdge: 1440 },
    { label: "4K", shortEdge: 2160 }
  ];
  const maxScale = videoResolutionScale(video, 3840, 2160);
  const options = resolutions.flatMap(({ label, shortEdge }) => {
    // The p labels refer to the short side. Keep wider clips at their original aspect ratio.
    const scale = label === "4K" ? maxScale : videoResolutionScale(video, Infinity, shortEdge);
    if (scale < 1 || scale > 4 || scale > maxScale) return [];
    const quote = topazVideoQuote(video, { ...defaultTopazVideoOptions, upscale_factor: scale });
    return quote ? [{ label, scale, width: quote.width, height: quote.height }] : [];
  });
  return options.filter(({ width, height }, index) =>
    index === 0 || width !== options[index - 1].width || height !== options[index - 1].height
  );
}

export function defaultTopazVideoScale(video: TopazVideoMetadata) {
  const resolutions = topazVideoResolutionOptions(video);
  return (resolutions.find(({ label }) => label === "1080p") ?? resolutions[0])?.scale ??
    Math.max(1, Math.min(4, videoResolutionScale(video, 3840, 2160)));
}

export function buildTopazVideoInput(videoUrl: string, options: TopazVideoOptions) {
  return { video_url: videoUrl, ...options, enable_safety_checker: true };
}
