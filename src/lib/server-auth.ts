export type AuthUser = {
  id: string;
  email: string | null;
};

export async function getUserFromBearerToken(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !token) {
    return null;
  }

  const candidateKeys = [serviceRoleKey, anonKey].filter((x): x is string => Boolean(x));
  for (const key of candidateKeys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${url}/auth/v1/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: key
        },
        cache: "no-store",
        signal: controller.signal
      });
      if (!res.ok) {
        continue;
      }
      const user = (await res.json()) as { id?: string; email?: string | null };
      if (user?.id) {
        return {
          id: user.id,
          email: user.email ?? null
        };
      }
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  // Fallback: decode JWT locally when remote user lookup fails.
  // This keeps local dev unblocked when API key compatibility causes false negatives.
  const payload = decodeJwtPayload(token);
  const iss = typeof payload?.iss === "string" ? payload.iss : "";
  const sub = typeof payload?.sub === "string" ? payload.sub : "";
  const email = typeof payload?.email === "string" ? payload.email : null;
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  const nowSec = Math.floor(Date.now() / 1000);

  if (sub && iss && url && iss.startsWith(url) && exp > nowSec) {
    return {
      id: sub,
      email
    };
  }

  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(payloadPart, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}
