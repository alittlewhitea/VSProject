import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { fetchFal } from "../../../../lib/fal-fetch";
import { refundCredits } from "../../../../lib/credits";
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

type RefundInfo = {
  balance: number | null;
  refundLedgerId: number | string | null;
  refundedCredits: number;
};

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

function isAllowedFalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "queue.fal.run";
  } catch {
    return false;
  }
}

async function readRefundLedger(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  taskId: string
) {
  const { data } = await admin
    .from("credit_ledger")
    .select("id, amount")
    .eq("user_id", userId)
    .eq("reason", "generation_refund")
    .eq("reference_id", taskId)
    .maybeSingle();

  const row = data as { id?: number | string; amount?: number } | null;
  return {
    refundLedgerId: row?.id || null,
    refundedCredits: typeof row?.amount === "number" ? Math.abs(row.amount) : 0
  };
}

async function refundAndReadLedger(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  taskId: string,
  refundCreditsAmount: number
): Promise<RefundInfo> {
  let balance: number | null = null;
  if (refundCreditsAmount > 0) {
    balance = await refundCredits(admin, userId, refundCreditsAmount, "generation_refund", taskId);
  }
  const ledger = await readRefundLedger(admin, userId, taskId);
  return {
    balance,
    ...ledger
  };
}

