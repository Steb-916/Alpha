# Scope Alpha — Roadmap v3

## Crypto Analytics & Quantitative Intelligence Platform

### Updated: April 2026 — Phases 0–4 shipped; Phases 5–10 ahead

---

## What Changed From v2

- **Phases 0–4 are live in the codebase.** Derivatives data, intelligence layer, options analytics, and microstructure (GEX, DEX, flow, pin risk, cascade risk) have shipped. Volatility/options analytics are inert without the Quant Engine deployed (controlled by `QUANT_ENGINE_URL`).
- **Cascade-risk overlay added.** A Phase 4 extension (April 2026) cross-overlays dealer negative-gamma zones with the liquidation heatmap. Reuses cached GEX + heatmap — no separate pipeline.
- **Single-service backend.** v2 diagrammed a separate "Market Data Service" on Railway/Fly.io. In practice, all exchange integrations run inside the Next.js backend (`scope-alpha/frontend/lib/exchanges/`, `lib/market-data/`). The Quant Engine (Python FastAPI) remains a separate service. Split market-data out only if scale or cold-start latency demands it — probably around Phase 7 or later.
- **Placeholder pages are real.** `/terminal/{onchain,macro,sentiment}` and `/tools/{screener,backtest}` render a `ComingSoon` component today — they exist in navigation but have no analytics. This roadmap's Phases 5–8 fill them in.
- **Monetization still deferred.** Stripe, Resend (email), Telegram bot, Cloudflare R2 remain absent. Reassess after Phase 8.

---

## Current Snapshot (as of this revision)

### Shipped surface area

| Area | Status | Where it lives |
|---|---|---|
| Auth & sessions | ✅ Live | `lib/auth.ts`, NextAuth v4, credentials + Google, Prisma-backed `UserSession` with jti revocation |
| Live derivatives (Binance, Bybit, OKX) | ✅ Live | `lib/exchanges/`, `lib/market-data/`, WebSocket manager |
| Funding / OI / liquidations / basis | ✅ Live | `app/api/market/{funding,open-interest,liquidations,basis,compare,cvd}` |
| Health score composite | ✅ Live | `app/api/market/health`, `HealthScoreSnapshot` model |
| Multi-asset screener (derivatives) | ✅ Live | `app/api/market/screener`, `lib/market/screener-warmer.ts` |
| Arb scanner | ✅ Live | `app/(app)/tools/arb-scanner`, `app/api/tools/arb-scanner` |
| Alerts v1 (in-app) | ✅ Live | `Alert` + `AlertHistory` Prisma models, `/api/alerts/*` |
| Vol surface / RND / skew / term / cone / VRP | ✅ Live (inert without quant engine) | `components/volatility/*`, `app/api/market/options/*`, Quant Engine `/rnd`, `/vol-surface`, `/skew`, `/vol-cone`, `/vrp` |
| GEX / GEX heatmap / DEX / vanna-charm / flow / pin risk | ✅ Live | `components/volatility/*`, Phase 4 routes under `app/api/market/options/*` |
| Cascade-risk overlay | ✅ Live | `components/volatility/CascadeRiskView.tsx`, `app/api/market/options/cascade-risk` |
| Vercel cron (candles, options refresh, screener warming) | ✅ Live | `app/api/cron/{persist-candles,refresh-options,refresh-screener}` |
| Landing + guest access | ✅ Live | `app/page.tsx`, PRD_UX_Landing_Page_and_Guest_Access |
| Sentry error tracking | ✅ Optional (inert without DSN) | `lib/sentry.ts` |

### Not yet built

| Area | Phase | Present state |
|---|---|---|
| On-chain metrics (flows, MVRV, SOPR, NVT, whales, stablecoins) | 5 | `/terminal/onchain` is a `ComingSoon` stub |
| Regime classifier, convergence score, "why is price moving?" | 6 | Not started |
| Sentiment (Fear & Greed, social), macro (correlations, ETF flows, unlocks), dispersion | 7 | `/terminal/macro`, `/terminal/sentiment` are `ComingSoon` stubs |
| Custom multi-factor screener, backtester, similarity search | 8 | `/tools/screener`, `/tools/backtest` are `ComingSoon` stubs |
| Email / Telegram alert delivery, layouts, annotations, mobile polish | 9 | Alerts fire in-app only |
| Security audit, legal pages, monitoring, soft launch | 10 | Not started |

