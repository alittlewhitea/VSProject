import { NextResponse, type NextRequest } from "next/server";

const DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID || "local";
const NO_STORE_VALUE = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";

function withRuntimeHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", NO_STORE_VALUE);
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("X-DreamFace-Deploy", DEPLOYMENT_ID);
  return response;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const mode = url.searchParams.get("mode");

  if ((mode === "image" || mode === "video") && !url.searchParams.has("workflow")) {
    url.searchParams.set("workflow", mode === "image" ? "text-to-image" : "text-to-video");
    return withRuntimeHeaders(NextResponse.redirect(url));
  }

  return withRuntimeHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/studio",
    "/auth",
    "/billing",
    "/creations",
    "/gallery",
    "/gallery/:path*",
    "/admin",
    "/admin/:path*"
  ]
};
