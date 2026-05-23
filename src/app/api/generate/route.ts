import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import { ensureCreditAccount, refundCredits, spendCredits } from "../../../lib/credits";

type GenerateMode = "image" | "video";

type GenerateRequest = {
  mode: GenerateMode;
  imageWorkflow?: "text-to-image" | "image-to-image";
  provider: string;
  ratio: string;
  duration: string;
  prompt: string;
  imageSize?: string;
  imageUrls?: string[];
  resolution?: string;
  outputFormat?: string;
  idempotencyKey?: string;
};

type ExistingTask = {
  id: string;
  mode: "image" | "video";
  provider: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  status_url: string | null;
  response_url: string | null;
  failure_code: string | null;
  failure_reason: string | null;
};

function isValidBody(body: unknown): body is GenerateRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as Record<string, unknown>;
  return (
    (payload.mode === "image" || payload.mode === "video") &&
    typeof payload.provider === "string" &&
    typeof payload.ratio === "string" &&
    typeof payload.duration === "string" &&
    typeof payload.prompt === "string"
  );
}

function hasReferenceImages(body: GenerateRequest) {
  return body.mode === "image" && Array.isArray(body.imageUrls) && body.imageUrls.some((url) => typeof url === "string" && url.trim());
}

function getModelId(mode: GenerateMode, provider: string, editImage = false): string | null {
  const keyByProvider: Record<string, string | undefined> = {
    "chatgpt-image": editImage
      ? process.env.FAL_MODEL_IMAGE_CHATGPT_EDIT || "openai/gpt-image-2/edit"
      : process.env.FAL_MODEL_IMAGE_CHATGPT || "openai/gpt-image-2",
    "flux-image": process.env.FAL_MODEL_IMAGE_FLUX,
    "nano-banana-image": editImage
      ? process.env.FAL_MODEL_IMAGE_NANO_BANANA_EDIT || "fal-ai/nano-banana-2/edit"
      : process.env.FAL_MODEL_IMAGE_NANO_BANANA || "fal-ai/nano-banana-2",
    "nano-banana-edit": process.env.FAL_MODEL_IMAGE_NANO_BANANA_EDIT || "fal-ai/nano-banana-2/edit",
    "recraft-image": process.env.FAL_MODEL_IMAGE_RECRAFT,
    "seedance-video": process.env.FAL_MODEL_VIDEO_SEEDANCE,
    "kling-video": process.env.FAL_MODEL_VIDEO_KLING,
    "veo-video": process.env.FAL_MODEL_VIDEO_VEO,
    "grok-video": process.env.FAL_MODEL_VIDEO_GROK || "xai/grok-imagine-video/text-to-video"
  };

  return (
    keyByProvider[provider] ||
    (mode === "image" ? process.env.FAL_MODEL_IMAGE_DEFAULT : process.env.FAL_MODEL_VIDEO_DEFAULT) ||
    null
  );
}

const IMAGE_SIZE_PRESETS = new Set([
  "default_4_3",
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9"
]);
const EDIT_ASPECT_RATIOS = new Set(["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"]);
const EDIT_RESOLUTIONS = new Set(["0.5K", "1K", "2K", "4K"]);
const OUTPUT_FORMATS = new Set(["jpeg", "png", "webp"]);
const VIDEO_ASPECT_RATIOS = new Set(["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"]);
const GROK_VIDEO_RESOLUTIONS = new Set(["480p", "720p"]);

function getFalImageSize(ratio: string, imageSize?: string) {
  if (imageSize === "default_4_3") return "landscape_4_3";
  if (imageSize && IMAGE_SIZE_PRESETS.has(imageSize)) return imageSize;
  if (ratio === "16:9") return "landscape_16_9";
  if (ratio === "4:3") return "landscape_4_3";
  if (ratio === "3:4") return "portrait_4_3";
  if (ratio === "9:16") return "portrait_16_9";
  return "square_hd";
}

