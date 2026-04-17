# PRD: Quant Engine — RND Engine Integration

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — unlocks all compute-dependent volatility tabs in Phase 3
**Type:** Standalone (Quant Partner deliverable)
**Depends on:** Phase 3 options pipeline deployed (Deribit data flowing, QuantEngineClient wrapper built)

---

## 1. What We Have

### The RND Engine (`RND.py` — 2,100 lines)

A comprehensive risk-neutral density engine originally built as a matplotlib desktop application for US equity options (SPX, ETFs). It fetches options data via yfinance, computes volatility surfaces, extracts risk-neutral probability distributions via Breeden-Litzenberger, calculates Greeks and tail risk metrics, and generates trade tickets for credit spread strategies.

### Core Computation Modules Inside RND.py

| Function | Lines | What It Does | Reusable? |
|---|---|---|---|
| `filter_quotes()` | 91–141 | Pre-filters options data: removes bad spreads, intrinsic violations, low OI. Returns liquidity metrics. | Yes — adapt for Deribit format |
| `infer_forward()` | 155–201 | Infers forward price from put-call parity using near-ATM liquid pairs. Returns median forward, IQR, pair count. | Yes — but Deribit provides mark price directly |
| `get_strike_bounds()` | 206–212 | Computes maturity-dependent strike bounds using ATM IV and n-sigma range. | Yes — reuse directly |
| `fetch_and_clean()` | 217–299 | Fetches one expiration from yfinance, applies quality filters, infers forward, classifies reliability. | Replace — data comes from Deribit pipeline, not yfinance |
| `build_density()` | 303–423 | **The core RND engine.** Takes cleaned calls/puts, fits IV spline, applies wing extrapolation with lognormal tail blend, computes BS call prices, enforces monotonicity + convexity, takes second derivative → density. Clips negative densities. | Yes — this is the crown jewel. Adapt input format. |
| `compute_stats()` | 429–441 | Computes mean, std, skewness, 5th/95th percentiles from density. | Yes — reuse directly |
| `compute_tail_metrics()` | 444–498 | Computes P[ret < -1%/-2%/-3%], expected shortfall at 1% and 5%, left tail mass. | Yes — reuse directly |
| `compute_confidence_score()` | 501–555 | Quality score 0–100 based on mass, forward error, IQR, retention %, spread quality. | Yes — adapt for Deribit data quality signals |
| `slice_greeks()` | 996–1054 | Computes ATM IV, 25-delta call/put strikes, 25-delta risk reversal, butterfly spread. Uses bisection IV solver. | Yes — this IS the skew computation |
| `fetch_realized_vol()` | 63–86 | Computes annualized realized vol from daily closes for multiple windows. | Yes — input changes from yfinance to our CandleHistory data |
| `bs_iv_from_price()` | 982–994 | Black-Scholes IV solver (bisection method, 60 iterations). | Yes — reuse directly |
| `bs_call()` | 391–395 | Black-Scholes call pricing (vectorized numpy). | Yes — reuse directly |
| `load_ticker()` | 562–653 | Orchestrates full pipeline: fetch all expirations, clean, build densities, interpolate to common grid. | Replace — orchestration happens in the FastAPI endpoint, not yfinance |
| `draw_2d_slice()` | 829–910 | Matplotlib rendering of 2D density slice. | Remove — frontend handles rendering |
| `update_3d()` | 915–939 | Matplotlib 3D surface rendering. | Remove — frontend handles rendering |
| `print_report()` | 944–1200+ | Generates text report with term structure, Greeks, tail metrics. | Extract the computation logic, remove print/text formatting |
| `generate_trade_ticket()` | ~1700–2038 | SPX credit spread trade ticket generator. | Remove entirely — SPX-specific, not relevant to crypto platform |
| Matplotlib UI code | ~678–800, 2040–2162 | All figure setup, sliders, buttons, callbacks. | Remove entirely — web frontend replaces this |

### What's Excellent About This Code

- **The `build_density()` function is production-quality.** It handles wing extrapolation with lognormal tail blending (not just flat extrapolation), enforces no-arbitrage constraints (monotonicity + convexity on call prices), clips negative densities, and uses a 4th-order spline with adaptive smoothing. This is significantly more robust than a naive Breeden-Litzenberger implementation.
- **The confidence scoring system** gives users a quality metric for each density slice — critical for an analytics platform where users need to know how much to trust the output.
- **The tail metrics** (Expected Shortfall, tail probabilities) go beyond basic RND statistics and provide risk management–relevant outputs.
- **The Greeks extraction** (`slice_greeks`) computes 25-delta risk reversals and butterflies correctly — these are the skew metrics the Phase 3 PRD specs.

