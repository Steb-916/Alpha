# Scope Alpha — Implementation Roadmap

**Date:** April 7, 2026
**Purpose:** Granular phase/sub-phase breakdown scoped so each sub-phase can be turned into a standalone PRD for Claude Code implementation.

---

## Phase 1 — Data Layer (Mock → Live)

The foundation. Nothing else matters until the platform shows real data.

### 1A — Live OHLCV Charting
- WebSocket connection to Binance/Bybit kline streams
- Real-time candlestick updates to Lightweight Charts via `update()`
- Historical candle backfill on chart load (REST endpoint)
- Multi-timeframe support (1m, 5m, 15m, 1H, 4H, 1D, 1W)
- Multi-asset switching without stale data bleed
- Reconnection/retry logic with exponential backoff
- Connection status indicator in the UI

### 1B — Live Derivatives Metrics
- Funding rate feed: current, 8hr average, annualized carry, z-score
- Open interest feed: aggregate OI, net changes, per-exchange breakdown
- Liquidation feed: long/short volumes, exchange-level heatmap data
- Perpetual basis calculation: basis %, annualized rate, per-exchange
- Health Score rewrite to compute from live inputs instead of mock values

### 1C — Server-Side Data Aggregation & Caching
- Next.js API route (or edge function) that proxies exchange data
- Redis or in-memory cache layer to avoid redundant exchange calls
- Rate limit management per exchange API
- Fallback logic: if Exchange A drops, try Exchange B
- Scheduled jobs for metrics that don't need sub-second freshness (e.g., 8hr funding avg)

### 1D — Multi-Asset Screener (Live)
- Screener table pulls from cached live data instead of mock arrays
- Sparkline generation from rolling window of real candle closes
- Regime classification logic recalculated from live metrics
- Sortable columns wired to real values

---

## Phase 2 — Payments & Subscriptions

The platform can't monetize until Stripe is real.

### 2A — Stripe Integration (Core)
- Stripe Connect onboarding flow for analysts (identity verification, payout account)
- Subscription checkout: subscriber selects tier → Stripe Checkout session → webhook confirms
- Recurring billing tied to subscription tier pricing ($50–$2,000/mo)
- Platform commission split (15–25%) handled via Stripe Connect application fees
- Webhook handlers: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

### 2B — Subscription Lifecycle Management
- Upgrade/downgrade between tiers (proration handling)
- Cancellation flow with end-of-period access
- Grace period logic for failed payments (retry → warn → suspend → cancel)
- Subscriber dashboard: active subscriptions, billing history, upcoming charges
- Analyst dashboard: subscriber count, revenue, payout history

### 2C — Access Gating
- Middleware that checks active subscription status before serving analyst content
- Signal visibility: free preview (asset + direction only) vs. full signal (entry/target/stop)
- Annotation access gated to active subscribers
- Chat room access gated to active subscribers
- Graceful degradation: expired subscribers see a paywall, not a broken page

---

## Phase 3 — Notifications & Signal Delivery

Signals are worthless if subscribers don't see them in time.

### 3A — Email System
- Transactional email provider integration (Resend, Postmark, or SendGrid)
- Email verification on signup (block unverified accounts from subscribing)
- Email templates: welcome, subscription confirmation, payment receipt, payment failed
- Unsubscribe/preference management

### 3B — Real-Time Signal Alerts
- In-app notification system: bell icon with unread count, notification dropdown
- Email alert when a subscribed analyst publishes a new signal
- Notification preferences per subscriber (in-app, email, or both)
- Batching logic to avoid spamming during high-activity periods

### 3C — Telegram Bot Integration
- Telegram bot that subscribers link to their account
- Signal push to Telegram with formatted message (asset, direction, entry, targets, stop)
- Per-analyst channel or per-subscriber DM delivery
- Commands: /subscribe, /unsubscribe, /status, /recent

---

## Phase 4 — Analyst Experience Polish

Make the analyst side of the platform feel professional and complete.

### 4A — Signal Creation UX Overhaul
- Multi-target support (TP1, TP2, TP3 with partial close percentages)
- Chart-based signal creation: click on chart to set entry/target/stop visually
- Signal templates: save and reuse common setups
- Draft signals: save without publishing, publish when ready
- Attach a chart screenshot or annotation snapshot to the signal

