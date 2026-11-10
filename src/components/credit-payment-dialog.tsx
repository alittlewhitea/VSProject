"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CREDIT_PACKS, formatUsd, type CreditPack, type CreditPaymentProvider } from "../lib/billing";
import { trackEvent, trackPurchaseEvent } from "../lib/analytics";
import { getPayPalWalletConfig, mountPayPalWallets, type WalletController, type WalletStatus, type WalletReceipt, type Wallet, type WalletCallbacks } from "../lib/paypal-wallets-client";
import { DODO_CHECKOUT_SUSPENDED } from "../lib/payment-release";
import { PayPalCardPayment } from "./paypal-card-payment";
type PaymentCallbacks = Omit<Required<WalletCallbacks>, "createOrder"> & { createOrder: (method: Wallet | "card") => Promise<string> };
type Translate=(key:string,values?:Record<string,string|number>)=>string;
const PENDING_KEY="dreamface_wallet_pending_order";
type Pending={orderId:string;packId:string};
export default function CreditPaymentDialog({pack,accessToken,t,loadingPack,message,onCheckout,onClose}:{
  pack:CreditPack;accessToken:string;t:Translate;loadingPack:string|null;message?:string;
  onCheckout:(id:string,provider:CreditPaymentProvider)=>void|Promise<void>;onClose:()=>void;
}) {
  const dialog=useRef<HTMLDivElement>(null),apple=useRef<HTMLDivElement>(null),google=useRef<HTMLDivElement>(null);
  const [walletBusy,setWalletBusy]=useState(false);
  const [walletStates,setWalletStates]=useState<Record<Wallet,WalletStatus>>({applepay:"loading",googlepay:"loading"});
  const [walletAttempt,setWalletAttempt]=useState(0);
  const walletController=useRef<WalletController|null>(null);
  const [card,setCard]=useState(false),[error,setError]=useState(false),[redirectAttempted,setRedirectAttempted]=useState(false);
  const [paid,setPaid]=useState<WalletReceipt|null>(null),[pending,setPending]=useState<Pending|null>(null);
  const operation=useRef(false),pendingRef=useRef<Pending|null>(null),alive=useRef(true);
  const busy=walletBusy||Boolean(loadingPack);
  const stateRef=useRef({busy,onClose});stateRef.current={busy,onClose};
  const displayPack=CREDIT_PACKS.find(item=>item.id===(paid?.packId||pending?.packId))||pack;
  async function post(path:string,body:unknown) {
    const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw Object.assign(new Error("Payment not confirmed"),{status:response.status,code:payload?.code});
    return payload;
  }
  function remember(value:Pending) {
    pendingRef.current=value;if(alive.current)setPending(value);
    try{window.sessionStorage.setItem(PENDING_KEY,JSON.stringify(value));}catch{/* optional recovery storage */}
  }
  function complete(receipt:WalletReceipt) {
    if(!receipt.completed||!receipt.transactionId)throw new Error("Payment not confirmed");
    pendingRef.current=null;
    try{window.sessionStorage.removeItem(PENDING_KEY);}catch{/* optional storage */}
    if(alive.current){setPending(null);setPaid(receipt);setError(false);}
    // Redirect checkout uses the PayPal order ID as its analytics transaction ID.
    const trackingKey=`dreamface_wallet_purchase:${receipt.orderId}`;
    let tracked=false;try{tracked=window.sessionStorage.getItem(trackingKey)==="1";}catch{/* optional storage */}
    if(!tracked){
      try{
        trackEvent("checkout_success",{pack_id:receipt.packId,credits:receipt.credits,amount_cents:receipt.amountCents,payment_provider:"paypal"},accessToken);
        trackPurchaseEvent({transaction_id:receipt.orderId,value:receipt.amountCents/100,currency:receipt.currency,payment_provider:"paypal",items:[{item_id:receipt.packId,item_name:CREDIT_PACKS.find(item=>item.id===receipt.packId)?.name||receipt.packId,item_category:"credit_pack",price:receipt.amountCents/100,quantity:1}]},accessToken);
        window.sessionStorage.setItem(trackingKey,"1");
      }catch{/* Analytics cannot change a successful payment. */}
    }
    window.dispatchEvent(new Event("dreamface:credits-updated"));
  }
  const callbacks=useRef<PaymentCallbacks>({canStart:()=>true,createOrder:async(_wallet:Wallet|"card")=>"",capture:async(_id:string)=>({} as WalletReceipt),onBusy:(_busy:boolean)=>{},onAuthorized:(_id:string)=>{},onSuccess:(_receipt:WalletReceipt)=>{},onError:()=>{}});
  callbacks.current={
    canStart:()=>!operation.current&&!pendingRef.current&&!paid&&!loadingPack,
    createOrder:async(wallet)=>{
      if(pendingRef.current)throw new Error("Confirm the previous payment first");
      const order=await post("/api/billing/paypal/wallet-orders",{packId:pack.id,wallet,expectedAmountCents:pack.amountCents,expectedCredits:pack.credits});
      if(typeof order?.orderId!=="string"||order.amountCents!==pack.amountCents||order.credits!==pack.credits||order.currency!=="USD")throw new Error("Invalid order quote");
      trackEvent("checkout_started",{pack_id:pack.id,payment_provider:"paypal",wallet,credits:pack.credits,amount_cents:pack.amountCents},accessToken);
      return order.orderId;
    },
    capture:async(orderId)=>{
      try { return await post("/api/billing/paypal/capture",{orderId}); }
      catch (failure) {
        // The server explicitly refused to capture this order. An uncertain
        // capture still keeps recovery locked to its existing order below.
        if ((failure as {code?:string}).code === "paypal_authentication_failed") {
          pendingRef.current=null;
          try{window.sessionStorage.removeItem(PENDING_KEY);}catch{/* optional storage */}
          if(alive.current)setPending(null);
        }
        throw failure;
      }
    },
    onBusy:value=>{operation.current=value;if(alive.current){setWalletBusy(value);if(value){setError(false);setRedirectAttempted(false);}}},
    onAuthorized:orderId=>remember({orderId,packId:pack.id}),
    onSuccess:receipt=>complete(receipt),
    onError:()=>{if(alive.current)setError(true);}
  };
  useEffect(()=>{
    alive.current=true;
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";dialog.current?.focus();
    try {
      const saved=JSON.parse(window.sessionStorage.getItem(PENDING_KEY)||"null");
      if(saved&&/^[A-Z0-9-]{6,64}$/i.test(saved.orderId)&&CREDIT_PACKS.some(item=>item.id===saved.packId)){pendingRef.current=saved;setPending(saved);}
    }catch{/* ignore corrupt or unavailable optional storage */}
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.stopImmediatePropagation();if(!stateRef.current.busy)stateRef.current.onClose();}
      if(event.key!=="Tab")return;
      const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),iframe,a[href],apple-pay-button,[tabindex="0"]');
      if(!items?.length){event.preventDefault();return;}
      const visible=Array.from(items).filter(item=>!item.closest('[inert]')&&item.getClientRects().length);
      const first=visible[0],last=visible[visible.length-1];
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",keydown,true);
    return ()=>{alive.current=false;document.body.style.overflow=overflow;document.removeEventListener("keydown",keydown,true);if(previous?.isConnected)previous.focus();};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    walletController.current=null;
    setWalletStates({applepay:"loading",googlepay:"loading"});
    const sdkAbort=new AbortController();
    const signal=AbortSignal.timeout(15000);
    if(!DODO_CHECKOUT_SUSPENDED) void fetch("/api/billing/payment-methods",{signal}).then(response=>response.json()).then(data=>{if(!cancelled)setCard(Array.isArray(data.providers)&&data.providers.includes("dodo"));}).catch(()=>undefined);
    void (async()=>{
      try {
        const config=await getPayPalWalletConfig(walletAttempt>0);
        if(cancelled||!apple.current||!google.current)return;
        const controller=await mountPayPalWallets(config,{amountCents:pack.amountCents,appleContainer:apple.current,googleContainer:google.current,signal:sdkAbort.signal,
          onController:value=>{if(cancelled)value.destroy();else walletController.current=value;},
          onStatus:(wallet,status)=>{if(!cancelled)setWalletStates(current=>({...current,[wallet]:status}));},callbacks:{
          canStart:()=>callbacks.current.canStart(),createOrder:wallet=>callbacks.current.createOrder(wallet),capture:id=>callbacks.current.capture(id),onBusy:value=>callbacks.current.onBusy(value),onAuthorized:id=>callbacks.current.onAuthorized(id),onSuccess:receipt=>callbacks.current.onSuccess(receipt),onError:()=>callbacks.current.onError()
        }});
        if(cancelled)controller.destroy();
      }catch{if(!cancelled)setWalletStates({applepay:"error",googlepay:"error"});}
    })();
    return ()=>{cancelled=true;sdkAbort.abort();walletController.current?.destroy();};
  },[pack.id,accessToken,walletAttempt]);
  function retryWallet(wallet:Wallet) {
    if(operation.current||busy||pendingRef.current||paid)return;
    if(walletController.current)void walletController.current.retry(wallet);
    else setWalletAttempt(value=>value+1);
  }
  async function retry() {
    if(operation.current||!pendingRef.current)return;
    operation.current=true;setWalletBusy(true);setError(false);
    try{complete(await post("/api/billing/paypal/capture",{orderId:pendingRef.current.orderId}));}
    catch(failure){
      if((failure as {status?:number}).status===404){pendingRef.current=null;setPending(null);try{window.sessionStorage.removeItem(PENDING_KEY);}catch{/* optional storage */}}
      setError(true);
    }
    finally{operation.current=false;if(alive.current)setWalletBusy(false);}
  }
  async function redirect(provider:CreditPaymentProvider) {
    if(provider==="dodo"&&DODO_CHECKOUT_SUSPENDED)return;
    if(operation.current||busy||pendingRef.current||paid)return;
    operation.current=true;setRedirectAttempted(true);setError(false);
    try{await onCheckout(pack.id,provider);}catch{setError(true);}finally{operation.current=false;}
  }
  const disabled=busy||Boolean(pending)||Boolean(paid);
  return createPortal(
    <div data-credit-payment-dialog className="fixed inset-0 z-[220] flex items-center justify-center bg-[#100b1d]/65 p-4 backdrop-blur-sm" onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget&&!busy)onClose();}}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="credit-payment-title" tabIndex={-1} className="relative max-h-[90dvh] w-full max-w-[440px] overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 text-start shadow-2xl outline-none sm:p-8">
        <button type="button" aria-label={t("creditShop.close")} disabled={busy} onClick={onClose} className="absolute end-3 top-3 grid h-10 w-10 place-items-center rounded-full text-xl text-[#82758f] hover:bg-[#f5f2fa] disabled:opacity-40">×</button>
        <p className="text-xs font-black uppercase tracking-widest text-[#8069b1]">{t("creditShop.oneTime")}</p>
        <h2 id="credit-payment-title" className="mt-3 pe-6 text-2xl font-black tracking-tight text-[#241a34]">{t("creditShop.paymentTitle")}</h2>
        <div className="my-6 rounded-2xl border border-[#e8e0f7] bg-[#faf7ff] p-4">
          <p className="font-bold text-[#37294b]">{displayPack.name}</p>
          <p className="mt-1 text-sm font-semibold text-[#8061b8]">{(paid?.credits??displayPack.credits).toLocaleString()} {t("creditShop.credits")}</p>
          <div className="mt-4 flex items-center justify-between border-t border-[#e8e0f7] pt-3"><span className="text-sm text-[#82758f]">{t("creditShop.total")}</span><strong className="text-2xl font-black text-[#241a34]">{formatUsd(paid?.amountCents??displayPack.amountCents)} <span className="text-xs font-semibold text-[#82758f]">USD</span></strong></div>
        </div>
        {paid ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{t("creditShop.paid")}</p> : <>
          <p className="mb-3 text-sm font-bold text-[#5e4a78]">{t("creditShop.chooseMethod")}</p>
          <div inert={disabled||undefined} className={disabled?"pointer-events-none opacity-50":""}>
            {(["applepay","googlepay"] as const).map(wallet=><div key={wallet} data-wallet-slot={wallet} data-wallet-status={walletStates[wallet]} hidden={walletStates[wallet]==="unavailable"} className="mb-2 min-h-12 min-w-0">
              <div ref={wallet==="applepay"?apple:google} data-wallet-container={wallet} hidden={walletStates[wallet]!=="ready"} />
              {walletStates[wallet]==="loading"?<div role="status" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e8e0f7] bg-[#f7f5fa] px-4 py-3 text-sm" aria-label={`${wallet==="applepay"?"Apple Pay":"Google Pay"}: ${t("creditShop.walletLoading")}`}>
                <span className="font-semibold text-[#5e4a78]">{wallet==="applepay"?"Apple Pay":"Google Pay"}</span>
                <span className="flex items-center gap-2 text-xs text-[#82758f]"><span className="h-3.5 w-3.5 rounded-full border-2 border-[#d8ceeb] border-t-[#7554e8] motion-safe:animate-spin" aria-hidden="true"/>{t("creditShop.walletPreparing")}</span>
              </div>:null}
              {walletStates[wallet]==="error"?<div role="status" className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[#e8e0f7] bg-[#faf7ff] px-4 py-2 text-sm">
                <div><span className="font-semibold text-[#5e4a78]">{wallet==="applepay"?"Apple Pay":"Google Pay"}</span><p className="text-xs text-[#82758f]">{t("creditShop.walletLoadFailed")}</p></div>
                <button type="button" data-wallet-load-retry={wallet} onClick={()=>retryWallet(wallet)} disabled={disabled} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-[#7554e8] disabled:opacity-40">{t("creditShop.walletLoadRetry")}</button>
              </div>:null}
            </div>)}
          </div>
          <div className="grid gap-2">
            <button type="button" data-payment-provider="paypal" disabled={disabled} onClick={()=>void redirect("paypal")} className="min-h-12 rounded-xl bg-[#ffc439] px-4 text-sm font-black text-[#003087] disabled:opacity-40">PayPal</button>
            <PayPalCardPayment key={pack.id} amountCents={pack.amountCents} disabled={disabled} t={t} callbacks={{
              canStart:()=>callbacks.current.canStart(),createOrder:()=>callbacks.current.createOrder("card"),capture:id=>callbacks.current.capture(id),
              onBusy:value=>callbacks.current.onBusy(value),onAuthorized:id=>callbacks.current.onAuthorized(id),onSuccess:receipt=>callbacks.current.onSuccess(receipt),onError:()=>callbacks.current.onError(),onInvalid:()=>{}
            }} />
            {card&&!DODO_CHECKOUT_SUSPENDED?<button type="button" data-payment-provider="dodo" disabled={disabled} onClick={()=>void redirect("dodo")} className="min-h-12 rounded-xl bg-[#7554e8] px-4 text-sm font-black text-white disabled:opacity-40">Credit Card</button>:null}
          </div>
          {pending?<div role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>{t("creditShop.pending")}</p><button type="button" data-wallet-retry disabled={busy} onClick={()=>void retry()} className="mt-3 min-h-11 w-full rounded-lg bg-amber-900 px-3 font-bold text-white disabled:opacity-50">{t("creditShop.retry")}</button></div>:null}
          {busy?<p role="status" className="mt-3 text-sm text-[#8061b8]">{t("creditShop.paying")}</p>:null}
          {error||redirectAttempted&&message&&!loadingPack?<p role="alert" className="mt-3 text-sm text-red-700">{redirectAttempted&&message?message:t("creditShop.paymentFailed")}</p>:null}
        </>}
        {paid||pending?<a href="/billing" className="mt-4 inline-block text-sm font-bold text-[#7554e8] underline">{t("creditShop.viewBilling")}</a>:null}
        <p className="mt-5 text-xs leading-5 text-[#95869f]">{t("creditShop.secure")}</p>
      </div>
    </div>,document.body
  );
}
