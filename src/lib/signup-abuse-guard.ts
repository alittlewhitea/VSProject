import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import disposableDomains from "disposable-email-domains/index.json";

export const SIGNUP_DEVICE_COOKIE = "df_signup_device";

function signupDeviceSecret() {
  const secret = process.env.SIGNUP_IP_SECRET || process.env.AUTH_SESSION_SECRET || process.env.MYSQL_PASSWORD;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Signup signing is not configured.");
  return secret || "local-signup-ip-secret";
}

export function readSignedSignupDeviceId(cookieValue?: string | null): string | null {
  if (!cookieValue || cookieValue.length > 160) return null;
  const [id, sig, extra] = cookieValue.split(".");
  if (extra || !id || !/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{64}$/.test(sig || "")) return null;
  const expected = createHmac("sha256", signupDeviceSecret()).update(`signup-device:${id}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex")) ? id : null;
}

export function createSignedSignupDeviceCookie() {
  const id = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", signupDeviceSecret()).update(`signup-device:${id}`).digest("hex");
  return { id, value: `${id}.${sig}` };
}

/**
 * Extra disposable / rotating temporary mailbox domains frequently seen in
 * free-credit abuse waves (e.g. Toboxes, Mail.tm, Temp-Mail, 2925, Smailpro)
 * that may lag behind the upstream `disposable-email-domains` package.
 */
const EXTRA_DISPOSABLE_DOMAINS = [
  "toboxes.com",
  "toboxes.net",
  "toboxes.org",
  "toboxes.io",
  "toboxes.me",
  "toboxes.xyz",
  "mailpotus.com",
  "vedm.pro",
  "dsmspaces.com",
  "drtall.com",
  "orsonki.com",
  "xeno2.asia",
  "yxlbyb9g1w.asia",
  "aaronnavit.work",
  "tempmailo.com",
  "tempmail.plus",
  "tempmail.dev",
  "tempmail.email",
  "linshiyouxiang.net",
  "2925.com",
  "snapmail.cc",
  "moakt.cc",
  "mail.tm",
  "mail.gw",
  "smailpro.com",
  "inboxes.com",
  "emailnator.com",
  "internxt.com",
  "minuteinbox.com",
  "inboxkitten.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "yopmail.com",
  "mailinator.com",
  "maildrop.cc",
  "trashmail.com",
  "10minutemail.com"
];

/** Exact DNS label tokens strongly associated with temporary mailbox services. */
const DISPOSABLE_LABEL_KEYWORDS = [
  "toboxes",
  "tempmail",
  "temp-mail",
  "10minutemail",
  "guerrillamail",
  "mailinator",
  "yopmail",
  "trashmail",
  "throwawaymail",
  "fakeinbox",
  "dispostable",
  "minuteinbox",
  "inboxkitten",
  "emailnator",
  "smailpro",
  "linshiyouxiang"
];

/** Known MX host substrings operated by temporary / burner email providers. */
const DISPOSABLE_MX_PATTERNS = [
  "toboxes",
  "temp-mail",
  "tempmail",
  "guerrillamail",
  "sharklasers",
  "mailinator",
  "yopmail",
  "mail.tm",
  "mail.gw",
  "maildrop.cc",
  "trashmail",
  "10minutemail",
  "minuteinbox",
  "inboxkitten",
  "inboxes.com",
  "smailpro",
  "emailnator",
  "moakt",
  "2925.com",
  "tempmailo"
];

/**
 * Mainstream consumer email providers eligible for the full Email-OTP free
 * signup bonus. Unknown custom/company domains can still register, sign in,
 * and buy credits, or use Google OAuth, without exposing 100-credit signup
 * bonuses to rotating burner domains.
 */
const TRUSTED_CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.jp",
  "outlook.de",
  "outlook.fr",
  "outlook.co.uk",
  "outlook.es",
  "outlook.it",
  "outlook.com.br",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "hotmail.de",
  "hotmail.es",
  "hotmail.it",
  "live.com",
  "live.cn",
  "live.co.uk",
  "live.fr",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.co.jp",
  "yahoo.co.uk",
  "yahoo.fr",
  "yahoo.de",
  "yahoo.es",
  "yahoo.it",
  "yahoo.com.tw",
  "yahoo.com.hk",
  "yahoo.com.br",
  "ymail.com",
  "rocketmail.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "qq.com",
  "foxmail.com",
  "163.com",
  "126.com",
  "yeah.net",
  "sina.com",
  "sina.cn",
  "sohu.com",
  "aliyun.com",
  "yandex.ru",
  "yandex.com",
  "yandex.by",
  "yandex.kz",
  "yandex.ua",
  "ya.ru",
  "mail.ru",
  "bk.ru",
  "inbox.ru",
  "list.ru",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "web.de",
  "t-online.de",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "aol.com",
  "zoho.com",
  "fastmail.com",
  "seznam.cz",
  "email.cz",
  "orange.fr",
  "free.fr",
  "laposte.net",
  "wp.pl",
  "onet.pl",
  "o2.pl",
  "interia.pl",
  "libero.it",
  "virgilio.it",
  "abv.bg",
  "inbox.lv",
  "freemail.hu",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "cox.net",
  "shaw.ca",
  "rogers.com",
  "telus.net",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "optusnet.com.au",
  "bigpond.com"
]);

const PLUS_ALIAS_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "yahoo.com",
  "fastmail.com",
  "yandex.ru",
  "yandex.com"
]);

const GMAIL_DOT_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

const BASE_DISPOSABLE_SET = new Set<string>([
  ...(Array.isArray(disposableDomains) ? disposableDomains : []),
  ...EXTRA_DISPOSABLE_DOMAINS
]);

const MX_CACHE_TTL_MS = 10 * 60 * 1000;
const mxCache = new Map<string, { disposable: boolean; expiresAt: number }>();

function parseCsvEnv(...values: Array<string | undefined>): string[] {
  return values
    .flatMap((value) => (value || "").toLowerCase().split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at >= trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  return domain && domain.includes(".") ? domain : null;
}

export function isDisposableSignupEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return true;
  const allowed = parseCsvEnv(process.env.SIGNUP_EMAIL_ALLOWLIST, process.env.REFERRAL_EMAIL_ALLOWLIST);
  if (allowed.includes(domain)) return false;

  const extraDenied = parseCsvEnv(process.env.SIGNUP_EMAIL_DENYLIST, process.env.REFERRAL_EMAIL_DENYLIST);
  const extraDeniedSet = extraDenied.length ? new Set(extraDenied) : null;
  const labels = domain.split(".");
  if (labels.some((label) => DISPOSABLE_LABEL_KEYWORDS.includes(label))) {
    return true;
  }
  return labels.some((_, index) => {
    const candidate = labels.slice(index).join(".");
    return BASE_DISPOSABLE_SET.has(candidate) || Boolean(extraDeniedSet?.has(candidate));
  });
}

export function isTrustedFreeBonusEmailDomain(email: string | null | undefined): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  // RFC 2606 non-routable test TLD used by isolated integration fixtures.
  if (domain.endsWith(".invalid")) return true;
  if (isDisposableSignupEmail(email!)) return false;

  const allowed = parseCsvEnv(process.env.SIGNUP_EMAIL_ALLOWLIST, process.env.REFERRAL_EMAIL_ALLOWLIST);
  if (allowed.includes(domain)) return true;
  if (TRUSTED_CONSUMER_EMAIL_DOMAINS.has(domain)) return true;
  if (/\.(edu|ac)(\.[a-z]{2})?$/.test(domain)) return true;
  return false;
}

/**
 * Normalizes email aliases (`user+tag@gmail.com`, `u.s.e.r@gmail.com`) into a
 * canonical address so the same inbox cannot farm multiple signup bonuses.
 */
export function canonicalizeSignupEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at >= trimmed.length - 1) return null;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  if (!local || !domain || !domain.includes(".")) return null;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (PLUS_ALIAS_DOMAINS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus > 0) local = local.slice(0, plus);
  }
  if (GMAIL_DOT_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
  }
  return local ? `${local}@${domain}` : null;
}

/**
 * Checks DNS MX records for unknown custom domains to catch newly rotated
 * burner domains pointing at known temporary mailbox MX infrastructure.
 * Fails open on transient DNS timeouts so real users are never blocked.
 */
export async function hasDisposableMxRecord(email: string, timeoutMs = 1500): Promise<boolean> {
  const domain = extractEmailDomain(email);
  if (!domain) return true;
  if (domain.endsWith(".invalid") || TRUSTED_CONSUMER_EMAIL_DOMAINS.has(domain)) return false;
  const allowed = parseCsvEnv(process.env.SIGNUP_EMAIL_ALLOWLIST, process.env.REFERRAL_EMAIL_ALLOWLIST);
  if (allowed.includes(domain)) return false;

  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > now) return cached.disposable;

  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        timer.unref?.();
      })
    ]);
    if (records === null) return false;
    const disposable =
      records.length === 0 ||
      records.some((record) => {
        const exchange = (record.exchange || "").toLowerCase();
        return DISPOSABLE_MX_PATTERNS.some((pattern) => exchange.includes(pattern));
      });
    if (mxCache.size >= 512) mxCache.delete(mxCache.keys().next().value!);
    mxCache.set(domain, { disposable, expiresAt: now + MX_CACHE_TTL_MS });
    return disposable;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOTFOUND" || code === "ENODATA") {
      if (mxCache.size >= 512) mxCache.delete(mxCache.keys().next().value!);
      mxCache.set(domain, { disposable: true, expiresAt: now + MX_CACHE_TTL_MS });
      return true;
    }
    return false;
  }
}

export type SignupBonusEvaluation = {
  credits: number;
  reason:
    | "eligible"
    | "limited_region"
    | "missing_country"
    | "disposable_email"
    | "untrusted_email_domain";
};

export function evaluateSignupBonusPolicy(input: {
  countryCode: string | null;
  countryBonusCredits: number;
  email?: string | null;
  provider?: "email" | "google" | null;
}): SignupBonusEvaluation {
  if (!input.countryCode) {
    return { credits: 0, reason: "missing_country" };
  }
  if (input.email && isDisposableSignupEmail(input.email)) {
    return { credits: 0, reason: "disposable_email" };
  }
  // Only Email-OTP signups from non-mainstream custom domains are gated;
  // verified Google OAuth users and mainstream/academic email users stay eligible.
  if (input.provider === "email" && input.email && !isTrustedFreeBonusEmailDomain(input.email)) {
    const configured = Number.parseInt(process.env.SIGNUP_UNTRUSTED_DOMAIN_BONUS ?? "0", 10);
    const untrustedBonus = Number.isFinite(configured) && configured >= 0
      ? Math.min(configured, input.countryBonusCredits)
      : 0;
    return { credits: untrustedBonus, reason: "untrusted_email_domain" };
  }
  return {
    credits: input.countryBonusCredits,
    reason: input.countryBonusCredits < 100 ? "limited_region" : "eligible"
  };
}
