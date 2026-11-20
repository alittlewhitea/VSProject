export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;
export const EMAIL_CODE_LIFETIME_SECONDS = 10 * 60;
export const EMAIL_CODE_LENGTH = 6;

export function normalizeSignInEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
