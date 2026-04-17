# PRD: Quant Engine Activation & Cinematic Loading

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — lights up 5 dark volatility tabs
**Type:** Standalone sub-phase (executes after Phase 4, before Phase 5)
**Depends on:** Phase 3 pipeline + Phase 4 complete + Quant Engine scaffold in `scope-alpha/quant-engine/`

---

## 1. Context

### Where We Are

The Quant Engine scaffold exists at `scope-alpha/quant-engine/` with:
- `main.py` — FastAPI service with 5 endpoints (`/vol-surface`, `/rnd`, `/skew`, `/vol-cone`, `/vrp`) + `/health`
- Pydantic models matching the TypeScript contracts in `types/options.ts`
- Placeholder math returning realistic-shaped output
- Dockerfile configured for Railway
- `requirements.txt` with pinned dependencies

The frontend pipeline is fully wired:
- `lib/quant-engine.ts` POSTs to 5 endpoints, returns null in inert mode
- `app/api/cron/refresh-options/route.ts` dispatches chain data to the Quant Engine
- 7 volatility tabs exist, showing `UnavailableBanner` for compute-dependent features
- On-demand cache warming populates data on first visit (Cache Warming PRD)

**What's missing:**
1. The Quant Engine is not deployed — `QUANT_ENGINE_URL` is unset in Vercel
2. The placeholder math produces synthetic data, not real Breeden-Litzenberger densities
3. The 3-5 second computation time during on-demand warming shows a generic loading state

### What This PRD Covers

Three deliverables in sequence:

1. **Deploy scaffold with placeholder math** — validate the entire pipeline end-to-end
2. **Replace placeholders with real math** — port `RND.py` core functions into the Quant Engine
3. **Cinematic loading animations** — make the computation time feel intentional and premium

---

## 2. Deliverable 1: Deploy Scaffold to Railway

### Goal

Get placeholder data flowing through the full pipeline: Deribit → cron → Quant Engine → Redis → frontend. All 5 compute-dependent tabs show data (synthetic but realistic) instead of `UnavailableBanner`.

### Steps

This is an ops task, not a code task. No files change — just deployment and configuration.

**2.1 Deploy to Railway:**

```bash
cd scope-alpha/quant-engine
npm install -g @railway/cli    # if not installed
railway login
railway init                    # creates Railway project
railway up                      # deploys Docker container
```

**2.2 Configure Railway:**

In Railway dashboard → project → Variables:
```
QUANT_ENGINE_API_KEY = <generate with: openssl rand -hex 32>
```

In Railway dashboard → Settings → Domains → Generate Domain → copy the URL (e.g., `https://scope-alpha-quant-production.up.railway.app`)

**2.3 Configure Vercel:**

In Vercel dashboard → scope-alpha → Settings → Environment Variables (Production):
```
QUANT_ENGINE_URL      = https://scope-alpha-quant-production.up.railway.app
QUANT_ENGINE_API_KEY  = <same key from Railway>
```

Redeploy on Vercel (Deployments → latest → Redeploy).

**2.4 Validate:**

```bash
# Test Quant Engine directly
curl -H "X-Quant-Key: YOUR_KEY" https://YOUR-RAILWAY-URL/health

# Trigger the options cron
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-VERCEL-URL/api/cron/refresh-options

# Check Vercel logs for successful Quant Engine dispatches
```

Open `/terminal/volatility` — all tabs should show data. Vol Surface shows a heatmap, RND shows a bell-curve-like density, Skew shows term structure, Vol Cone shows percentile bands, VRP shows a time series.

**2.5 Definition of Done (Deliverable 1):**

- [ ] Quant Engine running on Railway, `/health` returns 200
- [ ] `QUANT_ENGINE_URL` and `QUANT_ENGINE_API_KEY` set in Vercel
- [ ] Cron trigger populates all `options:vol-surface:*`, `options:rnd:*`, `options:skew:*`, `options:vol-cone:*`, `options:vrp:*` Redis keys
- [ ] All 5 compute-dependent tabs render data (placeholder math is fine)
- [ ] No `UnavailableBanner` on any volatility tab
- [ ] VolSurfaceSnapshot and IVSnapshot rows in PostgreSQL have non-null computed fields

---

## 3. Deliverable 2: Replace Placeholder Math with Real RND Engine

### Goal

