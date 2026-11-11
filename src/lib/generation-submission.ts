import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {RowDataPacket} from "mysql2/promise";
import {withMysqlTransaction,withMysqlAdvisoryTransaction,toMysqlDate} from "./mysql";
import {fetchFal} from "./fal-fetch";
import {falApiErrorFromResponse,FalApiError} from "./fal-errors";
import {isAllowedFalUrl} from "./generation-task-guards";
import {siteUrl} from "./site-url";

export type SubmissionStage="primary"|"tts";
export type ProviderAttempt={id:string;stage:SubmissionStage;modelId:string;inputHash:string;startedAt:string;state:"submitting"|"accepted"|"unknown"|"rejected";requestId?:string;statusUrl?:string;responseUrl?:string;cancelUrl?:string;failureInfo?:ReturnType<typeof import("./fal-errors").parseFalFailure>};
type StoredTask=Record<string,any>;
function settings(task:StoredTask) {return typeof task.request_settings==="string"?JSON.parse(task.request_settings):task.request_settings||{};}
function secret(){const key=process.env.FAL_WEBHOOK_SECRET||process.env.AUTH_SESSION_SECRET||process.env.MYSQL_PASSWORD;if(!key&&process.env.NODE_ENV==="production")throw new Error("Provider recovery signing is not configured.");return key||"local-provider-recovery-only";}
const signature=(taskId:string,attemptId:string)=>createHmac("sha256",secret()).update(`fal-recovery:${taskId}:${attemptId}`).digest("hex");
export function verifyRecoveryToken(taskId:string,attemptId:string,token:string) {
  if(!/^[a-f0-9]{64}$/.test(token))return false;
  return timingSafeEqual(Buffer.from(token,"hex"),Buffer.from(signature(taskId,attemptId),"hex"));
}
function canonical(value:any):string {return Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`:JSON.stringify(value);}
export function providerInputHash(input:unknown){return createHash("sha256").update(canonical(input)).digest("hex");}
export function providerTracking(modelId:string,requestId:string) {
  if(!/^[a-zA-Z0-9_-]{1,191}$/.test(requestId)||!/^[-a-zA-Z0-9_]+\/[-a-zA-Z0-9_]+(?:\/[-a-zA-Z0-9_]+)*$/.test(modelId))throw new Error("Invalid provider tracking.");
  const base=`https://queue.fal.run/${modelId.split("/").slice(0,2).join("/")}/requests/${requestId}`;
  return {requestId,statusUrl:`${base}/status`,responseUrl:base,cancelUrl:`${base}/cancel`};
}
async function mutateTask(taskId:string,userId:string|null,change:(task:StoredTask,config:Record<string,any>)=>Record<string,unknown>|null,claimRequestId?:string) {
  const transact=claimRequestId?<T>(fn:Parameters<typeof withMysqlTransaction<T>>[0])=>withMysqlAdvisoryTransaction("df-request:"+createHash("sha256").update(claimRequestId).digest("hex").slice(0,48),fn):withMysqlTransaction;
  return transact(async connection=>{
    const [rows]=await connection.execute<RowDataPacket[]>("select * from generation_tasks where id = ? for update",[taskId]);const task=rows[0];
    if(!task||(userId&&task.user_id!==userId))throw new Error("Task not found.");
    if(claimRequestId){const [linked]=await connection.execute<RowDataPacket[]>("select id from generation_tasks where provider_request_id = ? and id <> ? limit 1",[claimRequestId,taskId]);if(linked.length)throw new Error("This provider request belongs to another task.");}
    if(!["queued","running"].includes(task.status))return {...task,request_settings:settings(task)};
    const config=settings(task),patch=change(task,config);if(!patch)return {...task,request_settings:config};
    const columns=Object.keys(patch);if(columns.some(key=>!["request_settings","provider_request_id","status_url","response_url","failure_code","failure_reason","last_checked_at","updated_at"].includes(key)))throw new Error("Invalid submission update.");
    await connection.execute(`update generation_tasks set ${columns.map(key=>`\`${key}\` = ?`).join(",")} where id = ?`,[...columns.map(key=>key==="request_settings"?JSON.stringify(patch[key]):key.endsWith("_at")?toMysqlDate(patch[key]):patch[key]),taskId] as any[]);
    return {...task,...patch};
  });
}
export class SubmissionAlreadyStarted extends Error {}
export class SubmissionNotStarted extends Error {}
export async function recordProviderAttempt(taskId:string,userId:string|null,attemptId:string,tracking:ReturnType<typeof providerTracking>) {
  return mutateTask(taskId,userId,(_task,config)=>{
    const attempts=config.provider_attempts||{},entry=Object.values(attempts).find((value:any)=>value?.id===attemptId) as ProviderAttempt|undefined;
    if(!entry)throw new Error("Submission attempt not found.");
    if(entry.requestId&&entry.requestId!==tracking.requestId)throw new Error("Provider request does not match this attempt.");
    // Canonical URLs derive from the server's recorded model, never webhook/body URLs.
    const verified=providerTracking(entry.modelId,tracking.requestId);Object.assign(entry,verified,{state:"accepted"});
    return {request_settings:config,...(entry.stage==="primary"?{provider_request_id:verified.requestId,status_url:verified.statusUrl,response_url:verified.responseUrl,failure_code:null,failure_reason:null}:{}),updated_at:new Date().toISOString()};
  },tracking.requestId);
}

/** Durable intent precedes the network request; a stage can never be submitted twice. */
export async function submitTrackedFal(falKey:string,modelId:string,input:unknown,context:{taskId:string;userId:string;stage:SubmissionStage}) {
  try {providerTracking(modelId,"validate");}catch{throw new SubmissionNotStarted("The provider model is not configured correctly.");}
  let attempt:ProviderAttempt|undefined;
  try {
    await mutateTask(context.taskId,context.userId,(_task,config)=>{
      config.provider_attempts ||= {};
      if(config.provider_attempts[context.stage])throw new SubmissionAlreadyStarted("This provider stage is already pending reconciliation.");
      attempt={id:randomUUID(),stage:context.stage,modelId,inputHash:providerInputHash(input),startedAt:new Date().toISOString(),state:"submitting"};
      config.provider_attempts[context.stage]=attempt;
      return {request_settings:config,updated_at:new Date().toISOString()};
    });
  } catch(error) {if(error instanceof SubmissionAlreadyStarted)throw error;throw new SubmissionNotStarted("Provider submission could not be prepared. No provider request was made.");}
  if(!attempt)throw new SubmissionAlreadyStarted("Task is already settled.");
  const active=attempt as ProviderAttempt,url=new URL(`https://queue.fal.run/${modelId}`),origin=new URL(siteUrl());
  // localhost cannot receive fal callbacks; polling still works in local development.
  if(origin.protocol==="https:"&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) {
    const callback=new URL("/api/generate/webhook/fal",origin);callback.searchParams.set("taskId",context.taskId);callback.searchParams.set("attemptId",active.id);callback.searchParams.set("token",signature(context.taskId,active.id));url.searchParams.set("fal_webhook",callback.toString());
  }
  try {
    const response=await fetchFal(url.toString(),{method:"POST",attempts:1,timeoutMs:22000,headers:{Authorization:`Key ${falKey}`,"Content-Type":"application/json","X-Fal-No-Retry":"1","X-Fal-Tags":`task=${context.taskId},stage=${context.stage},attempt=${active.id}`},body:JSON.stringify(input)});
    if(!response.ok)throw await falApiErrorFromResponse(response);
    const payload=await response.json() as {request_id:string;status:string;status_url:string;response_url?:string;cancel_url?:string};
    const tracking=providerTracking(modelId,payload.request_id);
    // Persist accepted IDs independently of the route's final update. A verified
    // callback can recover an acceptance whose response was completely lost.
    try {await recordProviderAttempt(context.taskId,context.userId,active.id,tracking);}
    catch {console.error("Accepted provider tracking awaits recovery",{taskId:context.taskId,stage:context.stage,requestId:payload.request_id});}
    const valid=(value:string|undefined,fallback:string)=>isAllowedFalUrl(value)&&value.includes(`/requests/${payload.request_id}`)?value:fallback;
    return {...payload,status_url:valid(payload.status_url,tracking.statusUrl),response_url:valid(payload.response_url,tracking.responseUrl),cancel_url:tracking.cancelUrl};
  } catch(error) {
    const rejected=error instanceof FalApiError&&error.status>=400&&error.status<500&&![408,409].includes(error.status);
    await mutateTask(context.taskId,context.userId,(_task,config)=>{const entry=config.provider_attempts?.[context.stage];if(entry?.id!==active.id)return null;if(entry.state!=="accepted"){entry.state=rejected?"rejected":"unknown";if(rejected&&error instanceof FalApiError)entry.failureInfo=error.info;}return {request_settings:config,updated_at:new Date().toISOString()};}).catch(()=>null);
    throw error;
  }
}

export async function recoverStoredTracking(task:StoredTask) {
  const config=settings(task),attempt=config.provider_attempts?.primary as ProviderAttempt|undefined;
  if(attempt?.requestId)return recordProviderAttempt(task.id,task.user_id,attempt.id,providerTracking(attempt.modelId,attempt.requestId));
  return task;
}

export async function recordTtsOutput(taskId:string,userId:string,output:Record<string,unknown>) {
  return mutateTask(taskId,userId,(_task,config)=>({request_settings:{...config,tts_step:output},updated_at:new Date().toISOString()}));
}

/** Admin changes are recorded in the task under the same row lock; never accept a caller's provider URL. */
export async function attachProviderTracking(task:StoredTask,requestId:string,actor:string,note:string) {
  return mutateTask(task.id,task.user_id,(_current,config)=>{
    const entry=config.provider_attempts?.primary as ProviderAttempt|undefined;
    const model=entry?.modelId||config.model_id;if(typeof model!=="string")throw new Error("Stored provider model is unavailable.");
    if(_current.provider_request_id&&_current.provider_request_id!==requestId)throw new Error("A different provider request is already attached.");
    const tracking=providerTracking(model,requestId);
    config.reconciliation_events=[...(config.reconciliation_events||[]),{action:"attach_tracking",actor,note,requestId,at:new Date().toISOString()}].slice(-20);
    if(entry)Object.assign(entry,tracking,{state:"accepted"});
    return {request_settings:config,provider_request_id:requestId,status_url:tracking.statusUrl,response_url:tracking.responseUrl,failure_code:null,failure_reason:null,updated_at:new Date().toISOString()};
  },requestId);
}

export async function recordReconciliationEvent(taskId:string,userId:string,action:string,actor:string,note:string) {
  return mutateTask(taskId,userId,(_task,config)=>({request_settings:{...config,...(action==="cancel_queue_removed"?{provider_cancelled_before_execution:true}:{}),reconciliation_events:[...(Array.isArray(config.reconciliation_events)?config.reconciliation_events:[]),{action,actor,note,at:new Date().toISOString()}].slice(-20)},updated_at:new Date().toISOString(),...(action==="cancel_requested"?{failure_code:"provider_cancel_requested",failure_reason:"Cancellation was requested. The provider result and charge are being reconciled."}:{})}));
}