### Quant Engine module coverage

| Module | Endpoint | Status |
|---|---|---|
| Black-Scholes | internal | ✅ `app/core/black_scholes.py` |
| RND (Breeden–Litzenberger) | `POST /rnd` | ✅ |
| Vol surface (SVI spline) | `POST /vol-surface` | ✅ |
| Skew + term structure | `POST /skew` | ✅ |
| Vol cone (realized percentiles) | `POST /vol-cone` | ✅ |
| VRP (IV − realized) | `POST /vrp` | ✅ |
| Greeks surface | internal | ✅ `app/core/greeks.py` |
| Regime classifier | — | ❌ Phase 6 |
| Convergence scorer | — | ❌ Phase 6 |
| MVRV / SOPR / NVT | — | ❌ Phase 5 |
| Dispersion analysis | — | ❌ Phase 7 |
| Similarity search | — | ❌ Phase 8 |

---

## Current Architecture (actual)

```
┌────────────────────────────────────────────────────────┐
│           VERCEL — scope-alpha/frontend                │
│   Next.js 14 · React 18 · TypeScript · Tailwind        │
│                                                          │
│   ┌─ Pages (/terminal/*, /tools/*)                      │
│   ├─ API routes (app/api/**)                            │
│   ├─ WebSocket manager (lib/market-data/)               │
│   ├─ Exchange adapters (lib/exchanges/)                 │
│   │    Binance · Bybit · OKX · Deribit                  │
│   ├─ Analytics libs (lib/analytics/, lib/options/)      │
│   ├─ Cache wrapper (lib/cache/redis.ts)                 │
│   └─ Vercel cron handlers (app/api/cron/**)             │
└─────────────┬──────────────────────────┬───────────────┘
              │                          │
              │ POST raw chain +         │ Prisma client
              │ historical candles       │
              ▼                          ▼
┌─────────────────────────┐   ┌────────────────────────┐
│  QUANT ENGINE           │   │   NEON POSTGRES         │
│  (Railway / Fly.io)     │   │   + UPSTASH REDIS       │
│  Python 3 · FastAPI     │   │                         │
│                         │   │  Historical candles     │
│  /rnd  /vol-surface     │   │  Funding / OI snapshots │
│  /skew /vol-cone /vrp   │   │  Liquidation events     │
│  /health                │   │  Options chain snapshots│
│                         │   │  Vol surface / IV snaps │
│  Inert mode when        │   │  GEX snapshots          │
│  QUANT_ENGINE_URL unset │   │  Health-score snapshots │
└─────────────────────────┘   │  Users / alerts / etc.  │
                              └─────────────────────────┘
```

**Two services, one platform.** The v2 "Market Data Service" is collapsed into the Next.js app — WebSocket connections, exchange adapters, and SSE broadcast all live in the same process as the UI. The Quant Engine remains separate and stateless (it only receives data and returns computed metrics). Revisit splitting market-data out if: (a) WebSocket connections exceed what a single Vercel function budget can sustain, (b) cold starts on options compute become visible to users, or (c) you need cross-region low-latency streams.

---

## Active Tech Stack

### Frontend (`scope-alpha/frontend/package.json`)

| Category | Package | Version |
|---|---|---|
| Framework | next | 14.2.5 |
| UI | react / react-dom | 18.3.1 |
| Auth | next-auth | 4.24.13 |
| Auth adapter | @next-auth/prisma-adapter | 1.0.7 |
| Password hashing | bcryptjs | 3.0.3 |
| ORM | @prisma/client | 6.19.2 |
| Cache | @upstash/redis | 1.37.0 |
| Charts | lightweight-charts | 4.2.0 |
| Icons | lucide-react | 0.577.0 |
| State | zustand | 4.5.2 |
| Data fetching | swr | 2.4.1 |
| WebSocket | ws | 8.18.0 |
| CSS | tailwindcss | 3.4.4 |
| TypeScript | typescript | 5.4.5 |

