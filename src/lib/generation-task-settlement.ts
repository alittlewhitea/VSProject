type TaskPatch = {
  status: "queued" | "running" | "completed" | "failed";
  [key: string]: unknown;
};
type SettlementResult = {
  applied: boolean;
  task: Record<string, any>;
  balance: number | null;
  refundLedgerId: number | string | null;
  refundedCredits: number;
};
type SettlementStorage = { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

/** The row lock, terminal transition, account update and ledger commit together. */
export async function settleGenerationTask(admin: SettlementStorage, userId: string, taskId: string, patch: TaskPatch, refundCredits = 0, repairFailedRefund = false, resolution?: {actor:string;note:string;evidence:string;costUsd:number|null}): Promise<SettlementResult> {
  const { data, error } = await admin.rpc("settle_generation_task", { p_user_id: userId, p_task_id: taskId, p_patch: patch, p_refund_credits: refundCredits, p_repair_failed_refund: repairFailedRefund, p_resolution:resolution });
  if (error) throw error;
  if (!data) throw new Error("Task settlement failed.");
  return data as SettlementResult;
}
