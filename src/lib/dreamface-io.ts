import { refundCredits } from "./credits";

export const DREAMFACE_IO_PROVIDER = "dreamface-io-video";
export const DREAMFACE_IO_DAILY_UNITS = 6;
export const DREAMFACE_IO_CREDITS_PER_UNIT = 10;
const DREAMFACE_IO_MODEL = "agnes-video-v2.0";
const DREAMFACE_IO_API_BASE = "https://apihub.agnes-ai.com";

type DreamfaceIoTask = {
  id: string;
  user_id: string;
  provider: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  provider_request_id: string | null;
  status_url: string | null;
  request_settings?: Record<string, unknown> | null;
  output_url?: string | null;
  created_at: string;
  timed_out_at?: string | null;
};

function apiKey() {
  return process.env.AGNES_API_KEY?.trim() || "";
}

export function isDreamfaceIoConfigured() {
  return Boolean(apiKey());
}

export async function ensureDreamfaceIoPublicImage(
  admin: any,
  userId: string,
  taskId: string,
  value: string | null
) {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) {
    throw new Error("DreamFace IO image input must be an uploaded image or a public HTTPS URL.");
  }

  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    throw new Error("DreamFace IO image input must be smaller than 10 MB.");
  }
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${taskId}.${extension}`;
  const { error } = await admin.storage
    .from("generation-inputs")
    .upload(path, bytes, {
      contentType: match[1],
      upsert: true
    });
  if (error) throw error;
  return admin.storage.from("generation-inputs").getPublicUrl(path).data.publicUrl;
}

export function dreamfaceIoDurationSeconds(duration: string | null | undefined) {
  const seconds = Number.parseInt(String(duration || "5s"), 10);
  return seconds === 10 || seconds === 15 ? seconds : 5;
}

export function dreamfaceIoUnits(duration: string | null | undefined) {
  return dreamfaceIoDurationSeconds(duration) / 5;
}

export function dreamfaceIoCredits(duration: string | null | undefined) {
  return dreamfaceIoUnits(duration) * DREAMFACE_IO_CREDITS_PER_UNIT;
}

function dreamfaceIoSpeechInstruction() {
  return [
    "If the subject speaks, use the same language as the dialogue written in the user's prompt.",
    "Deliver the dialogue exactly as written; do not translate it into English or any other language, and do not paraphrase it.",
    "Preserve the original wording, names, pronunciation, and intended speaking style.",
    "Keep the voice clear and the lip movement naturally synchronized with the original-language dialogue."
  ].join(" ");
}

export function enhanceDreamfaceIoPrompt(
  prompt: string,
  options: {
    imageToVideo?: boolean;
    talkingAvatar?: boolean;
    duration?: string | null;
  } = {}
) {
  const original = prompt.trim().slice(0, 1400);
  const seconds = dreamfaceIoDurationSeconds(options.duration);
  const pacing =
    seconds <= 5
      ? "Keep the action simple and achievable within one continuous short shot."
      : "Keep the action coherent and naturally paced throughout the shot.";
  const speechInstruction = dreamfaceIoSpeechInstruction();

  if (options.talkingAvatar) {
    return [
      `Dialogue to speak exactly: "${original}"`,
      speechInstruction,
      "Use the uploaded image as the only visual source. The visible subject in the image must be the speaker.",
      "Animate only natural speaking behavior: lip movement, subtle facial expression, blinking, light head motion, and gentle breathing.",
      "The subject must say only the dialogue written above. Do not add extra words, narration, subtitles, captions, sound effects, scene changes, new characters, gestures unrelated to speaking, or any additional story action.",
      "Do not translate, rewrite, summarize, or expand the dialogue. Preserve the user's language, wording, names, and speaking style exactly.",
      "Preserve the source image's identity, face, clothing, background, framing, lighting, and visual style as much as possible.",
      "Keep the shot stable and simple with strong lip sync, stable anatomy, consistent facial features, and no unwanted transformations."
    ].filter(Boolean).join(" ");
  }

  if (options.imageToVideo) {
    return [
      original,
      speechInstruction,
      "Preserve the source image's subject identity, facial features, clothing, composition, visual style, and background.",
      "Add subtle, physically plausible subject motion and smooth natural camera movement with gentle parallax.",
      "Maintain stable anatomy, consistent details, coherent lighting, and temporal continuity; avoid sudden scene changes or unwanted transformations.",
      pacing
    ].filter(Boolean).join(" ");
  }

  return [
    original,
    speechInstruction,
    "Create one visually coherent cinematic shot with a clearly defined subject and action.",
    "Use natural, physically plausible motion, smooth intentional camera movement, consistent lighting, stable anatomy, and strong temporal continuity.",
    "Keep the subject and background visually consistent; avoid abrupt cuts, duplicated elements, flicker, distortion, or unwanted transformations.",
    pacing
  ].filter(Boolean).join(" ");
}

function frameCount(duration: string | null | undefined) {
  const seconds = dreamfaceIoDurationSeconds(duration);
  return seconds === 15 ? 361 : seconds === 10 ? 241 : 121;
}

function dimensions(ratio: string, resolution: string | null | undefined) {
  const tier = resolution === "480p" || resolution === "1080p" ? resolution : "720p";
  const landscape = {
    "480p": [768, 512],
    "720p": [1152, 768],
    "1080p": [1728, 1152]
  } as const;
  const [longSide, shortSide] = landscape[tier];

  if (ratio === "9:16" || ratio === "3:4") return { width: shortSide, height: longSide };
  if (ratio === "1:1") return { width: shortSide, height: shortSide };
  if (ratio === "4:3") return { width: Math.round(shortSide * 4 / 3), height: shortSide };
  return { width: longSide, height: shortSide };
}

export function dreamfaceIoStatusUrl(videoId: string) {
  const url = new URL("/agnesapi", DREAMFACE_IO_API_BASE);
  url.searchParams.set("video_id", videoId);
  url.searchParams.set("model_name", DREAMFACE_IO_MODEL);
  return url.toString();
}

export async function submitDreamfaceIoVideo(input: {
  prompt: string;
  imageUrl?: string | null;
  ratio: string;
  resolution?: string | null;
  duration?: string | null;
  seed?: number;
}) {
  const key = apiKey();
  if (!key) throw new Error("DreamFace IO is not configured.");

  const size = dimensions(input.ratio, input.resolution);
  const response = await fetch(`${DREAMFACE_IO_API_BASE}/v1/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DREAMFACE_IO_MODEL,
      prompt: input.prompt,
      ...(input.imageUrl ? { image: input.imageUrl } : {}),
      ...size,
      num_frames: frameCount(input.duration),
      frame_rate: 24,
      ...(typeof input.seed === "number" ? { seed: input.seed } : {})
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `DreamFace IO could not accept this request (${response.status}).`
    );
  }

  const videoId = typeof payload?.video_id === "string" ? payload.video_id : null;
  const taskId =
    typeof payload?.task_id === "string"
      ? payload.task_id
      : typeof payload?.id === "string"
        ? payload.id
        : null;
  if (!videoId) throw new Error("DreamFace IO did not return a tracking id.");

  return {
    requestId: videoId,
    upstreamTaskId: taskId,
    status: typeof payload?.status === "string" ? payload.status : "queued",
    statusUrl: dreamfaceIoStatusUrl(videoId),
    raw: payload
  };
}

