"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "../../../lib/supabase-client";
import type { GrowthReport } from "../../../lib/growth-report";
const channels: Record<string, string> = { organic_search: "Organic search", ai_referral: "AI referral", paid_search: "Paid search", campaign: "Campaign", referral: "Referral", direct: "Direct / unobserved source", unknown: "Unknown attribution" };
function rate(value: number, count: number) { return count ? `${(100 * value / count).toFixed(1)}%` : "—"; }
export default function GrowthPage() {
  const router = useRouter(), [days, setDays] = useState(28), [report, setReport] = useState<GrowthReport | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setReport(null);
    async function load() {
      try {
        const { data } = await createBrowserSupabaseClient().auth.getSession();
        if (!active) return;
        if (!data.session) { router.replace("/auth?next=%2Fadmin%2Fgrowth"); return; }
        const response = await fetch(`/api/admin/growth?days=${days}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Growth data could not be loaded.");
        if (active) setReport(body);
      } catch (reason) { if (active) { setReport(null); setError(reason instanceof Error ? reason.message : "Growth data could not be loaded."); } }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [days, router, revision]);
  const total = report?.totals;
  return <main className="min-h-screen bg-[#f7f7f8] px-4 py-8 text-[#1d1d1f] sm:px-8"><div className="mx-auto max-w-7xl"><Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">← Operations Console</Link><section className="mt-4 rounded-3xl border border-black/10 bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-violet-700">Acquisition and activation</p><h1 className="mt-3 text-3xl font-bold">Landing-page growth</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-[#6e6e73]">Follow newly observed browser visitors from their first public page to registration, a real completed result and a completed purchase. Attribution starts when this tracking is deployed; older unrecorded sources stay unknown.</p></div><div className="flex items-center gap-3"><label className="text-sm">Window <select aria-label="Reporting window" value={days} onChange={event => setDays(Number(event.target.value))} className="ml-2 min-h-11 rounded-xl border border-black/10 px-3">{[7, 28, 90].map(value => <option key={value} value={value}>Last {value} days</option>)}</select></label><button onClick={() => setRevision(value => value + 1)} disabled={loading} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button></div></div>
      {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      {report && total ? <><div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">{[["New browser visitors", total.visitors], ["Workspace clicks", total.workspaceClicks], ["New users", total.signups], ["First real result", total.activated], ["Paying users", total.payers]].map(([label, value]) => <div key={label} className="rounded-2xl bg-[#f6f4fb] p-4"><p className="text-xs text-[#6e6e73]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
        <p className="mt-5 text-sm leading-7 text-[#6e6e73]">Registration attribution coverage: {report.coverage.attributedNewUsers} / {report.coverage.newUsers} new users. {report.coverage.earlierTouchSignups} registered in this window after a first visit before the window; those visitors are outside the funnel cohort below.</p>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="bg-[#f5f5f7]"><tr>{["First landing page", "Channel", "Visitors", "Clicks", "New users", "Real result", "Payers", "Activation", "Paid / signup"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={JSON.stringify([row.landingPath, row.channel])} className="border-t border-black/10"><td className="max-w-[260px] break-words px-4 py-4">{row.landingPath === "unknown" ? "Unknown / before tracking" : row.landingPath}</td><td className="px-4 py-4">{channels[row.channel] || row.channel}</td>{[row.visitors, row.workspaceClicks, row.signups, row.activated, row.payers].map((value, index) => <td key={index} className="px-4 py-4">{value}</td>)}<td className="px-4 py-4">{rate(row.activated, row.signups)}</td><td className="px-4 py-4">{rate(row.payers, row.signups)}</td></tr>)}</tbody></table>{!report.rows.length ? <p className="p-6 text-sm text-[#6e6e73]">No observed first-touch data in this window yet.</p> : null}</div>
        <details className="mt-6 text-sm leading-7 text-[#6e6e73]"><summary className="min-h-11 cursor-pointer font-semibold text-[#1d1d1f]">How these numbers are counted</summary><p>First touch is retained for 30 days in a signed browser cookie. Visitors and workspace clicks are deduplicated by the observed browser attribution ID, not by person. A returning visit or OAuth/payment return does not replace the first source.</p><p className="mt-3">New users come from user creation records, not login_success. Activation requires a real completed task with an output URL; mock tasks, queued tasks and failures do not qualify. Paying users have at least one completed credit purchase; repeat orders do not add another paying user. Activation and paid percentages use the same registration cohort. They are current outcomes, so recent cohorts are still maturing.</p><p className="mt-3">Unknown-source registrations are visible even when visit tracking was unavailable. Browser blocking, another device, expired cookies and missing historical data can reduce coverage. AI referral traffic is a source observation, not proof of an AI answer citing DreamFace. Updated {new Date(report.generatedAt).toLocaleString()}.</p></details>
      </> : null}</section></div></main>;
}
