import { getPayPalCheckoutSdk, type WalletConfig, type WalletCallbacks } from "./paypal-wallets-client";

export type CardCallbacks = Omit<WalletCallbacks, "createOrder"> & { createOrder: () => Promise<string>; onInvalid: () => void };
export type CardBillingAddress = { addressLine1: string; adminArea1: string; adminArea2: string; countryCode: string; postalCode: string };
export type CardController = { destroy: () => void; eligible: boolean; submit: (billingAddress: CardBillingAddress) => Promise<void> };

function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Card fields timed out")), milliseconds);
    promise.then(value => { window.clearTimeout(timer); resolve(value); }, error => { window.clearTimeout(timer); reject(error); });
  });
}

// PayPal owns every card input iframe. No card number, expiry or CVV is read,
// stored, logged or sent to our endpoints. Extend the existing v5 SDK instance.
export async function mountPayPalCards(config: WalletConfig, input: {
  containers: { name: HTMLElement; number: HTMLElement; expiry: HTMLElement; cvv: HTMLElement };
  placeholders: { name: string; number: string; expiry: string; cvv: string };
  callbacks: CardCallbacks; signal: AbortSignal;
}): Promise<CardController> {
  let destroyed = input.signal.aborted, busy = false, createdOrder: string | null = null;
  let approval: Promise<void> | null = null;
  let orderRequest: Promise<string> | null = null;
  const fields: Array<{ close?: () => void; render: (target: HTMLElement) => Promise<void> }> = [];
  const destroy = () => {
    destroyed = true;
    input.signal.removeEventListener("abort", destroy);
    for (const field of fields) { try { field.close?.(); } catch { /* already closed */ } }
    for (const container of Object.values(input.containers)) container.replaceChildren();
  };
  input.signal.addEventListener("abort", destroy, { once: true });
  const empty: CardController = { destroy, eligible: false, submit: async () => {} };
  if (destroyed || !config.enabled || !config.clientId) return empty;
  try {
    const sdk = await getPayPalCheckoutSdk(config);
    if (destroyed || !sdk.CardFields) return empty;
    const form = sdk.CardFields({
      style: { input: { "font-size": "16px", "font-family": "Arial, sans-serif", "line-height": "24px", padding: "12px", color: "#241a34" }, ".invalid": { color: "#b91c1c" } },
      createOrder: async () => {
        if (destroyed || !busy) throw new Error("Card payment was not started");
        orderRequest ||= input.callbacks.createOrder().then(orderId => { createdOrder = orderId; return orderId; });
        return orderRequest;
      },
      onApprove: (data: { orderID: string; liabilityShift?: string }) => {
        if (!busy || !createdOrder || data.orderID !== createdOrder) throw new Error("Card order mismatch");
        if (data.liabilityShift === "UNKNOWN") throw new Error("Card authentication unavailable");
        if (!approval) approval = (async () => {
          input.callbacks.onAuthorized(data.orderID);
          const receipt = await input.callbacks.capture(data.orderID);
          input.callbacks.onSuccess(receipt);
        })();
        return approval;
      },
      onError: () => { if (!destroyed) input.callbacks.onError(); }
    });
    if (!form.isEligible() || destroyed) return empty;
    const renders: Promise<void>[] = [];
    for (const [key, factory] of [["name", "NameField"], ["number", "NumberField"], ["expiry", "ExpiryField"], ["cvv", "CVVField"]] as const) {
      const field = form[factory]({ placeholder: input.placeholders[key] });
      fields.push(field);
      renders.push(field.render(input.containers[key]));
    }
    await bounded(Promise.all(renders), 15000);
    if (destroyed) { destroy(); return empty; }
    return { eligible: true, destroy, submit: async billingAddress => {
      if (destroyed || busy || input.callbacks.canStart?.() === false) return;
      busy = true;
      input.callbacks.onBusy(true);
      createdOrder = null; approval = null; orderRequest = null;
      try {
        const state = await bounded<{ isFormValid: boolean }>(form.getState(), 5000);
        if (destroyed) return;
        if (!state.isFormValid) { input.callbacks.onInvalid(); return; }
        await form.submit({ billingAddress });
        if (approval) await approval;
      } catch { if (!destroyed) input.callbacks.onError(); }
      finally { busy = false; input.callbacks.onBusy(false); }
    } };
  } catch {
    destroy();
    throw new Error("Card fields unavailable");
  }
}
