import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { cookies } from "next/headers";
import type { AppSession } from "./server-auth";

export const LOGIN_SUCCESS_COOKIE = "dreamface_login_success";
const RECEIPT_SECONDS = 10 * 60;
export type LoginSuccessEvent = { id: string; method: "google" | "email" };
type LoginReceipt = LoginSuccessEvent & { binding: string; issuedAt: number; expires: number };

function signingSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.AUTH_RATE_LIMIT_SECRET || process.env.ANALYTICS_IP_SECRET || process.env.MYSQL_PASSWORD ||
    (process.env.NODE_ENV !== "production" ? "local-login-event-secret" : null);
}
const sessionBinding = (session: AppSession) => createHash("sha256").update(session.access_token).digest("hex");

/** Only successful authentication callbacks create a fresh, session-bound receipt. */
export function setLoginSuccessReceipt(store: Pick<Awaited<ReturnType<typeof cookies>>, "set">, session: AppSession, method: LoginSuccessEvent["method"]) {
  const secret = signingSecret();
  if (!secret) return;
  const now = Date.now();
  const receipt: LoginReceipt = { id: randomUUID(), method, binding: sessionBinding(session), issuedAt: now, expires: now + RECEIPT_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  store.set(LOGIN_SUCCESS_COOKIE, `${body}.${signature}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: RECEIPT_SECONDS });
}

export function readLoginSuccessReceipt(value: string | undefined, session: AppSession | null): LoginReceipt | null {
  const secret = signingSecret();
  if (!secret || !session || !value || value.length > 2048) return null;
  const [body, signature, extra] = value.split(".");
  if (extra || !body || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  try {
    const receipt = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LoginReceipt;
    if (!/^[a-f0-9-]{36}$/.test(receipt.id) || !["google", "email"].includes(receipt.method) || receipt.binding !== sessionBinding(session) ||
      !Number.isFinite(receipt.issuedAt) || !Number.isFinite(receipt.expires) || receipt.issuedAt > Date.now() || receipt.expires <= Date.now() || receipt.expires <= receipt.issuedAt || receipt.expires - receipt.issuedAt > RECEIPT_SECONDS * 1000) return null;
    return receipt;
  } catch { return null; }
}
