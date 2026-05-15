import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";

const TASK_HISTORY_TIMEOUT_MS = 4500;

type TaskHistoryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
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

export async function GET(request: Request) {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Invalid or missing Supabase access token." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

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