### Quant Engine (`quant-engine/requirements.txt`)

| Package | Constraint | Purpose |
|---|---|---|
| fastapi | >=0.110,<1.0 | HTTP API |
| uvicorn[standard] | >=0.27,<1.0 | ASGI server |
| numpy | >=1.26,<3.0 | Array math |
| scipy | >=1.12,<2.0 | Optimization + interpolation (SVI spline, BL density) |
| pandas | >=2.2,<3.0 | Rolling windows (vol cone, VRP) |
| pydantic | >=2.6,<3.0 | Request/response validation |
| pytest / httpx | dev | Test client |

### Infrastructure

- **Hosting**: Vercel (frontend + cron), Railway or Fly.io (Quant Engine — exact host is deployment-time choice)
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis (optional; in-memory Map fallback in dev)
- **Scheduled jobs**: Vercel cron (3 handlers active)
- **Error tracking**: Sentry (optional)

---

## Data Sources & External APIs

| Source | Domain | Used by | Env vars |
|---|---|---|---|
| Binance Futures REST + WebSocket | Perps: price, funding, OI, liquidations, klines | `lib/exchanges/binance.ts`, `lib/market-data/binance-ws.ts` | `BINANCE_FUTURES_REST_URL` (optional override) |
| Bybit REST + WebSocket | Perps + options OI + liquidations | `lib/exchanges/bybit.ts`, `lib/market-data/bybit-ws.ts` | `BYBIT_REST_URL` (optional override) |
| OKX REST | Cross-exchange OI + funding | `lib/exchanges/okx.ts` | OKX public endpoints |
| Deribit REST | Options chains (BTC, ETH) | `lib/exchanges/deribit.ts`, `lib/options/fetcher.ts` | `DERIBIT_REST_URL` (optional override) |
| Quant Engine (self-hosted) | RND, vol surface, skew, cone, VRP | `lib/quant-engine.ts` | `QUANT_ENGINE_URL`, `QUANT_ENGINE_API_KEY` |
| Neon PostgreSQL | Primary DB | Prisma datasource | `DATABASE_URL` |
| Upstash Redis | Cache + locks + rate-limit counters | `lib/cache/redis.ts` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| NextAuth / Google OAuth | Auth | `lib/auth.ts` | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Vercel Cron | Scheduled work | `app/api/cron/*`, `vercel.json` | `CRON_SECRET` |
| Sentry | Error tracking | `lib/sentry.ts` | `SENTRY_DSN` (optional) |

### Planned (not yet integrated)

| Source | For phase | Notes |
|---|---|---|
| Glassnode API **or** CryptoQuant | Phase 5 on-chain | Paid tier ($29–$300+/mo). Free tier + public RPC is a viable starting point for MVRV, SOPR, NVT |
| Alternative.me Fear & Greed | Phase 7 sentiment | Free |
| LunarCrush **or** Santiment | Phase 7 social | Tiered |
| Yahoo Finance / FRED | Phase 7 macro | Free (SPX, DXY, 10Y yields) |
| Public ETF flow sources | Phase 7 macro | Free (BlackRock/Fidelity/etc. filings) |
| Token Unlocks API | Phase 7 macro | Tiered |
| Resend + React Email | Phase 9 alerts | Email delivery |
| Telegram Bot API | Phase 9 alerts | Alert delivery bot |

---

## Remaining Phases

Each remaining phase is rewritten against the current codebase. File paths reference what exists today and what should be added. Durations assume the same engineering cadence that shipped Phases 0–4.

### Phase 5 — On-Chain Analytics

**Goal**: Populate `/terminal/onchain` with actionable blockchain data. Focus on metrics that feed the convergence engine (Phase 6) — not vanity counts.

**Duration**: 3–4 weeks.

