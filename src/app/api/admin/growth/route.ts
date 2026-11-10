import { NextResponse } from "next/server";
import { getAdminUserFromRequest } from "../../../../lib/admin-auth";
import { readGrowthReport } from "../../../../lib/growth-report";
export async function GET(request: Request) {
  if (!await getAdminUserFromRequest(request)) return NextResponse.json({ error: "Forbidden. Sign in with an admin email." }, { status: 403 });
  try {
    const report = await readGrowthReport(Number(new URL(request.url).searchParams.get("days") || 28));
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Growth data could not be loaded. Try again shortly." }, { status: 503 });
  }
}
