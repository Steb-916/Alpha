# PRD: UX Polish — Landing Page & Guest Access

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — blocks user acquisition and demo-ability
**Type:** Standalone UX sprint (not part of the numbered phase sequence)

---

## 1. Problem Statement

Phase 0 stripped the marketplace code and rewrote the landing page. Two things were lost:

1. **The animated hero section** — the original landing page had a visually distinctive animated background (floating particles, mesh gradient, or similar motion effect) that gave the site immediate visual impact. The `components/landing/` directory was deleted entirely during Phase 0. The current landing page is a static dark page with text and cards — functional but forgettable.

2. **Demo / guest access** — the old demo login was removed (correctly — it seeded fake analyst data that no longer exists). But now there's no way to see the terminal without creating an account. A visitor hits the landing page, sees a value proposition, but can't experience the product. That's a conversion wall that kills interest.

Both issues hurt the platform's ability to attract and retain early users. This PRD fixes both.

---

## 2. Goals

After this PRD is complete:

1. The landing page has a visually striking animated hero section that communicates "professional trading terminal" at a glance
2. A "Try it live" or "Explore terminal" button lets anyone access the derivatives terminal without signing up
3. Guest users see real live data (same as authenticated users) but with clear upgrade prompts
4. The overall landing page design matches the glass-morphism terminal aesthetic — it should feel like a preview of the product, not a generic SaaS landing page
5. The auth flow remains intact — signing up still works and gives a persistent account

---

## 3. Feature 1: Animated Landing Page Hero

### What It Should Feel Like

The hero section is the first thing a visitor sees. It needs to instantly communicate: "this is a serious, data-driven crypto analytics platform." Think Bloomberg terminal meets modern web design. Not a generic gradient, not a stock photo — something that feels alive and data-driven.

### Recommended Approach: Animated Data Grid / Matrix

A dark background with a subtle animated grid or mesh of moving data points — numbers, chart fragments, or abstract data visualization that floats and pulses. This communicates "live data" without showing actual data. The headline and CTA buttons sit on top.

**Options (in order of recommendation):**

1. **Floating data particles** — small glowing dots or numbers that drift slowly across the hero area. Some form brief connections (like a network graph). Colors match the teal/cyan accent palette. Pure CSS + minimal JS. Performance-friendly.

2. **Animated mesh gradient** — the `MeshBackground.tsx` component that already exists in `components/layout/` may be reusable or adaptable. If it produces the kind of animated gradient mesh effect that was on the original landing, restore it to the hero section.

3. **Canvas-based chart watermark** — a faint, animated line chart (like a heartbeat monitor or price chart) that slowly draws across the background. Gives a "trading" feel without any real data.

4. **CSS-only animated grid** — a grid of faintly glowing cells that pulse in waves, like a heatmap coming alive. Simple to build, no dependencies.

### Implementation

**Restore or rebuild:** Check if `MeshBackground.tsx` or any animation utilities survived Phase 0. If the component exists but wasn't being used on the landing page, integrate it. If the original `components/landing/` components were deleted and can't be recovered from git history, build a new hero animation from scratch.

**New component:** `components/landing/AnimatedHero.tsx`

```tsx
// Structure
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Animated background layer */}
  <AnimatedBackground />
  
  {/* Content layer */}
  <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
    <h1>Institutional-Grade Crypto Analytics</h1>
    <p>Derivatives data, options analytics, on-chain intelligence, 
       and quantitative tools — in one platform.</p>
    
    <div className="flex gap-4 justify-center mt-8">
      <Link href="/terminal/derivatives">
        <Button variant="primary">Explore terminal</Button>
      </Link>
      <Link href="/signup">
        <Button variant="outline">Create account</Button>
      </Link>
    </div>
  </div>
</section>
```

**Performance requirements:**
- Animation must not cause jank or high CPU on mobile devices
- Use `requestAnimationFrame` or CSS animations (no `setInterval`)
- Respect `prefers-reduced-motion` — disable animation if set
- Keep the component under 5KB (no heavy animation libraries)