Replace the synthetic placeholder functions with real quantitative computation ported from `RND.py`. After this, the platform shows genuine Breeden-Litzenberger risk-neutral densities, properly fitted vol surfaces, and calibrated confidence scores computed from live Deribit options data.

### Architecture

Refactor `main.py` from a single monolithic file into a proper module structure:

```
quant-engine/
├── app/
│   ├── main.py                    # FastAPI app, routes, auth — thin orchestration
│   ├── config.py                  # Constants (TRADING_DAYS=365, defaults)
│   ├── core/
│   │   ├── __init__.py
│   │   ├── black_scholes.py       # bs_call(), bs_iv_from_price()
│   │   ├── density.py             # build_density() — the crown jewel
│   │   ├── spline.py              # IV spline fitting + wing extrapolation
│   │   ├── statistics.py          # compute_stats(), compute_tail_metrics()
│   │   ├── confidence.py          # compute_confidence_score()
│   │   ├── greeks.py              # slice_greeks() for skew/RR/butterfly
│   │   ├── filters.py             # filter_quotes() adapted for Deribit
│   │   ├── forward.py             # infer_forward() for diagnostics
│   │   ├── bounds.py              # get_strike_bounds()
│   │   ├── realized_vol.py        # Realized vol from daily closes
│   │   └── surface.py             # Multi-expiry surface construction loop
│   └── models/
│       ├── inputs.py              # Pydantic input models (already exists)
│       └── outputs.py             # Pydantic output models (already exists)
├── tests/
│   ├── test_density.py
│   ├── test_black_scholes.py
│   ├── test_statistics.py
│   └── fixtures/
│       └── btc_chain_sample.json
├── requirements.txt
├── Dockerfile
└── README.md
```

### Port Map (RND.py → Quant Engine)

Each function maps from the original `RND.py` with specific adaptations for crypto:

| Source (RND.py) | Target (Quant Engine) | Key Adaptations |
|---|---|---|
| `bs_call()` (line 391-395) | `core/black_scholes.py` | None — pure math |
| `bs_iv_from_price()` (line 982-994) | `core/black_scholes.py` | None — bisection solver |
| `get_strike_bounds()` (line 206-212) | `core/bounds.py` | None — pure math |
| `filter_quotes()` (line 91-141) | `core/filters.py` | Relax `max_spread_ratio` to 3.0 for crypto; adapt column names for Deribit format |
| `infer_forward()` (line 155-201) | `core/forward.py` | Keep as diagnostic only — Deribit provides underlying_price directly |
| `build_density()` (line 304-423) | `core/density.py` | Remove `is_american` EE haircut; use mark_iv directly; configurable risk_free_rate (default 0.0); annualize with √365 not √252 |
| IV spline + wing blend (within build_density) | `core/spline.py` | Extract into separate module; keep UnivariateSpline k=4, lognormal wing blending, monotonicity + convexity enforcement |
| `compute_stats()` (line 429-441) | `core/statistics.py` | None — pure numpy |
| `compute_tail_metrics()` (line 444-498) | `core/statistics.py` | Keep for internal use; map to TS contract fields where they overlap |
| `compute_confidence_score()` (line 501-555) | `core/confidence.py` | Remove `reliable` halving (crypto is 24/7, always "live"); map score to quality label ("good"/"fair"/"poor") per TS contract |
| `slice_greeks()` (line 996-1054) | `core/greeks.py` | Add 10d, 5d skew alongside 25d; produce smile array and term structure per SkewOutput contract |
| `fetch_realized_vol()` (line 63-83) | `core/realized_vol.py` | Accept daily_closes array as input instead of yfinance ticker; annualize with √365 |
| `load_ticker()` loop (line 586-654) | `core/surface.py` | Replace yfinance fetch with input parameter; iterate expirations, call density per slice, interpolate to common strike grid |

### Functions to NOT Port

| Function | Why |
|---|---|
| All matplotlib rendering | Headless service |
| `load_ticker()` data fetching | Replaced by POST input |
| `is_market_open()` | Crypto is 24/7 |
| `generate_trade_ticket()` | Regulatory risk — we don't give trade recommendations |
| `print_report()` formatting | Replaced by JSON response |
| `_prior_snapshot` / `save_snapshot` / `get_deltas` | State handled by frontend Redis |
| All GUI callbacks and sliders | Headless service |

### Endpoint Implementation Details

**`POST /rnd` — the critical path:**

