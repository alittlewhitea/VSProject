import {fetchFal} from "./fal-fetch";
import {falApiErrorFromResponse,falRefundCreditsFromCost,parseFalFailure,formatFalFailureReason} from "./fal-errors";
import {resolveFalCostUsd,resolveFalTaskCostUsd} from "./fal-billing";
import {recoverStoredTracking,providerTracking,submitTrackedFal,recordTtsOutput,type ProviderAttempt} from "./generation-submission";
import {settleGenerationTask} from "./generation-task-settlement";

/** Only the unsent next stage may start. An unknown primary attempt is never replayed. */
export async function recoverGenerationTracking(admin:any,task:Record<string,any>,falKey:string) {
  const config=task.request_settings||{},primary=config.provider_attempts?.primary as ProviderAttempt|undefined;
  const rejected=primary?.state==="rejected"?primary:!primary&&config.provider_attempts?.tts?.state==="rejected"?config.provider_attempts.tts as ProviderAttempt:null;
  if(rejected?.failureInfo) {
    const info={...rejected.failureInfo};
    const cost=await resolveFalTaskCostUsd(falKey,task,info.costUsd);
    if(cost.pendingAuxiliary)return (await settleGenerationTask(admin,task.user_id,task.id,{status:task.status,failure_code:"billing_reconciliation_pending",failure_reason:"Provider rejection is confirmed. Voice-stage cost is being verified.",updated_at:new Date().toISOString()})).task;
    const refund=falRefundCreditsFromCost(cost.costUsd,task.estimated_credits,task.provider);info.costUsd=cost.costUsd;
    return (await settleGenerationTask(admin,task.user_id,task.id,{status:"failed",failure_code:info.code||"provider_rejected",failure_reason:formatFalFailureReason(info,task.estimated_credits,refund),updated_at:new Date().toISOString()},refund)).task;
  }
  if(primary?.requestId)return recoverStoredTracking(task);
  if(primary||!falKey)return task;
  const tts=config.provider_attempts?.tts as ProviderAttempt|undefined;
  if(!tts?.requestId||!["kling-avatar-standard","kling-avatar-pro"].includes(task.provider)||Date.now()-new Date(tts.startedAt).getTime()<120000)return task;
  const tracking=providerTracking(tts.modelId,tts.requestId);
  const status=await fetchFal(tracking.statusUrl,{attempts:1,timeoutMs:5000,headers:{Authorization:`Key ${falKey}`},cache:"no-store"});
  if(!status.ok)return task;
  const state=await status.json() as {status?:string};if(!["COMPLETED","FAILED","ERROR"].includes(String(state.status).toUpperCase()))return task;
  const response=await fetchFal(tracking.responseUrl,{attempts:1,timeoutMs:5000,headers:{Authorization:`Key ${falKey}`},cache:"no-store"});
  if(!response.ok&&[401,403,404,408,429].includes(response.status)||response.status>=500)return task;
  const result=response.ok?await response.json():(await falApiErrorFromResponse(response)).info.details;
  const audio=result?.audio?.url;
  if(typeof audio!=="string"||!/^https:\/\//i.test(audio)) {
    const failure=parseFalFailure(result);failure.costUsd=await resolveFalCostUsd(falKey,tts.requestId,failure.costUsd);
    const refund=falRefundCreditsFromCost(failure.costUsd,task.estimated_credits,task.provider);
    return (await settleGenerationTask(admin,task.user_id,task.id,{status:"failed",failure_code:"tts_provider_failed",failure_reason:formatFalFailureReason(failure,task.estimated_credits,refund),updated_at:new Date().toISOString()},refund)).task;
  }
  if(typeof config.model_id!=="string"||!config.image_urls?.[0])return task;
  await recordTtsOutput(task.id,task.user_id,{...(config.tts_step||{}),request_id:tts.requestId,model_id:tts.modelId,audio_url:audio,recovered:true});
  try {await submitTrackedFal(falKey,config.model_id,{image_url:config.image_urls[0],audio_url:audio,prompt:task.prompt||"."},{taskId:task.id,userId:task.user_id,stage:"primary"});}
  catch { /* The durable primary intent prevents retries after any uncertain acceptance. */ }
  const {data,error}=await admin.from("generation_tasks").select("*").eq("id",task.id).eq("user_id",task.user_id).maybeSingle();if(error)throw error;return data||task;
}
