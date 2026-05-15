import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const user = await getUserFromBearerToken(authHeader);
  const tokenPayload = decodeJwtPayload(token);
  const tokenIssuer = typeof tokenPayload?.iss === "string" ? tokenPayload.iss : null;
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;

  return NextResponse.json({
    hasAuthorizationHeader: Boolean(authHeader),
    tokenLength: token.length,
    tokenPrefix: token ? token.slice(0, 12) : "",
    tokenIssuer,
    envSupabaseUrl,
    issuerMatchesEnv: Boolean(tokenIssuer && envSupabaseUrl && tokenIssuer.startsWith(envSupabaseUrl)),
    resolvedUserId: user?.id ?? null,
    resolvedEmail: user?.email ?? null
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    if (!token.includes(".")) return null;
    const payloadPart = token.split(".")[1];
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}
