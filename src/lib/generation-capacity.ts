import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { MAX_ACTIVE_GENERATIONS } from "./api-limits";
import { REMOVED_PROVIDER_IDS } from "./retired-providers";

export class GenerationCapacityError extends Error {
  constructor() { super("You already have 5 generations in progress. Wait for one to finish or review pending tasks."); this.name = "GenerationCapacityError"; }
}

/** Caller must hold the user's credit-account row lock until task insertion commits.
 * Pending provider work counts even when hidden or older than a timeout: it can still cost money.
 * Do not lock task rows here (settlement locks task then account).
 */
export async function assertGenerationCapacity(connection: PoolConnection, userId: string) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `select id from generation_tasks where user_id = ? and status in ('queued','running') and provider not in (${REMOVED_PROVIDER_IDS.map(() => "?").join(",")}) limit ${MAX_ACTIVE_GENERATIONS}`,
    [userId, ...REMOVED_PROVIDER_IDS]
  );
  if (rows.length >= MAX_ACTIVE_GENERATIONS) throw new GenerationCapacityError();
}

type TaskInput = { id: string; user_id: string; mode: string; provider: string; prompt: string; estimated_credits: number; transport: string; request_settings: Record<string, unknown> };
type Storage = { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }> };
export async function reserveGenerationTask(admin: Storage, task: TaskInput) {
  const { data, error } = await admin.rpc("reserve_generation_task", { p_task: task });
  if (error) {
    if (error.code === "generation_concurrency_limit") throw new GenerationCapacityError();
    throw error;
  }
  return data as { allowed: boolean; duplicate: boolean; balance: number; task: Record<string, any> | null };
}
