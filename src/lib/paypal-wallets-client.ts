// Browser-only SDK boundary. Public resources can warm while credit packs are shown.
export type Wallet = "applepay" | "googlepay";
export type WalletConfig = { enabled: boolean; clientId: string | null; environment: "PRODUCTION" | "TEST"; merchantCountry: string | null };
export type WalletStatus = "loading" | "ready" | "unavailable" | "error";
export type WalletController = { destroy: () => void; apple: boolean; google: boolean; retry: (wallet: Wallet) => Promise<void> };
export type WalletReceipt = { completed: boolean; orderId: string; transactionId: string; packId: string; credits: number; amountCents: number; currency: string };
export type WalletCallbacks = {
  canStart?: () => boolean;
  createOrder: (wallet: Wallet) => Promise<string>;
  capture: (orderId: string) => Promise<WalletReceipt>;
  onBusy: (busy: boolean) => void;
  onAuthorized: (orderId: string) => void;
  onSuccess: (receipt: WalletReceipt) => void;
  onError: () => void;
};
const scripts = new Map<string,Promise<void>>();
const APPLE_SDK = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";
const GOOGLE_SDK = "https://pay.google.com/gp/p/js/pay.js";
let configCache: { value: WalletConfig; expires: number } | null = null;
let configRequest: Promise<WalletConfig> | null = null;