```python
# Simplified flow in the route handler:

async def rnd_endpoint(inp: RNDInput) -> RNDOutput:
    # 1. Convert Deribit IV format (percentage → decimal)
    options = convert_iv_format(inp.options)
    
    # 2. Separate calls and puts, build DataFrames
    calls_df, puts_df = build_dataframes(options, inp.spot_price)
    
    # 3. Filter quotes (adapted for crypto spreads)
    calls_clean, puts_clean, liq_metrics = filter_and_clean(
        calls_df, puts_df, inp.spot_price
    )
    
    # 4. Build density via Breeden-Litzenberger
    K_density, density = build_density(
        spot=inp.spot_price,
        calls=calls_clean,
        puts=puts_clean,
        T=inp.expiry_days / 365,
        r=inp.risk_free_rate,
        is_american=False  # Always False for crypto
    )
    
    # 5. Compute stats, tail metrics, confidence
    stats = compute_stats(K_density, density)
    tail = compute_tail_metrics(K_density, density, inp.spot_price)
    confidence = compute_confidence_score(...)
    
    # 6. Compute Greeks (ATM IV, 25d RR, butterfly)
    greeks = slice_greeks(T, density, forward, reliable=True)
    
    # 7. Build response matching TS contract exactly
    return RNDOutput(
        density=[...],
        statistics=RNDStatistics(
            mean=stats.mean,
            median=stats.median,
            mode=stats.mode,
            std_dev=stats.std,
            skewness=stats.skewness,
            kurtosis=None,
            prob_above_spot=stats.prob_above_spot,
            prob_below_80k=tail.get('p_below_80k'),
            prob_above_90k=tail.get('p_above_90k'),
        ),
        confidence=Confidence(
            method="breeden_litzenberger",
            n_options_used=len(calls_clean) + len(puts_clean),
            strike_range=[K_density[0], K_density[-1]],
            quality=map_score_to_quality(confidence_score),
        ),
    )
```

**`POST /vol-surface`:**

Loops through expirations, calls `build_density()` per slice, interpolates to a common strike grid (same as `load_ticker()` lines 617-639), extracts fitted IVs from the spline, computes RMSE.

**`POST /skew`:**

Calls `slice_greeks()` per expiration, builds smile arrays (IV at 5d, 10d, 25d, 50d delta), computes term structure (ATM IV across expirations), classifies shape as "contango" / "backwardation" / "flat".

**`POST /vol-cone`:**

Accepts daily closes array, computes realized vol for each window (7d, 30d, 60d, 90d, 180d) at every historical position, returns percentile distribution. Overlays current ATM IV. Annualizes with √365.

**`POST /vrp`:**

Aligns IV history and RV history by date, computes VRP series (IV - subsequent RV), current VRP, percentile rank, mean/std.

### Testing

Before deploying the real math:

```bash
cd scope-alpha/quant-engine
pip install -r requirements.txt
pytest tests/ -v
```

**Test cases:**
- `test_density.py` — inject known IV smile → density mass ∈ [0.85, 1.15], no negatives, mean ≈ forward
- `test_black_scholes.py` — round-trip: price → IV → price, < 0.01% error
- `test_statistics.py` — uniform density → mean = midpoint; normal density → skew ≈ 0

### Deploy

```bash
cd scope-alpha/quant-engine
railway up    # Redeploy with real math
```

Trigger the Vercel cron. Check `/terminal/volatility` — placeholder curves replaced with real Breeden-Litzenberger densities.

### Validation

Compare Quant Engine output to original `RND.py` on a saved options chain:
- Density shape should be qualitatively similar (single mode near spot, heavier left tail)
- Statistics (mean, std, skew) within 1%
- Confidence score within 5 points
- If Deribit data is sparse (few strikes, wide spreads), confidence score should correctly degrade to "fair" or "poor"

### Definition of Done (Deliverable 2)

- [ ] `core/` module structure created with all ported functions
- [ ] `build_density()` adapted: no American haircut, √365, configurable r, mark_iv input
- [ ] `compute_confidence_score()` adapted: no off-hours penalty, maps to quality label
- [ ] `slice_greeks()` produces 25d/10d/5d skew, smile array, term structure
- [ ] All placeholder functions in routes replaced with real computation
- [ ] Unit tests passing (density mass, BS round-trip, stats baselines)
- [ ] Deployed to Railway with `railway up`
- [ ] `/rnd` returns real Breeden-Litzenberger density from Deribit BTC chain
- [ ] `/vol-surface` returns fitted surface with RMSE < 1% of mark IVs
- [ ] `/skew` returns per-expiry smile with correct term structure shape
- [ ] `/vol-cone` returns 5 windows of percentile bands
- [ ] `/vrp` returns current VRP with percentile rank
- [ ] Confidence scoring meaningfully discriminates quality (sparse chain → "poor")
- [ ] Response times: /rnd < 500ms, /vol-surface < 3s, /skew < 500ms, /vol-cone < 300ms, /vrp < 200ms