### What Needs to Change for Crypto

| Aspect | Current (Equity) | Target (Crypto) |
|---|---|---|
| Data source | yfinance (US equity options) | Deribit API (already fetched by Phase 3 cron) |
| Option style | American + European (with early exercise haircut) | European only (crypto options are European-style) |
| Market hours | Checks NYSE hours, degrades quality off-hours | 24/7 — always "live." Remove market hours logic. |
| Forward price | Inferred from put-call parity | Deribit provides `underlying_price` and `mark_price` directly |
| IV source | Computed from bid/ask mid prices | Deribit provides `mark_iv`, `bid_iv`, `ask_iv` directly |
| Risk-free rate | Hardcoded 5% (US treasuries) | Use crypto-specific: ~0% or funding-rate-implied |
| Strike format | Dollar amounts (e.g., 5800 for SPX) | Dollar amounts (e.g., 80000 for BTC) — same concept, different scale |
| Instrument naming | yfinance format | Deribit format: `BTC-28MAR26-90000-C` (already parsed by Phase 3) |
| UI | Matplotlib interactive desktop app | FastAPI endpoints → JSON responses → web frontend |
| Trade tickets | SPX credit spread generator | Remove entirely — platform doesn't give trading advice |

---

## 2. Target Architecture

The RND Engine becomes the **Quant Engine** — a FastAPI service deployed on Railway/Fly.io that Phase 3 already has a client wrapper for (`lib/quant-engine.ts` with `QuantEngineClient`).

```
┌─────────────────────────────────┐
│  QUANT ENGINE (FastAPI)         │
│  Railway / Fly.io               │
│                                 │
│  POST /health          → 200 OK │
│  POST /vol-surface     → fitted surface + summary │
│  POST /rnd             → density + stats + tails  │
│  POST /skew            → smile + RR + term struct │
│  POST /vol-cone        → percentile bands + RV    │
│  POST /vrp             → IV-RV spread series      │
│                                 │
│  Python 3.11+                   │
│  numpy, scipy, fastapi, uvicorn │
│  NO database access             │
│  NO external API calls          │
│  Stateless — all data via POST  │
└─────────────────────────────────┘
```

The Vercel cron (`refresh-options`) sends raw Deribit chain data to the Quant Engine. The engine returns computed results. The Vercel backend caches them in Redis and serves to the frontend.

---

## 3. Decomposition Plan

### Step 1: Extract Core Math Modules

Create a Python package structure:

```
quant-engine/
  app/
    main.py                    # FastAPI app, health check, CORS
    config.py                  # Constants (risk-free rate, default params)
    routes/
      vol_surface.py           # POST /vol-surface
      rnd.py                   # POST /rnd
      skew.py                  # POST /skew
      vol_cone.py              # POST /vol-cone
      vrp.py                   # POST /vrp
    core/
      black_scholes.py         # bs_call(), bs_iv_from_price()
      density.py               # build_density() adapted for Deribit input
      statistics.py            # compute_stats(), compute_tail_metrics()
      confidence.py            # compute_confidence_score() adapted
      greeks.py                # slice_greeks() → skew, RR, butterfly
      filters.py               # filter_quotes() adapted for Deribit
      forward.py               # infer_forward() (kept as validation, not primary)
      bounds.py                # get_strike_bounds()
      realized_vol.py          # realized vol from daily closes
      spline.py                # IV spline fitting + wing extrapolation
    models/
      inputs.py                # Pydantic input models
      outputs.py               # Pydantic output models
  requirements.txt
  Dockerfile
  README.md
```

### Step 2: Adapt `build_density()` for Deribit Data

The current `build_density()` takes raw calls/puts DataFrames with `strike`, `impliedVolatility`, `bid`, `ask` columns. For Deribit:

**Input adaptation:**
```python
# Current (yfinance):
# calls DataFrame with: strike, impliedVolatility, bid, ask, openInterest
# puts DataFrame with: same

# New (Deribit via Phase 3 cron):
# List of OptionsChainEntry dicts:
# { strike, markIV, bidIV, askIV, optionType, openInterest, volume24h, underlyingPrice }
```

**Key changes inside build_density():**

1. **IV source:** Use `mark_iv` from Deribit directly instead of computing from bid/ask mid prices. Deribit's `mark_iv` is already cleaned and arbitrage-free. This actually simplifies the pipeline — skip the bid/ask mid computation, go straight to the spline fitting on mark IV.