/** Cache only public merchant settings, never a token, order or payment quote. */
export function getPayPalWalletConfig(refresh = false): Promise<WalletConfig> {
  if (configRequest) return configRequest;
  if (!refresh && configCache && configCache.expires > Date.now()) return Promise.resolve(configCache.value);
  configRequest = (async () => {
    const response = await fetch("/api/billing/paypal/wallet-config", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Wallet configuration unavailable");
    const value = await response.json() as WalletConfig;
    if (typeof value.enabled !== "boolean" || !["TEST", "PRODUCTION"].includes(value.environment) || (value.enabled && !value.clientId)) throw new Error("Invalid wallet configuration");
    configCache = { value, expires: Date.now() + 5 * 60 * 1000 };
    return value;
  })().finally(() => { configRequest = null; });
  return configRequest;
}

function walletScripts(config: WalletConfig) {
  const sdk = new URL("https://www.paypal.com/sdk/js");
  sdk.search = new URLSearchParams({ "client-id": config.clientId || "", components: "applepay,googlepay,card-fields", currency: "USD", intent: "capture", commit: "true" }).toString();
  // All three downloads start together; one failed wallet must not block the other.
  const resources = { paypal: loadScript(sdk.toString()), apple: loadScript(APPLE_SDK), google: loadScript(GOOGLE_SDK) };
  for (const promise of Object.values(resources)) void promise.catch(() => undefined);
  return resources;
}

export async function preloadPayPalWallets() {
  const config = await getPayPalWalletConfig();
  if (!config.enabled || !config.clientId) return;
  await Promise.allSettled(Object.values(walletScripts(config)));
}

function loadScript(src: string) {
  if (scripts.has(src)) return scripts.get(src)!;
  const promise = new Promise<void>((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src;script.async=true;script.dataset.dreamfaceWalletSdk="true";
    if (src.startsWith("https://www.paypal.com/sdk/js?")) script.dataset.namespace="dreamfacePayPal";
    const timer=window.setTimeout(()=>{script.remove();reject(new Error("Wallet SDK timeout"));},12000);
    script.onload=()=>{window.clearTimeout(timer);resolve();};
    script.onerror=()=>{window.clearTimeout(timer);script.remove();reject(new Error("Wallet SDK unavailable"));};
    document.head.appendChild(script);
  });
  scripts.set(src,promise);
  void promise.catch(()=>scripts.delete(src));
  return promise;
}
// External SDK objects deliberately stay at this boundary; payment data is never logged or stored.
type ExternalSdk = any;
export async function getPayPalCheckoutSdk(config: WalletConfig): Promise<ExternalSdk> {
  if (!config.enabled || !config.clientId) throw new Error("PayPal unavailable");
  await walletScripts(config).paypal;
  const sdk = (window as unknown as { dreamfacePayPal?: ExternalSdk }).dreamfacePayPal;
  if (!sdk) throw new Error("PayPal SDK unavailable");
  return sdk;
}
function deadline<T>(promise:Promise<T>,milliseconds=10000):Promise<T> {
  return new Promise((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error("Wallet operation timed out")),milliseconds);
    promise.then(value=>{window.clearTimeout(timer);resolve(value);},error=>{window.clearTimeout(timer);reject(error);});
  });
}
export async function mountPayPalWallets(config: WalletConfig, input: {
  amountCents: number; appleContainer: HTMLElement; googleContainer: HTMLElement; callbacks: WalletCallbacks; signal?: AbortSignal;
  onStatus?: (wallet: Wallet, status: WalletStatus) => void;
  onController?: (controller: WalletController) => void;
}): Promise<WalletController> {
  const callbacks=input.callbacks;
  let destroyed=false,busy=false,authorized=false;
  let appleSession: ExternalSdk=null;
  let appleButton:HTMLElement|null=null,googleButton:HTMLElement|null=null;
  const destroy=()=>{
    destroyed=true;
    if(appleSession&&busy&&!authorized){try{appleSession.abort();}catch{/* already closed */}}
    appleButton?.remove();googleButton?.remove();
    input.signal?.removeEventListener("abort",destroy);
  };
  input.signal?.addEventListener("abort",destroy,{once:true});
  if(input.signal?.aborted)destroy();
  const sdkWindow=window as unknown as {dreamfacePayPal?:ExternalSdk;ApplePaySession?:ExternalSdk;google?:ExternalSdk};
  const setBusy=(value:boolean)=>{busy=value;if(!destroyed)callbacks.onBusy(value);};
  const success=(receipt:WalletReceipt)=>{if(!destroyed){try{callbacks.onSuccess(receipt);}catch{/* payment is already captured */}}};
  const error=()=>{if(!destroyed)callbacks.onError();};
  const states: Record<Wallet, WalletStatus> = { applepay: "loading", googlepay: "loading" };
  const report = (wallet: Wallet, status: WalletStatus) => { states[wallet] = status; if (!destroyed) input.onStatus?.(wallet, status); };
  const empty: WalletController = { destroy, apple: false, google: false, retry: async () => {} };
  if (!config.enabled || !config.clientId || destroyed) {
    report("applepay", "unavailable"); report("googlepay", "unavailable"); return empty;
  }
  const resources = walletScripts(config);
  await resources.paypal;
  if (destroyed) return empty;
  const paypal=sdkWindow.dreamfacePayPal;
  if(!paypal)throw new Error("PayPal SDK unavailable");
  const amount=(input.amountCents/100).toFixed(2);
  const setupApple=async(retry=false)=>{
    await (retry ? loadScript(APPLE_SDK) : resources.apple);
    const Apple=sdkWindow.ApplePaySession;
    if(!Apple || !Apple.canMakePayments() || !paypal.Applepay)return false;
    const api=paypal.Applepay();const appleConfig:ExternalSdk=await deadline(api.config());
    if(!appleConfig.isEligible || destroyed)return false;
    const button=document.createElement("apple-pay-button");
    appleButton=button;
    button.setAttribute("buttonstyle","black");button.setAttribute("type","buy");button.setAttribute("locale",document.documentElement.lang || "en-US");
    button.style.setProperty("--apple-pay-button-width","100%");button.style.setProperty("--apple-pay-button-height","48px");button.style.setProperty("--apple-pay-button-border-radius","12px");button.style.display="block";
    button.addEventListener("click",()=>{
      if(destroyed||busy||callbacks.canStart?.()===false)return;
      setBusy(true);authorized=false;
      try {
        // Both construction and begin remain synchronous inside the user gesture.
        const session=new Apple(4,{countryCode:appleConfig.countryCode,merchantCapabilities:appleConfig.merchantCapabilities,supportedNetworks:appleConfig.supportedNetworks,currencyCode:"USD",requiredBillingContactFields:["postalAddress"],total:{label:"DreamFace",type:"final",amount}});
        appleSession=session;let cancelled=false,processing=false;
        session.onvalidatemerchant=async(event:ExternalSdk)=>{
          try {const result:ExternalSdk=await deadline(api.validateMerchant({validationUrl:event.validationURL,displayName:"DreamFace"}));if(!cancelled&&appleSession===session)session.completeMerchantValidation(result.merchantSession);}
          catch {if(appleSession===session){try{session.abort();}catch{/* already closed */}setBusy(false);error();}}
        };
        session.onpaymentauthorized=async(event:ExternalSdk)=>{
          if(processing||cancelled)return;processing=true;
          try {
            const orderId=await callbacks.createOrder("applepay");
            if(cancelled)return;
            const result:ExternalSdk=await deadline(api.confirmOrder({orderId,token:event.payment.token,billingContact:event.payment.billingContact}),25000);
            if(cancelled)return;
            if(!["APPROVED","COMPLETED"].includes(result.status))throw new Error("Wallet not approved");
            authorized=true;callbacks.onAuthorized(orderId);
            const receipt=await callbacks.capture(orderId);
            try{session.completePayment(Apple.STATUS_SUCCESS);}catch{/* The capture remains successful even if the sheet closed. */}success(receipt);
          } catch {try{session.completePayment(Apple.STATUS_FAILURE);}catch{/* already closed */}error();}
          finally {if(appleSession===session)setBusy(false);}
        };
        session.oncancel=()=>{cancelled=true;if(!authorized&&appleSession===session)setBusy(false);};
        session.begin();
      } catch {setBusy(false);error();}
    });
    if(!destroyed)input.appleContainer.replaceChildren(button);
    return true;
  };
  const setupGoogle=async(retry=false)=>{
    if(!config.merchantCountry || !paypal.Googlepay)return false;
    await (retry ? loadScript(GOOGLE_SDK) : resources.google);
    const api=paypal.Googlepay();const googleConfig:ExternalSdk=await deadline(api.config());
    if(googleConfig.isEligible===false || !googleConfig.allowedPaymentMethods?.length)return false;
    let processing:Promise<ExternalSdk>|null=null;
    const client=new sdkWindow.google.payments.api.PaymentsClient({environment:config.environment,paymentDataCallbacks:{onPaymentAuthorized:(data:ExternalSdk)=>{
      if(processing)return processing;
      processing=(async()=>{
        try {
          const orderId=await callbacks.createOrder("googlepay");
          const confirmation:ExternalSdk=await deadline(api.confirmOrder({orderId,paymentMethodData:data.paymentMethodData}),25000);
          if(confirmation.status==="PAYER_ACTION_REQUIRED"){
            const authentication=await api.initiatePayerAction({orderId});
            if(!["POSSIBLE","YES"].includes(authentication?.liabilityShift))throw new Error("Payment authentication failed");
          }
          else if(!["APPROVED","COMPLETED"].includes(confirmation.status))throw new Error("Wallet not approved");
          authorized=true;callbacks.onAuthorized(orderId);
          const receipt=await callbacks.capture(orderId);success(receipt);
          return {transactionState:"SUCCESS"};
        } catch {error();return {transactionState:"ERROR",error:{intent:"PAYMENT_AUTHORIZATION",reason:"PAYMENT_DATA_INVALID",message:"Payment could not be confirmed. Please check your order before paying again."}};}
      })();
      return processing;
    }}});
    const ready:ExternalSdk=await deadline(client.isReadyToPay({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:googleConfig.allowedPaymentMethods}));
    if(!ready.result || destroyed)return false;
    const button=client.createButton({buttonColor:"black",buttonType:"pay",buttonSizeMode:"fill",allowedPaymentMethods:googleConfig.allowedPaymentMethods,onClick:()=>{
      if(destroyed||busy||callbacks.canStart?.()===false)return;
      setBusy(true);authorized=false;processing=null;
      try {
        // No network await before loadPaymentData, so browser popup permissions are preserved.
        const payment=client.loadPaymentData({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:googleConfig.allowedPaymentMethods,merchantInfo:googleConfig.merchantInfo,transactionInfo:{currencyCode:"USD",countryCode:config.merchantCountry,totalPriceStatus:"FINAL",totalPrice:amount},callbackIntents:["PAYMENT_AUTHORIZATION"]});
        void payment.catch((failure:ExternalSdk)=>{if(failure?.statusCode!=="CANCELED")error();}).finally(async()=>{if(processing)await processing;setBusy(false);});
      } catch {setBusy(false);error();}
    }});
    googleButton=button;
    if(!destroyed)input.googleContainer.replaceChildren(button);
    return true;
  };
  const controller: WalletController = {
    apple: false, google: false, destroy,
    retry: async wallet => { if (!destroyed && !busy && states[wallet] === "error") await run(wallet, true); }
  };
  async function run(wallet: Wallet, retry=false) {
    report(wallet, "loading");
    try {
      const available = await (wallet === "applepay" ? setupApple(retry) : setupGoogle(retry));
      if (wallet === "applepay") controller.apple = available; else controller.google = available;
      report(wallet, available ? "ready" : "unavailable");
    } catch { report(wallet, "error"); }
  }
  input.onController?.(controller);
  await Promise.all([run("applepay"), run("googlepay")]);
  return controller;
}
