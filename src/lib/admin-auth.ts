import { getUserFromBearerToken, type AuthUser } from "./server-auth";

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminUserFromRequest(request: Request): Promise<AuthUser | null> {
  const user = await getUserFromBearerToken(request.headers.get("authorization"));
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;

  const adminEmails = getAdminEmails();
  if (!adminEmails.length || !adminEmails.includes(email)) {
    return null;
  }

  return user;
}
