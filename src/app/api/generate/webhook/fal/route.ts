import {NextResponse} from "next/server";
import {createSupabaseAdminClient} from "../../../../../lib/supabase-admin";
import {readRequestBytes,RequestBodyError} from "../../../../../lib/request-body";
import {verifyRecoveryToken,recordProviderAttempt,providerTracking,type ProviderAttempt} from "../../../../../lib/generation-submission";
import {verifyFalWebhook} from "../../../../../lib/fal-webhook-signature";
import {syncFalTask,type FalTask} from "../../../../../lib/fal-task-sync";

export async function POST(request:Request) {
  try {
    const params=new URL(request.url).searchParams,taskId=params.get("taskId")||"",attemptId=params.get("attemptId")||"",token=params.get("token")||"";
    if(!/^[a-zA-Z0-9_-]{1,191}$/.test(taskId)||!verifyRecoveryToken(taskId,attemptId,token))return NextResponse.json({error:"Invalid callback."},{status:403});
    const bytes=await readRequestBytes(request,2*1024*1024);
    if(!await verifyFalWebhook(request.headers,bytes))return NextResponse.json({error:"Invalid signature."},{status:403});
    const payload=JSON.parse(bytes.toString("utf8")) as {request_id?:string};
    if(!payload.request_id||payload.request_id!==request.headers.get("x-fal-webhook-request-id"))return NextResponse.json({error:"Request does not match signature."},{status:400});
    const admin=createSupabaseAdminClient();if(!admin)return NextResponse.json({error:"Storage unavailable."},{status:503});
    const {data:stored,error}=await admin.from("generation_tasks").select("*").eq("id",taskId).maybeSingle();
    if(error)throw error;if(!stored)return NextResponse.json({error:"Task not found."},{status:404});
    const task=stored as FalTask & Record<string,any>;
    if(["completed","failed"].includes(task.status))return NextResponse.json({ok:true,settled:true});
    const attempt=Object.values(task.request_settings?.provider_attempts||{}).find((value:any)=>value?.id===attemptId) as ProviderAttempt|undefined;
    if(!attempt)return NextResponse.json({error:"Attempt not found."},{status:404});
    const recovered=await recordProviderAttempt(taskId,task.user_id,attemptId,providerTracking(attempt.modelId,payload.request_id));
    if(attempt.stage==="primary")await syncFalTask(admin,recovered as FalTask,process.env.FAL_KEY||"");
    return NextResponse.json({ok:true});
  } catch(error) {return NextResponse.json({error:"Callback will be retried."},{status:error instanceof RequestBodyError?error.status:503});}
}
