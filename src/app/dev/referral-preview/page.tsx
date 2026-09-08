import { notFound } from "next/navigation";
import { StudioReferrals } from "../../../features/studio/studio-referrals";

export default function ReferralPreview() {
  if(process.env.NODE_ENV !== "development") notFound();
  return <main className="min-h-screen bg-[#f8f7ff]">
    <p className="mx-auto max-w-4xl px-6 pt-6 text-sm text-amber-800">本地界面预览 · 模拟符合条件的 100 积分地区用户 · 不连接奖励数据库，不发放真实积分</p>
    <StudioReferrals accessToken="preview-only" locale="zh-CN" previewData={{enabled:true,eligible:true,verified:true,generated:true,url:"http://localhost:3000/r/preview-example",code:"preview-example",settings:{inviterCredits:100,inviteeCredits:100,dailyLimit:3,monthlyLimit:30},usage:{daily:1,monthly:8,earned:700,pending:100},incoming:{status:"pending",invitee_credits:100},history:[{id:"preview-1",status:"pending",bound_at:"2026-09-08 08:00:00",paid_at:null,inviter_credits:100},{id:"preview-2",status:"paid",bound_at:"2026-09-07 08:00:00",paid_at:"2026-09-07 08:20:00",inviter_credits:100}]}} />
  </main>;
}
