import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import { refundCredits } from "../../../lib/credits";
import { resolveFalCostUsd } from "../../../lib/fal-billing";
import {
  falApiErrorFromResponse,
  falRefundCreditsFromCost,
  formatFalFailureReason,
  parseFalFailure
} from "../../../lib/fal-errors";

const DEFAULT_TASK_HISTORY_TIMEOUT_MS = 12000;
const DEFAULT_TASK_SYNC_TIMEOUT_MS = 3500;
const TASK_SYNC_LIMIT = 5;
const DEFAULT_TASK_TIMEOUT_MINUTES = 45;
const DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES = 10;
const TASK_LIST_SELECT =
  "id, mode, provider, prompt, status, estimated_credits, transport, status_url, response_url, output_url, request_settings, created_at, updated_at, title, is_favorite, failure_code, failure_reason, last_checked_at, timed_out_at";
const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, raw_result`;

type TaskHistoryResult = {
  data: TaskRow[] | null;
  error: { message: string } | null;
};

type LedgerRow = {
  id: number | string;
  amount: number;
  reason: string;
  reference_id: string | null;
};

type TaskRow = {
  id: string;
  mode: "image" | "video" | "audio";
  provider?: string;
  prompt?: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport?: "real" | "mock";
  status_url?: string | null;
  response_url?: string | null;
  output_url?: string | null;
  raw_result?: unknown;
  request_settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string | null;
  title?: string | null;
  is_favorite?: boolean;
  failure_code?: string | null;
  failure_reason?: string | null;
  last_checked_at?: string | null;
  timed_out_at?: string | null;
};

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
};

type TaskUpdatePayload = {
  id?: string;
  title?: string | null;
  isFavorite?: boolean;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Cloud task history timed out.")), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

function positiveTimeout(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function taskHistoryTimeoutMs() {
  return positiveTimeout(process.env.TASK_HISTORY_TIMEOUT_MS, DEFAULT_TASK_HISTORY_TIMEOUT_MS);
}

function taskSyncTimeoutMs() {
  return positiveTimeout(process.env.TASK_SYNC_TIMEOUT_MS, DEFAULT_TASK_SYNC_TIMEOUT_MS);
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

function normalizeFalStatus(status: string) {
  const upperStatus = status.toUpperCase();
  if (upperStatus === "IN_QUEUE") return "queued";
  if (upperStatus === "IN_PROGRESS") return "running";
  if (upperStatus === "COMPLETED") return "completed";
  return "failed";
}

function taskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES || DEFAULT_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TASK_TIMEOUT_MINUTES;
}

function isTaskTimedOut(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() > taskTimeoutMinutes() * 60 * 1000;
}

function orphanTaskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_ORPHAN_TIMEOUT_MINUTES || DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ORPHAN_TASK_TIMEOUT_MINUTES;
}

function isOrphanTaskTimedOut(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() > orphanTaskTimeoutMinutes() * 60 * 1000;
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, 120) : null;
}

async function attachCreditLedger(admin: SupabaseClient, userId: string, tasks: TaskRow[]) {
  if (!tasks.length) return tasks;
  const taskIds = tasks.map((task) => task.id);
  const { data } = await admin
    .from("credit_ledger")
    .select("id, amount, reason, reference_id")
    .eq("user_id", userId)
    .in("reference_id", taskIds)
    .in("reason", ["generation_task", "generation_refund"]);

  const ledger = (data || []) as LedgerRow[];
  return tasks.map((task) => {
    const charge = ledger.find((entry) => entry.reference_id === task.id && entry.reason === "generation_task");
    const refund = ledger.find((entry) => entry.reference_id === task.id && entry.reason === "generation_refund");
    return {
      ...task,
      charged_credits: charge ? Math.abs(charge.amount) : task.estimated_credits,
      charge_ledger_id: charge?.id || null,
      refunded_credits: refund ? Math.abs(refund.amount) : 0,
      refund_ledger_id: refund?.id || null,
      refund_status: refund ? "refunded" : task.status === "failed" ? "not_refunded" : "not_applicable"
    };
  });
}

async function syncPendingFalTasks(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const falKey = process.env.FAL_KEY;
  if (!admin || !falKey) return;

  const { data } = await admin
    .from("generation_tasks")
    .select("id,user_id,status,estimated_credits,transport,provider_request_id,status_url,response_url,created_at")
    .eq("user_id", userId)
    .eq("transport", "real")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(TASK_SYNC_LIMIT);

  const pendingTasks = (data || []) as PendingTaskRow[];
  await Promise.all(
    pendingTasks.map(async (task) => {
      try {
        if (!isAllowedFalUrl(task.status_url)) {
          const now = new Date().toISOString();
          if (isOrphanTaskTimedOut(task.created_at)) {
            if (task.estimated_credits > 0) {
              await refundCredits(admin, userId, task.estimated_credits, "generation_refund", task.id);
            }
            await admin
              .from("generation_tasks")
              .update({
                status: "failed",
                failure_code: "provider_tracking_missing",
                failure_reason: `The task was charged but never received a provider tracking URL within ${orphanTaskTimeoutMinutes()} minutes. Credits were refunded automatically. Please retry.`,
                last_checked_at: now,
                timed_out_at: now,
                updated_at: now
              })
              .eq("id", task.id)
              .eq("user_id", userId);
          } else {
            await admin
              .from("generation_tasks")
              .update({
                last_checked_at: now,
                updated_at: now
              })
              .eq("id", task.id)
              .eq("user_id", userId);
          }
          return;
        }

        if (isTaskTimedOut(task.created_at)) {
          const now = new Date().toISOString();
          if (task.estimated_credits > 0) {
            await refundCredits(admin, userId, task.estimated_credits, "generation_refund", task.id);
          }
          await admin
            .from("generation_tasks")
            .update({
              status: "failed",
              failure_code: "task_timeout",
              failure_reason: `The provider task did not finish within ${taskTimeoutMinutes()} minutes. Credits were refunded automatically.`,
              last_checked_at: now,
              timed_out_at: now,
              updated_at: now
            })
            .eq("id", task.id)
            .eq("user_id", userId);
          return;
        }

        const statusRes = await fetchFal(task.status_url, {
          attempts: 1,
          timeoutMs: 3500,
          headers: {
            Authorization: `Key ${falKey}`
          },
          cache: "no-store"
        });
        if (!statusRes.ok) return;

        const statusPayload = (await statusRes.json()) as { status?: string; response_url?: string };
        const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();
        const normalized = normalizeFalStatus(upperStatus);
        const providerResponseUrl = isAllowedFalUrl(statusPayload.response_url || null)
          ? statusPayload.response_url || null
          : null;
        const effectiveResponseUrl = providerResponseUrl || task.response_url;
        let result: unknown = null;

        let responseFailureInfo: ReturnType<typeof parseFalFailure> | null = null;
        if ((upperStatus === "COMPLETED" || upperStatus === "FAILED" || upperStatus === "ERROR") && isAllowedFalUrl(effectiveResponseUrl)) {
          const resultRes = await fetchFal(effectiveResponseUrl, {
            attempts: 1,
            timeoutMs: 5000,
            headers: {
              Authorization: `Key ${falKey}`
            },
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

        const failureInfo = normalized === "failed" ? responseFailureInfo || parseFalFailure(result || statusPayload) : null;
        if (failureInfo) {
          failureInfo.costUsd = await resolveFalCostUsd(falKey, task.provider_request_id, failureInfo.costUsd);
        }
        const refundCreditsAmount = failureInfo ? falRefundCreditsFromCost(failureInfo.costUsd, task.estimated_credits) : 0;
        if (normalized === "failed" && refundCreditsAmount > 0) {
          await refundCredits(admin, userId, refundCreditsAmount, "generation_refund", task.id);
        }
        const failureReason = failureInfo
          ? formatFalFailureReason(failureInfo, task.estimated_credits, refundCreditsAmount)
          : null;

        await admin
          .from("generation_tasks")
          .update({
            status: normalized,
            response_url: effectiveResponseUrl,
            output_url: extractMediaUrl(result),
            raw_result: result,
            failure_code: failureInfo?.code || (normalized === "failed" ? "provider_failed" : null),
            failure_reason: failureReason,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", task.id)
          .eq("user_id", userId);
      } catch {
        // History should still load even if a provider status check times out.
      }
    })
  );
}

export async function GET(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  await withTimeout(syncPendingFalTasks(admin, user.id), taskSyncTimeoutMs()).catch(() => null);

  const historyStartedAt = Date.now();
  const historyTimeoutMs = taskHistoryTimeoutMs();
  const { data, error } = await withTimeout<TaskHistoryResult>(
    (() => {
      const id = new URL(request.url).searchParams.get("id");
      let query = admin
        .from("generation_tasks")
        .select(id ? TASK_DETAIL_SELECT : TASK_LIST_SELECT)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (id) {
        query = query.eq("id", id).limit(1);
      } else {
        query = query.limit(30);
      }
      return query as unknown as Promise<TaskHistoryResult>;
    })(),
    historyTimeoutMs
  ).catch((error: unknown) => ({
    data: [],
    error: error instanceof Error ? error : new Error("Task history request failed.")
  }));

  if (error) {
    console.error("[tasks] task history query failed", {
      userId: user.id,
      durationMs: Date.now() - historyStartedAt,
      timeoutMs: historyTimeoutMs,
      message: error.message
    });
    return NextResponse.json(
      {
        tasks: [],
        storageWarning: `Task history is temporarily unavailable: ${error.message}`
      },
      { status: 200 }
    );
  }

  const tasksWithLedger = await withTimeout(attachCreditLedger(admin, user.id, data ?? []), taskHistoryTimeoutMs()).catch(
    () => data ?? []
  );
  return NextResponse.json({ tasks: tasksWithLedger });
}

export async function PATCH(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  let payload: TaskUpdatePayload;
  try {
    payload = (await request.json()) as TaskUpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.id || typeof payload.id !== "string") {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if ("title" in payload) {
    update.title = normalizeTitle(payload.title);
  }

  if ("isFavorite" in payload) {
    update.is_favorite = Boolean(payload.isFavorite);
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No supported task updates were provided." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("generation_tasks")
    .update(update)
    .eq("id", payload.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select(TASK_DETAIL_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("generation_tasks")
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}

