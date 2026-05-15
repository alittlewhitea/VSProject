import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { fetchFal } from "../../../lib/fal-fetch";
import { refundCredits } from "../../../lib/credits";

const TASK_HISTORY_TIMEOUT_MS = 4500;
const TASK_SYNC_LIMIT = 5;

type TaskHistoryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
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
            raw_result: result
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
      .select("id, mode, provider, prompt, status, estimated_credits, transport, status_url, response_url, output_url, raw_result, created_at")
      .eq("user_id", user.id)
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

  return NextResponse.json({ tasks: data ?? [] });
}

