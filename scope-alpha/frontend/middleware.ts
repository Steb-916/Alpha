import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  if (token && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/terminal", request.url));
  }

  // Protect /terminal/* routes — allow demo mode bypass
  const isDemo = request.cookies.get("scope-alpha-demo")?.value === "true";
  if (pathname.startsWith("/terminal") && !token && !isDemo) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect /profile route
  if (pathname === "/profile" && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/terminal/:path*", "/login", "/signup", "/profile"],
};
