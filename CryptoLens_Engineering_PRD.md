# CryptoLens — Engineering PRD for Claude Code

## Document Purpose
This is a phased engineering specification for building CryptoLens, a desktop-first crypto derivatives analytics terminal. Each phase has explicit deliverables and verification checks. **Do not advance to the next phase until all verification checks in the current phase pass.** If a check fails, fix it before moving on.

---

## Project Overview

**Product:** CryptoLens — A crypto derivatives analytics terminal
**Stack:** Next.js 14 (App Router) + TypeScript frontend, Python FastAPI backend, PostgreSQL + TimescaleDB, Redis
**Design Direction:** Dark terminal aesthetic (#0B0E14 base) with neumorphic-inspired interactive controls, crypto green accent (#00D4AA)
**Target:** Desktop-first (1280px+ viewport), data-dense terminal layout
**Landing Page:** Already built as a React component (CryptoLens_Landing.jsx) — integrate into the project in Phase 1

---

## Design System Tokens

Use these consistently across all components. Define them as CSS variables in globals.css and as a TypeScript theme object.

### Colors
```
--bg-primary: #0B0E14
--bg-surface: #0F1219
--bg-elevated: #131620
--bg-card: rgba(18, 22, 32, 0.6)
--border-subtle: rgba(255, 255, 255, 0.05)
--border-medium: rgba(255, 255, 255, 0.08)
--border-accent: rgba(0, 212, 170, 0.2)
--text-primary: #F1F5F9
--text-secondary: #94A3B8
--text-muted: #64748B
--text-dim: #475569
--accent-green: #00D4AA
--accent-green-dim: #00B894
--accent-blue: #3B82F6
--accent-yellow: #F59E0B
--accent-red: #EF4444
--accent-purple: #8B5CF6
--accent-pink: #EC4899
--positive: #10B981
--negative: #EF4444
```

### Typography
```
--font-display: 'Outfit', sans-serif          (headlines, large numbers)
--font-body: 'Satoshi', sans-serif             (body text, labels, UI)
--font-mono: 'JetBrains Mono', monospace       (data, prices, metrics, code)
```

### Neumorphic Shadows (on dark backgrounds)
```
--shadow-raised: 4px 4px 16px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.03)
--shadow-pressed: inset 2px 2px 8px rgba(0,0,0,0.4)
--shadow-glow-green: 0 0 40px rgba(0,212,170,0.15)
--shadow-card-hover: 8px 8px 24px rgba(0,0,0,0.5), -4px -4px 12px rgba(255,255,255,0.02), 0 0 60px rgba(0,212,170,0.08)
```

### Spacing & Layout
```
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 20px
--panel-gap: 12px
--panel-padding: 16px
```

---

## Phase 0 — Project Scaffolding

### Objective
Set up a monorepo-style project structure with frontend and backend that both run locally with one command.

### Deliverables

1. **Project root structure:**
```
cryptolens/
├── frontend/                    # Next.js 14 app
│   ├── app/
│   │   ├── layout.tsx           # Root layout with fonts, metadata
│   │   ├── page.tsx             # Landing page (port from CryptoLens_Landing.jsx)
│   │   ├── globals.css          # CSS variables, resets, animations
│   │   └── terminal/
│   │       ├── layout.tsx       # Terminal layout (sidebar + panels)
│   │       └── page.tsx         # Main terminal dashboard
│   ├── components/
│   │   ├── ui/                  # Reusable UI primitives
│   │   │   ├── NeuButton.tsx
│   │   │   ├── NeuCard.tsx
│   │   │   ├── DataCell.tsx     # Metric display cell (label, value, change)
│   │   │   ├── Badge.tsx
│   │   │   └── Tooltip.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PanelGrid.tsx    # Resizable panel container
│   │   │   └── TopBar.tsx
│   │   ├── charts/
│   │   │   └── PriceChart.tsx   # TradingView Lightweight Charts wrapper
│   │   └── landing/
│   │       └── LandingPage.tsx  # Ported from the .jsx artifact
│   ├── lib/
│   │   ├── api.ts               # API client (fetch wrapper for backend)
│   │   ├── websocket.ts         # WebSocket client manager
│   │   ├── types.ts             # Shared TypeScript types
│   │   └── utils.ts             # Formatting, helpers
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.js
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entrypoint
│   │   ├── config.py            # Environment config, API keys
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── instruments.py   # Instrument/symbol models
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── market.py        # Market data endpoints
│   │   │   └── health.py        # Health check endpoint
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── coingecko.py     # CoinGecko API client
│   │   └── db/
│   │       ├── __init__.py
│   │       ├── connection.py    # DB connection pool
│   │       └── schema.sql       # Initial table definitions
│   ├── requirements.txt
│   └── .env.example
├── docker-compose.yml           # Postgres+TimescaleDB, Redis, backend, frontend
├── .gitignore
├── README.md
└── Makefile                     # Convenience commands: make dev, make db-setup, etc.
```

2. **docker-compose.yml** must include:
   - `timescaledb` service (timescale/timescaledb:latest-pg16, port 5432, volume for persistence)
   - `redis` service (redis:7-alpine, port 6379)
   - Environment variables for DB connection shared to backend

3. **Frontend setup:**
   - Next.js 14 with App Router, TypeScript strict mode
   - Tailwind CSS configured with the design token colors as custom theme extensions
   - Google Fonts loaded in layout.tsx: Outfit, JetBrains Mono (Satoshi via CDN fallback)
   - globals.css with all CSS variables from the Design System Tokens section above
   - All keyframe animations from the landing page (heroGlow, float, barGrow, pulse, fadeInUp, textShimmer, orbFloat, gradientShift)

4. **Backend setup:**
   - FastAPI with CORS middleware (allow localhost:3000)
   - Health check endpoint: GET /api/health → { status: "ok", timestamp: ... }
   - Async DB connection pool using asyncpg
   - Redis connection using aioredis
   - .env.example with all required env vars documented

5. **Makefile commands:**
   - `make dev` — starts docker-compose (DB + Redis) then runs frontend and backend in parallel
   - `make db-setup` — runs schema.sql against the TimescaleDB container
   - `make db-reset` — drops and recreates all tables

### Verification Checks — Phase 0
```
□ Running `make dev` starts all services without errors
□ http://localhost:3000 loads the Next.js app (can be blank page with "CryptoLens" text)
□ http://localhost:8000/api/health returns { "status": "ok" } with 200
□ PostgreSQL is accessible on port 5432 with TimescaleDB extension enabled
□ Redis is accessible on port 6379 and responds to PING
□ TypeScript compiles with zero errors (`cd frontend && npx tsc --noEmit`)
□ All CSS variables from the design system are defined in globals.css
□ Tailwind config extends theme with the custom color tokens
□ .gitignore excludes node_modules, __pycache__, .env, .next, docker volumes
```

---

## Phase 1 — Landing Page + Terminal Shell

### Objective
Port the landing page into the project and build the empty terminal layout with navigation between them.

### Deliverables

1. **Landing page** at `/` — port from CryptoLens_Landing.jsx:
   - Convert from inline styles to Tailwind utility classes where practical
   - Keep complex animations as CSS keyframes in globals.css
   - NeuButton and NeuCard become proper components in `components/ui/`
   - "Launch Terminal" button navigates to `/terminal`
   - All hover states, animations, and scroll effects must work

2. **Terminal layout** at `/terminal`:
   - **Sidebar** (left, 56px collapsed / 220px expanded):
     - Logo + collapse toggle at top
     - Nav items with icons: Dashboard, Funding, Open Interest, Liquidations, Basis, Screener
     - Each nav item highlights when active (green left border + bg tint)
     - Neumorphic inset style when collapsed, smooth expand animation
   - **TopBar** (top, 48px height):
     - Asset selector dropdown (shows current asset like "BTC / USDT")
     - Timeframe pills: 1m, 5m, 15m, 1H, 4H, 1D, 1W (neumorphic toggle group)
     - Connection status indicator (green dot + "Live" or yellow dot + "Delayed")
     - Settings gear icon
   - **Main content area**:
     - For now, render a placeholder panel grid with 4 empty NeuCard panels
     - Each panel has a header bar with title text and a drag handle placeholder
     - Content area shows "Coming in Phase 2" or similar

3. **Routing:**
   - `/` → Landing page
   - `/terminal` → Terminal dashboard (default to Dashboard view)
   - `/terminal/funding` → Funding dashboard (placeholder)
   - `/terminal/oi` → Open interest (placeholder)
   - `/terminal/liquidations` → Liquidations (placeholder)
   - `/terminal/basis` → Basis (placeholder)
   - `/terminal/screener` → Screener (placeholder)

### Verification Checks — Phase 1
```
□ Landing page at / renders with all animations working (hero glow, floating dashboard, scroll reveals, shimmer text)
□ "Launch Terminal" button on landing page navigates to /terminal
□ Terminal layout renders with sidebar, topbar, and main content area
□ Sidebar nav items are clickable and navigate to correct routes
□ Active nav item shows green highlight
□ Sidebar collapses and expands with smooth animation
□ TopBar timeframe pills are clickable with neumorphic pressed state
□ Asset selector shows "BTC / USDT" (static for now)
□ Connection status indicator shows (static green dot for now)
□ All 6 terminal sub-routes render their placeholder panels
□ Responsive: terminal remains usable at 1280px width minimum
□ No TypeScript errors
□ No console errors in browser
□ Dark theme is consistent — no white flashes on route transitions
```

---

## Phase 2 — Data Layer Foundation

### Objective
Build the backend API layer and database schema to ingest, store, and serve market data. Get real data flowing from CoinGecko to the frontend.

### Deliverables

1. **Database schema** (schema.sql):
```sql
-- Instruments table
CREATE TABLE instruments (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,      -- 'BTC', 'ETH', 'SOL'
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50),                         -- CoinGecko slug
    rank INTEGER,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OHLCV candles (TimescaleDB hypertable)
CREATE TABLE candles (
    time TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    exchange VARCHAR(20) DEFAULT 'aggregate',
    interval VARCHAR(5) NOT NULL,            -- '1m','5m','15m','1h','4h','1d'
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume DOUBLE PRECISION,
    PRIMARY KEY (time, instrument_id, exchange, interval)
);
SELECT create_hypertable('candles', 'time');

-- Market snapshots (current price, 24h stats)
CREATE TABLE market_snapshots (
    time TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    price DOUBLE PRECISION,
    market_cap DOUBLE PRECISION,
    volume_24h DOUBLE PRECISION,
    change_24h DOUBLE PRECISION,
    change_7d DOUBLE PRECISION,
    PRIMARY KEY (time, instrument_id)
);
SELECT create_hypertable('market_snapshots', 'time');
```

2. **CoinGecko service** (backend/app/services/coingecko.py):
   - Async HTTP client using httpx
   - Rate limiting: respect 30 calls/min on demo tier
   - Methods:
     - `get_top_coins(limit=20)` → returns list of top coins with metadata
     - `get_coin_market_data(coin_id)` → current price, volume, market cap, changes
     - `get_coin_ohlc(coin_id, days=30)` → historical OHLC data
   - Error handling with retries (3 attempts, exponential backoff)
   - Response caching in Redis (TTL: 60s for market data, 300s for metadata)

3. **API endpoints** (backend/app/routers/market.py):
   - `GET /api/instruments` → list all tracked instruments with latest snapshot
   - `GET /api/instruments/{symbol}` → single instrument detail
   - `GET /api/instruments/{symbol}/candles?interval=1d&limit=90` → OHLCV data
   - `GET /api/instruments/{symbol}/snapshot` → latest market snapshot
   - `GET /api/market/overview` → top 20 assets sorted by market cap with price, change, volume

4. **Data ingestion script** (backend/app/services/ingestion.py):
   - On startup, populate instruments table with top 20 coins from CoinGecko
   - Backfill 90 days of daily OHLC for each instrument
   - Scheduled task: refresh market snapshots every 60 seconds
   - Scheduled task: refresh OHLC data every 5 minutes
   - Use Python's asyncio for concurrent fetching with rate limit compliance

5. **Frontend API client** (frontend/lib/api.ts):
   - Typed fetch wrapper pointing to backend (http://localhost:8000)
   - Functions matching each backend endpoint
   - Return types defined in types.ts
   - Error handling with typed error responses

### Verification Checks — Phase 2
```
□ `make db-setup` creates all tables without errors
□ TimescaleDB hypertables are confirmed created (query timescaledb_information.hypertables)
□ Backend startup populates instruments table with 20 coins
□ GET /api/instruments returns 20 instruments with correct metadata
□ GET /api/instruments/BTC/candles?interval=1d&limit=30 returns 30 daily candles
□ GET /api/market/overview returns 20 assets with price, change_24h, volume_24h
□ Redis is caching responses (check with redis-cli KEYS *)
□ Rate limiting is working (no 429 errors from CoinGecko in logs)
□ Ingestion scheduler is running and refreshing data (check logs for refresh cycle)
□ Frontend api.ts compiles with no TypeScript errors
□ Frontend can fetch and console.log /api/market/overview data successfully
□ All API responses match their TypeScript type definitions
```

---

## Phase 3 — Live Chart + Watchlist

### Objective
Build the first real terminal screens: a candlestick price chart and a functional watchlist. This is where the app starts feeling like a product.

### Deliverables

1. **Price chart component** (components/charts/PriceChart.tsx):
   - Use `lightweight-charts` library from TradingView (npm install lightweight-charts)
   - Candlestick series from backend OHLCV data
   - Volume histogram as secondary series
   - Timeframe switching (1D, 4H, 1H) fetches new data from backend
   - Dark theme configuration matching design tokens:
     - Background: var(--bg-primary)
     - Grid lines: rgba(255,255,255,0.03)
     - Up candle: var(--positive) (#10B981)
     - Down candle: var(--negative) (#EF4444)
     - Crosshair: rgba(255,255,255,0.15)
   - Crosshair with price/time labels
   - Auto-resize on container resize
   - Loading skeleton while data fetches
   - Chart renders current asset from URL/state context

2. **Watchlist component** (components/terminal/Watchlist.tsx):
   - Table showing all 20 instruments
   - Columns: Rank, Symbol/Name, Price, 24h Change (%), 24h Volume, Market Cap
   - Sortable by clicking column headers (toggle asc/desc)
   - Change column is color-coded (green positive, red negative)
   - Row click navigates to that asset's chart view
   - Current asset row highlighted with accent border
   - Price values formatted correctly ($67,842.50 for BTC, $0.5423 for small caps)
   - Compact neumorphic styling matching terminal aesthetic
   - Refresh indicator showing last update time

3. **Terminal Dashboard page** (app/terminal/page.tsx):
   - Two-panel layout:
     - Left (65% width): Price chart for selected asset
     - Right (35% width): Watchlist
   - Asset selection state: clicking watchlist row updates the chart
   - TopBar asset selector syncs with selected asset
   - TopBar timeframe pills control the chart timeframe

4. **Asset context:**
   - Create a React context or Zustand store for:
     - `selectedAsset: string` (symbol)
     - `selectedTimeframe: string`
     - `setAsset(symbol)` / `setTimeframe(tf)`
   - Persisted to localStorage so refresh preserves selection

### Verification Checks — Phase 3
```
□ Price chart renders BTC daily candles on terminal load
□ Candles are correctly colored (green up, red down)
□ Volume histogram shows below candles
□ Switching timeframe to 4H or 1H fetches new data and re-renders chart
□ Chart has crosshair with price and time labels
□ Chart resizes when browser window resizes
□ Loading skeleton shows while chart data is fetching
□ Watchlist displays all 20 instruments with correct data
□ Watchlist columns are sortable (click header to sort)
□ 24h change is green for positive, red for negative
□ Clicking a watchlist row changes the chart to that asset
□ TopBar asset selector shows the currently selected asset
□ TopBar timeframe pills reflect the current timeframe
□ Selected asset persists across page refresh (localStorage)
□ No layout shifts or flash of unstyled content
□ Prices are formatted correctly (BTC shows $67,842, not $67842.1234)
□ No console errors
```

---

## Phase 4 — Binance WebSocket Real-Time Data

### Objective
Add real-time price streaming from Binance so the chart and watchlist update live without polling.

### Deliverables

1. **Binance WebSocket service** (backend/app/services/binance_ws.py):
   - Connect to Binance's combined stream WebSocket
   - Subscribe to streams for top 20 assets:
     - `btcusdt@kline_1m` (kline/candle updates)
     - `btcusdt@trade` (individual trades for last price)
     - `btcusdt@miniTicker` (24h ticker summary)
   - Auto-reconnect with exponential backoff on disconnect
   - Handle Binance's 24-hour connection expiry (reconnect before timeout)
   - Ping/pong heartbeat handler
   - Normalize Binance data into internal format before broadcasting

2. **WebSocket relay** (backend → frontend):
   - FastAPI WebSocket endpoint: `ws://localhost:8000/ws/market`
   - Client subscribes by sending: `{ "action": "subscribe", "symbols": ["BTC", "ETH"] }`
   - Server pushes updates:
     - `{ "type": "price", "symbol": "BTC", "price": 67842.5, "change_24h": 2.34, "volume_24h": 28400000000, "timestamp": ... }`
     - `{ "type": "kline", "symbol": "BTC", "interval": "1m", "open": ..., "high": ..., "low": ..., "close": ..., "volume": ..., "time": ... }`
   - Redis pub/sub as internal message bus between ingestion and relay

3. **Frontend WebSocket client** (frontend/lib/websocket.ts):
   - Singleton WebSocket manager
   - Auto-reconnect with backoff
   - Subscribe/unsubscribe methods
   - Event emitter pattern or Zustand integration
   - Connection state tracking (connected, connecting, disconnected)
   - Message parsing and type validation

4. **Live updates on UI:**
   - Watchlist prices update in real-time (flash green/red on change)
   - Price chart appends new candles from kline stream
   - TopBar connection indicator reflects actual WebSocket state
   - Last price display in TopBar updates live

5. **Connection health:**
   - Track last message timestamp
   - If no message for 30 seconds, show "Delayed" status
   - If disconnected, show "Disconnected" with reconnect attempt count
   - Log connection events for debugging

### Verification Checks — Phase 4
```
□ Backend connects to Binance WebSocket on startup (check logs)
□ Backend auto-reconnects if Binance connection drops (test by restarting Docker network briefly)
□ Frontend WebSocket connects to backend on terminal page load
□ Watchlist prices update in real-time without page refresh
□ Price flash effect works (green flash on price increase, red on decrease)
□ Chart updates with new candles as they arrive
□ Connection indicator shows green "Live" when connected
□ Connection indicator shows yellow "Delayed" if no data for 30s
□ Connection indicator shows red "Disconnected" on WS failure
□ Subscribing to a different asset starts receiving that asset's data
□ No memory leaks (watch browser memory over 5 minutes of live data)
□ WebSocket reconnects automatically if backend restarts
□ Console shows no repeated error spam during normal operation
```

---

## Phase 5 — Derivatives Data (CoinGlass Integration)

### Objective
This is the core differentiator. Add funding rates, open interest, and liquidation data from CoinGlass. This phase makes CryptoLens more than a chart app.

### Deliverables

1. **CoinGlass service** (backend/app/services/coinglass.py):
   - Async HTTP client with API key auth
   - Rate limiting appropriate to the tier (free or basic)
   - Methods:
     - `get_funding_rates(symbol)` → current funding rates across exchanges
     - `get_funding_history(symbol, days=30)` → historical funding rate series
     - `get_open_interest(symbol)` → current OI by exchange
     - `get_oi_history(symbol, days=30)` → historical OI series
     - `get_liquidations(symbol, period='24h')` → recent liquidation events
     - `get_liquidation_history(symbol, days=7)` → historical liquidation volume
   - Response caching in Redis (TTL: 120s for current data, 600s for history)
   - Graceful fallback: if CoinGlass is unavailable, serve cached data with staleness flag

2. **Database schema additions:**
```sql
-- Funding rates
CREATE TABLE funding_rates (
    time TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    exchange VARCHAR(20) NOT NULL,
    rate DOUBLE PRECISION,
    PRIMARY KEY (time, instrument_id, exchange)
);
SELECT create_hypertable('funding_rates', 'time');

-- Open interest
CREATE TABLE open_interest (
    time TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    exchange VARCHAR(20) DEFAULT 'aggregate',
    oi_value DOUBLE PRECISION,               -- in USD
    oi_change_1h DOUBLE PRECISION,
    oi_change_4h DOUBLE PRECISION,
    oi_change_24h DOUBLE PRECISION,
    PRIMARY KEY (time, instrument_id, exchange)
);
SELECT create_hypertable('open_interest', 'time');

-- Liquidations
CREATE TABLE liquidations (
    time TIMESTAMPTZ NOT NULL,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id),
    exchange VARCHAR(20),
    side VARCHAR(5) NOT NULL,                -- 'long' or 'short'
    amount DOUBLE PRECISION,                  -- USD value
    price DOUBLE PRECISION,
    PRIMARY KEY (time, instrument_id, exchange, side)
);
SELECT create_hypertable('liquidations', 'time');
```

3. **API endpoints:**
   - `GET /api/derivatives/{symbol}/funding` → current + historical funding
   - `GET /api/derivatives/{symbol}/oi` → current + historical open interest
   - `GET /api/derivatives/{symbol}/liquidations` → recent liquidations + 24h summary
   - `GET /api/derivatives/overview` → all assets with latest funding, OI, OI change, liq volume

4. **Analytics computations** (backend/app/services/analytics.py):
   - `funding_zscore(symbol)` → (current_rate - 30d_mean) / 30d_std
   - `oi_momentum(symbol)` → rate of change of OI with 4h/24h smoothing
   - `liquidation_ratio(symbol)` → long_liq_volume / total_liq_volume over 24h
   - These are computed on each data refresh and cached in Redis

5. **Derivatives ingestion:**
   - Scheduled polling: funding rates every 5 minutes, OI every 5 minutes, liquidations every 2 minutes
   - Backfill 30 days of funding and OI history on first run
   - Store raw data in TimescaleDB, computed analytics in Redis

6. **Frontend pages:**

   **Funding Dashboard** (`/terminal/funding`):
   - Funding rates table: all assets, current rate, 8h avg, z-score, annualized carry
   - Color scale: deep green (very negative = shorts paying) → deep red (very positive = longs paying)
   - Historical funding chart for selected asset (line chart, last 30 days)
   - Exchange breakdown bar chart (Binance, OKX, Bybit rates side by side)

   **Open Interest** (`/terminal/oi`):
   - Aggregate OI card with large number + 24h change
   - OI history chart (area chart, last 30 days)
   - OI by exchange (stacked bar or donut)
   - OI vs Price overlay chart (dual axis)
   - OI momentum indicator (gauge or color-coded badge)

   **Liquidations** (`/terminal/liquidations`):
   - Real-time liquidation ticker (scrolling feed of recent events)
   - 24h liquidation volume: longs vs shorts (horizontal stacked bar)
   - Cumulative liquidation chart (last 7 days, area chart, long vs short)
   - Largest single liquidation events table

### Verification Checks — Phase 5
```
□ CoinGlass API client fetches funding rates without errors
□ CoinGlass API client fetches OI data without errors
□ CoinGlass API client fetches liquidation data without errors
□ Funding rates table in TimescaleDB has data for 20 assets
□ Open interest table has data for 20 assets
□ GET /api/derivatives/BTC/funding returns current + 30 days history
□ GET /api/derivatives/BTC/oi returns current OI with exchange breakdown
□ GET /api/derivatives/overview returns all assets with derivatives metrics
□ Funding z-score calculation produces reasonable values (-3 to +3 range)
□ OI momentum calculation works and updates on each refresh
□ Funding dashboard page renders table with all 20 assets
□ Funding table is sortable and color-coded
□ Historical funding chart renders for selected asset
□ OI page shows aggregate OI with correct 24h change
□ OI history chart renders (area chart)
□ OI vs price overlay chart has dual axes working correctly
□ Liquidation feed shows recent events (or empty state if no recent events)
□ 24h liquidation bar chart shows long vs short breakdown
□ All derivative pages show loading states while data fetches
□ Stale data is flagged with timestamp and warning badge
□ No CoinGlass rate limit errors in logs during normal operation
```

---

## Phase 6 — Basis Analysis + Composite Analytics

### Objective
Add the final analytical layer: basis calculations and the composite derivatives health score. This is what makes CryptoLens unique.

### Deliverables

1. **Basis calculation** (backend/app/services/analytics.py):
   - Fetch perp and spot prices simultaneously from Binance
   - `basis = (perp_price - spot_price) / spot_price * 100` (percentage)
   - `annualized_basis = basis * (365 / days_to_expiry)` (for dated futures; for perps, use 365 * funding rate as proxy)
   - Historical basis from stored perp vs spot candles
   - Multi-exchange basis comparison (Binance, OKX, Bybit if data available)

2. **Derivatives health score:**
   - Composite metric (0-100 scale):
     - Funding z-score component (25% weight): extreme positive = bearish, extreme negative = bullish
     - OI momentum component (25% weight): rapid OI increase + price increase = overheated
     - Liquidation ratio component (25% weight): heavy long liquidations = bearish flush
     - Basis component (25% weight): very high basis = expensive leverage
   - Regime classification:
     - 0-30: "Risk Off" (red badge)
     - 30-50: "Cautious" (yellow badge)
     - 50-70: "Neutral" (gray badge)
     - 70-90: "Risk On" (green badge)
     - 90-100: "Overheated" (orange badge, warning)
   - Update every 60 seconds

3. **API endpoints:**
   - `GET /api/derivatives/{symbol}/basis` → current + historical basis
   - `GET /api/derivatives/{symbol}/health` → health score + component breakdown
   - `GET /api/derivatives/screener` → all assets with all metrics for screener

4. **Frontend pages:**

   **Basis Monitor** (`/terminal/basis`):
   - Current basis display: large number with annualized yield
   - Historical basis chart (line chart, 30 days)
   - Multi-exchange basis comparison (grouped bar chart)
   - Basis vs funding rate correlation scatter or dual-line chart

   **Screener** (`/terminal/screener`):
   - Full-width table of all 20 assets
   - Columns: Asset, Price, Funding Rate, Funding Z, OI ($), OI 24h Δ, Liq 24h ($), Liq Ratio, Basis (%), Health Score, Regime
   - All columns sortable
   - Health score cell: colored badge with score number
   - Regime cell: colored pill label
   - Row click navigates to that asset's detail
   - Heatmap toggle: switch table to color-intensity grid view
   - Export to CSV button

   **Terminal Dashboard update** (`/terminal/page.tsx`):
   - Add a stats bar above the chart showing: Health Score, Funding Rate, OI Change, Basis for selected asset
   - These are the 4 key DataCell components in a row, pulling from derivatives endpoints

### Verification Checks — Phase 6
```
□ Basis calculation returns reasonable values for BTC (typically -0.5% to +2%)
□ Annualized basis calculation is correct
□ Health score produces values in 0-100 range for all assets
□ Regime classification matches the score thresholds
□ GET /api/derivatives/BTC/basis returns current + history
□ GET /api/derivatives/BTC/health returns score + component breakdown
□ GET /api/derivatives/screener returns all 20 assets with all metrics
□ Basis monitor page renders with current basis and chart
□ Screener table renders all 20 assets with all columns populated
□ All screener columns are sortable
□ Health score badges show correct colors
□ Regime pills show correct labels and colors
□ Heatmap view toggle works and renders a color-intensity grid
□ CSV export produces a valid file with correct data
□ Terminal dashboard stats bar shows 4 key metrics for selected asset
□ All new pages have loading skeletons
□ All data updates respect caching (no redundant API calls)
□ Zero TypeScript errors across the entire frontend
```

---

## Phase 7 — Polish, Performance, and Deploy Readiness

### Objective
Make it bulletproof. This phase is about visual polish, error handling, performance, and documentation.

### Deliverables

1. **Error handling:**
   - Global error boundary in React with styled error UI
   - All API calls wrapped in try/catch with user-facing error states
   - Backend returns consistent error format: `{ error: string, code: string, timestamp: number }`
   - Graceful degradation: if CoinGlass is down, derivatives pages show cached data with warning
   - If Binance WS disconnects, watchlist shows last known prices with "stale" indicator

2. **Loading & empty states:**
   - Every data-dependent component has a skeleton loader
   - Skeletons match the shape of the actual content (not generic spinners)
   - Empty states for screener filters that return no results
   - First-load experience: show a brief onboarding tooltip on key features

3. **Performance:**
   - Chart rendering: verify <16ms frame budget during candle updates
   - Watchlist: virtualize if needed (only render visible rows)
   - API responses: add ETags and conditional request support
   - Frontend bundle: code-split terminal routes (dynamic imports)
   - Image/font optimization in Next.js config

4. **Keyboard shortcuts:**
   - `1-6` keys switch between terminal sections
   - `↑↓` navigate watchlist
   - `Enter` selects hovered watchlist item
   - `Esc` closes any open modal/dropdown
   - `?` shows keyboard shortcut overlay

5. **Tooltip system:**
   - Every metric label has an info tooltip explaining what it means
   - Tooltips use consistent styling (dark card, small text, max-width 250px)
   - Example: hovering "Funding Z-Score" shows "Standard deviations from 30-day mean funding rate. Values above 2 indicate extreme positive funding (longs paying)."

6. **Documentation:**
   - README.md with: project overview, screenshots, setup instructions, architecture diagram description, API endpoint catalog, environment variables reference
   - Inline code comments on complex logic (analytics calculations, WebSocket handling)
   - API auto-documentation from FastAPI (accessible at /docs)

### Verification Checks — Phase 7
```
□ Error boundary catches and displays errors gracefully (test by throwing in a component)
□ Network failure shows user-friendly error state (not blank screen)
□ All API errors show contextual messages to the user
□ Every data component has a skeleton loader (test by adding artificial delay)
□ Skeletons match the shape of real content
□ Chart maintains 60fps during live updates (check with Chrome DevTools Performance tab)
□ Terminal routes are code-split (check network tab for separate chunks)
□ Keyboard shortcuts 1-6 switch sections correctly
□ ↑↓ navigates watchlist
□ ? shows shortcut overlay
□ Metric tooltips appear on hover for all derivative metrics
□ Tooltips have correct, meaningful explanations
□ README.md has complete setup instructions that work from scratch
□ FastAPI /docs page shows all endpoints with schemas
□ No TypeScript errors
□ No ESLint warnings
□ Lighthouse performance score > 80 on landing page
□ All text is readable (contrast ratio >= 4.5:1 on critical text)
```

---

## Summary: Phase Dependency Chain

```
Phase 0: Scaffolding          → Must pass before anything
Phase 1: Landing + Shell      → Requires Phase 0
Phase 2: Data Layer           → Requires Phase 0
Phase 3: Chart + Watchlist    → Requires Phase 1 + Phase 2
Phase 4: Real-Time WS         → Requires Phase 2 + Phase 3
Phase 5: Derivatives          → Requires Phase 2 + Phase 3
Phase 6: Basis + Analytics    → Requires Phase 5
Phase 7: Polish + Deploy      → Requires all above
```

Phases 4 and 5 can be built in parallel if desired since they have the same prerequisites.

---

## Notes for Claude Code

- **Always run verification checks before moving to the next phase.** List each check and its pass/fail status.
- **If a check fails, fix it immediately.** Do not accumulate failures across phases.
- **Use TypeScript strict mode everywhere.** No `any` types except as a last resort with a comment explaining why.
- **Test API endpoints with curl commands** and include the curl commands in your verification output.
- **Commit after each phase passes** with a message like: `feat: Phase 2 — Data Layer Foundation (all checks pass)`
- **If CoinGlass API access is blocked or unavailable**, create a mock data service that returns realistic fake data in the same format so frontend development is not blocked. Flag this clearly.
- **If any external dependency is unavailable**, document the blocker, implement a mock, and proceed. Do not stop the build.
- **The landing page JSX component is available** — reference it when porting to the Next.js project. Convert inline styles to Tailwind where it makes sense, but keep complex animation logic in CSS.