**Engineering (frontend)**:
- Replace the `ComingSoon` stub at `scope-alpha/frontend/app/(app)/terminal/onchain/page.tsx` with a tabbed view mirroring the volatility page structure (reuse `Link`-based tab nav pattern from `app/(app)/terminal/volatility/page.tsx`).
- New tabs: Exchange Flows, Supply Dynamics, Network Health, Stablecoin Flows, Whale Monitor.
- Add hooks under `scope-alpha/frontend/hooks/useOnChain*.ts` using the `fetchOptionsJSON` pattern already established for options analytics.
- Add API routes under `app/api/market/onchain/*` that read from Redis cache populated by a new cron.
- Add a new Vercel cron `app/api/cron/refresh-onchain` that fetches from Glassnode (or chosen source) and persists.

**Prisma additions** (additive to `scope-alpha/frontend/prisma/schema.prisma`):
- `OnChainSnapshot` — asset, metric (enum: `mvrv_z`, `sopr`, `nvt`, etc.), value, timestamp
- `ExchangeFlowSnapshot` — asset, exchange, netFlowUsd, timestamp
- `WhaleTransaction` — asset, valueUsd, from, to, timestamp, classification

**Quant Engine additions** (`quant-engine/app/core/onchain.py` + routes):
- `POST /onchain/mvrv` — MVRV z-score with regime bands
- `POST /onchain/sopr` — SOPR with profit-taking/capitulation labels
- `POST /onchain/nvt` — NVT ratio with historical percentile
- `POST /onchain/flow-regime` — Classify exchange flow regime

**Synthesis features** (ship together with basic displays, not after):
- "On-chain + RND compare" card on `/terminal/volatility` RND view: overlay high-OI on-chain cost-basis zones on the RND curve.
- Exchange-flow price overlay on derivatives charts.

**Definition of done**:
- Five on-chain tabs render real data for BTC + ETH.
- Quant Engine serves MVRV / SOPR / NVT with back-tested regime labels.
- Data-source decision (Glassnode vs CryptoQuant vs public) made and documented in a new `PRD_Phase_5_Onchain_Analytics.md`.
- Accumulating historical data in Postgres.

**Open decisions**:
- Glassnode (deepest, $300+/mo) vs CryptoQuant (cheaper, thinner) vs free-tier bootstrap (public RPC + CoinMetrics community + Glassnode Studio free snapshots). Recommend starting on free-tier with a clear upgrade path.

---

### Phase 6 — Regime Classifier & Convergence Engine

**Goal**: Ship the synthesis layer. This is the product moat — no other tool combines derivatives + options microstructure + on-chain in one regime + convergence view.

**Duration**: 2–3 weeks (assumes Phase 5 on-chain data is accumulating).

**Engineering (frontend)**:
- New page `app/(app)/terminal/regime/page.tsx` (or fold into an overview tab on existing terminal pages — decide before PRD). Shows per-asset regime label with confidence, timeline heatmap (90d), and historical forward-return distribution.
- New page `app/(app)/terminal/convergence/page.tsx` with 3-panel (Phase 6) → 4-panel (Phase 7) convergence dashboard: derivatives | options | on-chain | (later: sentiment).
- New "Why is price moving?" card on each terminal page: auto-appears when |Δprice| > 3% in 1h, queries new `/api/market/insights/price-move?asset=BTC&window=1h` endpoint.
- Add `components/regime/*` and `components/convergence/*` directories.

**Quant Engine additions**:
- `quant-engine/app/core/regime.py` — feature vector builder + classifier. Start with rules-based HMM-style state machine (interpretable), leave ML door open.
- `quant-engine/app/core/convergence.py` — per-domain sentiment scoring + composite.
- `POST /regime/classify`, `GET /regime/history`, `POST /convergence/score`.

**Prisma additions**:
- `RegimeSnapshot` — asset, regime (enum), confidence, featureVector (JSON), timestamp
- `ConvergenceSnapshot` — asset, derivativesScore, optionsScore, onchainScore, composite, timestamp

**Synthesis features**:
- Contextual metric emphasis: based on current regime, surface-raise the predictive metrics (e.g., trending → funding + OI momentum; range-bound → on-chain accumulation).
- Alert type: `convergence_threshold` (fires when all domains agree).

