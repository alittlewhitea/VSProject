export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  amountCents: number;
  description: string;
  idealFor: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 600,
    amountCents: 500,
    description: "A light top-up for validating prompts, image edits, and short video tests.",
    idealFor: "Roughly 20+ premium image jobs or 2 short Seedance video jobs."
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 1500,
    amountCents: 1000,
    description: "Better value for weekly production batches across image and video models.",
    idealFor: "Roughly 50+ premium image jobs or 5 short Seedance video jobs."
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 4000,
    amountCents: 2500,
    description: "Best for teams testing multiple concepts, references, and video cuts.",
    idealFor: "Roughly 130+ premium image jobs or 13 short Seedance video jobs."
  }
];

export function getCreditPack(packId: string) {
  return CREDIT_PACKS.find((pack) => pack.id === packId) || null;
}

export function formatUsd(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}
