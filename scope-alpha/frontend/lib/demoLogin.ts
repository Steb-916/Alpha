/**
 * Demo login — navigates to /api/auth/demo which:
 * 1. Creates the demo user if needed
 * 2. Sets the session cookie server-side
 * 3. Redirects to /terminal
 *
 * One click. No forms. No client-side auth dance.
 */
export function loginAsDemo() {
  window.location.href = "/api/auth/demo";
}