**Definition of done**:
- Per-asset regime label with confidence + 90d timeline rendering.
- Convergence dashboard with 3-panel domain breakdown.
- "Why is price moving?" generating explanations that cite specific evidence (liq cascade size, whale deposit, GEX regime flip, etc.).
- Regime + convergence models validated on ≥2 years of historical data in a notebook.

---

### Phase 7 — Sentiment & Macro

**Goal**: Fill the last two data domains. Complete the 4-panel convergence framework.

**Duration**: 2–3 weeks.

**Engineering (frontend)**:
- Replace `ComingSoon` stubs at `app/(app)/terminal/sentiment/page.tsx` and `app/(app)/terminal/macro/page.tsx` with full views.
- **Sentiment**: Fear & Greed gauge, social-volume sparklines per asset, sector-sentiment comparison if data supports.
- **Macro**: Correlation matrix heatmap (BTC vs SPX/NASDAQ/DXY/gold/10Y), ETF flow chart, stablecoin supply as liquidity proxy (already computed — surface here), token unlock calendar.
- New API routes under `app/api/market/sentiment/*` and `app/api/market/macro/*`.
- New cron `app/api/cron/refresh-sentiment` and `app/api/cron/refresh-macro`.

**Quant Engine additions**:
- `quant-engine/app/core/dispersion.py` — BTC-altcoin IV correlation.
- `POST /dispersion/compute`.

**Convergence upgrade**:
- Add sentiment panel to convergence dashboard (4 panels).
- Add macro alignment as a contextual modifier (not a 5th panel — a regime-shaping input).

**Prisma additions**:
- `SentimentSnapshot`, `MacroCorrelation`, `ETFFlow`, `TokenUnlockEvent`

**Definition of done**:
- Sentiment + macro pages render with live data.
- Convergence dashboard shows 4 domains.
- Dispersion chart live.
- Regime classifier retrained on full feature set.

---

### Phase 8 — Quantitative Tools

**Goal**: Deliver the power-user toolkit that makes users sticky. Build against the already-accumulating historical dataset.

**Duration**: 3–4 weeks.

**Engineering (frontend)**:
- Replace `ComingSoon` at `app/(app)/tools/screener/page.tsx` with visual filter-builder UI. Filters span every data domain (derivatives, options, on-chain, sentiment, regime, convergence).
- Replace `ComingSoon` at `app/(app)/tools/backtest/page.tsx` with strategy-definition UI + results dashboard (equity curve, win rate, Sharpe, drawdown heatmap).
- New page `app/(app)/tools/similar-conditions/page.tsx` — "show me the last N times conditions looked like this" tool.
- CSV/JSON export from every chart + table (shared `lib/export/` utility).

**Quant Engine additions**:
- `quant-engine/app/core/backtest.py` — deterministic engine against stored historicals.
- `quant-engine/app/core/similarity.py` — multi-dimensional state-vector nearest-neighbors with a validated distance metric.
- `POST /backtest/run`, `POST /similarity/find`.

**Definition of done**:
- Screener filters across all domains, saves presets, exports CSV.
- Backtester runs strategies on daily resolution, single-asset, long/short v1. Results include equity curve, Sharpe, max drawdown, trade log.
- Similarity finder returns valid matches with forward-return distributions.
- All export paths work.

**Scope discipline**: v1 backtester is daily resolution, single asset, long/short only. Resist adding intraday, portfolio, or ML — those are v2.

---

### Phase 9 — Alerts, Delivery & Polish

**Goal**: Get insights out of the browser. Tighten the entire UX.

**Duration**: 2–3 weeks.

