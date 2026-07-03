import { NextResponse } from "next/server";
import { refundCredits } from "../../../../lib/credits";
import { fetchFal } from "../../../../lib/fal-fetch";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { cronAuthorized } from "../../../../lib/cron-auth";
import { resolveFalCostUsd } from "../../../../lib/fal-billing";
import {
  falApiErrorFromResponse,
  falNoMediaFailurePayload,
  falRefundCreditsFromCost,
  falResultLooksFailed,
  formatFalFailureReason,
  parseFalFailure
} from "../../../../lib/fal-errors";
import { DREAMFACE_IO_PROVIDER, syncDreamfaceIoTask } from "../../../../lib/dreamface-io";

const DEFAULT_TASK_TIMEOUT_MINUTES = 45;
const DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES = 10;
const SYNC_LIMIT = 40;

type PendingTaskRow = {
  id: string;
  user_id: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  provider_request_id: string | null;
  status_url: string | null;
  response_url: string | null;
  created_at: string;
  timed_out_at?: string | null;
  provider: string;
  request_settings?: Record<string, unknown> | null;
  output_url?: string | null;
};

function taskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES || DEFAULT_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TASK_TIMEOUT_MINUTES;
}

function orphanTaskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_ORPHAN_TIMEOUT_MINUTES || DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES;
}

function isOlderThan(value: string, minutes: number) {
  return Date.now() - new Date(value).getTime() > minutes * 60 * 1000;
}

function isAllowedFalUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "queue.fal.run";
  } catch {
    return false;
  }
}

function normalizeFalStatus(status: string) {
  const upperStatus = status.toUpperCase();
  if (upperStatus === "IN_QUEUE") return "queued";
  if (upperStatus === "IN_PROGRESS") return "running";
  if (upperStatus === "COMPLETED") return "completed";
  return "failed";
}

function extractMediaUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const payload = result as Record<string, unknown>;
  if (typeof payload.url === "string") return payload.url;
  if (Array.isArray(payload.images) && payload.images[0] && typeof payload.images[0] === "object") {
    const first = payload.images[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  if (payload.image && typeof payload.image === "object") {
    const image = payload.image as Record<string, unknown>;
    if (typeof image.url === "string") return image.url;
  }
  if (payload.video && typeof payload.video === "object") {
    const video = payload.video as Record<string, unknown>;
    if (typeof video.url === "string") return video.url;
  }
  if (Array.isArray(payload.videos) && payload.videos[0] && typeof payload.videos[0] === "object") {
    const first = payload.videos[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
  }
  if (payload.audio && typeof payload.audio === "object") {
    const audio = payload.audio as Record<string, unknown>;
    if (typeof audio.url === "string") return audio.url;
  }
  return null;
}

async function refundTaskCredits(task: PendingTaskRow, failureReference = task.id) {
  const admin = createSupabaseAdminClient();
  if (!admin || task.estimated_credits <= 0) return;
  await refundCredits(admin, task.user_id, task.estimated_credits, "generation_refund", failureReference);
}

async function syncTask(task: PendingTaskRow, falKey: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { taskId: task.id, action: "skipped", reason: "admin_not_configured" };
  }

  const now = new Date().toISOString();

  if (task.provider === DREAMFACE_IO_PROVIDER) {
    const synced = await syncDreamfaceIoTask(admin, task as Parameters<typeof syncDreamfaceIoTask>[1]);
    return { taskId: task.id, action: "synced", status: synced.status, providerStatus: synced.providerStatus };
  }

  if (!isAllowedFalUrl(task.status_url)) {
    if (!isOlderThan(task.created_at, orphanTaskTimeoutMinutes())) {
      await admin
        .from("generation_tasks")
        .update({ last_checked_at: now, updated_at: now })
        .eq("id", task.id)
        .eq("user_id", task.user_id);
      return { taskId: task.id, action: "checked", status: task.status };
    }

    await refundTaskCredits(task);
    await admin
      .from("generation_tasks")
      .update({
        status: "failed",
        failure_code: "provider_tracking_missing",
        failure_reason: `Cron sync: task was charged but never received provider tracking within ${orphanTaskTimeoutMinutes()} minutes. Credits were refunded.`,
        last_checked_at: now,
        timed_out_at: now,
        updated_at: now
      })
      .eq("id", task.id)
      .eq("user_id", task.user_id);
    return { taskId: task.id, action: "failed", status: "provider_tracking_missing" };
  }

  const statusRes = await fetchFal(task.status_url, {
    attempts: 2,
    timeoutMs: 15000,
    headers: { Authorization: `Key ${falKey}` },
    cache: "no-store"
  });

  if (!statusRes.ok) {
    await admin
      .from("generation_tasks")
      .update({ last_checked_at: now, updated_at: now })
      .eq("id", task.id)
      .eq("user_id", task.user_id);
    return { taskId: task.id, action: "status_error", statusCode: statusRes.status };
  }

  const statusPayload = (await statusRes.json()) as { status?: string; response_url?: string };
  const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();
  const normalized = normalizeFalStatus(upperStatus);
  const providerResponseUrl = isAllowedFalUrl(statusPayload.response_url || null)
    ? statusPayload.response_url || null
    : null;
  const effectiveResponseUrl = providerResponseUrl || task.response_url;

  if ((normalized === "queued" || normalized === "running") && isOlderThan(task.created_at, taskTimeoutMinutes())) {
    await refundTaskCredits(task);
    await admin
      .from("generation_tasks")
      .update({
        status: "failed",
        response_url: effectiveResponseUrl,
        failure_code: "task_timeout",
        failure_reason: `Cron sync: provider task exceeded ${taskTimeoutMinutes()} minutes. Credits were refunded.`,
        last_checked_at: now,
        timed_out_at: now,
        updated_at: now
      })
      .eq("id", task.id)
      .eq("user_id", task.user_id);
    return { taskId: task.id, action: "failed", status: "task_timeout", providerStatus: upperStatus };
  }

  let result: unknown = null;
  let responseFailureInfo: ReturnType<typeof parseFalFailure> | null = null;
  if ((upperStatus === "COMPLETED" || upperStatus === "FAILED" || upperStatus === "ERROR") && isAllowedFalUrl(effectiveResponseUrl)) {
    const resultRes = await fetchFal(effectiveResponseUrl, {
      attempts: 2,
      timeoutMs: 20000,
      headers: { Authorization: `Key ${falKey}` },
      cache: "no-store"
    });
    if (resultRes.ok) {
      result = await resultRes.json();
    } else {
      const falError = await falApiErrorFromResponse(resultRes);
      responseFailureInfo = falError.info;
      result = falError.info.details;
    }
  }

  const mediaUrl = extractMediaUrl(result);
  const completedFailurePayload =
    normalized === "completed"
      ? falResultLooksFailed(result)
        ? result
        : mediaUrl
          ? null
          : falNoMediaFailurePayload(result || statusPayload)
      : null;
  const finalStatus = completedFailurePayload ? "failed" : normalized;
  const failureInfo =
    finalStatus === "failed"
      ? completedFailurePayload
        ? parseFalFailure(completedFailurePayload)
        : responseFailureInfo || parseFalFailure(result || statusPayload)
      : null;
  if (failureInfo) {
    failureInfo.costUsd = await resolveFalCostUsd(falKey, task.provider_request_id, failureInfo.costUsd);
  }
  const refundCreditsAmount = failureInfo ? falRefundCreditsFromCost(failureInfo.costUsd, task.estimated_credits) : 0;
  if (finalStatus === "failed") {
    await refundTaskCredits({ ...task, estimated_credits: refundCreditsAmount });
  }
  const failureReason = failureInfo
    ? formatFalFailureReason(failureInfo, task.estimated_credits, refundCreditsAmount)
    : null;

  await admin
    .from("generation_tasks")
    .update({
      status: finalStatus,
      response_url: effectiveResponseUrl,
      output_url: finalStatus === "completed" ? mediaUrl : null,
      raw_result: result,
      failure_code: failureInfo?.code || (finalStatus === "failed" ? "provider_failed" : null),
      failure_reason: failureReason,
      last_checked_at: now,
      updated_at: now
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id);

  return { taskId: task.id, action: "synced", status: finalStatus, providerStatus: upperStatus };
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const falKey = process.env.FAL_KEY || "";

  const { data, error } = await admin
    .from("generation_tasks")
    .select("id,user_id,provider,status,estimated_credits,transport,provider_request_id,status_url,response_url,request_settings,output_url,created_at,timed_out_at")
    .eq("transport", "real")
    .in("status", ["queued", "running"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(SYNC_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (data || []) as PendingTaskRow[];
  const results = [];
  for (const task of tasks) {
    try {
      results.push(await syncTask(task, falKey));
    } catch (error) {
      results.push({
        taskId: task.id,
        action: "error",
        error: error instanceof Error ? error.message : "Unknown sync error"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: tasks.length,
    results
  });
}
