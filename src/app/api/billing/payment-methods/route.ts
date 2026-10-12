import { NextResponse } from "next/server";
import { isDodoConfigured } from "../../../../lib/dodo";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ providers: ["paypal", ...(isDodoConfigured() ? ["dodo"] : [])] }, { headers: { "Cache-Control": "no-store" } });
}