export async function fetchDreamfaceIoStatus(videoId: string) {
  const key = apiKey();
  if (!key) throw new Error("DreamFace IO is not configured.");

  const response = await fetch(dreamfaceIoStatusUrl(videoId), {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(`DreamFace IO status check failed (${response.status}).`);
  }
  return payload || {};
}

export function extractDreamfaceIoVideoUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  for (const key of ["remixed_from_video_id", "video_url", "url"]) {
    const value = row[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return null;
}

export function normalizeDreamfaceIoStatus(status: unknown) {
  const value = typeof status === "string" ? status.toLowerCase() : "queued";
  if (value === "completed") return "completed" as const;
  if (value === "failed" || value === "error") return "failed" as const;
  if (value === "in_progress" || value === "processing" || value === "running") return "running" as const;
  return "queued" as const;
}

export async function isDreamfaceIoDailyEligible(admin: any, userId: string) {
  const { data, error } = await admin
    .from("credit_ledger")
    .select("amount")
    .eq("user_id", userId)
    .eq("reason", "signup_bonus")
    .eq("amount", 100)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function getDreamfaceIoDailyUsage(admin: any, userId: string) {
  const { data, error } = await admin.rpc("get_model_daily_usage", {
    p_user_id: userId,
    p_model_key: DREAMFACE_IO_PROVIDER
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  const usedUnits = typeof result?.used_units === "number" ? result.used_units : 0;
  return {
    usedUnits,
    remainingUnits: Math.max(0, DREAMFACE_IO_DAILY_UNITS - usedUnits)
  };
}

export async function reserveDreamfaceIoDailyUnits(
  admin: any,
  userId: string,
  taskId: string,
  units: number
) {
  const { data, error } = await admin.rpc("reserve_model_daily_units", {
    p_user_id: userId,
    p_model_key: DREAMFACE_IO_PROVIDER,
    p_reference_id: taskId,
    p_units: units,
    p_daily_limit: DREAMFACE_IO_DAILY_UNITS
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(result?.allowed),
    duplicate: Boolean(result?.duplicate),
    usedUnits: typeof result?.used_units === "number" ? result.used_units : 0,
    remainingUnits: typeof result?.remaining_units === "number" ? result.remaining_units : 0
  };
}

export async function refundDreamfaceIoDailyUnits(admin: any, userId: string, taskId: string) {
  const { error } = await admin.rpc("refund_model_daily_units", {
    p_user_id: userId,
    p_model_key: DREAMFACE_IO_PROVIDER,
    p_reference_id: taskId
  });
  if (error) throw error;
}

export async function refundDreamfaceIoBilling(admin: any, task: {
  id: string;
  user_id: string;
  estimated_credits: number;
  request_settings?: Record<string, unknown> | null;
}) {
  const billingSource = task.request_settings?.billing_source;
  if (billingSource === "daily_free") {
    await refundDreamfaceIoDailyUnits(admin, task.user_id, task.id);
    return;
  }
  if (task.estimated_credits > 0) {
    await refundCredits(admin, task.user_id, task.estimated_credits, "generation_refund", task.id);
  }
}

async function cleanupDreamfaceIoInput(admin: any, task: DreamfaceIoTask) {
  const imageUrls = task.request_settings?.image_urls;
  if (!Array.isArray(imageUrls)) return;
  const prefix = "/storage/v1/object/public/generation-inputs/";
  const paths = imageUrls
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      try {
        const pathname = new URL(value).pathname;
        return pathname.includes(prefix) ? decodeURIComponent(pathname.split(prefix)[1] || "") : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  if (paths.length) {
    await admin.storage.from("generation-inputs").remove(paths);
  }
}

function timeoutMinutes() {
  const value = Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES || 45);
  return Number.isFinite(value) && value > 0 ? value : 45;
}

export async function syncDreamfaceIoTask(admin: any, task: DreamfaceIoTask) {
  const now = new Date().toISOString();
  if (!task.provider_request_id) {
    const orphanMinutes = Number(process.env.GENERATION_ORPHAN_TIMEOUT_MINUTES || 10);
    const timedOut = Date.now() - new Date(task.created_at).getTime() > orphanMinutes * 60 * 1000;
    if (!timedOut) {
      await admin
        .from("generation_tasks")
        .update({ last_checked_at: now, updated_at: now })
        .eq("id", task.id)
        .eq("user_id", task.user_id);
      return {
        status: task.status,
        providerStatus: "queued",
        result: null,
        outputUrl: task.output_url || null,
        failureCode: null,
        failureReason: null
      };
    }
    await refundDreamfaceIoBilling(admin, task);
    const failureReason = "DreamFace IO could not attach task tracking. Your generation allowance was returned.";
    await admin
      .from("generation_tasks")
      .update({
        status: "failed",
        failure_code: "provider_tracking_missing",
        failure_reason: failureReason,
        last_checked_at: now,
        timed_out_at: now,
        updated_at: now
      })
      .eq("id", task.id)
      .eq("user_id", task.user_id)
      .throwOnError();
    return {
      status: "failed" as const,
      providerStatus: "failed",
      result: null,
      outputUrl: task.output_url || null,
      failureCode: "provider_tracking_missing",
      failureReason
    };
  }

  const result = await fetchDreamfaceIoStatus(task.provider_request_id);
  let normalized = normalizeDreamfaceIoStatus(result.status);
  let failureCode: string | null = null;
  let failureReason: string | null = null;
  const timedOut =
    (normalized === "queued" || normalized === "running") &&
    Date.now() - new Date(task.created_at).getTime() > timeoutMinutes() * 60 * 1000;

  if (timedOut) {
    normalized = "failed";
    failureCode = "task_timeout";
    failureReason = "DreamFace IO took too long to finish. Your generation allowance was returned.";
  } else if (normalized === "failed") {
    failureCode = "provider_failed";
    failureReason = "DreamFace IO could not complete this generation. Your generation allowance was returned.";
  }

  if (normalized === "failed" && task.status !== "failed") {
    await refundDreamfaceIoBilling(admin, task);
  }
  if (normalized === "completed" || normalized === "failed") {
    await cleanupDreamfaceIoInput(admin, task).catch(() => null);
  }

  const outputUrl = normalized === "completed" ? extractDreamfaceIoVideoUrl(result) : task.output_url || null;
  const publicResult = {
    status: normalized,
    progress: typeof result.progress === "number" ? result.progress : normalized === "completed" ? 100 : null,
    seconds: typeof result.seconds === "string" || typeof result.seconds === "number" ? result.seconds : null,
    size: typeof result.size === "string" ? result.size : null,
    video: outputUrl ? { url: outputUrl } : null,
    error: normalized === "failed" ? failureReason : null
  };
  await admin
    .from("generation_tasks")
    .update({
      status: normalized,
      output_url: outputUrl,
      raw_result: publicResult,
      failure_code: failureCode,
      failure_reason: failureReason,
      last_checked_at: now,
      timed_out_at: timedOut ? now : task.timed_out_at || null,
      updated_at: now
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id)
    .throwOnError();

  return {
    status: normalized,
    providerStatus: typeof result.status === "string" ? result.status : "queued",
    result: publicResult,
    outputUrl,
    failureCode,
    failureReason
  };
}