---

## 4. Deliverable 3: Cinematic Loading Animations

### Goal

Replace generic loading spinners on volatility tabs with staged, cinematic animations that narrate the real computation pipeline. The 3-5 second on-demand warming time becomes a feature, not a bug — it feels like the platform is doing serious quantitative work because it is.

### Design Philosophy

- **Dark, data-driven aesthetic** — matches the terminal theme
- **Sequential status messages** — each step of the real pipeline gets a message
- **Visual progression** — something builds on screen as the computation progresses
- **Smooth transition** — when data arrives, the animation morphs into the final chart

### 4.1 Computation Stage Messages

Each volatility tab maps to specific computation stages. The loading component shows these sequentially with ~1 second between each (timing is cosmetic — they advance as fast as the API returns, with minimum display time per step for readability).

**RND tab:**
1. "Fetching options chain from Deribit..."
2. "Filtering illiquid strikes..."
3. "Fitting implied volatility spline..."
4. "Extracting risk-neutral density..."
5. "Computing tail probabilities..."

**Vol Surface tab:**
1. "Fetching options chain across expirations..."
2. "Building density per maturity slice..."
3. "Interpolating to common strike grid..."
4. "Fitting volatility surface..."

**Skew tab:**
1. "Fetching options chain..."
2. "Computing ATM implied volatility..."
3. "Extracting 25-delta risk reversals..."
4. "Building term structure..."

**Vol Cone tab:**
1. "Loading 180 days of historical prices..."
2. "Computing realized volatility windows..."
3. "Calculating percentile distributions..."
4. "Overlaying current implied volatility..."

**VRP tab:**
1. "Loading IV and realized vol history..."
2. "Aligning time series..."
3. "Computing volatility risk premium..."
4. "Ranking current VRP percentile..."

**GEX tab (Phase 4):**
1. "Fetching options chain with Greeks..."
2. "Aggregating gamma exposure by strike..."
3. "Detecting gamma flip level..."
4. "Classifying dealer positioning regime..."

### 4.2 Loading Component

**New component:** `components/volatility/ComputeLoader.tsx`

```tsx
interface ComputeLoaderProps {
  stages: string[];              // The status messages for this tab
  isLoading: boolean;            // True while data is being fetched
  onComplete?: () => void;       // Called when all stages shown + data ready
}

function ComputeLoader({ stages, isLoading }: ComputeLoaderProps) {
  const [currentStage, setCurrentStage] = useState(0);
  
  // Advance stages with minimum 800ms display per stage
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setCurrentStage(prev => Math.min(prev + 1, stages.length - 1));
    }, 800);
    return () => clearInterval(timer);
  }, [isLoading, stages.length]);
  
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      {/* Animated visual element */}
      <ComputeAnimation currentStage={currentStage} totalStages={stages.length} />
      
      {/* Stage messages */}
      <div className="mt-8 space-y-2">
        {stages.map((stage, i) => (
          <div
            key={i}
            className={cn(
              "text-sm font-mono transition-all duration-500",
              i < currentStage && "text-emerald-400/60",      // completed
              i === currentStage && "text-emerald-400",         // active — bright
              i > currentStage && "text-white/20",              // upcoming — dim
            )}
          >
            <span className="mr-2">
              {i < currentStage ? "✓" : i === currentStage ? "▸" : "○"}
            </span>
            {stage}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4.3 Animated Visual Element

**New component:** `components/volatility/ComputeAnimation.tsx`

**Recommended approach: Building density curve**

A SVG canvas that progressively draws a probability density curve from left to right. It starts as scattered data points (representing raw options data), then a spline curve emerges through them (representing the IV fitting), then the curve fills in as an area chart (representing the density). The animation progresses through the stages.

```
Stage 1-2: Scattered dots appear randomly across the canvas
           (representing raw strike/IV data points)

Stage 3:   A smooth curve starts drawing through the dots
           from left to right (spline fitting)

