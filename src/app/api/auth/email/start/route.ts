import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { withMysqlAdvisoryTransaction } from "../../../../../lib/mysql";
import { hashAuthToken, newAuthToken } from "../../../../../lib/server-auth";
import { getRequestIp } from "../../../../../lib/credits";
import { consumeRateLimit, safeInternalPath, trustedPublicOrigin } from "../../../../../lib/request-security";
import { captureReferralAuth } from "../../../../../lib/referrals";
import { EMAIL_LINK_LIFETIME_SECONDS, EMAIL_RESEND_COOLDOWN_SECONDS } from "../../../../../lib/auth-email-policy";

function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function reserveSignInLink(email: string, tokenHash: string) {
  // Serialize the recent-history check and link creation across all app instances.
  return withMysqlAdvisoryTransaction(`df:otp:${hashAuthToken(email).slice(0, 56)}`, async connection => {
    const [recent] = await connection.execute<RowDataPacket[]>(
      `select
         ceil(timestampdiff(microsecond, utc_timestamp(6), date_add(created_at, interval ? second)) / 1000000) as cooldown,
         ceil(timestampdiff(microsecond, utc_timestamp(6), date_add(created_at, interval ? second)) / 1000000) as window_retry
       from email_otp_codes
       where email = ? and created_at > date_sub(utc_timestamp(6), interval ? second)
       order by created_at desc limit 3`,
      [EMAIL_RESEND_COOLDOWN_SECONDS, EMAIL_LINK_LIFETIME_SECONDS, email, EMAIL_LINK_LIFETIME_SECONDS]
    );
    const retryAfter = Math.max(0, Number(recent[0]?.cooldown ?? 0), Number(recent[2]?.window_retry ?? 0));
    if (retryAfter > 0) return retryAfter;

    await connection.execute(
      "insert into email_otp_codes (email, code_hash, expires_at, created_at) values (?, ?, date_add(utc_timestamp(6), interval ? second), utc_timestamp(6))",
      [email, tokenHash, EMAIL_LINK_LIFETIME_SECONDS]
    );
    return 0;
  });
}

async function sendSigninEmail(apiKey: string, email: string, link: string, tokenHash: string) {
  const from = process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "DreamFace <noreply@dreamface.io>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": `auth-email/${tokenHash}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Sign in to DreamFace",
      html: [
        "<p>Click the button below to sign in to DreamFace.</p>",
        `<p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;font-weight:700">Sign in</a></p>`,
        `<p>If the button does not work, open this link:<br><a href="${link}">${link}</a></p>`,
        "<p>This link expires in 10 minutes.</p>"
      ].join("")
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    console.warn("Email sign-in provider rejected send", { attempt: tokenHash.slice(0, 12), status: response.status });
    throw new Error("Resend rejected the email.");
  }
  const payload = await response.json().catch(() => null) as { id?: unknown } | null;
  const id = payload?.id;
  console.info("Email sign-in link sent", {
    attempt: tokenHash.slice(0, 12),
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
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; next?: string } | null;
    const email = cleanEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Invalid email." }, { status: 400 });

    const ip = getRequestIp(request.headers) || "unknown";
    const ipLimit = await consumeRateLimit({ scope: "auth_ip", subject: ip, limit: 10, windowSeconds: 10 * 60 });
    if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSeconds, "ip_limit");

    stage = "prepare_link";
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing Resend configuration.");
    const token = newAuthToken();
    const tokenHash = hashAuthToken(token);
    const verifyUrl = new URL("/api/auth/verify", trustedPublicOrigin(request.url));
    verifyUrl.searchParams.set("token", token);
    verifyUrl.searchParams.set("next", safeInternalPath(body?.next));

    stage = "reserve_link";
    const retryAfter = await reserveSignInLink(email, tokenHash);
    if (retryAfter) return rateLimited(retryAfter, "recent_email");

    attempt = tokenHash.slice(0, 12);
    stage = "send_email";
    await captureReferralAuth(tokenHash, request.headers);
    await sendSigninEmail(apiKey, email, verifyUrl.toString(), tokenHash);

    return NextResponse.json({ ok: true, retryAfterSeconds: EMAIL_RESEND_COOLDOWN_SECONDS }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Email sign-in send failed", { stage, attempt });
    // A transport timeout can occur after Resend accepted the email. Keep the link usable.
    return NextResponse.json({ error: "Unable to send sign-in email." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", ...(attempt ? { "Retry-After": String(EMAIL_RESEND_COOLDOWN_SECONDS) } : {}) }
    });
  }
}
