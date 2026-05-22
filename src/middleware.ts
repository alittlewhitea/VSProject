import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const mode = url.searchParams.get("mode");

  if ((mode === "image" || mode === "video") && !url.searchParams.has("workflow")) {
    url.searchParams.set("workflow", mode === "image" ? "text-to-image" : "text-to-video");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/studio"]
};
