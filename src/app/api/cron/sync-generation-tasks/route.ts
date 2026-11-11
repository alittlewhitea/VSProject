import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { cronAuthorized } from "../../../../lib/cron-auth";

import { syncFalTask, type FalTask } from "../../../../lib/fal-task-sync";
import {REMOVED_PROVIDER_IDS} from "../../../../lib/retired-providers";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Storage is unavailable." }, { status: 503 });
  const { data, error } = await admin.from("generation_tasks")
    .select("id,user_id,provider,status,estimated_credits,transport,provider_request_id,status_url,response_url,request_settings,output_url,raw_result,failure_code,failure_reason,created_at,timed_out_at")
    .eq("transport", "real").neq("provider",REMOVED_PROVIDER_IDS[0]).in("status", ["queued", "running"])
    .order("last_checked_at", { ascending: true }).order("created_at", { ascending: true }).limit(40);
  if (error) return NextResponse.json({ error: "Task reconciliation is unavailable." }, { status: 503 });
  const results = [];
  for (const task of (data || []) as FalTask[]) {
    try {
      const result = await syncFalTask(admin, task, process.env.FAL_KEY || "");
      results.push({ taskId: task.id, action: "synced", status: result.status });
    } catch { results.push({ taskId: task.id, action: "error", error: "Task reconciliation will be retried." }); }
  }
  return NextResponse.json({ ok: true, scanned: results.length, results });
}
