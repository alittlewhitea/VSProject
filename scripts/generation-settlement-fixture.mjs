// Database boundary for model integration fixtures. Actual transactional SQL is
// exercised independently by verify-generation-settlement.mjs.
export function settlementRpcFixture(records, refund) {
 return async(name,params)=>{
  if(name!=='settle_generation_task')throw new Error('Unexpected fixture RPC');
  const row=records[params.p_task_id];
  if(!row||row.user_id!==params.p_user_id)return{data:null,error:new Error('Fixture task not found')};
  const result={applied:false,task:row,balance:null,refundLedgerId:null,refundedCredits:0};
  if(!['queued','running'].includes(row.status))return{data:result,error:null};
  Object.assign(row,{...params.p_patch,status:row.status==='running'&&params.p_patch.status==='queued'?'running':params.p_patch.status});
  result.applied=true;
  if(params.p_refund_credits){await refund(params.p_refund_credits);result.refundedCredits=params.p_refund_credits;result.balance=10000;result.refundLedgerId='fixture-refund';}
  return{data:result,error:null};
 };
}