**Engineering**:
- Add Resend integration + React Email templates (`lib/email/` + `components/emails/`).
- Add Telegram bot (separate tiny service or inside Quant Engine — decide before building). Alert dispatch lands in a new `app/api/alerts/dispatch/*` route or worker.
- Smart throttling (dedupe during high-vol cascades) — add to `lib/alerts/evaluator.ts`.
- Alert types extend to cover Phases 5–8: regime-change, convergence-threshold, "why is price moving?" digest.
- Dashboard workspace layouts (save/load) — `UserPreferences.savedLayouts` already exists; wire it up.
- Watchlist UI — already has model, needs UI polish.
- Chart annotation tools (user-owned lines/levels/notes) — new `ChartAnnotation` Prisma model.
- Keyboard shortcuts layer.
- Mobile responsiveness audit pass.
- Onboarding flow for new users.
- Lighthouse audit + code splitting heavy chart components.
- Error boundary coverage + data-freshness monitoring (alert if market data goes stale).

**Definition of done**:
- Email + Telegram alerts deliver.
- Customizable layouts working.
- Chart annotations persist per user.
- Mobile usable (not native).
- Sub-2s page loads, sub-1s data updates.

---

### Phase 10 — Security, Legal & Soft Launch

**Goal**: Production-harden and open the doors. Still free at this stage; monetization is a later decision.

**Duration**: 1–2 weeks.

**Scope**:
- Rate limiting on all routes (infrastructure already has `incrementWithExpiry` counter in `lib/cache/redis.ts` + `lib/rateLimit.ts`). Audit coverage.
- Input validation audit (zod / pydantic boundaries).
- CSP headers + dependency vulnerability scan.
- Auth route audit (already has `UserSession` revocation — verify coverage).
- Terms of Service (analytics platform, NOT financial advice).
- Privacy Policy, cookie consent, GDPR check.
- "Not financial advice" disclaimers on every insight card.
- Landing page SEO + OG cards + social sharing cards.
- Feedback mechanism (in-app).
- Privacy-respecting analytics (self-hosted Plausible or similar).
- Uptime monitoring for frontend + Quant Engine + database.
- Open to users, free, full feature access. Instrument what they actually use before deciding what to charge for.

**Definition of done**:
- Security audit clean.
- Legal pages published.
- Landing page live with clear value prop.
- App publicly accessible.
- Monitoring confirms stability under real traffic.

---

## Revised Phase Summary

| Phase | Name | Duration | Status |
|---|---|---|---|
| 0 | Strip & Restructure | 1 week | ✅ Shipped |
| 1 | Live Derivatives Data | 2–3 weeks | ✅ Shipped |
| 2 | Derivatives Intelligence | 2–3 weeks | ✅ Shipped |
| 3 | Options & Volatility | 3–4 weeks | ✅ Shipped (inert without Quant Engine) |
| 4 | Options Microstructure | 2–3 weeks | ✅ Shipped — includes cascade-risk overlay |
| 5 | On-Chain Analytics | 3–4 weeks | 🔜 Next |
| 6 | Regime & Convergence | 2–3 weeks | Planned |
| 7 | Sentiment & Macro | 2–3 weeks | Planned |
| 8 | Quant Tools | 3–4 weeks | Planned |
| 9 | Alerts & Polish | 2–3 weeks | Planned |
| 10 | Security & Soft Launch | 1–2 weeks | Planned |

**Remaining: ~14–22 weeks (3.5–5.5 months) to soft launch.**

---

## Architectural Principles (retained from v2, validated by practice)

