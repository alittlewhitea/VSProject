import { createHmac } from "node:crypto";
import { EMAIL_CODE_LIFETIME_SECONDS } from "./auth-email-policy";

export const EMAIL_CODE_COOKIE = "dreamface_email_code";
export const EMAIL_VERIFY_PATH = "/api/auth/verify";

export function emailCodeCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: EMAIL_VERIFY_PATH, maxAge: EMAIL_CODE_LIFETIME_SECONDS };
}

// The random challenge lives in the browser cookie. A stored hash alone cannot
// be used to test the limited set of possible six-digit codes offline.
export function hashEmailCode(challenge: string, email: string, code: string) {
  return createHmac("sha256", challenge).update(JSON.stringify(["email-code", email, code])).digest("hex");
}
