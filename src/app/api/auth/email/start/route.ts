import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { mysqlExecute, toMysqlDate } from "../../../../../lib/mysql";
import { hashAuthToken, newAuthToken } from "../../../../../lib/server-auth";
import { getRequestIp } from "../../../../../lib/credits";
import { consumeRateLimit, safeInternalPath, trustedPublicOrigin } from "../../../../../lib/request-security";

function cleanEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function originFromRequest(request: NextRequest) {
  return trustedPublicOrigin(request.url);
}

async function sendSigninEmail(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is missing.");

  const from = process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "DreamFace <noreply@dreamface.io>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || `Resend failed with ${response.status}.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; next?: string } | null;
    const email = cleanEmail(body?.email);
    if (!email) return NextResponse.json({ error: "Invalid email." }, { status: 400 });

    const ip = getRequestIp(request.headers) || "unknown";
    const [emailLimit, ipLimit] = await Promise.all([
      consumeRateLimit({ scope: "auth_email", subject: email, limit: 3, windowSeconds: 10 * 60 }),
      consumeRateLimit({ scope: "auth_ip", subject: ip, limit: 10, windowSeconds: 10 * 60 })
    ]);
    if (!emailLimit.allowed || !ipLimit.allowed) {
      const retryAfter = Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds);
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const token = newAuthToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await mysqlExecute<ResultSetHeader>("insert into email_otp_codes (email, code_hash, expires_at, created_at) values (?, ?, ?, ?)", [
      email,
      hashAuthToken(token),
      toMysqlDate(expiresAt),
      toMysqlDate(new Date())
    ]);

    const next = safeInternalPath(body?.next);
    const verifyUrl = new URL("/api/auth/verify", originFromRequest(request));
    verifyUrl.searchParams.set("token", token);
    verifyUrl.searchParams.set("next", next);
    await sendSigninEmail(email, verifyUrl.toString());

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send sign-in email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
