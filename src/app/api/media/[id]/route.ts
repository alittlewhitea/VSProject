import { NextResponse } from "next/server";
import { signStudioMediaRead, StudioMediaError } from "../../../../lib/r2-studio-media";
import { getUserFromBearerToken } from "../../../../lib/server-auth";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromBearerToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Sign in to view this media." }, { status: 401, headers });
    const { id } = await context.params;
    const location = await signStudioMediaRead(user.id, id, 900);
    return NextResponse.redirect(location, { status: 307, headers });
  } catch (error) {
    const known = error instanceof StudioMediaError;
    return NextResponse.json({ error: known ? error.message : "Media could not be loaded." }, {
      status: known ? error.status : 503, headers
    });
  }
}
