import { fetchFal } from "./fal-fetch";

type BillingEvent = {
  request_id?: string;
  endpoint_id?: string;
  output_units?: number;
  unit_price?: number;
  cost_estimate_nano_usd?: number;
  cost?: number;
};

function numeric(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function eventCostUsd(event: BillingEvent) {
  const nanoUsd = numeric(event.cost_estimate_nano_usd);
  if (nanoUsd) return nanoUsd / 1_000_000_000;

  const directCost = numeric(event.cost);
  if (directCost) return directCost;

  const outputUnits = numeric(event.output_units);
  const unitPrice = numeric(event.unit_price);
  return outputUnits && unitPrice ? outputUnits * unitPrice : null;
}

export async function fetchFalBillingCostUsd(falKey: string, requestId: string | null | undefined) {
  const cleanRequestId = typeof requestId === "string" ? requestId.trim() : "";
  if (!falKey || !cleanRequestId) return null;

  const url = new URL("https://api.fal.ai/v1/models/billing-events");
  url.searchParams.set("request_id", cleanRequestId);
  url.searchParams.set("limit", "50");

  try {
    const response = await fetchFal(url.toString(), {
      attempts: 1,
      timeoutMs: 8000,
      headers: {
        Authorization: `Key ${falKey}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { billing_events?: BillingEvent[] };
    const events = Array.isArray(payload.billing_events) ? payload.billing_events : [];
    const matchingEvents = events.filter((event) => event.request_id === cleanRequestId);
    const costs = matchingEvents.map(eventCostUsd).filter((cost): cost is number => typeof cost === "number" && cost > 0);
    return costs.length ? costs.reduce((sum, cost) => sum + cost, 0) : null;
  } catch {
    return null;
  }
}

export async function resolveFalCostUsd(
  falKey: string,
  requestId: string | null | undefined,
  fallbackCostUsd: number | null | undefined
) {
  const billingCostUsd = await fetchFalBillingCostUsd(falKey, requestId);
  return billingCostUsd ?? fallbackCostUsd ?? null;
}