2. **Remove American early exercise adjustment:** The `if is_american and T > 2/52: ee_haircut = ...` block is irrelevant for crypto (all European-style). Remove entirely.

3. **Forward price:** Use `underlying_price` from Deribit instead of `infer_forward()`. The put-call parity forward can still be computed as a validation check (if it diverges significantly from Deribit's underlying price, flag quality concern), but it's not the primary forward.

4. **Risk-free rate:** Change from hardcoded 0.05 to a configurable parameter (default 0.0 for crypto, or use the funding-rate-implied carry). Accept as input so the Vercel backend can pass the current rate.

5. **The core Breeden-Litzenberger computation is unchanged:**
   - Fit IV spline across strikes (UnivariateSpline, k=4)
   - Extrapolate wings with lognormal tail blend (keep this — it's excellent)
   - Compute BS call prices from smoothed IV
   - Enforce monotonicity + convexity on call prices
   - Take second derivative → density
   - Clip negative densities
   - Normalize

### Step 3: Adapt `slice_greeks()` for Skew Endpoint

This function computes ATM IV, 25-delta call/put strikes, risk reversal, and butterfly. It works by:
1. Finding ATM strike (closest to forward)
2. Computing ATM call price from density, then solving for ATM IV
3. Scanning strikes to find 25-delta call and put strikes
4. Computing 25-delta call and put IVs from density-derived option prices
5. RR = IV_call_25d - IV_put_25d, BF = (IV_call + IV_put)/2 - ATM_IV

**For crypto adaptation:**
- Same algorithm, but can also use Deribit's provided `mark_iv` per strike as a cross-check
- Add 10-delta and 5-delta skew computation (same approach, different delta targets)
- Add per-expiry smile output (IV vs delta curve)
- Add term structure output (ATM IV across expirations)

### Step 4: New Endpoints Not in Original Code

**`POST /vol-cone`** — not in the original `RND.py`. Build from scratch:
```python
def compute_vol_cone(daily_closes: list[float], current_atm_iv: float):
    log_returns = np.diff(np.log(daily_closes))
    
    windows = [7, 30, 60, 90, 180]
    result = []
    
    for w in windows:
        if len(log_returns) < w:
            continue
        
        # Compute RV for all possible w-day windows in history
        all_rvs = []
        for i in range(len(log_returns) - w + 1):
            rv = np.std(log_returns[i:i+w]) * np.sqrt(365)  # 365 for crypto (24/7)
            all_rvs.append(rv)
        
        current_rv = all_rvs[-1]
        percentiles = np.percentile(all_rvs, [10, 25, 50, 75, 90])
        
        result.append({
            "days": w,
            "current_rv": float(current_rv),
            "percentiles": {
                "p10": float(percentiles[0]),
                "p25": float(percentiles[1]),
                "p50": float(percentiles[2]),
                "p75": float(percentiles[3]),
                "p90": float(percentiles[4]),
            }
        })
    
    # IV percentile relative to 30d RV history
    rv_30d_history = [r for r in all_rvs]  # from the 30d window
    iv_pct = float(np.searchsorted(np.sort(rv_30d_history), current_atm_iv) 
                   / len(rv_30d_history) * 100)
    
    return {
        "windows": result,
        "current_atm_iv": current_atm_iv,
        "iv_percentile_vs_rv30d": iv_pct,
    }
```

**`POST /vrp`** — also new. Build from scratch:
```python
def compute_vrp(iv_history: list[dict], rv_history: list[dict]):
    # Align dates
    # VRP = IV - subsequent realized vol
    # Return time series + current VRP + percentile
    ...
```

**`POST /vol-surface`** — adapts `load_ticker()`'s orchestration loop. For each expiration in the input chain:
1. Separate calls and puts
2. Apply `filter_quotes()` (adapted)
3. Run `build_density()` (adapted)
4. Extract fitted IV values from the spline
5. Return the surface grid + fit quality metrics

### Step 5: Pydantic Input/Output Models

**Input for `/rnd`:**
```python
class RNDInput(BaseModel):
    asset: str                           # "BTC"
    spot_price: float                    # Current spot
    expiry_date: str                     # "2026-05-01"
    expiry_days: int                     # Days to expiry
    risk_free_rate: float = 0.0          # Default 0 for crypto
    options: list[OptionEntry]           # The chain for this expiry

class OptionEntry(BaseModel):
    strike: float
    mark_iv: float                       # Deribit mark IV (percentage, e.g., 52.3)
    bid_iv: float | None = None
    ask_iv: float | None = None
    option_type: str                     # "call" or "put"
    open_interest: float = 0
    volume_24h: float = 0
```

**Output for `/rnd`:**
```python
class RNDOutput(BaseModel):
    asset: str
    expiry_date: str
    expiry_days: int
    spot_price: float
    density: list[DensityPoint]          # [{price, probability}]
    statistics: RNDStatistics
    tail_metrics: TailMetrics
    confidence: ConfidenceMetrics
    diagnostics: Diagnostics

class RNDStatistics(BaseModel):
    mean: float
    std_dev: float
    skewness: float
    p5: float                            # 5th percentile price
    p95: float                           # 95th percentile price
    prob_above_spot: float               # P[S_T > spot]
    prob_below_spot: float

class TailMetrics(BaseModel):
    p_down_1pct: float                   # P[ret < -1%]
    p_down_2pct: float                   # P[ret < -2%]
    p_down_3pct: float                   # P[ret < -3%]
    es_1pct_ret: float | None            # Expected shortfall at 1%
    es_5pct_ret: float | None            # Expected shortfall at 5%

class ConfidenceMetrics(BaseModel):
    score: float                         # 0-100
    mass: float                          # Should be ~1.0
    forward_error: float                 # |E[S_T] - forward|
    n_strikes_used: int
    method: str = "breeden_litzenberger"
    quality: str                         # "good" / "fair" / "poor"
```

### Step 6: Remove Everything Not Needed

**Delete entirely:**
- All matplotlib imports and figure/axis setup (lines 1–11, 678–800, 2040–2162)
- All slider/button/callback code
- `draw_2d_slice()`, `update_3d()`, `update_mat_display()`, `update_strike_display()`
- `generate_trade_ticket()` — SPX credit spread logic, not relevant
- `is_market_open()` — crypto is 24/7
- `load_ticker()` — replaced by FastAPI endpoint orchestration
- `_prior_snapshot` / `save_snapshot()` / `get_deltas()` — change tracking is handled by the Vercel persistence layer
- All yfinance imports and calls
- The `if __name__` / `plt.show()` entry point

**What remains (~600-800 lines of core math):**
- `filter_quotes()` (adapted)
- `infer_forward()` (as validation)
- `get_strike_bounds()`
- `build_density()` (adapted — the core engine)
- `compute_stats()`
- `compute_tail_metrics()`
- `compute_confidence_score()` (adapted)
- `slice_greeks()` → becomes the skew endpoint
- `bs_call()`, `bs_iv_from_price()`

---

## 4. FastAPI Service Specification

### Endpoints

| Method | Path | Purpose | Input | Output |
|---|---|---|---|---|
| GET | `/health` | Health check | — | `{ status: "ok", version: "1.0.0" }` |
| POST | `/vol-surface` | Fit vol surface across all expirations | Full chain + spot | Fitted surface grid + quality |
| POST | `/rnd` | RND for single expiration | Single-expiry chain + spot | Density + stats + tails + confidence |
| POST | `/skew` | Smile + RR + term structure | Full chain + spot | Per-expiry skew + term structure |
| POST | `/vol-cone` | Realized vol percentiles | Daily closes + current ATM IV | Percentile bands per window |
| POST | `/vrp` | Volatility risk premium | IV history + RV history | VRP series + current + percentile |

### Authentication

Header: `X-Quant-Key: {shared_secret}`

Middleware checks this on every request except `/health`. Returns 401 if missing/wrong.

### Error Handling

- Input validation errors → 422 with Pydantic detail
- Computation failures (not enough data, spline fit fails) → 200 with `"quality": "failed"` and null density
- Never return 500 — always a structured JSON response

### Performance Targets

| Endpoint | Target Latency | Notes |
|---|---|---|
| `/rnd` (single expiry) | < 200ms | ~30-60 strikes, spline + BS + derivative |
| `/vol-surface` (full chain) | < 2s | Loops over 5-8 expirations |
| `/skew` | < 500ms | Greeks extraction per expiry |
| `/vol-cone` | < 300ms | Array operations on daily closes |
| `/vrp` | < 100ms | Simple arithmetic on two time series |

---

## 5. Deployment

### Requirements

```
# requirements.txt
fastapi==0.110.0
uvicorn==0.27.0
numpy==1.26.4
scipy==1.12.0
pandas==2.2.0
pydantic==2.6.0
```

**No yfinance, no matplotlib, no pytz** — all removed.

### Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Railway / Fly.io Deployment

- Single instance, 512MB RAM
- Health check: `GET /health`
- Environment variable: `QUANT_API_KEY` (shared secret, matches Vercel's `QUANT_ENGINE_API_KEY`)
- No database access, no external API calls — pure computation

### Vercel Integration

Once deployed, set in Vercel:
```env
QUANT_ENGINE_URL=https://scope-alpha-quant.up.railway.app
QUANT_ENGINE_API_KEY=<shared_secret>
```

The existing `QuantEngineClient` in `lib/quant-engine.ts` (built in Phase 3) immediately starts sending data to the engine. All compute-dependent volatility tabs light up with no frontend code changes.

---

## 6. Annualization Note: 365 vs 252

The original code uses `np.sqrt(252)` for annualizing realized vol (252 US trading days). Crypto markets trade 365 days/year. All annualization factors must change:

- Realized vol: `np.sqrt(365)` instead of `np.sqrt(252)`
- Time to expiry: already in calendar days (correct)
- Make this configurable via `config.py`: `TRADING_DAYS_PER_YEAR = 365`

---

## 7. Testing & Validation

### Unit Tests

For each core function, port the implicit test cases from the original code:

- `build_density()`: feed known IV smile → verify density sums to ~1.0, mean ≈ forward, no negative values
- `compute_stats()`: feed uniform density → verify correct mean, std
- `compute_tail_metrics()`: feed normal density → verify P[< -2%] matches analytical result
- `bs_call()` + `bs_iv_from_price()`: round-trip test — compute call price from known IV, then recover IV from price, verify < 0.01% error
- `slice_greeks()`: feed symmetric smile → verify RR ≈ 0, BF > 0

### Integration Tests

- Send a realistic BTC options chain (saved from Deribit) to `/rnd` → verify density shape is reasonable (single mode near spot, smooth tails)
- Send full chain to `/vol-surface` → verify fitted IVs are within 1% of input mark IVs on average
- Send edge case: very short expiry (1 day) → verify graceful handling (may return low confidence, not crash)
- Send edge case: very few strikes (< 10) → verify returns `quality: "poor"` not error

### Cross-Validation Against Original

Run the original `RND.py` on a saved SPX options chain. Run the adapted Quant Engine on the same data (with `r=0.05`, `annualization=252` to match). Verify:
- Density shapes match visually
- Statistics (mean, std, skew, p5, p95) within 1%
- Tail metrics within 5% (small differences expected from adaptation)

---

## 8. Definition of Done

- [ ] FastAPI service runs locally with all 5 computation endpoints + health check
- [ ] `POST /rnd` returns valid density with statistics, tail metrics, and confidence score
- [ ] `POST /vol-surface` returns fitted surface across multiple expirations
- [ ] `POST /skew` returns per-expiry smile, 25d RR, butterfly, and term structure
- [ ] `POST /vol-cone` returns percentile bands for 7/30/60/90/180-day windows
- [ ] `POST /vrp` returns VRP time series with current percentile
- [ ] All American option adjustments removed
- [ ] All matplotlib/yfinance/market-hours code removed
- [ ] Annualization uses 365 (crypto) not 252 (equity)
- [ ] Risk-free rate is configurable (default 0.0)
- [ ] Service deployed on Railway or Fly.io
- [ ] `QUANT_ENGINE_URL` set in Vercel → compute-dependent tabs show real data
- [ ] Density mass is within [0.85, 1.15] for BTC/ETH current chains
- [ ] Confidence score produces meaningful quality discrimination
- [ ] Unit tests pass for all core math functions
- [ ] Integration test with real Deribit data produces reasonable output
- [ ] Service responds within latency targets (< 2s for full surface)
- [ ] README.md documents all endpoints, input/output formats, deployment steps

---

## 9. What This Unlocks

Once deployed and connected via `QUANT_ENGINE_URL`:

- **Phase 3 volatility tabs all light up:** Vol Surface (2D heatmap populated with fitted IVs), RND (probability density curves per expiry with statistics), Skew (smile + risk reversal charts), Term Structure (ATM IV across expirations), Vol Cone (percentile bands with IV overlay), VRP (IV-RV spread chart)
- **Phase 4 (Options Microstructure):** The Quant Engine gains GEX/DEX/vanna/charm endpoints — same service, additional routes
- **Phase 6 (Convergence):** IV regime and skew inputs feed the convergence scorer
- **Screener:** BTC + ETH rows get ATM IV and skew columns

The RND Engine is the most mathematically sophisticated component of the entire platform. Getting it deployed is the single highest-impact milestone for product differentiation.

---

*This PRD is for the quant partner. It specifies what to extract from `RND.py`, how to restructure it as a FastAPI service, and what the Vercel backend expects. The quant partner owns development, testing, and deployment. The engineering side (Vercel) is already wired to consume the output via `QuantEngineClient`.*
