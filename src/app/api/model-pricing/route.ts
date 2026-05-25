import { NextResponse } from "next/server";
import { getLiveModelPricingRows } from "../../../lib/fal-pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getLiveModelPricingRows();
  return NextResponse.json({
    rows,
    checkedAt: new Date().toISOString()
  });
}
