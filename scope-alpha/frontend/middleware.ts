import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Routes that must be exempt from CSRF origin validation:
//   - /api/auth/*  : NextAuth has its own CSRF handling
function isCsrfExempt(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

function checkCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return null;
  if (!MUTATION_METHODS.has(request.method)) return null;
  if (isCsrfExempt(pathname)) return null;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  const allowed: string[] = [];
  if (host) {
    allowed.push(`https://${host}`);
    allowed.push(`http://${host}`);
  }
  if (process.env.NEXTAUTH_URL) allowed.push(process.env.NEXTAUTH_URL);

  let requestOrigin: string | null = null;
  if (origin) {
    requestOrigin = origin;
  } else if (referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (!requestOrigin || !allowed.some((a) => requestOrigin!.startsWith(a))) {
    return new NextResponse(
      JSON.stringify({ error: "CSRF validation failed" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  return null;
}

const PROTECTED_PATH_PREFIXES = ["/terminal", "/tools", "/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  if (token && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/terminal/derivatives", request.url));
  }

  const isProtected = PROTECTED_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/terminal/:path*",
    "/tools/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
