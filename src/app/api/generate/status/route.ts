import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../../lib/server-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

import { STATUS_LIMITS, firstExceededLimit, rateLimitHeaders } from "../../../../lib/api-limits";
import { consumeRateLimit } from "../../../../lib/request-security";
import { syncFalTask, taskSyncResponse, type FalTask } from "../../../../lib/fal-task-sync";
import { settleGenerationTask } from "../../../../lib/generation-task-settlement";

export async function GET(request: Request) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const limited = await firstExceededLimit(user.id, STATUS_LIMITS, consumeRateLimit);
    if (limited) return NextResponse.json({ error: "Too many status checks." }, { status: limited.unavailable ? 503 : 429, headers: rateLimitHeaders(limited.retryAfterSeconds) });
    const params = new URL(request.url).searchParams, taskId = params.get("taskId"), mockStatus = params.get("mockStatus");
    if (!taskId || !/^[a-zA-Z0-9_-]{1,100}$/.test(taskId)) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (!admin) return NextResponse.json({ error: "Storage is unavailable." }, { status: 503 });
    // Provider URLs supplied by older clients are ignored. Ownership and tracking
    // are loaded exclusively from the stored task record.
    const { data, error } = await admin.from("generation_tasks").select("id,user_id,provider,status,transport,estimated_credits,provider_request_id,status_url,response_url,request_settings,output_url,raw_result,failure_code,failure_reason,created_at,timed_out_at")
      .eq("id", taskId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const task = data as FalTask & { transport?: string };
    if (mockStatus) {
      if (process.env.NODE_ENV === "production" || process.env.ALLOW_MOCK_GENERATION !== "true" || task.transport !== "mock") return NextResponse.json({ error: "Mock updates are unavailable." }, { status: 400 });
      if (!["completed", "failed"].includes(mockStatus)) return NextResponse.json({ error: "Invalid mock status." }, { status: 400 });
      const settled = await settleGenerationTask(admin, user.id, taskId, { status: mockStatus as "completed" | "failed", updated_at: new Date().toISOString() }, mockStatus === "failed" ? task.estimated_credits : 0);
      return NextResponse.json(taskSyncResponse(settled.task as FalTask, { refundedCredits: settled.refundedCredits, balance: settled.balance }));
    }
    return NextResponse.json(await syncFalTask(admin, task, process.env.FAL_KEY || "", 15000));
  } catch { return NextResponse.json({ error: "Unable to check this task. Please try again.", code: "task_status_unavailable" }, { status: 503 }); }
}
