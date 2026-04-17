# Scope Alpha Quant Engine

Stateless FastAPI microservice for options analytics: Breeden-Litzenberger
risk-neutral density, vol surface, skew/term structure, vol cone, VRP.
The Vercel backend POSTs raw Deribit chain data here and caches the
computed outputs in Redis.

## Endpoints

All compute endpoints require `X-Quant-Key: $QUANT_API_KEY` when auth is
enabled. `/health` is always unauthenticated.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check + version |
| `POST` | `/rnd` | Breeden-Litzenberger density for one expiration |
| `POST` | `/vol-surface` | Fitted IV surface across expirations |
| `POST` | `/skew` | Per-expiry smile + 25d/10d/5d skew + term-structure shape |
| `POST` | `/vol-cone` | Realized-vol percentile bands (7/30/60/90/180d) |
| `POST` | `/vrp` | Vol risk premium time series + current percentile |

Input and output shapes mirror `types/options.ts` in the frontend — the
Pydantic models in `app/models/` are the authoritative contract.

## Local development

```bash
cd quant-engine
python -m venv .venv
.venv/Scripts/activate     # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements-dev.txt
pytest -v
uvicorn app.main:app --reload --port 8000
```

Then in `scope-alpha/frontend/.env.local`:

```
QUANT_ENGINE_URL=http://localhost:8000
QUANT_ENGINE_API_KEY=            # leave empty to disable auth locally
```

Trigger the options cron: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-options`

## Deploying to Railway

This is a one-time setup. The service runs as a single container with
512MB RAM — plenty for the numpy/scipy workload.

### 1. Install the Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Initialize the project

From the repo root:

```bash
cd quant-engine
railway init                  # choose "Empty Project"
```

### 3. Set the API key

Generate a shared secret and set it on Railway:

```bash
openssl rand -hex 32          # copy the output
railway variables set QUANT_API_KEY=<paste>
```

### 4. Deploy

```bash
railway up
```

Railway builds the Docker image from the `Dockerfile`, runs
`uvicorn app.main:app --host 0.0.0.0 --port 8000`, and exposes the
service. Once the deploy finishes, in the Railway dashboard → Settings
→ Networking → Generate Domain — copy the URL.

### 5. Verify

```bash
curl https://<your-railway-url>/health
# {"status":"ok","version":"1.0.0","auth_enabled":true}

curl -H "X-Quant-Key: <your-key>" -X POST https://<your-railway-url>/vol-cone \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC","daily_closes":[70000,71000,72500,73000],"current_atm_iv":50}'
```

### 6. Wire into Vercel

In the Vercel dashboard → scope-alpha → Settings → Environment Variables
(Production + Preview):

```
QUANT_ENGINE_URL     = https://<your-railway-url>
QUANT_ENGINE_API_KEY = <same key from step 3>
```

Redeploy on Vercel. Trigger the options cron manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-vercel-url>/api/cron/refresh-options
```

Check the logs for lines like `[quant-engine] /vol-surface → 200`.
Open `/terminal/volatility` and every compute-dependent tab should
render real data instead of the "Inert mode" unavailable banner.

## Architecture

```
app/
├── main.py              FastAPI app, routes, auth middleware
├── config.py            Constants (TRADING_DAYS_PER_YEAR=365, defaults)
├── core/
│   ├── black_scholes.py Pricing + IV bisection solver + delta
│   ├── bounds.py        Strike bracket for density integration
│   ├── filters.py       Quote quality filter adapted for Deribit
│   ├── spline.py        UnivariateSpline k=4 + lognormal wing blend
│   ├── density.py       Breeden-Litzenberger RND extraction (crown jewel)
│   ├── statistics.py    Mean/std/skew/percentiles/threshold probs
│   ├── confidence.py    0-100 score → "good"/"fair"/"poor"/"failed"
│   ├── greeks.py        ATM IV + 25d/10d/5d skew + smile + term-structure shape
│   ├── forward.py       Put-call parity forward (diagnostic only)
│   ├── realized_vol.py  Rolling RV with √365 annualization
│   └── surface.py       Multi-expiry orchestration for /vol-surface
└── models/
    ├── inputs.py        Pydantic input models mirroring types/options.ts
    └── outputs.py       Pydantic output models mirroring types/options.ts
```

### Crypto adaptations vs the original equity code

- `TRADING_DAYS_PER_YEAR = 365` (24/7 market) instead of 252
- Default `risk_free_rate = 0.0` (configurable per request)
- No American early-exercise haircut (all crypto options are European)
- No market-hours "off-hours" confidence penalty
- Wider spread tolerance in quote filtering
- IVs can round-trip with Deribit's mark_iv percentage convention; the
  routes auto-normalize percent → decimal at the input boundary

### Error handling

Computation failures never return 500. The route either:

- Returns valid empty output with `quality: "failed"` in the confidence
  block when the density couldn't be built (sparse chain, spline failure).
- Returns 422 with Pydantic details when the input itself is malformed.

The TS client in the frontend treats any non-2xx as `null` → "inert
mode" banner. Explicitly-failed but 200-status responses let the UI
render a graceful "low confidence" state rather than a generic error.

## Tests

```bash
pytest -v
```

12 unit tests cover:

- BS round-trip price → IV → price accuracy
- Put-call parity
- Density integrates to ~1.0, no negatives
- Skewed smile produces heavier left tail
- Sparse input rejected cleanly
- Stats baselines (uniform mean = midpoint, Gaussian skew ≈ 0)

Future: integration test with a saved Deribit BTC chain fixture for
visual regression on density shape.
