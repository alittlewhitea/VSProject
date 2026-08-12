type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalMoney = {
  currency_code: string;
  value: string;
};

export type PayPalOrder = {
  id: string;
  status: string;
  links?: PayPalLink[];
  purchase_units?: Array<{
    custom_id?: string;
    amount?: PayPalMoney;
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: PayPalMoney;
        custom_id?: string;
      }>;
    };
  }>;
};

export type PayPalSubscription = {
  id: string;
  plan_id?: string;
  custom_id?: string;
  status: string;
  subscriber?: { payer_id?: string; email_address?: string };
  start_time?: string;
  status_update_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string; amount?: PayPalMoney };
  };
  links?: PayPalLink[];
};

export type PayPalPlan = {
  id: string;
  status: string;
  billing_cycles?: Array<{
    tenure_type?: string;
    sequence?: number;
    total_cycles?: number;
    frequency?: { interval_unit?: string; interval_count?: number };
    pricing_scheme?: { fixed_price?: PayPalMoney };
  }>;
};

export type PayPalSubscriptionTransaction = {
  id: string;
  status: string;
  time?: string;
  amount_with_breakdown?: { gross_amount?: PayPalMoney };
};

type PayPalAccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;
let accessTokenRequest: Promise<string> | null = null;

function paypalBaseUrl() {
  return process.env.PAYPAL_ENV?.trim().toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function paypalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("PayPal credentials are not configured.");
  return { clientId, clientSecret };
}

export function isPayPalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

export function isPayPalWebhookConfigured() {
  return isPayPalConfigured() && Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim());
}

async function paypalAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;

  if (accessTokenRequest) return accessTokenRequest;

  accessTokenRequest = requestPayPalAccessToken();
  try {
    return await accessTokenRequest;
  } finally {
    accessTokenRequest = null;
  }
}

async function requestPayPalAccessToken() {
  const { clientId, clientSecret } = paypalCredentials();
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as PayPalAccessTokenResponse | { message?: string } | null;
  if (!response.ok || !payload || !("access_token" in payload)) {
    throw new Error((payload && "message" in payload && payload.message) || "Unable to authenticate with PayPal.");
  }

  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in) * 1000
  };
  return cachedAccessToken.value;
}

async function paypalRequest<T>(path: string, init: RequestInit & { requestId?: string } = {}): Promise<T> {
  const token = await paypalAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  if (init.requestId) headers.set("PayPal-Request-Id", init.requestId.slice(0, 108));

  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as (T & { message?: string; details?: Array<{ description?: string }> }) | null;
  if (!response.ok) {
    const detail = payload?.details?.find((item) => item.description)?.description;
    throw new Error(detail || payload?.message || `PayPal request failed with status ${response.status}.`);
  }
  return payload as T;
}

export async function createPayPalOrder(input: {
  referenceId: string;
  description: string;
  amountCents: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  return paypalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: `order-${input.referenceId}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: input.referenceId,
        description: input.description.slice(0, 127),
        amount: {
          currency_code: input.currency.toUpperCase(),
          value: (input.amountCents / 100).toFixed(2)
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl
          }
        }
      }
    })
  });
}

export async function capturePayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
    body: "{}"
  });
}

export async function getPayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export async function createPayPalSubscription(input: {
  planId: string;
  referenceId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  return paypalRequest<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    requestId: `subscription-${input.referenceId}`,
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.referenceId,
      application_context: {
        brand_name: "Dreamface",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl
      }
    })
  });
}

export async function getPayPalSubscription(subscriptionId: string) {
  return paypalRequest<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function listPayPalSubscriptionTransactions(subscriptionId: string, startTime: string, endTime: string) {
  const query = new URLSearchParams({ start_time: startTime, end_time: endTime });
  const result = await paypalRequest<{ transactions?: PayPalSubscriptionTransaction[] }>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions?${query.toString()}`
  );
  return result.transactions || [];
}

export async function getPayPalPlan(planId: string) {
  return paypalRequest<PayPalPlan>(`/v1/billing/plans/${encodeURIComponent(planId)}`);
}

export async function cancelPayPalSubscription(subscriptionId: string, reason: string) {
  await paypalRequest<unknown>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: "POST",
    requestId: `cancel-${subscriptionId}`,
    body: JSON.stringify({ reason: reason.slice(0, 128) || "Cancelled by the subscriber" })
  });
}

export function paypalApprovalUrl(resource: { links?: PayPalLink[] }) {
  return resource.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href || null;
}

export async function verifyPayPalWebhook(headers: Headers, rawEvent: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured.");

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSignature = headers.get("paypal-transmission-sig");
  const certificateUrl = headers.get("paypal-cert-url");
  const authAlgorithm = headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !transmissionSignature || !certificateUrl || !authAlgorithm) {
    return false;
  }

  const result = await paypalRequest<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: `{"transmission_id":${JSON.stringify(transmissionId)},"transmission_time":${JSON.stringify(transmissionTime)},"cert_url":${JSON.stringify(certificateUrl)},"auth_algo":${JSON.stringify(authAlgorithm)},"transmission_sig":${JSON.stringify(transmissionSignature)},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawEvent}}`
  });
  return result.verification_status === "SUCCESS";
}