Stage 4:   The area under the curve fills with a gradient
           (density extraction — the RND emerges)

Stage 5:   Vertical lines appear at key percentiles,
           a spot price marker drops in
           (statistics computed)

Complete:  Animation morphs seamlessly into the real chart
           using the actual data that just loaded
```

**Alternative (simpler but still premium):** A pulsing grid of numbers (strike prices and IVs) that shimmer and rearrange, gradually coalescing into a curve shape. Think "The Matrix meets Bloomberg Terminal."

**Alternative (simplest):** A horizontal progress bar styled as a vol surface — colored segments fill in as stages complete, going from dark to vibrant (plasma colormap gradient). Clean, fast to build, still looks intentional.

### 4.4 Integration with Existing Hooks

Each volatility hook (useVolSurface, useRND, useSkew, useVolCone, useVRP) already returns `{ data, isLoading, unavailable }`. The view components currently show a spinner or UnavailableBanner based on these states.

Replace the loading state rendering in each view:

```tsx
// Before (generic):
if (isLoading) return <Spinner />;

// After (cinematic):
if (isLoading) return (
  <ComputeLoader
    stages={RND_STAGES}
    isLoading={true}
  />
);
```

Define stage arrays as constants:

```typescript
// lib/options/loading-stages.ts

export const RND_STAGES = [
  "Fetching options chain from Deribit...",
  "Filtering illiquid strikes...",
  "Fitting implied volatility spline...",
  "Extracting risk-neutral density...",
  "Computing tail probabilities...",
];

export const VOL_SURFACE_STAGES = [
  "Fetching options chain across expirations...",
  "Building density per maturity slice...",
  "Interpolating to common strike grid...",
  "Fitting volatility surface...",
];

export const SKEW_STAGES = [...];
export const VOL_CONE_STAGES = [...];
export const VRP_STAGES = [...];
export const GEX_STAGES = [...];
export const DEX_STAGES = [...];
export const VANNA_CHARM_STAGES = [...];
```

### 4.5 Transition to Real Data

When the data arrives (hook returns `isLoading: false` with actual data), the animation should transition smoothly rather than pop:

1. Final stage message shows "✓" checkmark
2. Brief pause (300ms)
3. Animation canvas fades out with a slight scale-down
4. Real chart fades in with a slight scale-up
5. Total transition: ~500ms

Use CSS transitions or Framer Motion (if already in the project) for the fade.

### 4.6 Subsequent Visits (Cache Hit)

When data is cached (hook returns `isLoading: false` immediately), skip the animation entirely — show the chart directly. The cinematic loading only plays when actual computation is happening (cache miss → on-demand warming → Quant Engine round trip).

To detect "real loading" vs "cache hit loading":
- If data arrives within 500ms → it was cached → don't show animation, show chart immediately
- If data takes > 500ms → it's computing → show the staged animation

```tsx
const [showAnimation, setShowAnimation] = useState(false);

useEffect(() => {
  if (isLoading) {
    // Wait 500ms before showing animation — if data arrives before then, skip it
    const timer = setTimeout(() => setShowAnimation(true), 500);
    return () => clearTimeout(timer);
  } else {
    setShowAnimation(false);
  }
}, [isLoading]);
```

### 4.7 Mobile Considerations

- Animation canvas reduces to a smaller height on mobile
- Stage messages use shorter text on narrow screens
- Animation respects `prefers-reduced-motion` — falls back to a simple progress bar with stage text

---

## 5. File Structure

### New Files

```
# Quant Engine (Deliverable 2 — refactor from monolithic main.py)
quant-engine/app/config.py
quant-engine/app/core/__init__.py
quant-engine/app/core/black_scholes.py
quant-engine/app/core/density.py
quant-engine/app/core/spline.py
quant-engine/app/core/statistics.py
quant-engine/app/core/confidence.py
quant-engine/app/core/greeks.py
quant-engine/app/core/filters.py
quant-engine/app/core/forward.py
quant-engine/app/core/bounds.py
quant-engine/app/core/realized_vol.py
quant-engine/app/core/surface.py
quant-engine/tests/test_density.py
quant-engine/tests/test_black_scholes.py
quant-engine/tests/test_statistics.py
quant-engine/tests/fixtures/btc_chain_sample.json

