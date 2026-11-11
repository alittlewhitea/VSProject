import { syncFalTask, type FalTask } from "../../../lib/fal-task-sync";
import {REMOVED_PROVIDER_IDS} from "../../../lib/retired-providers";
import { NextResponse } from "next/server";
import { getUserFromBearerToken, getUserIdsForAuthUser } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";

import { TASKS_LIMITS, firstExceededLimit, rateLimitHeaders } from "../../../lib/api-limits";
import { consumeRateLimit } from "../../../lib/request-security";

const DEFAULT_TASK_HISTORY_TIMEOUT_MS = 12000;
const DEFAULT_TASK_SYNC_TIMEOUT_MS = 3500;
const TASK_SYNC_LIMIT = 5;
const TASK_LIST_SELECT =
  "id, mode, provider, prompt, status, estimated_credits, transport, status_url, response_url, output_url, created_at, updated_at, title, is_favorite, failure_code, failure_reason, last_checked_at, timed_out_at";
const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT}, request_settings, raw_result`;

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
  provider?: string;
  request_settings?: Record<string, unknown> | null;
  output_url?: string | null;
  timed_out_at?: string | null;
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

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, 120) : null;
}

async function attachCreditLedger(admin: any, userIds: string[], tasks: TaskRow[]) {
  if (!tasks.length) return tasks;
  const taskIds = tasks.map((task) => task.id);
  const { data } = await admin
    .from("credit_ledger")
    .select("id, amount, reason, reference_id")
    .in("user_id", userIds)
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

async function syncPendingFalTasks(admin: ReturnType<typeof createSupabaseAdminClient>, userIds: string[]) {
  if (!admin || !userIds.length) return;
  const { data } = await admin.from("generation_tasks")
    .select("id,user_id,provider,status,estimated_credits,transport,provider_request_id,status_url,response_url,request_settings,output_url,raw_result,failure_code,failure_reason,created_at,timed_out_at")
    .in("user_id", userIds).eq("transport", "real").neq("provider",REMOVED_PROVIDER_IDS[0]).in("status", ["queued", "running"])
    .order("last_checked_at", { ascending: true }).order("created_at", { ascending: true }).limit(TASK_SYNC_LIMIT);
  await Promise.all(((data || []) as FalTask[]).map(async task => {
    try {
      await syncFalTask(admin, task, process.env.FAL_KEY || "");
    } catch { /* History remains available when provider reconciliation is delayed. */ }
  }));
}

async function taskHistoryLimited(userId: string) {
  const exceeded = await firstExceededLimit(userId, TASKS_LIMITS, consumeRateLimit);
  return exceeded
    ? NextResponse.json({ error: "Too many requests." }, { status: exceeded.unavailable ? 503 : 429, headers: rateLimitHeaders(exceeded.retryAfterSeconds) })
    : null;
}

export async function GET(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
  }
  const limited = await taskHistoryLimited(user.id);
  if (limited) return limited;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const userIds = await getUserIdsForAuthUser(user);

  const historyStartedAt = Date.now();
  const historyTimeoutMs = taskHistoryTimeoutMs();
  const { data, error } = await withTimeout<TaskHistoryResult>(
    (() => {
      const id = new URL(request.url).searchParams.get("id");
      let query = admin
        .from("generation_tasks")
        .select(id ? TASK_DETAIL_SELECT : TASK_LIST_SELECT)
        .in("user_id", userIds)
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

  const tasksWithLedger = await withTimeout(attachCreditLedger(admin, userIds, data ?? []), taskHistoryTimeoutMs()).catch(
    () => data ?? []
  );
  return NextResponse.json({ tasks: tasksWithLedger });
}

// Explicit background sync: never delay the history read with provider requests.
export async function POST(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const limited = await taskHistoryLimited(user.id);
  if (limited) return limited;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  const userIds = await getUserIdsForAuthUser(user);
  await withTimeout(syncPendingFalTasks(admin, userIds), taskSyncTimeoutMs()).catch(() => null);
  return NextResponse.json({ ok: true });
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
  const userIds = await getUserIdsForAuthUser(user);

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
    .in("user_id", userIds)
    .is("deleted_at", null)
    .select(TASK_DETAIL_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to update this task.", code: "task_update_failed" }, { status: 500 });
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
  const userIds = await getUserIdsForAuthUser(user);

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
    .in("user_id", userIds)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to update this task.", code: "task_update_failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}

