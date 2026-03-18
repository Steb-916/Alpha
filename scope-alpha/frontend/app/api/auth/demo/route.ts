import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/demo — sets a demo cookie and redirects to /terminal
// No database, no auth, no JWT — just lets the user browse the terminal
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/terminal", origin));

  // Set demo cookie — middleware checks this to allow terminal access
  response.cookies.set("scope-alpha-demo", "true", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
  });

  return response;
}
