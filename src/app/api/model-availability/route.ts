import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { isDreamfaceIoConfigured } from "../../../lib/dreamface-io";
import { isDreamfaceIoEnabled } from "../../../lib/runtime-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({
      models: {
        dreamfaceIo: true
      }
    });
  }

  const admin = createSupabaseAdminClient();
  const dreamfaceIo = Boolean(admin) && isDreamfaceIoConfigured() && await isDreamfaceIoEnabled(admin);
  return NextResponse.json({
    models: {
      dreamfaceIo
    }
  });
}
