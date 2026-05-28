import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";

const TASK_SELECT =
  "id,user_id,mode,provider,prompt,status,estimated_credits,transport,output_url,created_at,updated_at,title,is_favorite,failure_code,failure_reason,last_checked_at,timed_out_at";

type TaskRow = {
  id: string;
  user_id: string;
  mode: "image" | "video" | "audio";
  provider: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  estimated_credits: number;
  transport: "real" | "mock";
  output_url: string | null;
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

function cleanStatus(status: string | null) {
  return ["queued", "running", "completed", "failed"].includes(status || "") ? status : null;
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
