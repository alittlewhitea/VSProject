import { CREDIT_PACKS, formatUsd } from "../../lib/billing";

const starter = CREDIT_PACKS.find(pack => pack.id === "starter")!;
export const DREAMFACE_CREDIT_SUMMARY = `DreamFace offers one-time credit packs starting at ${formatUsd(starter.amountCents)} for ${starter.credits.toLocaleString("en-US")} credits. These packs do not renew automatically. Generation costs depend on the model and settings; check the current Studio quote. Trial credits depend on signup eligibility.`;

export function DreamfaceCreditPacks() {
  return <div className="comparison-table-frame mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white">
    <table className="w-full min-w-[600px] border-collapse text-left text-sm">
      <thead><tr>{["One-time pack", "Price (USD)", "Credits", "Billing"].map(label=><th key={label} className="bg-[#f3f8fb] p-4">{label}</th>)}</tr></thead>
      <tbody>{CREDIT_PACKS.map(pack=><tr key={pack.id} className="border-t border-black/10"><td className="p-4 font-bold">{pack.name}</td><td className="p-4">{formatUsd(pack.amountCents)}</td><td className="p-4">{pack.credits.toLocaleString("en-US")}</td><td className="p-4">One-time purchase; no automatic renewal</td></tr>)}</tbody>
    </table>
  </div>;
}

export function DreamfacePricingCtaCopy() {
  return <><h2 className="mt-3 max-w-2xl text-3xl font-black">Create with one-time DreamFace credit packs.</h2><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70">{DREAMFACE_CREDIT_SUMMARY}</p></>;
}
