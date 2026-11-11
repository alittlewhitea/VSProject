// Model payload/price fixtures keep their existing storage/credit/provider boundaries.
// Real admission SQL and durable submission semantics have independent integration tests.
export function generationFixtureDependency(id,overrides,load) {
 if(!/^\.\.\/.*lib\//.test(id))return null;
 if(id.endsWith('/request-security'))return {...load('src/lib/request-security.ts'),consumeRateLimit:async()=>({allowed:true,retryAfterSeconds:0})};
 if(id.endsWith('/generation-task-settlement'))return {settleGenerationTask:async(admin,userId,taskId,patch,refund=0,...rest)=>{
  if(admin.rpc)return load('src/lib/generation-task-settlement.ts').settleGenerationTask(admin,userId,taskId,patch,refund,...rest);
  const {data:task}=await admin.from('generation_tasks').select('*').eq('id',taskId).eq('user_id',userId).maybeSingle();
  if(!task)throw new Error('Missing fixture task');
  if(['completed','failed'].includes(task.status))return {applied:false,task,refundedCredits:0,balance:null};
  const {error}=await admin.from('generation_tasks').update(patch).eq('id',taskId).eq('user_id',userId);if(error)throw error;
  const credits=Object.entries(overrides).find(([key])=>key.endsWith('/lib/credits'))?.[1];if(refund)await credits.refundCredits(admin,userId,refund,'generation_refund',taskId);
  return {applied:true,task:{...task,...patch},refundedCredits:refund,balance:null};
 }};
 if(id.endsWith('/generation-capacity'))return {GenerationCapacityError:class extends Error{},reserveGenerationTask:async(admin,task)=>{
  const credits=Object.entries(overrides).find(([key])=>key.endsWith('/lib/credits'))?.[1];if(!credits?.spendCredits)throw new Error('Missing credit fixture');
  const charged=task.estimated_credits?await credits.spendCredits(admin,task.user_id,task.estimated_credits,'generation_task',task.id):{ok:true,balance:(await credits.ensureCreditAccount(admin,task.user_id)).balance};
  if(!charged.ok)return {allowed:false,duplicate:false,balance:charged.balance,task:null};
  const {error}=await admin.from('generation_tasks').insert({...task,status:'queued'});if(error)throw error;
  return {allowed:true,duplicate:false,balance:charged.balance,task};
 }};
 if(id.endsWith('/generation-submission')) {
  const provider=Object.entries(overrides).find(([key])=>key.endsWith('/lib/fal-fetch'))?.[1];if(!provider)return null;
  return {SubmissionNotStarted:class extends Error{},submitTrackedFal:async(key,model,input)=>{const response=await provider.fetchFal('https://queue.fal.run/'+model,{method:'POST',headers:{Authorization:'Key '+key},body:JSON.stringify(input)});if(!response.ok)throw await load('src/lib/fal-errors.ts').falApiErrorFromResponse(response);return response.json();},recordTtsOutput:async()=>{}};
 }
 return null;
}
