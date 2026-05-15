export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  amountCents: number;
  description: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 600,
    amountCents: 500,
    description: "A light top-up for trying image ideas."
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 1500,
    amountCents: 1000,
    description: "Enough balance for regular creative batches."
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 4000,
    amountCents: 2500,
    description: "Best for heavier image and video testing."
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