### 4B — Performance Dashboard Enhancements
- Detailed trade journal view: filterable list of all resolved signals with notes
- Drawdown tracking and max drawdown metric
- Win rate by asset, by timeframe, by direction
- Rolling performance windows (7d, 30d, 90d, all-time) with comparison
- Exportable performance report (PDF or CSV)

### 4C — Annotation System V2
- Drawing tools: trend lines (angled), Fibonacci retracements, channels
- Drawing persistence in database (currently Zustand/localStorage)
- Shared annotations: subscribers see analyst drawings on their chart in real time
- Annotation versioning: history of what was drawn and when

---

## Phase 5 — Subscriber Experience Polish

Make the subscriber side sticky enough to retain paying users.

### 5A — Discovery & Marketplace Improvements
- Advanced filters: min/max win rate, P&L range, active signal count, asset specialization
- Analyst comparison view: side-by-side metrics for 2–3 analysts
- "Trending analysts" section based on recent subscriber growth
- Search with autocomplete across analyst names, assets, and tags

### 5B — Portfolio & P&L Tracking
- Subscriber portfolio dashboard: signals they're following, current status, unrealized P&L
- Mark signals as "taken" to track personal execution
- Personal P&L tracking against analyst signals (did you enter at their price or your own?)
- Aggregate P&L across all subscribed analysts

### 5C — Review & Rating System Enhancements
- Review sorting: most recent, highest rated, most helpful
- "Was this review helpful?" voting
- Review filtering by subscription tier
- Analyst response to reviews (already exists — polish the UX)
- Verified subscriber badge on reviews (proves they were subscribed when reviewing)

---

## Phase 6 — Community & Engagement

Turn the platform from a tool into a destination.

### 6A — Chat System V2
- Persistent chat rooms per analyst (already exists — upgrade UX)
- Typing indicators, read receipts, online status
- Media sharing: images, chart screenshots
- Moderation tools: mute, ban, delete messages
- Pinned messages and announcement integration in chat

### 6B — Social Feed
- Activity feed: new signals, resolved signals, new annotations, analyst milestones
- Follow analysts without subscribing (see public activity, gated content blurred)
- Like/bookmark signals for personal reference
- Share signal to external platforms (Twitter/X card preview with signal details)

---

## Phase 7 — Platform Hardening

Production readiness and operational maturity.

### 7A — Security & Auth Hardening
- Rate limiting on all API endpoints (per-user and global)
- CSRF protection on mutation endpoints
- Input sanitization audit across all forms and API inputs
- Session management: forced logout, active sessions view, revoke sessions
- Password reset flow

### 7B — Performance & Scalability
- Database query optimization: add indexes based on actual query patterns
- API response caching for expensive queries (analyst leaderboard, screener)
- Image/avatar upload to S3 or Cloudflare R2 (currently likely local or placeholder)
- Lazy loading and code splitting audit on frontend
- Lighthouse performance audit and fixes

### 7C — Monitoring & Error Handling
- Error tracking integration (Sentry or equivalent)
- Structured logging on API routes
- Uptime monitoring and alerting
- WebSocket connection health dashboard (internal)
- Database connection pool monitoring

### 7D — Legal & Compliance Scaffolding
- Terms of Service and Privacy Policy pages (lawyer-reviewed content)
- Signal disclaimer injected into every signal view ("not financial advice")
- Analyst agreement / terms of publishing (accepted on become-analyst flow)
- DMCA / content takedown process
- Data export / account deletion (GDPR-style compliance)

---

## Phase 8 — Mobile & API Access

Broader reach beyond the web app.

### 8A — Progressive Web App (PWA)
- Service worker for offline shell and push notifications
- App manifest for install-to-homescreen
- Mobile-optimized layouts for all critical flows (terminal, signals, subscriptions)
- Touch-friendly chart interactions

### 8B — Public API
- API key management for subscribers (generate, revoke, rate limits)
- REST endpoints for signal consumption (list, filter, subscribe to webhook)
- WebSocket endpoint for real-time signal streaming
- API documentation (auto-generated from OpenAPI spec)

---

## Suggested Implementation Order

The phases above are roughly sequential, but some sub-phases can be parallelized. The critical path is:

**1A → 1B → 1C → 1D** (get real data flowing first)
**→ 2A → 2C → 2B** (monetize — access gating before lifecycle polish)
**→ 3A → 3B** (signal delivery)
**→ 7A → 7D** (security and legal before public launch)

Everything else layers on top based on user feedback after early access.