function buildFalInput(body: GenerateRequest, prompt: string) {
  if (body.provider === "grok-video") {
    const duration = Number.parseInt(body.duration, 10);
    return {
      prompt,
      duration: Number.isInteger(duration) && duration > 0 ? duration : 6,
      aspect_ratio: VIDEO_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "16:9",
      resolution: body.resolution && GROK_VIDEO_RESOLUTIONS.has(body.resolution) ? body.resolution : "720p"
    };
  }

  if (body.provider === "nano-banana-edit" || (body.provider === "nano-banana-image" && hasReferenceImages(body))) {
    return {
      prompt,
      image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 14) : [],
      aspect_ratio: EDIT_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      resolution: body.resolution && EDIT_RESOLUTIONS.has(body.resolution) ? body.resolution : "1K",
      output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
      num_images: 1,
      limit_generations: true
    };
  }

  if (body.provider === "chatgpt-image") {
    if (hasReferenceImages(body)) {
      return {
        prompt,
        image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 16) : [],
        image_size: getFalImageSize(body.ratio, body.imageSize),
        quality: "high",
        output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png"
      };
    }
    return {
      prompt,
      image_size: getFalImageSize(body.ratio, body.imageSize)
    };
  }

  if (body.provider === "nano-banana-image") {
    return {
      prompt,
      aspect_ratio: EDIT_ASPECT_RATIOS.has(body.ratio) ? body.ratio : "auto",
      resolution: body.resolution && EDIT_RESOLUTIONS.has(body.resolution) ? body.resolution : "1K",
      output_format: body.outputFormat && OUTPUT_FORMATS.has(body.outputFormat) ? body.outputFormat : "png",
      num_images: 1
    };
  }

  if (body.provider === "flux-image") {
    return {
      prompt,
      image_size: getFalImageSize(body.ratio, body.imageSize),
      guidance_scale: 3.5,
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      acceleration: "none"
    };
  }

  return { prompt };
}

function generationTaskId(idempotencyKey: unknown) {
  const raw = typeof idempotencyKey === "string" ? idempotencyKey.trim() : "";
  const key = raw && /^[a-zA-Z0-9_-]{8,80}$/.test(raw) ? raw : randomUUID();
  return `tsk_${key}`;
}

async function findExistingTask(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, taskId: string) {
  const { data, error } = await admin
    .from("generation_tasks")
    .select("id,mode,provider,status,estimated_credits,transport,status_url,response_url,failure_code,failure_reason")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as ExistingTask | null;
}

