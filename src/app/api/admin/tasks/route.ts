import {NextResponse} from "next/server";
import {getAdminUserFromRequest} from "../../../../lib/admin-auth";
import {createSupabaseAdminClient} from "../../../../lib/supabase-admin";
import {actOnGeneration,AdminGenerationActionError,type AdminGenerationAction} from "../../../../lib/admin-generation-actions";
import {readRequestJson,RequestBodyError} from "../../../../lib/request-body";
const TASK_SELECT =
  "id,user_id,mode,provider,prompt,status,estimated_credits,transport,provider_request_id,status_url,response_url,output_url,request_settings,raw_result,created_at,updated_at,title,is_favorite,failure_code,failure_reason,last_checked_at,timed_out_at";
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

function cleanStatus(status: string | null) {
  return ["queued", "running", "completed", "failed"].includes(status || "") ? status : null;
}

async function readTaskWithLedger(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  taskId: string
) {
  const { data: task, error } = await admin
    .from("generation_tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
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
    timedOutAt: row.timed_out_at,
    reconciliationEvents: Array.isArray(row.request_settings?.reconciliation_events) ? row.request_settings.reconciliation_events : []
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
    .order("created_at", { ascending: false })
    .limit(limit);

  if(url.searchParams.get("review")!=="1")query=query.is("deleted_at",null);
  if (status) query = query.eq("status", status);
  if(url.searchParams.get("review")==="1")query=query.in("status",["queued","running"]).in("failure_code",["provider_submission_unknown","provider_tracking_pending","provider_timeout_pending","provider_cancel_requested","billing_reconciliation_pending","tracking_recovery_pending"]);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Task storage is unavailable." }, { status: 503 });
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
    return NextResponse.json({ error: "Credit records are unavailable." }, { status: 503 });
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
      timedOutAt: task.timed_out_at,
      reconciliationEvents: Array.isArray(task.request_settings?.reconciliation_events) ? task.request_settings.reconciliation_events : []
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

export async function POST(request:Request) {
  const adminUser=await getAdminUserFromRequest(request);
  if(!adminUser)return NextResponse.json({error:"Forbidden."},{status:403});
  const admin=createSupabaseAdminClient();if(!admin)return NextResponse.json({error:"Storage unavailable."},{status:503});
  try {
    const payload=await readRequestJson(request,16*1024) as AdminGenerationAction;
    if(!payload?.taskId||!/^[a-zA-Z0-9_-]{1,191}$/.test(payload.taskId))return NextResponse.json({error:"A valid task is required."},{status:400});
    const {data:task,error}=await admin.from("generation_tasks").select(TASK_SELECT).eq("id",payload.taskId).maybeSingle();
    if(error)throw error;if(!task)return NextResponse.json({error:"Task not found."},{status:404});
    const row=task as TaskRow;
    const result=await actOnGeneration(admin,row,payload,adminUser.email||adminUser.id);
    return NextResponse.json({adminEmail:adminUser.email,providerStatus:"status" in result?result.status:"RECONCILED",task:await readTaskWithLedger(admin,row.id)});
  } catch(error) {
    return NextResponse.json({error:error instanceof AdminGenerationActionError||error instanceof RequestBodyError?error.message:"The task action could not be completed. Refresh and retry reconciliation."},{status:error instanceof AdminGenerationActionError||error instanceof RequestBodyError?error.status:503});
  }
}