async function failOrphanTaskIfTimedOut(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string,
  taskId: string
) {
  const { data: task } = await admin
    .from("generation_tasks")
    .select("estimated_credits, created_at, status_url, status")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  const row = task as {
    estimated_credits?: number;
    created_at?: string;
    status_url?: string | null;
    status?: string;
  } | null;

  if (!row?.created_at || row.status === "completed" || row.status === "failed" || isAllowedFalUrl(row.status_url || "")) {
    return null;
  }

  if (!isOrphanTaskTimedOut(row.created_at)) {
    await admin
      .from("generation_tasks")
      .update({
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId)
      .eq("user_id", userId);
    return {
      pending: true,
      failureReason: `Provider tracking has not been attached yet. If this remains unresolved for ${orphanTaskTimeoutMinutes()} minutes, credits will be refunded automatically.`
    };
  }

  const estimatedCredits = typeof row.estimated_credits === "number" ? row.estimated_credits : 0;
  const refund = await refundAndReadLedger(admin, userId, taskId, estimatedCredits);
  const now = new Date().toISOString();
  const failureReason = `The task was charged but never received a provider tracking URL within ${orphanTaskTimeoutMinutes()} minutes. Credits were refunded automatically. Please retry.`;
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
    .eq("id", taskId)
    .eq("user_id", userId);

  return {
    pending: false,
    failureCode: "provider_tracking_missing",
    failureReason,
    ...refund
  };
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusUrl = searchParams.get("statusUrl");
    const responseUrl = searchParams.get("responseUrl");
    const taskId = searchParams.get("taskId");
    const mockStatus = searchParams.get("mockStatus");

    if (taskId && !mockStatus) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const { data: providerTask } = await admin
          .from("generation_tasks")
          .select("id,user_id,provider,status,estimated_credits,provider_request_id,status_url,request_settings,output_url,created_at,timed_out_at")
          .eq("id", taskId)
          .eq("user_id", user.id)
          .maybeSingle();
        if ((providerTask as { provider?: string } | null)?.provider === DREAMFACE_IO_PROVIDER) {
          try {
            const synced = await syncDreamfaceIoTask(admin, providerTask as Parameters<typeof syncDreamfaceIoTask>[1]);
            return NextResponse.json({
              status: synced.status.toUpperCase(),
              result: synced.result,
              failureCode: synced.failureCode,
              failureReason: synced.failureReason
            });
          } catch {
            return NextResponse.json({ error: "Unable to fetch DreamFace IO task status." }, { status: 502 });
          }
        }
      }
    }

    if (mockStatus) {
      if (!taskId) {
        return NextResponse.json({ error: "taskId is required for mock status updates." }, { status: 400 });
      }
      if (mockStatus !== "completed" && mockStatus !== "failed") {
        return NextResponse.json({ error: "Invalid mockStatus." }, { status: 400 });
      }

      const admin = createSupabaseAdminClient();
      if (!admin) {
        return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
      }

      const { data: task, error: taskError } = await admin
        .from("generation_tasks")
        .select("estimated_credits, transport")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (taskError) {
        return NextResponse.json({ error: taskError.message }, { status: 500 });
      }
      if (!task) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 });
      }
      if ((task as { transport?: string }).transport !== "mock") {
        return NextResponse.json({ error: "mockStatus can only update mock tasks." }, { status: 400 });
      }

      let balance: number | null = null;
      let refundLedgerId: number | string | null = null;
      let refundedCredits = 0;
      const estimatedCredits =
        typeof (task as { estimated_credits?: unknown }).estimated_credits === "number"
          ? (task as { estimated_credits: number }).estimated_credits
          : 0;

      if (mockStatus === "failed" && estimatedCredits > 0) {
        balance = await refundCredits(admin, user.id, estimatedCredits, "generation_refund", taskId);
        const refund = await readRefundLedger(admin, user.id, taskId);
        refundLedgerId = refund.refundLedgerId;
        refundedCredits = refund.refundedCredits;
      }

      await admin
        .from("generation_tasks")
        .update({
          status: mockStatus,
          failure_code: mockStatus === "failed" ? "mock_failed" : null,
          failure_reason: mockStatus === "failed" ? "Local mock generation was marked as failed." : null,
          updated_at: new Date().toISOString(),
          raw_result: {
            transport: "mock",
            status: mockStatus
          }
        })
        .eq("id", taskId)
        .eq("user_id", user.id)
        .throwOnError();

      return NextResponse.json({
        status: mockStatus.toUpperCase(),
        result: null,
        balance,
        failureCode: mockStatus === "failed" ? "mock_failed" : null,
        failureReason: mockStatus === "failed" ? "Local mock generation was marked as failed. Credits were refunded automatically." : null,
        refundLedgerId,
        refundedCredits
      });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "FAL_KEY is not configured." }, { status: 400 });
    }

    if (!statusUrl || !isAllowedFalUrl(statusUrl)) {
      if (taskId) {
        const admin = createSupabaseAdminClient();
        if (admin) {
          const orphanResult = await failOrphanTaskIfTimedOut(admin, user.id, taskId);
          if (orphanResult?.pending) {
            return NextResponse.json({
              status: "IN_QUEUE",
              result: null,
              failureReason: orphanResult.failureReason
            });
          }
          if (orphanResult && !orphanResult.pending) {
            return NextResponse.json({
              status: "FAILED",
              result: null,
              ...orphanResult
            });
          }
        }
      }
      return NextResponse.json({ error: "Invalid statusUrl." }, { status: 400 });
    }

    const statusRes = await fetchFal(statusUrl, {
      attempts: 2,
      timeoutMs: 15000,
      headers: {
        Authorization: `Key ${falKey}`
      },
      cache: "no-store"
    });

    if (!statusRes.ok) {
      return NextResponse.json({ error: `Status check failed (${statusRes.status}).` }, { status: 502 });
    }

    const statusPayload = (await statusRes.json()) as {
      status?: string;
      response_url?: string;
    };
    const upperStatus = (statusPayload.status || "IN_QUEUE").toUpperCase();
    const providerResponseUrl = isAllowedFalUrl(statusPayload.response_url || "")
      ? statusPayload.response_url || null
      : null;
    const effectiveResponseUrl = providerResponseUrl || responseUrl;

    let result: unknown = null;
    let responseFailureInfo: ReturnType<typeof parseFalFailure> | null = null;
    if ((upperStatus === "COMPLETED" || upperStatus === "FAILED" || upperStatus === "ERROR") && effectiveResponseUrl && isAllowedFalUrl(effectiveResponseUrl)) {
      const resultRes = await fetchFal(effectiveResponseUrl, {
        attempts: 2,
        timeoutMs: 20000,
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
    let statusMeta: Record<string, unknown> = {};
    let responseStatus = upperStatus;

    if (taskId) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const mediaUrl = extractMediaUrl(result);
        const providerNormalized =
          upperStatus === "IN_QUEUE"
            ? "queued"
            : upperStatus === "IN_PROGRESS"
              ? "running"
              : upperStatus === "COMPLETED"
                ? "completed"
                : "failed";
        const completedFailurePayload =
          providerNormalized === "completed"
            ? falResultLooksFailed(result)
              ? result
              : mediaUrl
                ? null
                : falNoMediaFailurePayload(result || statusPayload)
            : null;
        const normalized = completedFailurePayload ? "failed" : providerNormalized;
        responseStatus = normalized.toUpperCase();

        try {
          let taskForRefund: { estimated_credits?: number; created_at?: string; provider_request_id?: string | null } | null = null;
          const { data: task } = await admin
            .from("generation_tasks")
            .select("estimated_credits, created_at, provider_request_id")
            .eq("id", taskId)
            .eq("user_id", user.id)
            .maybeSingle();
          taskForRefund = task as { estimated_credits?: number; created_at?: string; provider_request_id?: string | null } | null;

          if (
            taskForRefund?.created_at &&
            (normalized === "queued" || normalized === "running") &&
            isTaskTimedOut(taskForRefund.created_at)
          ) {
            const estimatedCredits =
              typeof taskForRefund.estimated_credits === "number" ? taskForRefund.estimated_credits : 0;
            const refund = await refundAndReadLedger(admin, user.id, taskId, estimatedCredits);
            const now = new Date().toISOString();
            const failureReason = `The provider task did not finish within ${taskTimeoutMinutes()} minutes. Credits were refunded automatically.`;
            await admin
              .from("generation_tasks")
              .update({
                status: "failed",
                response_url: effectiveResponseUrl,
                failure_code: "task_timeout",
                failure_reason: failureReason,
                last_checked_at: now,
                timed_out_at: now,
                updated_at: now
              })
              .eq("id", taskId)
              .eq("user_id", user.id)
              .throwOnError();

            return NextResponse.json({
              status: "FAILED",
              result: null,
              failureCode: "task_timeout",
              failureReason,
              ...refund
            });
          }

          let refund: RefundInfo = { balance: null, refundLedgerId: null, refundedCredits: 0 };
          let failureCode: string | null = null;
          let failureReason: string | null = null;
          if (normalized === "failed") {
            const estimatedCredits =
              taskForRefund && typeof taskForRefund.estimated_credits === "number"
                ? taskForRefund.estimated_credits
                : 0;
            const failureInfo = completedFailurePayload
              ? parseFalFailure(completedFailurePayload)
              : responseFailureInfo || parseFalFailure(result || statusPayload);
            failureInfo.costUsd = await resolveFalCostUsd(falKey, taskForRefund?.provider_request_id, failureInfo.costUsd);
            const refundCredits = falRefundCreditsFromCost(failureInfo.costUsd, estimatedCredits);
            refund = await refundAndReadLedger(admin, user.id, taskId, refundCredits);
            failureCode = failureInfo.code || "provider_failed";
            failureReason = formatFalFailureReason(failureInfo, estimatedCredits, refundCredits);
            statusMeta = {
              failureCode,
              failureReason,
              actualCredits: Math.max(0, estimatedCredits - refundCredits),
              ...refund,
            };
          }

          await admin
            .from("generation_tasks")
            .update({
              status: normalized,
              response_url: effectiveResponseUrl,
              output_url: normalized === "completed" ? mediaUrl : null,
              raw_result: result,
              failure_code: failureCode,
              failure_reason: failureReason,
              last_checked_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", taskId)
            .eq("user_id", user.id)
            .throwOnError();
        } catch {
          // The provider result is still useful even if local task history cannot be updated.
        }
      }
    }

    return NextResponse.json({
      status: responseStatus,
      result,
      ...statusMeta
    });
  } catch {
    return NextResponse.json({ error: "Unable to fetch fal.ai task status." }, { status: 500 });
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

