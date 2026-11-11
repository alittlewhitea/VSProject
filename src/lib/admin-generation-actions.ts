import {fetchFal} from "./fal-fetch";
import {falRefundCreditsFromCost} from "./fal-errors";
import {syncFalTask,type FalTask} from "./fal-task-sync";
import {settleGenerationTask} from "./generation-task-settlement";
import {attachProviderTracking,providerTracking,providerInputHash,recordReconciliationEvent} from "./generation-submission";
import {isRetiredProvider} from "./retired-providers";

export class AdminGenerationActionError extends Error {constructor(message:string,public status=409){super(message);}}
export type AdminGenerationAction={action?:"sync_provider"|"attach_tracking"|"cancel_provider"|"resolve_no_job";taskId?:string;requestId?:string;note?:string;providerConfirmedNoJob?:boolean;confirmedCostUsd?:number};
export async function actOnGeneration(admin:any,task:FalTask&Record<string,any>,payload:AdminGenerationAction,actor:string) {
  if(payload.action==="sync_provider")return syncFalTask(admin,task,process.env.FAL_KEY||"");
  if(["completed","failed"].includes(task.status))throw new AdminGenerationActionError("This task is already settled. Refresh its details.");
  const note=typeof payload.note==="string"?payload.note.trim().slice(0,1000):"";
  if(payload.action==="cancel_provider") {
    if(!task.provider_request_id||typeof task.request_settings?.model_id!=="string"||isRetiredProvider(task.provider))throw new AdminGenerationActionError("No cancellable provider request is recorded.");
    const key=process.env.FAL_KEY;if(!key)throw new AdminGenerationActionError("Provider access is unavailable.",503);
    const tracking=providerTracking(task.request_settings.model_id,task.provider_request_id);
    await recordReconciliationEvent(task.id,task.user_id,"cancel_requested",actor,note||"Administrator requested cancellation; awaiting provider confirmation.");
    const response=await fetchFal(tracking.cancelUrl,{method:"PUT",attempts:1,timeoutMs:8000,headers:{Authorization:`Key ${key}`}});
    if(!response.ok)return {status:"CANCELLATION_PENDING"};
    const result=await response.json() as {status?:string};
    if(result.status==="OK") {
      // HTTP 200/OK explicitly confirms removal before execution. A running
      // cancellation signal (202) is not proof of zero cost or a terminal state.
      const cancelled=await recordReconciliationEvent(task.id,task.user_id,"cancel_queue_removed",actor,note||"Provider confirmed removal from queue before execution.");
      await syncFalTask(admin,cancelled as FalTask,key);
    } else await syncFalTask(admin,task,key);
    return result;
  }
  if(note.length<12)throw new AdminGenerationActionError("Record the provider evidence and reason (at least 12 characters).",400);
  if(payload.action==="attach_tracking") {
    if(typeof payload.requestId!=="string"||!/^[a-zA-Z0-9_-]{1,191}$/.test(payload.requestId)||typeof task.request_settings?.model_id!=="string")throw new AdminGenerationActionError("A provider request ID and stored model are required.",400);
    const {data:linked,error}=await admin.from("generation_tasks").select("id").eq("provider_request_id",payload.requestId).maybeSingle();if(error)throw error;
    if(linked&&linked.id!==task.id)throw new AdminGenerationActionError("This provider request is already assigned to another task.");
    const expectedHash=task.request_settings.provider_attempts?.primary?.inputHash;
    if(!expectedHash)throw new AdminGenerationActionError("This legacy task has no submission fingerprint. Use provider-confirmed manual resolution.");
    const url=new URL("https://api.fal.ai/v1/models/requests/by-endpoint");url.searchParams.set("endpoint_id",task.request_settings.model_id);url.searchParams.set("request_id",payload.requestId);url.searchParams.set("expand","payloads");
    const response=await fetchFal(url.toString(),{attempts:1,timeoutMs:8000,headers:{Authorization:`Key ${process.env.FAL_KEY||""}`}});
    if(!response.ok)throw new AdminGenerationActionError("Provider evidence could not be verified.");
    const history=await response.json() as {items?:any[]};
    const matches=(history.items||[]).filter(row=>row.request_id===payload.requestId&&row.endpoint_id===task.request_settings?.model_id&&row.json_input&&providerInputHash(row.json_input)===expectedHash);
    if(matches.length!==1)throw new AdminGenerationActionError("Provider model and input fingerprint do not match this task.");
    await attachProviderTracking(task,payload.requestId,actor,note);
    const {data:recovered,error:readError}=await admin.from("generation_tasks").select("*").eq("id",task.id).eq("user_id",task.user_id).maybeSingle();if(readError)throw readError;
    return syncFalTask(admin,recovered,process.env.FAL_KEY||"");
  }
  if(payload.action==="resolve_no_job") {
    if(payload.providerConfirmedNoJob!==true||!Number.isFinite(payload.confirmedCostUsd)||Number(payload.confirmedCostUsd)<0)throw new AdminGenerationActionError("Confirm the provider has no active job and record its actual total cost.",400);
    if(task.provider_request_id&&!isRetiredProvider(task.provider))throw new AdminGenerationActionError("This task has provider tracking. Sync or cancel it; an active request cannot be manually refunded.");
    if(Date.now()-new Date(task.created_at||"").getTime()<10*60000)throw new AdminGenerationActionError("Allow 10 minutes for provider recovery before manual resolution.");
    const refund=falRefundCreditsFromCost(Number(payload.confirmedCostUsd),task.estimated_credits,task.provider);
    return settleGenerationTask(admin,task.user_id,task.id,{status:"failed",failure_code:"provider_confirmed_no_job",failure_reason:"Support reconciled this request against provider evidence.",updated_at:new Date().toISOString()},refund,false,{actor,note,evidence:"operator_provider_confirmed_no_active_job",costUsd:Number(payload.confirmedCostUsd)});
  }
  throw new AdminGenerationActionError("Unsupported admin task action.",400);
}
