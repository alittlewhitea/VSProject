import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { refundCredits } from "../../../../lib/credits";
import { fetchFal } from "../../../../lib/fal-fetch";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { resolveFalCostUsd } from "../../../../lib/fal-billing";
import {
  falApiErrorFromResponse,
  falRefundCreditsFromCost,
  formatFalFailureReason,
  parseFalFailure
} from "../../../../lib/fal-errors";
import { DREAMFACE_IO_PROVIDER, syncDreamfaceIoTask } from "../../../../lib/dreamface-io";

const TASK_SELECT =
  "id,user_id,mode,provider,prompt,status,estimated_credits,transport,provider_request_id,status_url,response_url,output_url,request_settings,created_at,updated_at,title,is_favorite,failure_code,failure_reason,last_checked_at,timed_out_at";
const DEFAULT_TASK_TIMEOUT_MINUTES = 45;

type TaskRow = {
  id: string;
  user_id: string;
  mode: "image" | "video" | "audio";
  provider: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  provider_request_id: string | null;
  status_url: string | null;
  response_url: string | null;
  output_url: string | null;
  request_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  title: string | null;
  is_favorite: boolean;
  failure_code: string | null;
  failure_reason: string | null;
  last_checked_at: string | null;
  timed_out_at: string | null;
};