- **Synthesis is the product.** Every phase ships a cross-domain derived metric, not just a new display.
- **The Quant Engine is authoritative for math.** TypeScript glues; Python computes. No black-scholes in the frontend (the inverted form of what Wonju's branch proposed).
- **Inert modes everywhere.** Every external dependency has a graceful-degradation path: Upstash Redis → in-memory Map; Quant Engine unset → `UnavailableBanner`; Sentry unset → no-op. This keeps dev friction low and production robust.
- **Cache-first reads, cache-warming via cron.** API routes read Redis. Cron warms Redis. No inline compute on hot paths.
- **One codebase until scale forces a split.** Market data lives with the UI for now. Quant Engine is split because it's a different language, not because of scale.

---

## Risks & Open Decisions

1. **On-chain data source (Phase 5 blocker)**. Glassnode's depth is hard to match, but $300+/mo is steep pre-monetization. Recommend: free-tier + public RPC for MVRV, SOPR, NVT to validate the feature; upgrade once convergence engine demonstrates value.
2. **Regime classifier model choice (Phase 6)**. Rules-based HMM is interpretable and backtestable with small data. An ML classifier needs more historicals than we currently have. Recommend: rules-based v1, ML v2 after 6+ months of accumulated data.
3. **Backtester scope creep (Phase 8)**. v1 must stay daily / single-asset / long-short. Every "just one more feature" request adds weeks. Write the scope-guard into the PRD.
4. **Market Data Service split**. v2 planned a Railway-hosted market-data service. v3 keeps it in Next.js. If WebSocket connection count, per-function duration, or cold-start latency becomes a pain point, revisit — probably Phase 7–9 timeframe.
5. **Telegram bot hosting**. A tiny long-running node process doesn't fit Vercel's model. Options: Railway/Fly.io companion service, or fold into the Quant Engine box. Decide during Phase 9 PRD.
6. **Monetization timing**. v2 put it "late-stage." Instrument Phase 10 soft-launch carefully so the pricing decision is data-driven, not intuition-driven.

---

## Appendix A — Current Route Inventory

### Pages (`app/(app)/`)

**Terminal**:
- `/terminal` — Dashboard home
- `/terminal/derivatives` — Funding / OI / liquidations / basis / health score
- `/terminal/volatility` — 13 tabs: Overview, Vol Surface, RND, Skew, Term, Vol Cone, VRP, GEX, GEX Heatmap, Cascade Risk, DEX, Vanna/Charm, Flow
- `/terminal/onchain` — `ComingSoon`
- `/terminal/macro` — `ComingSoon`
- `/terminal/sentiment` — `ComingSoon`

**Tools**:
- `/tools/arb-scanner` — Live
- `/tools/screener` — `ComingSoon`
- `/tools/backtest` — `ComingSoon`

### API Routes (`app/api/`)

**Auth / users / watchlists / alerts**: standard CRUD (see `lib/auth.ts`, Prisma models).

**Market (derivatives)**:
`funding`, `open-interest`, `liquidations`, `liquidation-heatmap`, `basis`, `compare`, `cvd`, `health`, `screener`, plus `history/{funding,oi,liquidations}`.

**Market (options, Phase 3)**:
`chain`, `rnd`, `vol-surface`, `skew`, `vol-cone`, `vrp`.

**Market (options, Phase 4)**:
`gex`, `gex-history`, `flow`, `greeks-exposure`, `pin-risk`, `cascade-risk`, `dex`.

**Tools**:
`arb-scanner`.

**Cron** (Vercel):
`persist-candles`, `refresh-options`, `refresh-screener`.

**Health**:
`/api/health`, `/api/health/sse`.

---

## Appendix B — Prisma Model Inventory

**Identity / auth**: `User`, `Account`, `Session`, `VerificationToken`, `UserSession`.
**User data**: `UserPreferences`, `Watchlist`, `Alert`, `AlertHistory`.
**Market (Phase 1)**: `FundingRateSnapshot`, `OISnapshot`, `LiquidationEvent`, `CandleHistory`.
**Market (Phase 2)**: `HealthScoreSnapshot`.
**Options (Phase 3)**: `OptionsChainSnapshot`, `VolSurfaceSnapshot`, `IVSnapshot`.
**Options (Phase 4)**: `GEXSnapshot`.

**Planned**:
- Phase 5: `OnChainSnapshot`, `ExchangeFlowSnapshot`, `WhaleTransaction`.
- Phase 6: `RegimeSnapshot`, `ConvergenceSnapshot`.
- Phase 7: `SentimentSnapshot`, `MacroCorrelation`, `ETFFlow`, `TokenUnlockEvent`.
- Phase 9: `ChartAnnotation`.

---

*v3 supersedes v2 for planning. v2 remains the historical reference for "what was intended" before Phases 0–4 shipped. Each remaining phase (5–10) will be expanded into a standalone PRD following the `PRD's/era 2/PRD_Phase_N_*.md` convention before implementation starts.*
