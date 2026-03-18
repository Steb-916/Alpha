# Default Dark Mode + Demo Bypass Login

## Context
Scope Alpha is live on Vercel. Two changes needed: the app should launch in dark mode by default (not light), and there needs to be a "Skip to Demo" button that bypasses authentication so investors and prospects can explore the full terminal without creating an account.

---

## Feature 1: Default to Dark Mode

### Problem
The app currently launches in light mode (or system preference). A crypto trading terminal should default to dark mode — it's the industry standard, it's what the design was built around, and it's what looks best in demos.

### Fix

In the theme initialization logic (likely in `lib/useTheme.ts` or wherever the `data-theme` attribute is set on `<html>`):

**Current behavior:** Reads system preference or defaults to light.

**New behavior:** Default to `"dark"` when there is no saved preference.

```typescript
// Before (likely current):
const defaultTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// After:
const defaultTheme = 'dark'; // Always default to dark
```

The user can still toggle to light mode via the ThemeToggle, and that preference saves to localStorage. But on first visit with no saved preference, it's dark.

**Also check:** the `app/layout.tsx` or root `<html>` tag. If the server render doesn't include `data-theme="dark"`, there will be a flash of light mode before the client hydrates. Fix by setting the default directly on the server:

```tsx
// app/layout.tsx
<html lang="en" data-theme="dark">
```

This ensures the very first paint is dark. The client-side theme logic can then override it if the user previously chose light mode.

### Verification
```
□ Open the deployed URL in an incognito browser (no saved preferences)
□ Page loads in dark mode immediately — no flash of light mode
□ Theme toggle still works (can switch to light and back)
□ Light mode preference persists after toggle (localStorage)
□ Returning to the site after choosing light mode stays in light mode
□ Clearing localStorage and refreshing returns to dark mode
```

---

## Feature 2: Demo Bypass Login

### Problem
An investor or prospect visits the site and wants to explore the terminal, marketplace, analyst profiles, charts, and all features. But the terminal routes are behind auth — they'd have to create an account just to look around. That's friction that kills demos.

### Solution
Add a "Try Demo" or "Explore Demo" button on the login page and landing page that logs the user in as a pre-seeded demo account with full access. No signup form, no password, one click.

### Implementation

#### 2a. Seed a Demo User

Create a seed script or add logic to auto-create the demo user on first access. The demo user should be an **analyst** (highest permission role) so the investor can see everything — publishing tools, signals, annotations, the works.

**Demo user record:**
```
email: demo@scopealpha.com
displayName: "Demo User"
slug: "demo"
role: "analyst"
password: (not needed — bypassed)
bio: "Demo account for exploring Scope Alpha"
avatarUrl: null (use initials fallback)
```

**Demo analyst profile:**
```
tagline: "Demo trading analyst"
primaryAssets: ["BTC", "ETH", "SOL"]
tradingStyle: "swing"
experienceYears: 3
isAcceptingSubscribers: true
```

**How to seed:** Create an API route or a Prisma seed script:

Option A — API route that auto-creates on first demo login (recommended):
```typescript
// Inside the demo login handler:
// 1. Check if demo user exists
// 2. If not, create it with the above fields
// 3. Return the user for session creation
```

Option B — Prisma seed script (`prisma/seed.ts`):
```bash
npx prisma db seed
```

Option A is better because it self-heals — if the database is reset, the demo user gets recreated on next demo login attempt.

#### 2b. Demo Login API Route

Create `app/api/auth/demo/route.ts`:

```typescript
// POST /api/auth/demo
// 1. Find or create the demo user (email: demo@scopealpha.com)
// 2. Create a session/JWT for this user (use NextAuth's signIn programmatically)
// 3. Return success with redirect URL

// The demo user bypasses password validation entirely.
// This is intentional — it's a read-only demo account.
```

**Approach:** Use NextAuth's `CredentialsProvider` with a special flag. Add a check in the authorize function:

```typescript
// In lib/auth.ts, inside CredentialsProvider authorize:
async authorize(credentials) {
  // Demo bypass
  if (credentials?.email === 'demo@scopealpha.com' && credentials?.demo === 'true') {
    let user = await prisma.user.findUnique({ where: { email: 'demo@scopealpha.com' } });
    if (!user) {
      // Auto-create demo user
      user = await prisma.user.create({
        data: {
          email: 'demo@scopealpha.com',
          displayName: 'Demo User',
          slug: 'demo',
          role: 'analyst',
          bio: 'Demo account for exploring Scope Alpha',
        }
      });
      // Also create analyst profile
      await prisma.analystProfile.create({
        data: {
          userId: user.id,
          tagline: 'Demo trading analyst',
          primaryAssets: ['BTC', 'ETH', 'SOL'],
          tradingStyle: 'swing',
          experienceYears: 3,
          isAcceptingSubscribers: true,
        }
      });
    }
    return user;
  }
  
  // Normal email/password flow continues below...
}
```

#### 2c. Demo Login Client Function

Create a helper function that triggers the demo login:

```typescript
// lib/demoLogin.ts
import { signIn } from 'next-auth/react';

export async function loginAsDemo() {
  await signIn('credentials', {
    email: 'demo@scopealpha.com',
    demo: 'true',
    callbackUrl: '/terminal',
  });
}
```

#### 2d. Add "Try Demo" Button to Login Page

In `app/(auth)/login/page.tsx`, add a prominent demo button:

**Placement:** Below the login form, separated by a divider.

```
[Email input]
[Password input]
[Sign In button]

[— or sign in with —]
[Google OAuth button]

────────────────────

[🚀 Explore Demo — No account needed]
```

**Button styling:**
- Full width, same as other buttons
- Ghost/outline variant: transparent background, `var(--accent-green)` border and text
- On hover: `var(--accent-green)` background at 10% opacity
- Text: "Explore Demo" or "Try Demo — No account needed"
- Subtext below button (optional, small muted): "Browse as a demo analyst with full access"
- On click: calls `loginAsDemo()` which triggers NextAuth signIn with demo credentials

#### 2e. Add "Try Demo" to Landing Page

In the landing page hero section, add a secondary CTA:

**Current:**
```
[Get Started Free]  [View Demo]
```

**Updated:**
```
[Get Started Free]  [Try Live Demo →]
```

The "Try Live Demo →" button calls `loginAsDemo()` directly — one click from the landing page straight into the terminal as the demo user. No signup, no login form, no friction.

Also update the landing page nav bar:
- If unauthenticated: show "Try Demo" as a ghost button next to "Get Started"
- If authenticated: show "Go to Terminal" (current behavior)

#### 2f. Add Demo Indicator in Terminal

When logged in as the demo user, show a small, non-intrusive banner at the top of the terminal:

```
You're exploring Scope Alpha as a demo user.  [Create Account →]  [✕]
```

**Styling:**
- Height: 32px, single line
- Background: `rgba(0, 212, 170, 0.08)` (subtle green tint)
- Border bottom: `1px solid rgba(0, 212, 170, 0.15)`
- Text: 13px, `var(--text-secondary)`
- "Create Account →" link: `var(--accent-green)`, navigates to /signup
- Dismiss X: saves to sessionStorage (comes back if they reopen the tab, but doesn't persist forever)
- Position: above the TopBar or integrated as the first element inside the terminal layout

**Detection:** Check if `session.user.email === 'demo@scopealpha.com'` to show the banner.

#### 2g. Seed Demo Data (Optional but Recommended)

To make the demo experience rich, seed some sample data for the demo analyst:

**Sample signals (3-5):**
- BTC Long, entry $65,000, target $72,000, stop $62,000, status: active
- ETH Short, entry $3,600, target $3,200, stop $3,800, status: target_hit, P&L: +11.1%
- SOL Long, entry $140, target $165, stop $128, status: stopped_out, P&L: -8.6%

**Sample annotations (3-5):**
- BTC horizontal line at $68,000 (labeled "Key Resistance")
- ETH zone between $3,400-$3,600 (labeled "Accumulation Zone")
- BTC trend line from Jan to March

**Sample announcements (2):**
- "Weekly Market Update — March 2026" (pinned)
- "New BTC signal posted — watching the 4H structure"

**Sample subscription tiers:**
- Basic: $99/mo — "Signals and annotations"
- Pro: $299/mo — "Everything + chat access"

This makes the demo feel alive instead of empty. Seed this data in the same auto-create flow as the demo user (Step 2a).

### Verification
```
□ Login page shows "Explore Demo" button below the login form
□ Clicking "Explore Demo" logs in immediately (no form input needed)
□ After demo login, user arrives at /terminal
□ Terminal shows full functionality (chart, watchlist, sidebar, all pages)
□ Demo user has analyst role (can see drawing toolbar, signals panel, etc.)
□ Demo banner appears at top of terminal ("You're exploring as a demo user")
□ "Create Account →" link in banner navigates to /signup
□ Dismiss X hides the banner for the session
□ Landing page "Try Live Demo →" button works (one click to terminal)
□ Landing page nav shows "Try Demo" button when not logged in
□ Demo user persists across page refreshes (session is valid)
□ Signing out from demo account returns to landing page
□ Demo data is visible: sample signals, annotations, announcements exist
□ Creating a real account after demo works normally (separate user)
□ Demo login works on the deployed Vercel URL (not just localhost)
□ Dark mode is the default on first visit
□ No flash of light mode on initial page load
```

---

## Files to Create
```
lib/demoLogin.ts                        — Demo login helper function
```

## Files to Modify
```
lib/auth.ts                             — Add demo bypass in CredentialsProvider authorize
app/(auth)/login/page.tsx               — Add "Explore Demo" button
components/landing/LandingPage.tsx       — Update CTA to "Try Live Demo →"
app/terminal/layout.tsx                  — Add demo user banner
app/layout.tsx                           — Set data-theme="dark" on <html>
lib/useTheme.ts (or equivalent)         — Default theme to 'dark'
```

## Do Not Change
```
lib/mockData.ts, lib/store.ts, lib/types.ts
prisma/schema.prisma (no schema changes needed)
app/api/* (except adding demo logic to auth.ts)
Component styling/layout (no visual changes beyond the demo banner)
```