async function returnExistingTask(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  task: ExistingTask
) {
  const account = await ensureCreditAccount(admin, userId);
  if (task.status === "failed" && task.failure_code === "insufficient_credits") {
    return NextResponse.json(
      { error: task.failure_reason || "Not enough credits.", taskId: task.id, duplicate: true },
      { status: 402 }
    );
  }

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
    transport: task.transport,
    mode: task.mode,
    provider: task.provider,
    estimatedCredits: task.estimated_credits,
    balance: account.balance,
    statusUrl: task.status_url,
    responseUrl: task.response_url,
    failureCode: task.failure_code,
    failureReason: task.failure_reason,
    duplicate: true
  });
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const body = await request.json();

    if (!isValidBody(body)) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const prompt = body.prompt.trim();
    if (prompt.length < 8) {
      return NextResponse.json({ error: "Prompt must be at least 8 characters." }, { status: 400 });
    }

    const estimatedCredits = body.mode === "image" ? 12 : body.duration === "10s" ? 68 : body.duration === "8s" ? 56 : 42;
    if (body.mode === "image" && body.provider === "nano-banana-edit") {
      const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((url) => typeof url === "string" && url.trim()) : [];
      if (!imageUrls.length) {
        return NextResponse.json({ error: "Image to Image requires at least one reference image." }, { status: 400 });
      }
    }
    const falKey = process.env.FAL_KEY;
    const modelId = getModelId(body.mode, body.provider, hasReferenceImages(body));
    const taskId = generationTaskId(body.idempotencyKey);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server auth storage is not configured." }, { status: 500 });
    }
    const creditAccount = await ensureCreditAccount(admin, user.id);
    if (creditAccount.balance < estimatedCredits) {
      return NextResponse.json(
        { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${creditAccount.balance}.` },
        { status: 402 }
      );
    }

    const existingTask = await findExistingTask(admin, user.id, taskId);
    if (existingTask) {
      return returnExistingTask(admin, user.id, existingTask);
    }

    const transport = !falKey || !modelId ? "mock" : "real";
    try {
      const { error: insertError } = await admin.from("generation_tasks").insert({
        id: taskId,
        user_id: user.id,
        mode: body.mode,
        provider: body.provider,
        prompt,
        status: "queued",
        estimated_credits: estimatedCredits,
        transport
      });
      if (insertError) {
        const existingAfterConflict = await findExistingTask(admin, user.id, taskId);
        if (existingAfterConflict) {
          return returnExistingTask(admin, user.id, existingAfterConflict);
        }
        throw insertError;
      }
    } catch (insertError) {
      const existingAfterConflict = await findExistingTask(admin, user.id, taskId);
      if (existingAfterConflict) {
        return returnExistingTask(admin, user.id, existingAfterConflict);
      }
      return NextResponse.json(
        {
          error: `Task could not be saved, so credits were not charged: ${
            insertError instanceof Error ? insertError.message : "Task history insert failed."
          }`
        },
        { status: 500 }
      );
    }

    const spendResult = await spendCredits(admin, user.id, estimatedCredits, "generation_task", taskId);
    if (!spendResult.ok) {
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "insufficient_credits",
          failure_reason: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.`,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);
      return NextResponse.json(
        { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.` },
        { status: 402 }
      );
    }

    if (transport === "mock") {
      return NextResponse.json({
        taskId,
        status: "queued",
        transport: "mock" as const,
        mode: body.mode,
        provider: body.provider,
        estimatedCredits,
        balance: spendResult.balance
      });
    }

    let submitResponse: Response;
    try {
      submitResponse = await fetchFal(`https://queue.fal.run/${modelId}`, {
        method: "POST",
        attempts: 3,
        timeoutMs: 22000,
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildFalInput(body, prompt))
      });
    } catch (networkError) {
      const balance = await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "provider_submit_failed",
          failure_reason:
            networkError instanceof Error
              ? `fal.ai network error before provider accepted the task. Credits were refunded automatically. ${networkError.message}`
              : "fal.ai network error before provider accepted the task. Credits were refunded automatically.",
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);
      return NextResponse.json(
        {
          error:
            networkError instanceof Error
              ? networkError.message
              : "fal.ai network error.",
          balance
        },
        { status: 502 }
      );
    }

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      const balance = await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
      await admin
        .from("generation_tasks")
        .update({
          status: "failed",
          failure_code: "provider_submit_failed",
          failure_reason: `fal.ai rejected the task before generation started. Credits were refunded automatically. ${submitResponse.status} ${errorText}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);
      return NextResponse.json(
        { error: `fal.ai request failed: ${submitResponse.status} ${errorText}`, balance },
        { status: 502 }
      );
    }

    const submitPayload = (await submitResponse.json()) as {
      request_id: string;
      status: string;
      status_url: string;
      response_url?: string;
    };

    try {
      const normalizedStatus = submitPayload.status?.toUpperCase() === "IN_PROGRESS" ? "running" : "queued";
      const { error: updateError } = await admin
        .from("generation_tasks")
        .update({
          provider_request_id: submitPayload.request_id,
          status: normalizedStatus,
          status_url: submitPayload.status_url,
          response_url: submitPayload.response_url || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }
    } catch (updateError) {
      const balance = await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
      try {
        await admin
          .from("generation_tasks")
          .update({
            status: "failed",
            failure_code: "local_tracking_failed",
            failure_reason: `Provider accepted the task (${submitPayload.request_id}), but local tracking could not be updated. Credits were refunded automatically.`,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId)
          .eq("user_id", user.id);
      } catch {
        // The original update already failed. The response still carries the provider id for support.
      }
      return NextResponse.json(
        {
          error: `Provider accepted the task but local tracking failed, so credits were refunded. Provider request id: ${submitPayload.request_id}. ${
            updateError instanceof Error ? updateError.message : "Task update failed."
          }`,
          balance
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      taskId,
      status: submitPayload.status?.toLowerCase() || "queued",
      transport: "real" as const,
      mode: body.mode,
      provider: body.provider,
      estimatedCredits,
      balance: spendResult.balance,
      statusUrl: submitPayload.status_url,
      responseUrl: submitPayload.response_url || null,
      providerRequestId: submitPayload.request_id
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `Unable to process generation request: ${error.message}` : "Unable to process generation request."
      },
      { status: 500 }
    );
  }
}

