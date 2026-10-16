// Browser-only SDK boundary. SDKs are loaded only when the payment dialog opens.
export type Wallet = "applepay" | "googlepay";
export type WalletConfig = { enabled: boolean; clientId: string | null; environment: "PRODUCTION" | "TEST"; merchantCountry: string | null };
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
function deadline<T>(promise:Promise<T>,milliseconds=10000):Promise<T> {
  return new Promise((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error("Wallet operation timed out")),milliseconds);
    promise.then(value=>{window.clearTimeout(timer);resolve(value);},error=>{window.clearTimeout(timer);reject(error);});
  });
}
export async function mountPayPalWallets(config: WalletConfig, input: {
  amountCents: number; appleContainer: HTMLElement; googleContainer: HTMLElement; callbacks: WalletCallbacks; signal?: AbortSignal;
}) {
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
  const sdk=new URL("https://www.paypal.com/sdk/js");
  sdk.search=new URLSearchParams({"client-id":config.clientId || "",components:"applepay,googlepay",currency:"USD",intent:"capture",commit:"true"}).toString();
  if (!config.enabled || !config.clientId || destroyed) return {destroy,apple:false,google:false};
  await loadScript(sdk.toString());
  const paypal=sdkWindow.dreamfacePayPal;
  if(!paypal)throw new Error("PayPal SDK unavailable");
  const amount=(input.amountCents/100).toFixed(2);
  const setupApple=async()=>{
    await loadScript("https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js");
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
  const setupGoogle=async()=>{
    if(!config.merchantCountry || !paypal.Googlepay)return false;
    await loadScript("https://pay.google.com/gp/p/js/pay.js");
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
  const results=await Promise.allSettled([setupApple(),setupGoogle()]);
  return {
    apple:results[0].status==="fulfilled"&&results[0].value,
    google:results[1].status==="fulfilled"&&results[1].value,
    destroy
  };
}
