import { creditsFromFalUsd } from "./model-pricing";

type FalModelError = {
  loc?: unknown[];
  msg?: string;
  type?: string;
  url?: string;
  ctx?: Record<string, unknown>;
};

export type FalFailureInfo = {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean | null;
  costUsd: number | null;
  details: unknown;
};

export class FalApiError extends Error {
  status: number;
  info: FalFailureInfo;

  constructor(status: number, info: FalFailureInfo) {
    super(info.userMessage);
    this.name = "FalApiError";
    this.status = status;
    this.info = info;
  }
}

function retryableFromHeader(value: string | null) {
  if (!value) return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

function firstModelError(payload: unknown): FalModelError | null {
  if (!payload || typeof payload !== "object") return null;
  const detail = (payload as Record<string, unknown>).detail;
  if (Array.isArray(detail)) {
    const first = detail.find((item) => item && typeof item === "object");
    return (first as FalModelError | undefined) || null;
  }
  return null;
}

function requestErrorType(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).error_type;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requestErrorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).detail;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatBytes(value: unknown) {
  const bytes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes} bytes`;
}

function userMessageForError(code: string, modelError: FalModelError | null) {
  const ctx = modelError?.ctx || {};
  if (code === "content_policy_violation") {
    return "We could not process this request because the prompt or reference media appears to include adult, sensitive, or otherwise restricted content. Please soften the prompt or use a different reference and try again.";
  }
  if (code === "face_detection_error") {
    return "We could not detect a clear face in the reference image. Please use a front-facing image with one visible face and try again.";
  }
  if (code === "image_load_error" || code === "file_download_error") {
    return "We could not load the reference file. Please make sure the URL is public, the file opens in a browser, and then try again.";
  }
  if (code === "unsupported_image_format") {
    return "That image format is not supported. Please use JPG, PNG, or WEBP and try again.";
  }
  if (code === "unsupported_video_format") {
    return "That video format is not supported. Please use MP4, MOV, or WEBM and try again.";
  }
  if (code === "unsupported_audio_format") {
    return "That audio format is not supported. Please use MP3, WAV, or OGG and try again.";
  }
  if (code === "image_too_small") {
    const width = ctx.min_width;
    const height = ctx.min_height;
    return `The reference image is too small.${width && height ? ` Please use an image at least ${width}x${height}px.` : " Please use a larger image."}`;
  }
  if (code === "image_too_large") {
    const width = ctx.max_width;
    const height = ctx.max_height;
    return `The reference image is too large.${width && height ? ` Please use an image up to ${width}x${height}px.` : " Please use a smaller image."}`;
  }
  if (code === "file_too_large") {
    const maxSize = formatBytes(ctx.max_size);
    return `The uploaded file is too large.${maxSize ? ` Please use a file under ${maxSize}.` : " Please use a smaller file."}`;
  }
  if (code === "audio_duration_too_long" || code === "video_duration_too_long") {
    const maxDuration = ctx.max_duration;
    return `The media file is too long.${maxDuration ? ` Please keep it under ${maxDuration} seconds.` : " Please use a shorter file."}`;
  }
  if (code === "audio_duration_too_short" || code === "video_duration_too_short") {
    const minDuration = ctx.min_duration;
    return `The media file is too short.${minDuration ? ` Please use at least ${minDuration} seconds.` : " Please use a longer file."}`;
  }
  if (code === "no_media_generated") {
    return "The model could not produce a usable result from this input. Please adjust the prompt or reference media and try again.";
  }
  if (code === "feature_not_supported" || code === "one_of") {
    return "This combination of settings is not supported by the selected model. Please adjust the settings and try again.";
  }
  if (code === "generation_timeout" || code === "request_timeout" || code === "startup_timeout") {
    return "The provider took too long to finish this request. Please try again in a moment or use a simpler prompt.";
  }
  if (code.startsWith("runner_") || code === "downstream_service_unavailable" || code === "downstream_service_error") {
    return "The provider is temporarily having trouble. Please try again in a moment.";
  }
  if (code === "bad_request") {
    return "The provider could not accept this request. Please adjust the input and try again.";
  }
  return modelError?.msg || "The provider could not complete this request. Please adjust the input and try again.";
}

export function extractFalCostUsd(value: unknown): number | null {
  const seen = new Set<unknown>();
  const candidates: number[] = [];

  function visit(node: unknown, key = "") {
    if (!node || candidates.length > 12) return;
    if (typeof node === "object") {
      if (seen.has(node)) return;
      seen.add(node);
      for (const [childKey, childValue] of Object.entries(node as Record<string, unknown>)) {
        visit(childValue, childKey);
      }
      return;
    }
    if (typeof node !== "number" && typeof node !== "string") return;
    const normalizedKey = key.toLowerCase();
    if (!normalizedKey.includes("cost")) return;
    const amount = typeof node === "number" ? node : Number.parseFloat(node);
    if (Number.isFinite(amount) && amount > 0 && amount < 1000) {
      candidates.push(amount);
    }
  }

  visit(value);
  return candidates.length ? Math.max(...candidates) : null;
}

export function parseFalFailure(payload: unknown, headers?: Headers | null, status = 0): FalFailureInfo {
  const modelError = firstModelError(payload);
  const headerCode = headers?.get("x-fal-error-type") || null;
  const code = modelError?.type || requestErrorType(payload) || headerCode || `fal_http_${status || "error"}`;
  const message = modelError?.msg || requestErrorDetail(payload) || (payload && typeof payload === "object" ? JSON.stringify(payload).slice(0, 500) : "fal.ai request failed.");
  return {
    code,
    message,
    userMessage: userMessageForError(code, modelError),
    retryable: retryableFromHeader(headers?.get("x-fal-retryable") || null),
    costUsd: extractFalCostUsd(payload),
    details: payload
  };
}

export async function falApiErrorFromResponse(response: Response) {
  let payload: unknown = null;
  try {
    payload = await response.clone().json();
  } catch {
    try {
      payload = { detail: await response.text() };
    } catch {
      payload = { detail: "fal.ai request failed." };
    }
  }
  return new FalApiError(response.status, parseFalFailure(payload, response.headers, response.status));
}

export function falActualCreditsFromCost(costUsd: number | null, estimatedCredits: number) {
  if (!Number.isFinite(costUsd || 0) || !costUsd || costUsd <= 0) return 0;
  return Math.min(Math.max(0, estimatedCredits), creditsFromFalUsd(costUsd, 1));
}

export function falRefundCreditsFromCost(costUsd: number | null, estimatedCredits: number) {
  return Math.max(0, estimatedCredits - falActualCreditsFromCost(costUsd, estimatedCredits));
}

export function formatFalFailureReason(info: FalFailureInfo, estimatedCredits: number, refundedCredits: number) {
  const actualCredits = Math.max(0, estimatedCredits - refundedCredits);
  const creditNote =
    actualCredits > 0
      ? `The provider reported a processing cost, so ${actualCredits} credits were used and ${refundedCredits} credits were returned.`
      : refundedCredits > 0
        ? `${refundedCredits} credits were returned to your balance.`
        : "No additional credits were used.";
  return `${info.userMessage} ${creditNote}`;
}
