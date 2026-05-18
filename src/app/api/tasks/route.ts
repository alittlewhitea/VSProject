import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import { refundCredits } from "../../../lib/credits";

const TASK_HISTORY_TIMEOUT_MS = 4500;
const TASK_SYNC_LIMIT = 5;
const TASK_SELECT =
  "id, mode, provider, prompt, status, estimated_credits, transport, status_url, response_url, output_url, raw_result, created_at, updated_at, title, is_favorite";

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
  mode: "image" | "video";
  provider?: string;
  prompt?: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport?: "real" | "mock";
  status_url?: string | null;
  response_url?: string | null;
  output_url?: string | null;
  raw_result?: unknown;
  created_at?: string;
  updated_at?: string | null;
  title?: string | null;
  is_favorite?: boolean;
};

type PendingTaskRow = {
  id: string;
  user_id: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  status_url: string | null;
  response_url: string | null;
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
  if (payload.video && typeof payload.video === "object") {
    const video = payload.video as Record<string, unknown>;
    if (typeof video.url === "string") return video.url;
  }
  if (Array.isArray(payload.videos) && payload.videos[0] && typeof payload.videos[0] === "object") {
    const first = payload.videos[0] as Record<string, unknown>;
    if (typeof first.url === "string") return first.url;
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
    .select("id,user_id,status,estimated_credits,transport,status_url,response_url")
    .eq("user_id", userId)
    .eq("transport", "real")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(TASK_SYNC_LIMIT);

  const pendingTasks = (data || []) as PendingTaskRow[];
  await Promise.all(
    pendingTasks.map(async (task) => {
      if (!isAllowedFalUrl(task.status_url)) return;

      try {
        const statusRes = await fetchFal(task.status_url, {
          attempts: 1,
          timeoutMs: 3500,
          headers: {
            Authorization: `Key ${falKey}`
          },
          cache: "no-store"
        });
        if (!statusRes.ok) return;

        const statusPayload = (await statusRes.json()) as { status?: string };
        const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();
        const normalized = normalizeFalStatus(upperStatus);
        let result: unknown = null;

        if (upperStatus === "COMPLETED" && isAllowedFalUrl(task.response_url)) {
          const resultRes = await fetchFal(task.response_url, {
            attempts: 1,
            timeoutMs: 5000,
            headers: {
              Authorization: `Key ${falKey}`
            },
            cache: "no-store"
          });
          if (resultRes.ok) {
            result = await resultRes.json();
          }
        }

        if (normalized === "failed" && task.estimated_credits > 0) {
          await refundCredits(admin, userId, task.estimated_credits, "generation_refund", task.id);
        }

        await admin
          .from("generation_tasks")
          .update({
            status: normalized,
            output_url: extractMediaUrl(result),
            raw_result: result,
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

  await withTimeout(syncPendingFalTasks(admin, user.id), TASK_HISTORY_TIMEOUT_MS).catch(() => null);

  const { data, error } = await withTimeout<TaskHistoryResult>(
    admin
      .from("generation_tasks")
      .select(TASK_SELECT)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30) as unknown as Promise<TaskHistoryResult>,
    TASK_HISTORY_TIMEOUT_MS
  ).catch((error: unknown) => ({
    data: [],
    error: error instanceof Error ? error : new Error("Task history request failed.")
  }));

  if (error) {
    return NextResponse.json(
      {
        tasks: [],
        storageWarning: `Task history is temporarily unavailable: ${error.message}`
      },
      { status: 200 }
    );
  }

  const tasksWithLedger = await withTimeout(attachCreditLedger(admin, user.id, data ?? []), TASK_HISTORY_TIMEOUT_MS).catch(
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
    .select(TASK_SELECT)
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