### Landing Page Structure (Full Page)

```
┌─────────────────────────────────────────────────┐
│  HEADER: Logo | Log in | Sign up                │
├─────────────────────────────────────────────────┤
│                                                 │
│  HERO SECTION (full viewport height)            │
│  [Animated background]                          │
│                                                 │
│  Institutional-Grade Crypto Analytics           │
│                                                 │
│  Derivatives data, options analytics,           │
│  on-chain intelligence, and quantitative        │
│  tools — in one platform.                       │
│                                                 │
│  [ Explore terminal ]  [ Create account ]       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  FEATURE CARDS (2×2 grid)                       │
│                                                 │
│  ┌─────────────────┐ ┌─────────────────┐       │
│  │ LIVE             │ │ LIVE             │       │
│  │ Derivatives      │ │ Volatility &     │       │
│  │ Terminal         │ │ Options          │       │
│  │ Real-time funding│ │ Vol surface, RND │       │
│  │ rates, OI, ...   │ │ skew, cone, VRP  │       │
│  └─────────────────┘ └─────────────────┘       │
│  ┌─────────────────┐ ┌─────────────────┐       │
│  │ COMING SOON      │ │ COMING SOON      │       │
│  │ On-Chain         │ │ Quantitative     │       │
│  │ Intelligence     │ │ Tools            │       │
│  │ Exchange flows,  │ │ Screener, back-  │       │
│  │ MVRV, whale ...  │ │ tester, arb ...  │       │
│  └─────────────────┘ └─────────────────┘       │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  DIFFERENTIATORS SECTION                        │
│                                                 │
│  "What makes Scope Alpha different?"            │
│                                                 │
│  • Cross-domain synthesis — derivatives +       │
│    options + on-chain in one view                │
│  • Proprietary quant tools — RND, vol cone,     │
│    regime classification, CVD divergence         │
│  • Real-time data — not delayed, not stale      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  CTA SECTION                                    │
│                                                 │
│  Ready to see the data?                         │
│  [ Explore terminal ]  [ Create free account ]  │
│                                                 │
├─────────────────────────────────────────────────┤
│  FOOTER: © 2026 Scope Alpha | Terms | Privacy  │
└─────────────────────────────────────────────────┘
```

Update the feature cards to reflect current state — Derivatives and Volatility should show "LIVE" (green badge) now that Phase 3 is complete. On-Chain and Quant Tools still show "COMING SOON" (amber badge).

---

## 4. Feature 2: Guest Terminal Access

### How It Works

A guest can access the terminal and see real data without creating an account. No fake data, no demo user, no seeded content — they see exactly what a signed-in user sees. The difference is:

- Guest sessions are ephemeral (no persistence — no saved watchlists, no alerts, no preferences)
- A subtle persistent banner encourages sign-up: "You're exploring as a guest. Create a free account to save watchlists and set alerts."
- Certain features that require a user record are gated with an inline sign-up prompt (not a hard block)

### What Guests CAN Do

- View all derivatives terminal tabs (Overview, Funding, OI, Liquidations, Basis, Screener, Cross-Exchange)
- View all volatility tabs (Overview, Vol Surface, RND, Skew, Term Structure, Vol Cone, VRP)
- Use drawing tools on charts (persists in localStorage as usual)
- View the arb scanner
- Toggle chart overlays (CVD, heatmap, divergences)
- Navigate freely between all terminal sections

### What Guests CANNOT Do (Soft Gate)

When a guest tries to:
- Create a watchlist → inline prompt: "Sign up to save watchlists"
- Create an alert → inline prompt: "Sign up to create alerts"
- Access settings → redirect to sign-up
- Any future gated feature → same inline prompt pattern

These are **soft gates**, not hard blocks. The terminal itself is fully functional. The gates only appear when the user tries to do something that requires a persistent account.

### Implementation

**Approach: middleware bypass for terminal routes**

Currently, the `(app)/layout.tsx` has a `getServerSession` redirect guard that sends unauthenticated users to `/login`. Modify this:

```typescript
// app/(app)/layout.tsx

export default async function AppLayout({ children }) {
  const session = await getServerSession(authOptions);
  
  // Allow guest access to terminal and tools routes
  // Only redirect to login for settings routes
  // Session is optional — components check for it and show upgrade prompts
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar session={session} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar session={session} />
        <main className="flex-1 overflow-auto">
          {!session && <GuestBanner />}
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Middleware update (`middleware.ts`):**

```typescript
// Routes that require authentication (hard redirect to login):
const AUTH_REQUIRED = [
  '/settings',
  '/api/watchlists',
  '/api/alerts',
  '/api/users/preferences',
  '/api/users/me',
  '/api/users/accept-tos',
];

// Routes that allow guest access:
// /terminal/*, /tools/* → accessible without session
// API routes for market data → already public (no session check)
```

**Guest banner component:** `components/layout/GuestBanner.tsx`

```tsx
// Slim banner at the top of the terminal area (below TopBar)
<div className="bg-accent/10 border-b border-accent/20 px-4 py-2 flex items-center justify-between">
  <span className="text-sm text-muted-foreground">
    Exploring as guest — data is live and real-time
  </span>
  <div className="flex gap-2">
    <Link href="/signup">
      <Button size="sm" variant="primary">Create free account</Button>
    </Link>
    <Link href="/login">
      <Button size="sm" variant="ghost">Log in</Button>
    </Link>
  </div>
</div>
```

**Soft gate component:** `components/ui/SignUpGate.tsx`

```tsx
// Wraps any feature that requires auth
// If session exists → render children normally
// If no session → render a styled prompt

interface SignUpGateProps {
  children: React.ReactNode;
  feature: string; // "save watchlists" | "create alerts" | etc.
}

export function SignUpGate({ children, feature }: SignUpGateProps) {
  const session = useSession();
  
  if (session) return <>{children}</>;
  
  return (
    <div className="glass-card p-6 text-center">
      <Lock className="mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-4">
        Sign up to {feature}
      </p>
      <Link href="/signup">
        <Button size="sm">Create free account</Button>
      </Link>
    </div>
  );
}
```

**Usage in settings pages:**

```tsx
// app/(app)/settings/watchlists/page.tsx
// The middleware redirect handles this — guests never reach settings pages
```

**Usage in terminal for inline features:**

```tsx
// In AlertBell.tsx or alert creation flow
<SignUpGate feature="create alerts">
  <AlertCreationForm />
