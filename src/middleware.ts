import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  if (url.searchParams.get("mode") === "image" && !url.searchParams.has("workflow")) {
    url.searchParams.set("workflow", "text-to-image");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/studio"]
};