type LedgerRow = {
  id: number | string;
  user_id: string;
  amount: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

type SyncProviderPayload = {
  action?: "sync_provider";
  taskId?: string;
};

function cleanStatus(status: string | null) {
  return ["queued", "running", "completed", "failed"].includes(status || "") ? status : null;
}

function taskTimeoutMinutes() {
  const value = Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES || DEFAULT_TASK_TIMEOUT_MINUTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TASK_TIMEOUT_MINUTES;
}

function isTaskTimedOut(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() > taskTimeoutMinutes() * 60 * 1000;
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

async function readTaskWithLedger(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  taskId: string
) {
  const { data: task, error } = await admin
    .from("generation_tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!task) return null;

  const row = task as TaskRow;
  const { data: ledgerData } = await admin
    .from("credit_ledger")
    .select("id,user_id,amount,reason,reference_id,created_at")
    .eq("reference_id", row.id)
    .in("reason", ["generation_task", "generation_refund"]);

  const ledger = (ledgerData || []) as LedgerRow[];
  const charge = ledger.find((entry) => entry.reference_id === row.id && entry.reason === "generation_task");
  const refund = ledger.find((entry) => entry.reference_id === row.id && entry.reason === "generation_refund");

  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    provider: row.provider,
    prompt: row.prompt,
    status: row.status,
    estimatedCredits: row.estimated_credits,
    chargedCredits: charge ? Math.abs(charge.amount) : 0,
    chargeLedgerId: charge?.id || null,
    refundedCredits: refund ? Math.abs(refund.amount) : 0,
    refundLedgerId: refund?.id || null,
    refundStatus: refund ? "refunded" : row.status === "failed" ? "not_refunded" : "not_applicable",
    transport: row.transport,
    providerRequestId: row.provider_request_id,
    outputUrl: row.output_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    isFavorite: row.is_favorite,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
    lastCheckedAt: row.last_checked_at,
    timedOutAt: row.timed_out_at
  };
}

async function syncProviderTask(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  taskId: string
) {
  const { data, error } = await admin
    .from("generation_tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Task not found.");

  const task = data as TaskRow;
  if (task.transport !== "real") {
    throw new Error("Only real provider tasks can be synced.");
  }
  if (task.provider === DREAMFACE_IO_PROVIDER) {
    const synced = await syncDreamfaceIoTask(admin, task as Parameters<typeof syncDreamfaceIoTask>[1]);
    return {
      providerStatus: synced.providerStatus,
      timedOut: false,
      task: await readTaskWithLedger(admin, task.id)
    };
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error("FAL_KEY is not configured.");
  }
  if (!isAllowedFalUrl(task.status_url)) {
    throw new Error("Task does not have a valid fal.ai status URL.");
  }

  const statusRes = await fetchFal(task.status_url, {
    attempts: 2,
    timeoutMs: 15000,
    headers: { Authorization: `Key ${falKey}` },
    cache: "no-store"
  });

  if (!statusRes.ok) {
    throw new Error(`Provider status check failed (${statusRes.status}).`);
  }

  const statusPayload = (await statusRes.json()) as { status?: string; response_url?: string };
  const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();
  const normalized = normalizeFalStatus(upperStatus);
  const responseUrl = isAllowedFalUrl(statusPayload.response_url || null)
    ? statusPayload.response_url || null
    : task.response_url;

  let result: unknown = null;
  let responseFailureInfo: ReturnType<typeof parseFalFailure> | null = null;
  if ((upperStatus === "COMPLETED" || upperStatus === "FAILED" || upperStatus === "ERROR") && isAllowedFalUrl(responseUrl)) {
    const resultRes = await fetchFal(responseUrl, {
      attempts: 2,
      timeoutMs: 20000,
      headers: { Authorization: `Key ${falKey}` },
      cache: "no-store"
    });
    if (!resultRes.ok) {
      const falError = await falApiErrorFromResponse(resultRes);
      responseFailureInfo = falError.info;
      result = falError.info.details;
    } else {
      result = await resultRes.json();
    }
  }

  const now = new Date().toISOString();
  const timedOut = (normalized === "queued" || normalized === "running") && isTaskTimedOut(task.created_at);
  let finalStatus = normalized;
  let failureCode: string | null = null;
  let failureReason: string | null = null;

  if (timedOut) {
    finalStatus = "failed";
    failureCode = "task_timeout";
    failureReason = `Admin sync: provider task exceeded ${taskTimeoutMinutes()} minutes. Credits were refunded.`;
  } else if (normalized === "failed") {
    const failureInfo = responseFailureInfo || parseFalFailure(result || statusPayload);
    failureInfo.costUsd = await resolveFalCostUsd(falKey, task.provider_request_id, failureInfo.costUsd);
    const refundCreditsAmount = falRefundCreditsFromCost(failureInfo.costUsd, task.estimated_credits);
    failureCode = failureInfo.code || "provider_failed";
    failureReason = formatFalFailureReason(failureInfo, task.estimated_credits, refundCreditsAmount);
  }

  if (finalStatus === "failed" && task.estimated_credits > 0) {
    const failureInfo = normalized === "failed" && !timedOut ? responseFailureInfo || parseFalFailure(result || statusPayload) : null;
    if (failureInfo) {
      failureInfo.costUsd = await resolveFalCostUsd(falKey, task.provider_request_id, failureInfo.costUsd);
    }
    const refundCreditsAmount = failureInfo
      ? falRefundCreditsFromCost(failureInfo.costUsd, task.estimated_credits)
      : task.estimated_credits;
    if (refundCreditsAmount > 0) {
      await refundCredits(admin, task.user_id, refundCreditsAmount, "generation_refund", task.id);
    }
  }

  await admin
    .from("generation_tasks")
    .update({
      status: finalStatus,
      response_url: responseUrl,
      output_url: finalStatus === "completed" ? extractMediaUrl(result) : task.output_url,
      raw_result: result,
      failure_code: failureCode,
      failure_reason: failureReason,
      last_checked_at: now,
      timed_out_at: timedOut ? now : task.timed_out_at,
      updated_at: now
    })
    .eq("id", task.id)
    .eq("user_id", task.user_id)
    .throwOnError();

  return {
    providerStatus: upperStatus,
    timedOut,
    task: await readTaskWithLedger(admin, task.id)
  };
}

export async function GET(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const status = cleanStatus(url.searchParams.get("status"));
  const userId = url.searchParams.get("userId")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 10), 100);

  let query = admin
    .from("generation_tasks")
    .select(TASK_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (data || []) as TaskRow[];
  const taskIds = tasks.map((task) => task.id);
  const { data: ledgerData, error: ledgerError } = taskIds.length
    ? await admin
        .from("credit_ledger")
        .select("id,user_id,amount,reason,reference_id,created_at")
        .in("reference_id", taskIds)
        .in("reason", ["generation_task", "generation_refund"])
    : { data: [], error: null };

  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  const ledger = (ledgerData || []) as LedgerRow[];
  const items = tasks.map((task) => {
    const charge = ledger.find((entry) => entry.reference_id === task.id && entry.reason === "generation_task");
    const refund = ledger.find((entry) => entry.reference_id === task.id && entry.reason === "generation_refund");
    return {
      id: task.id,
      userId: task.user_id,
      mode: task.mode,
      provider: task.provider,
      prompt: task.prompt,
      status: task.status,
      estimatedCredits: task.estimated_credits,
      chargedCredits: charge ? Math.abs(charge.amount) : 0,
      chargeLedgerId: charge?.id || null,
      refundedCredits: refund ? Math.abs(refund.amount) : 0,
      refundLedgerId: refund?.id || null,
      refundStatus: refund ? "refunded" : task.status === "failed" ? "not_refunded" : "not_applicable",
      transport: task.transport,
      providerRequestId: task.provider_request_id,
      outputUrl: task.output_url,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      title: task.title,
      isFavorite: task.is_favorite,
      failureCode: task.failure_code,
      failureReason: task.failure_reason,
      lastCheckedAt: task.last_checked_at,
      timedOutAt: task.timed_out_at
    };
  });

  return NextResponse.json({
    adminEmail: adminUser.email,
    items,
    totals: {
      all: items.length,
      failed: items.filter((item) => item.status === "failed").length,
      refunded: items.filter((item) => item.refundStatus === "refunded").length,
      notRefundedFailures: items.filter((item) => item.status === "failed" && item.refundStatus !== "refunded").length
    }
  });
}

export async function POST(request: Request) {
  const adminUser = await getAdminUserFromRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const payload = (await request.json().catch(() => null)) as SyncProviderPayload | null;
  if (payload?.action !== "sync_provider" || !payload.taskId) {
    return NextResponse.json({ error: "Unsupported admin task action." }, { status: 400 });
  }

  try {
    const result = await syncProviderTask(admin, payload.taskId);
    return NextResponse.json({
      adminEmail: adminUser.email,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync provider task." },
      { status: 500 }
    );
  }
}
