import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { isDreamfaceIoConfigured } from "../../../lib/dreamface-io";
import { isDreamfaceIoEnabled } from "../../../lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createSupabaseAdminClient();
  const dreamfaceIo = Boolean(admin) && isDreamfaceIoConfigured() && await isDreamfaceIoEnabled(admin);
  return NextResponse.json({
    models: {
      dreamfaceIo
    }
  });
}