</SignUpGate>
```

**API route protection:**

Market data routes (`/api/market/*`, `/api/tools/*`, `/api/cron/*`) should NOT require authentication — they serve data to both guests and signed-in users.

User-specific routes (`/api/watchlists`, `/api/alerts`, `/api/users/*`) already check for session and return 401 if absent. No change needed.

### Landing Page CTA Update

Change the primary CTA from "Get started" (which implies sign-up) to "Explore terminal" (which goes directly to `/terminal/derivatives`).

Keep "Create account" / "Sign up" as the secondary CTA.

The "Explore terminal" button should be visually prominent — this is the primary action. Getting people into the product is more important than getting them signed up. They sign up after they see the value.

---

## 5. Feature 3: Minor UX Improvements

### 5.1 Sidebar for Guests

When no session exists:
- Show all terminal and tools sections normally (same as signed-in)
- Settings section at the bottom changes to "Sign up" / "Log in" buttons
- No user avatar or account name — show a generic icon

### 5.2 TopBar for Guests

When no session exists:
- Asset selector and timeframe selector work normally
- Alert bell is hidden (no alerts without an account)
- User menu is replaced with "Log in" / "Sign up" buttons
- Search works normally

### 5.3 Feature Card Badges (Landing Page)

Update the feature cards on the landing page to reflect the current state:
- **Derivatives Terminal** → "LIVE" (green)
- **Volatility & Options** → "LIVE" (green) — Phase 3 just shipped
- **Arb Scanner** → "LIVE" (green) — Phase 2 shipped
- **On-Chain Intelligence** → "COMING SOON" (amber)
- **Quantitative Tools** → "COMING SOON" (amber)
- **Macro & Sentiment** → "COMING SOON" (amber)

### 5.4 Meta Tags & OG Cards

Add proper meta tags to the landing page for social sharing:

```html
<title>Scope Alpha — Institutional-Grade Crypto Analytics</title>
<meta name="description" content="Derivatives data, options analytics, on-chain intelligence, and quantitative tools in one platform." />
<meta property="og:title" content="Scope Alpha — Crypto Analytics Terminal" />
<meta property="og:description" content="Real-time derivatives data, volatility analytics, and quantitative tools for crypto traders." />
<meta property="og:image" content="/og-image.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

Create an OG image (`public/og-image.png`) — a 1200×630 screenshot or designed card showing the terminal interface. This is what appears when someone shares the URL on Twitter/Discord/Telegram.

---

## 6. File Structure

### New Files

```
components/landing/
  AnimatedHero.tsx                     # Animated hero section with background effect
  AnimatedBackground.tsx               # The actual animation (particles/mesh/grid)
  FeatureCards.tsx                      # 2×2 or 3×2 feature card grid
  Differentiators.tsx                  # "What makes us different" section
  CTASection.tsx                       # Bottom CTA block
  Footer.tsx                           # Landing page footer

components/layout/
  GuestBanner.tsx                      # "Exploring as guest" banner
  
components/ui/
  SignUpGate.tsx                        # Soft auth gate wrapper

public/
  og-image.png                         # OG card image for social sharing
```

### Files to Modify

```
app/page.tsx                           # Rewrite with new landing page sections
app/(app)/layout.tsx                   # Remove hard auth redirect for terminal/tools routes
middleware.ts                          # Update route protection (terminal = guest-allowed)
components/layout/Sidebar.tsx          # Handle null session (guest mode)
components/layout/TopBar.tsx           # Handle null session (guest mode)
components/layout/AlertBell.tsx        # Hide when no session
```

---

## 7. Implementation Order

1. **Middleware + layout auth changes** — make terminal accessible without login
2. **GuestBanner + SignUpGate components** — guest UX infrastructure
3. **Sidebar + TopBar guest mode** — handle null session gracefully
4. **AnimatedHero + AnimatedBackground** — hero section with animation
5. **Landing page rewrite** — full page with hero, feature cards, differentiators, CTA, footer
6. **OG meta tags + og-image** — social sharing support
7. **Feature card badge updates** — reflect current build state (LIVE vs COMING SOON)
8. **Testing** — verify guest flow end-to-end, verify auth still works for sign-up/login

---

## 8. Definition of Done

- [ ] Landing page has animated hero section with motion effect
- [ ] "Explore terminal" button on landing page goes directly to `/terminal/derivatives` without requiring login
- [ ] Guest users can navigate all terminal tabs and tools pages
- [ ] Guest users see real live data (not mock, not empty)
- [ ] GuestBanner displays at top of terminal area for unauthenticated users
- [ ] Settings pages redirect to login for unauthenticated users
- [ ] Watchlist/alert creation shows SignUpGate prompt for guests
- [ ] Sidebar renders correctly for guests (no user info, sign-up CTA at bottom)
- [ ] TopBar renders correctly for guests (no alert bell, sign-up buttons)
- [ ] Feature cards show correct LIVE/COMING SOON badges
- [ ] OG meta tags present on landing page
- [ ] OG image exists at `/og-image.png`
- [ ] Sign-up and login flows still work correctly
- [ ] Authenticated users see no GuestBanner (it only shows for guests)
- [ ] Animation respects `prefers-reduced-motion`
- [ ] Landing page loads in < 2s, animation doesn't cause jank on mobile
- [ ] Zero TypeScript errors, build passes

---

*This PRD is a standalone UX sprint and does not block or depend on any numbered phase. It can be executed at any point after Phase 0.*
