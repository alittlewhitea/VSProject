import { NextResponse } from "next/server";
import { getUserFromBearerToken } from "../../../lib/server-auth";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const user = await getUserFromBearerToken(authHeader);

  return NextResponse.json({
    hasAuthorizationHeader: Boolean(authHeader),
    tokenLength: token.length,
    tokenPrefix: token ? token.slice(0, 12) : "",
    sessionResolved: Boolean(user),
    resolvedUserId: user?.id ?? null,
    resolvedEmail: user?.email ?? null
  });
}
