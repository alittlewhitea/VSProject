import {createHash,createPublicKey,verify,type JsonWebKey} from "node:crypto";
let cached:{keys:JsonWebKey[];expires:number}|null=null;
export async function verifyFalWebhook(headers:Headers,body:Buffer) {
  const requestId=headers.get("x-fal-webhook-request-id"),userId=headers.get("x-fal-webhook-user-id"),timestamp=headers.get("x-fal-webhook-timestamp"),signature=headers.get("x-fal-webhook-signature");
  if(!requestId||!userId||!timestamp||!/^\d{10,11}$/.test(timestamp)||!signature||! /^[a-f0-9]{128}$/i.test(signature)||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
  if(process.env.FAL_WEBHOOK_USER_ID&&userId!==process.env.FAL_WEBHOOK_USER_ID)return false;
  if(!cached||cached.expires<Date.now()) {
    const response=await fetch("https://rest.fal.ai/.well-known/jwks.json",{signal:AbortSignal.timeout(5000),cache:"no-store"});
    if(!response.ok)throw new Error("Provider signature keys are unavailable.");
    const payload=await response.json() as {keys:JsonWebKey[]};
    cached={keys:(payload.keys||[]).filter(key=>key.kty==="OKP"&&key.crv==="Ed25519"&&typeof key.x==="string").slice(0,10),expires:Date.now()+3600000};
  }
  const message=Buffer.from([requestId,userId,timestamp,createHash("sha256").update(body).digest("hex")].join("\n"));
  return cached.keys.some(key=>{try{return verify(null,message,createPublicKey({key,format:"jwk"}),Buffer.from(signature,"hex"));}catch{return false;}});
}
