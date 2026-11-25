import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { withMysqlAdvisoryTransaction } from "../../../../../lib/mysql";
import { hashAuthToken, newAuthToken } from "../../../../../lib/server-auth";
import { getRequestIp } from "../../../../../lib/credits";
import { consumeRateLimit, trustedPublicOrigin } from "../../../../../lib/request-security";
import { captureReferralAuth } from "../../../../../lib/referrals";
import { EMAIL_CODE_LENGTH, EMAIL_CODE_LIFETIME_SECONDS, EMAIL_RESEND_COOLDOWN_SECONDS, normalizeSignInEmail } from "../../../../../lib/auth-email-policy";
import { EMAIL_CODE_COOKIE, emailCodeCookieOptions, hashEmailCode } from "../../../../../lib/auth-email-code";
import { readRequestJson, RequestBodyError } from "../../../../../lib/request-body";
import { hasDisposableMxRecord, isDisposableSignupEmail } from "../../../../../lib/signup-abuse-guard";

function reserveSignInCode(email: string, codeHash: string) {
  // Serialize the recent-history check and code creation across all app instances.
  return withMysqlAdvisoryTransaction(`df:otp:${hashAuthToken(email).slice(0, 56)}`, async connection => {
    const [recent] = await connection.execute<RowDataPacket[]>(
      `select
         ceil(timestampdiff(microsecond, utc_timestamp(6), date_add(created_at, interval ? second)) / 1000000) as cooldown,
         ceil(timestampdiff(microsecond, utc_timestamp(6), date_add(created_at, interval ? second)) / 1000000) as window_retry
       from email_otp_codes
       where email = ? and created_at > date_sub(utc_timestamp(6), interval ? second)
       order by created_at desc limit 3`,
      [EMAIL_RESEND_COOLDOWN_SECONDS, EMAIL_CODE_LIFETIME_SECONDS, email, EMAIL_CODE_LIFETIME_SECONDS]
    );
    const retryAfter = Math.max(0, Number(recent[0]?.cooldown ?? 0), Number(recent[2]?.window_retry ?? 0));
    if (retryAfter > 0) return retryAfter;

    await connection.execute(
      "insert into email_otp_codes (email, code_hash, expires_at, created_at) values (?, ?, date_add(utc_timestamp(6), interval ? second), utc_timestamp(6))",
      [email, codeHash, EMAIL_CODE_LIFETIME_SECONDS]
    );
    return 0;
  });
}

async function sendSigninEmail(apiKey: string, email: string, code: string, codeHash: string) {
  const from = process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "DreamFace <noreply@dreamface.io>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": `auth-email/${codeHash}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your DreamFace sign-in code",
      text: `Your DreamFace sign-in code is ${code}. It expires in 10 minutes. Enter it in DreamFace to sign in.`,
      html: [
        "<p>Enter this code in DreamFace to sign in.</p>",
        `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>`,
        "<p>This code expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>"
      ].join("")
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    console.warn("Email sign-in provider rejected send", { attempt: codeHash.slice(0, 12), status: response.status });
    throw new Error("Resend rejected the email.");
  }
  const payload = await response.json().catch(() => null) as { id?: unknown } | null;
  const id = payload?.id;
  console.info("Email sign-in code sent", {
    attempt: codeHash.slice(0, 12),
    ...(typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? { resendId: id } : {})
  });
}

function rateLimited(retryAfter: number, reason: "ip_limit" | "recent_email") {
  return NextResponse.json({ error: "Too many sign-in attempts. Please try again later.", reason }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" }
  });
}

export async function POST(request: NextRequest) {
  let stage = "rate_limit";
  let attempt: string | undefined;
  let pendingChallenge: string | undefined;
  try {
    if (request.headers.get("origin") !== trustedPublicOrigin(request.url)) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const body = await readRequestJson(request, 4096);
    const email = normalizeSignInEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    if (isDisposableSignupEmail(email) || await hasDisposableMxRecord(email)) {
      return NextResponse.json(
        { error: "Temporary or disposable email addresses are not supported. Please use a regular email or sign in with Google.", reason: "disposable_email" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const ip = getRequestIp(request.headers) || "unknown";
    const ipLimit = await consumeRateLimit({ scope: "auth_ip", subject: ip, limit: 10, windowSeconds: 10 * 60 });
    if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSeconds, "ip_limit");

    stage = "prepare_code";
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing Resend configuration.");
    const challenge = newAuthToken();
    const code = String(randomInt(10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, "0");
    const codeHash = hashEmailCode(challenge, email, code);

    stage = "reserve_code";
    const retryAfter = await reserveSignInCode(email, codeHash);
    if (retryAfter) return rateLimited(retryAfter, "recent_email");

    attempt = codeHash.slice(0, 12);
    stage = "send_email";
    await captureReferralAuth(codeHash, request.headers);
    pendingChallenge = challenge;
    await sendSigninEmail(apiKey, email, code, codeHash);

    const response = NextResponse.json({ ok: true, retryAfterSeconds: EMAIL_RESEND_COOLDOWN_SECONDS }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(EMAIL_CODE_COOKIE, challenge, emailCodeCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: "Invalid email request." }, { status: error.status });
    console.error("Email sign-in send failed", { stage, attempt });
    // A transport timeout can occur after Resend accepted the email. Keep the code usable.
    const response = NextResponse.json({ error: "Unable to send sign-in email.", codePending: Boolean(pendingChallenge) }, {
      status: 503,
      headers: { "Cache-Control": "no-store", ...(attempt ? { "Retry-After": String(EMAIL_RESEND_COOLDOWN_SECONDS) } : {}) }
    });
    if (pendingChallenge) response.cookies.set(EMAIL_CODE_COOKIE, pendingChallenge, emailCodeCookieOptions());
    return response;
  }
}
