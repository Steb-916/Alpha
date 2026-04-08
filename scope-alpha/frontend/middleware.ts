import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Routes that must be exempt from CSRF origin validation:
//   - /api/auth/*           : NextAuth has its own CSRF + the demo bypass route
//   - /api/stripe/webhook   : Stripe verifies via signature header
//   - /api/telegram/webhook : Telegram verifies via secret token
function isCsrfExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/telegram/webhook")
  );
}

function checkCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return null;
  if (!MUTATION_METHODS.has(request.method)) return null;
  if (isCsrfExempt(pathname)) return null;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Build the allowed origins list. Both http+https variants of the host
  // header cover localhost, preview deploys, and prod.
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

  if (
    !requestOrigin ||
    !allowed.some((a) => requestOrigin!.startsWith(a))
  ) {
    return new NextResponse(
      JSON.stringify({ error: "CSRF validation failed" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── CSRF: gate /api/* mutations on origin/referer ─────────────────────
  // Runs BEFORE auth so an attacker can't even reach the auth check.
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  // ── Auth-driven routing for HTML pages ────────────────────────────────
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

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
  // Phase 7: include /api/:path* so the CSRF check runs on every API
  // mutation. Static assets are excluded by the early return above.
  matcher: [
    "/api/:path*",
    "/terminal/:path*",
    "/login",
    "/signup",
    "/profile",
    "/profile/:path*",
  ],
};
