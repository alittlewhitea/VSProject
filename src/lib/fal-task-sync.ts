import { fetchFal } from "./fal-fetch";
import { resolveFalTaskCostUsd } from "./fal-billing";
import { falApiErrorFromResponse, falNoMediaFailurePayload, falRefundCreditsFromCost, falResultLooksFailed, formatFalFailureReason, parseFalFailure } from "./fal-errors";
import { isTerminalTaskStatus, providerPollTargets } from "./generation-task-guards";
import { settleGenerationTask } from "./generation-task-settlement";
import {recoverGenerationTracking} from "./generation-recovery";
import {hasProviderIntegration} from "./retired-providers";

export type FalTask = {
  id: string; user_id: string; status: "queued" | "running" | "completed" | "failed";
  provider?: string; estimated_credits: number; status_url?: string | null; response_url?: string | null;
  provider_request_id?: string | null; output_url?: string | null; raw_result?: unknown;
  failure_code?: string | null; failure_reason?: string | null; created_at?: string;
  request_settings?: Record<string,any> | null;
};
type Storage = Parameters<typeof settleGenerationTask>[0];

export function extractTaskMedia(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, any>;
  const url = value.url || value.images?.[0]?.url || value.image?.url || value.video?.url || value.videos?.[0]?.url || value.audio?.url || value.audio_file?.url;
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

export function taskSyncResponse(task: FalTask, refund: Record<string, unknown> = {}) {
  return { status: task.status === "queued" ? "IN_QUEUE" : task.status === "running" ? "IN_PROGRESS" : task.status.toUpperCase(),
    result: task.status === "completed" ? task.raw_result ?? (task.output_url ? { url: task.output_url } : null) : null,
    failureCode: task.failure_code || null, failureReason: task.failure_reason || null, ...refund };
}

/** Shared by explicit polling, task history sync and cron; settlement is atomic. */
export async function syncFalTask(admin: Storage, task: FalTask, falKey: string, timeoutMs = 5000) {
  if (isTerminalTaskStatus(task.status)) return taskSyncResponse(task);
  if(!hasProviderIntegration(task.provider))return taskSyncResponse({...task,failure_code:"model_retired",failure_reason:"This model has been retired. Contact support for any unresolved historical task."});
  if(!providerPollTargets(task)&&task.request_settings?.provider_attempts) {
    try {task=await recoverGenerationTracking(admin,task,falKey) as FalTask;} catch {/* Persist a fair retry timestamp below. */}
    if(isTerminalTaskStatus(task.status))return taskSyncResponse(task);
  }
  const now = new Date().toISOString();
  const hold = async (code?: string, reason?: string) => {
    const settled = await settleGenerationTask(admin, task.user_id, task.id, { status: task.status, last_checked_at: now, updated_at: now,
      ...(code ? { failure_code: code, failure_reason: reason } : {}) });
    return taskSyncResponse(settled.task as FalTask);
  };
  const targets = providerPollTargets(task);
  if(task.request_settings?.provider_cancelled_before_execution&&falKey) {
    const cost=await resolveFalTaskCostUsd(falKey,task,0,true);
    if(cost.pendingAuxiliary)return hold("billing_reconciliation_pending","Cancellation is confirmed. The cost of the voice-generation stage is still being verified.");
    const refund=falRefundCreditsFromCost(cost.costUsd,task.estimated_credits,task.provider);
    const settled=await settleGenerationTask(admin,task.user_id,task.id,{status:"failed",failure_code:"provider_cancelled",failure_reason:formatFalFailureReason(parseFalFailure({error_type:"cancelled",cost:cost.costUsd}),task.estimated_credits,refund),updated_at:now},refund);
    return taskSyncResponse(settled.task as FalTask,{refundedCredits:settled.refundedCredits,balance:settled.balance});
  }
  if (!targets) return task.failure_code==="billing_reconciliation_pending" ? hold(task.failure_code,task.failure_reason||"Provider costs are being verified.") : hold("provider_tracking_pending", "Provider tracking is awaiting reconciliation. No automatic resubmission or refund has been made.");
  if (!falKey) return hold();
  try {
    const response = await fetchFal(targets.statusUrl, { attempts: 1, timeoutMs, headers: { Authorization: `Key ${falKey}` }, cache: "no-store" });
    if (!response.ok) return hold();
    const statusPayload = await response.json() as { status?: string };
    const status = String(statusPayload.status || "").toUpperCase();
    if (!["COMPLETED", "FAILED", "ERROR"].includes(status)) {
      const pending = status === "IN_PROGRESS" ? "running" : task.status;
      const expired = Date.now() - new Date(task.created_at || now).getTime() > Math.max(1, Number(process.env.GENERATION_TASK_TIMEOUT_MINUTES) || 45) * 60000;
      const settled = await settleGenerationTask(admin, task.user_id, task.id, { status: pending, last_checked_at: now, updated_at: now,
        ...(expired ? { failure_code: "provider_timeout_pending", failure_reason: "The provider is still processing this task. Its charge will be reconciled when the final result is known.", timed_out_at: now } : {}) });
      return taskSyncResponse(settled.task as FalTask);
    }
    if (!targets.responseUrl) return hold();
    const resultResponse = await fetchFal(targets.responseUrl, { attempts: 1, timeoutMs, headers: { Authorization: `Key ${falKey}` }, cache: "no-store" });
    // A transient result endpoint error does not establish a failed paid job.
    if (!resultResponse.ok && (resultResponse.status >= 500 || [401,403,404,408,429].includes(resultResponse.status))) return hold();
    let result: unknown;
    let failure: ReturnType<typeof parseFalFailure> | null = null;
    if (resultResponse.ok) result = await resultResponse.json();
    else { const error = await falApiErrorFromResponse(resultResponse); failure = error.info; result = failure.details; }
    const media = extractTaskMedia(result);
    const failed = status !== "COMPLETED" || failure || falResultLooksFailed(result) || !media;
    if (failed && !failure) failure = parseFalFailure(falResultLooksFailed(result) ? result : !media && status === "COMPLETED" ? falNoMediaFailurePayload(result) : result);
    if (failure) {
      const cost=await resolveFalTaskCostUsd(falKey,task,failure.costUsd);
      if(cost.pendingAuxiliary)return hold("billing_reconciliation_pending","The provider failed. Its voice-generation cost is being verified before refunding the remaining credits.");
      failure.costUsd=cost.costUsd;
    }
    const refund = failure ? falRefundCreditsFromCost(failure.costUsd, task.estimated_credits, task.provider) : 0;
    const settled = await settleGenerationTask(admin, task.user_id, task.id, {
      status: failed ? "failed" : "completed", output_url: failed ? null : media, raw_result: result,
      failure_code: failure?.code || null, failure_reason: failure ? formatFalFailureReason(failure, task.estimated_credits, refund) : null,
      last_checked_at: now, updated_at: now
    }, refund);
    return taskSyncResponse(settled.task as FalTask, { balance: settled.balance, refundLedgerId: settled.refundLedgerId, refundedCredits: settled.refundedCredits });
  } catch {
    // Record fair polling progress; uncertainty never means "failed/refunded".
    return hold();
  }
}
