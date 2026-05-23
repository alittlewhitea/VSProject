import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const deploymentId =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID ||
  process.env.NEXT_DEPLOYMENT_ID ||
  process.env.DEPLOYMENT_VERSION ||
  process.env.GIT_SHA ||
  "local";

export async function GET() {
  return NextResponse.json(
    {
      deploymentId,
      checkedAt: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "X-DreamFace-Deploy": deploymentId
      }
    }
  );
}
