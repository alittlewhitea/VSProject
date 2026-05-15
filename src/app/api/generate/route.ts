import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import { ensureCreditAccount, spendCredits } from "../../../lib/credits";

type GenerateMode = "image" | "video";

type GenerateRequest = {
  mode: GenerateMode;
  provider: string;
  ratio: string;
  duration: string;
  prompt: string;
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

function getModelId(mode: GenerateMode, provider: string): string | null {
  const keyByProvider: Record<string, string | undefined> = {
    "chatgpt-image": process.env.FAL_MODEL_IMAGE_CHATGPT,
    "flux-image": process.env.FAL_MODEL_IMAGE_FLUX,
    "recraft-image": process.env.FAL_MODEL_IMAGE_RECRAFT,
    "seedance-video": process.env.FAL_MODEL_VIDEO_SEEDANCE,
    "kling-video": process.env.FAL_MODEL_VIDEO_KLING,
    "veo-video": process.env.FAL_MODEL_VIDEO_VEO
  };

  return (
    keyByProvider[provider] ||
    (mode === "image" ? process.env.FAL_MODEL_IMAGE_DEFAULT : process.env.FAL_MODEL_VIDEO_DEFAULT) ||
    null
  );
}

function getFalImageSize(ratio: string) {
  if (ratio === "16:9") return "landscape_16_9";
  if (ratio === "9:16") return "portrait_16_9";
  return "square_hd";
}

function buildFalInput(body: GenerateRequest, prompt: string) {
  if (body.provider === "flux-image") {
    return {
      prompt,
      image_size: getFalImageSize(body.ratio),
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
    const falKey = process.env.FAL_KEY;
    const modelId = getModelId(body.mode, body.provider);

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

    if (!falKey || !modelId) {
      const taskId = `tsk_${Date.now()}`;
      const spendResult = await spendCredits(admin, user.id, estimatedCredits, "generation_task", taskId);
      if (!spendResult.ok) {
        return NextResponse.json(
          { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.` },
          { status: 402 }
        );
      }
      const { error: insertError } = await admin.from("generation_tasks").insert({
        id: taskId,
        user_id: user.id,
        mode: body.mode,
        provider: body.provider,
        prompt,
        status: "queued",
        estimated_credits: estimatedCredits,
        transport: "mock"
      });
      if (insertError) {
        return NextResponse.json({
          taskId,
          status: "queued",
          transport: "mock" as const,
          mode: body.mode,
          provider: body.provider,
          estimatedCredits,
          balance: spendResult.balance,
          storageWarning: `DB insert failed (mock): ${insertError.message}`
        });
      }
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
      return NextResponse.json(
        {
          error:
            networkError instanceof Error
              ? networkError.message
              : "fal.ai network error."
        },
        { status: 502 }
      );
    }

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      return NextResponse.json(
        { error: `fal.ai request failed: ${submitResponse.status} ${errorText}` },
        { status: 502 }
      );
    }

    const submitPayload = (await submitResponse.json()) as {
      request_id: string;
      status: string;
      status_url: string;
      response_url?: string;
    };
    const spendResult = await spendCredits(admin, user.id, estimatedCredits, "generation_task", submitPayload.request_id);
    if (!spendResult.ok) {
      return NextResponse.json(
        { error: `Not enough credits. This task needs ${estimatedCredits} credits, but your balance is ${spendResult.balance}.` },
        { status: 402 }
      );
    }

    const { error: insertError } = await admin.from("generation_tasks").insert({
      id: submitPayload.request_id,
      user_id: user.id,
      mode: body.mode,
      provider: body.provider,
      prompt,
      status: "queued",
      estimated_credits: estimatedCredits,
      transport: "real",
      status_url: submitPayload.status_url,
      response_url: submitPayload.response_url || null
    });
    if (insertError) {
      return NextResponse.json({
        taskId: submitPayload.request_id,
        status: submitPayload.status?.toLowerCase() || "queued",
        transport: "real" as const,
        mode: body.mode,
        provider: body.provider,
        estimatedCredits,
        balance: spendResult.balance,
        statusUrl: submitPayload.status_url,
        responseUrl: submitPayload.response_url || null,
        storageWarning: `DB insert failed (real): ${insertError.message}`
      });
    }

    return NextResponse.json({
      taskId: submitPayload.request_id,
      status: submitPayload.status?.toLowerCase() || "queued",
      transport: "real" as const,
      mode: body.mode,
      provider: body.provider,
      estimatedCredits,
      balance: spendResult.balance,
      statusUrl: submitPayload.status_url,
      responseUrl: submitPayload.response_url || null
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