# Frontend (Deliverable 3 — loading animations)
components/volatility/ComputeLoader.tsx
components/volatility/ComputeAnimation.tsx
lib/options/loading-stages.ts
```

### Files to Modify

```
# Quant Engine
quant-engine/app/main.py                          # Refactor to import from core/ modules

# Frontend — each volatility view component
components/volatility/VolSurfaceView.tsx           # Replace spinner with ComputeLoader
components/volatility/RNDView.tsx                  # Replace spinner with ComputeLoader
components/volatility/SkewView.tsx                 # Replace spinner with ComputeLoader
components/volatility/TermStructureView.tsx         # Replace spinner with ComputeLoader
components/volatility/VolConeView.tsx              # Replace spinner with ComputeLoader
components/volatility/VRPView.tsx                  # Replace spinner with ComputeLoader
components/volatility/GEXView.tsx                  # Replace spinner with ComputeLoader (Phase 4)
components/volatility/DEXView.tsx                  # Replace spinner with ComputeLoader (Phase 4)
components/volatility/VannaCharmView.tsx            # Replace spinner with ComputeLoader (Phase 4)
```

---

## 6. Implementation Order

### Deliverable 1 (Ops — no code changes)
1. Deploy scaffold to Railway
2. Configure Railway env vars
3. Configure Vercel env vars
4. Trigger cron, validate all tabs populate

### Deliverable 2 (Quant Engine math — Python only)
5. Create `core/` module structure
6. Port `black_scholes.py` + `bounds.py` (pure math, no adaptation)
7. Port `filters.py` (adapt for Deribit format)
8. Port `density.py` + `spline.py` (the crown jewel — apply crypto adaptations)
9. Port `statistics.py` + `confidence.py` (remove off-hours penalty)
10. Port `greeks.py` (extend for 10d/5d skew, smile arrays)
11. Build `realized_vol.py` + `surface.py` (new code)
12. Update `main.py` routes to call `core/` modules instead of placeholder functions
13. Write and run unit tests
14. Deploy to Railway with `railway up`
15. Trigger Vercel cron, validate real data on all tabs

### Deliverable 3 (Frontend — TypeScript/React only)
16. Create `lib/options/loading-stages.ts` with stage arrays per tab
17. Build `ComputeAnimation.tsx` (the visual element)
18. Build `ComputeLoader.tsx` (stages + animation + transition logic)
19. Integrate into all volatility view components
20. Add 500ms delay gate (skip animation on cache hits)
21. Test: clear cache, visit tab, confirm animation plays then transitions to chart
22. Test: revisit tab with warm cache, confirm chart loads instantly (no animation)

---

## 7. Definition of Done

### Pipeline (Deliverable 1)
- [ ] Quant Engine running on Railway
- [ ] All 5 compute-dependent volatility tabs show data
- [ ] End-to-end: Deribit → cron → Quant Engine → Redis → frontend verified

### Real Math (Deliverable 2)
- [ ] `RND.py` core functions ported to `core/` modules
- [ ] All crypto adaptations applied (no American haircut, √365, configurable r)
- [ ] Unit tests passing
- [ ] `/rnd` returns real Breeden-Litzenberger density
- [ ] Confidence scoring discriminates quality correctly
- [ ] Response times within budget

### Loading Animations (Deliverable 3)
- [ ] ComputeLoader component with sequential stage messages
- [ ] ComputeAnimation visual element (at minimum: progress-bar style; stretch: building curve)
- [ ] All volatility views use ComputeLoader instead of generic spinner
- [ ] Animation only plays on real computation (>500ms load), skips on cache hit
- [ ] Smooth transition from animation to real chart
- [ ] Mobile-responsive
- [ ] Respects `prefers-reduced-motion`
- [ ] Stage messages are accurate to the real computation pipeline

---

## 8. What This Enables

After all three deliverables:

- Every volatility tab shows **real quantitative analytics** computed from live Deribit data — not placeholders, not synthetic
- The confidence scoring tells users when to trust the data and when the chain is too sparse
- The loading experience reinforces the "institutional-grade" positioning — users see the computational pipeline narrated in real-time
- The Quant Engine is deployed and extensible — future endpoints (flow-based GEX, additional assets) are just new `core/` modules + route registrations
- Phase 5 (On-Chain) can proceed knowing the options analytics layer is fully operational

---

*Deliverables 1 and 2 are for the Quant Engine (Python + ops). Deliverable 3 is for the frontend (TypeScript/React). They can be executed in parallel — the loading animations work with both placeholder and real data.*
