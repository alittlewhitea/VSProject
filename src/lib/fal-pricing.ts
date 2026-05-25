import { MODEL_PRICING_ROWS, estimateGenerationCredits } from "./model-pricing";

type FalPricingResponse = {
  unit_price?: number;
  unit?: string | null;
  currency?: string;
};

export type LiveModelPricingRow = {
  provider: string;
  label: string;
  mode: "image" | "video";
  workflow: string;
  endpointId: string;
  falBasis: string;
  unitNote: string;
  fallbackCredits: number;
  typicalCredits: number;
  liveUnitPriceUsd: number | null;
  unit: string | null;
  currency: string;
  source: "live" | "fallback";
  checkedAt: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: FalPricingResponse | null }>();

function endpointForProvider(provider: string, hasReferences = false) {
  if (provider === "chatgpt-image") return hasReferences ? "openai/gpt-image-2/edit" : "openai/gpt-image-2";
  if (provider === "nano-banana-image") return hasReferences ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
  if (provider === "nano-banana-edit") return "fal-ai/nano-banana-2/edit";
  if (provider === "nano-banana-pro") return hasReferences ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro";
  if (provider === "nano-banana-pro-edit") return "fal-ai/nano-banana-pro/edit";
  if (provider === "flux-image") return "fal-ai/flux/schnell";
  if (provider === "flux-dev") return "fal-ai/flux/dev";
  if (provider === "seedance-video") return "bytedance/seedance-2.0/image-to-video";
  if (provider === "kling-video") return "fal-ai/kling-video/v3/pro/image-to-video";
  if (provider === "grok-video") return "xai/grok-imagine-video/text-to-video";
  return null;
}

function normalizeFalPricing(payload: unknown): FalPricingResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const prices = Array.isArray(root.prices) ? root.prices : null;
  const data = prices?.[0] && typeof prices[0] === "object" ? (prices[0] as Record<string, unknown>) : root;
  const unitPrice = Number(data.unit_price ?? data.unitPrice ?? data.price);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  const unit = typeof data.unit === "string" ? data.unit : null;
  const supportedUnits = new Set(["image", "images", "second", "seconds", "megapixel", "megapixels"]);
  if (unit && !supportedUnits.has(unit.toLowerCase())) return null;
  return {
    unit_price: unitPrice,
    unit,
    currency: typeof data.currency === "string" ? data.currency : "USD"
  };
}

export async function getFalModelPricing(endpointId: string) {
  const now = Date.now();
  const cached = cache.get(endpointId);
  if (cached && cached.expiresAt > now) return cached.value;

  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    cache.set(endpointId, { expiresAt: now + CACHE_TTL_MS, value: null });
    return null;
  }

  try {
    const response = await fetch(`https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpointId)}`, {
      headers: {
        Authorization: `Key ${key}`
      },
      next: { revalidate: Math.floor(CACHE_TTL_MS / 1000) }
    });
    if (!response.ok) throw new Error(`fal pricing ${response.status}`);
    const value = normalizeFalPricing(await response.json());
    cache.set(endpointId, { expiresAt: now + CACHE_TTL_MS, value });
    return value;
  } catch {
    cache.set(endpointId, { expiresAt: now + 10 * 60 * 1000, value: null });
    return null;
  }
}

export async function estimateGenerationCreditsWithLivePricing(input: {
  mode: "image" | "video";
  provider: string;
  imageSize?: string | null;
  duration?: string | null;
  hasReferences?: boolean;
  resolution?: string | null;
}) {
  const endpointId = endpointForProvider(input.provider, input.hasReferences);
  const livePricing = endpointId ? await getFalModelPricing(endpointId) : null;
  return estimateGenerationCredits({
    ...input,
    falUnitPriceUsd: livePricing?.unit_price ?? null
  });
}

export async function getLiveModelPricingRows(): Promise<LiveModelPricingRow[]> {
  const checkedAt = new Date().toISOString();
  return Promise.all(
    MODEL_PRICING_ROWS.map(async (row) => {
      const live = await getFalModelPricing(row.endpointId);
      const typicalCredits = estimateGenerationCredits({
        mode: row.mode,
        provider: row.provider,
        duration: row.mode === "video" ? "6s" : undefined,
        imageSize: row.provider === "flux-image" ? "landscape_16_9" : "default_4_3",
        hasReferences: row.workflow.toLowerCase().includes("image to image"),
        falUnitPriceUsd: live?.unit_price ?? null
      });

      return {
        ...row,
        fallbackCredits: row.typicalCredits,
        typicalCredits,
        liveUnitPriceUsd: live?.unit_price ?? null,
        unit: live?.unit || null,
        currency: live?.currency || "USD",
        source: live?.unit_price ? "live" : "fallback",
        checkedAt
      };
    })
  );
}
