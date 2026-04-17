# Scope Alpha — Quant Engine

FastAPI microservice for volatility analytics. The Vercel frontend calls these five endpoints over HTTP to compute vol surface, RND, skew, vol cone, and VRP.

Currently ships with placeholder math so the end-to-end pipeline works out of the box. Replace placeholders one endpoint at a time with real Python implementations.

---

## Deploy to Railway (recommended — $5/month free credit, ~10 min setup)

1. **Create a Railway account** at https://railway.app (log in with GitHub).

2. **Install the Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Deploy from this directory**:
   ```bash
   cd scope-alpha/quant-engine
   railway init          # create a new Railway project
   railway up            # build the Dockerfile + deploy
   ```

4. **Generate a shared secret** for service-to-service auth:
   ```bash
   openssl rand -hex 32
   # Copy the output — you'll paste it into TWO places: Railway and Vercel
   ```

5. **Set the env var in Railway** (dashboard → project → Variables):
   ```
   QUANT_ENGINE_API_KEY  <paste the openssl output>
   ```

6. **Grab the public URL** from the Railway dashboard (Settings → Domains → Generate Domain). Should look like `https://quant-engine-production-abc123.up.railway.app`.

7. **Test it works**:
   ```bash
   curl https://<your-railway-url>/health
   # Expected: {"ok":true,"version":"0.1.0"}
   ```

8. **Add the same two env vars to Vercel** (project → Settings → Environment Variables, production):
   ```
   QUANT_ENGINE_URL       https://<your-railway-url>
   QUANT_ENGINE_API_KEY   <same secret as step 5>
   ```

9. **Redeploy Vercel** (Deployments → latest → ⋯ → Redeploy). The `QuantEngineClient` in the Next.js app auto-detects `QUANT_ENGINE_URL` and switches from "inert mode" to real HTTP calls.

10. **Trigger the options cron manually** from the Vercel dashboard → Crons → `refresh-options` → Run. After ~10 seconds the `/terminal/volatility` tabs populate.

---

## Local development

```bash
cd scope-alpha/quant-engine
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export QUANT_ENGINE_API_KEY=local-test
uvicorn main:app --reload --port 8000
```

Test:
```bash
curl http://localhost:8000/health
curl -X POST http://localhost:8000/rnd \
  -H "X-Quant-Key: local-test" \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC","spot_price":84000,"expiry_date":"2026-05-01","expiry_days":14,"risk_free_rate":0.05,"options":[]}'
```

---

## Replacing the placeholder math

Every `compute_*` function in [main.py](main.py) currently returns realistic-shaped placeholder output so the Vercel frontend works end-to-end. When you're ready to plug in the real Python:

1. Open `main.py`, find the function (e.g. `compute_rnd`).
2. Keep the function signature — `(inp: RNDInput) -> RNDOutput`.
3. Replace the body with your real math. The input fields (`inp.spot_price`, `inp.options`, etc.) are Pydantic-validated so you can trust their types.
4. Return a populated `RNDOutput` (or the respective output class).
5. Commit, `railway up` to redeploy.
6. Trigger the Vercel `refresh-options` cron from the Vercel dashboard — the next cached RND result will be your real math.

### Pydantic model recap (keep return shapes exact)

| Endpoint | Input | Output |
|---|---|---|
| `/vol-surface` | `VolSurfaceInput` | `VolSurfaceOutput` |
| `/rnd` | `RNDInput` | `RNDOutput` |
| `/skew` | `SkewInput` | `SkewOutput` |
| `/vol-cone` | `VolConeInput` | `VolConeOutput` |
| `/vrp` | `VRPInput` | `VRPOutput` |

See the model definitions at the top of `main.py`. They mirror the TypeScript types in `scope-alpha/frontend/types/options.ts` exactly — if one changes, update both sides.

---

## Alternative platforms

- **Fly.io**: `fly launch` from this directory, auto-detects the Dockerfile. Free tier has 3 shared VMs. Set the env var via `fly secrets set QUANT_ENGINE_API_KEY=...`.
- **Render**: Connect your GitHub repo, pick "Web Service" → Python, root dir `scope-alpha/quant-engine`. Free tier has a cold-start delay (~30s) that will hit the Vercel cron's 10s timeout sometimes — upgrade to the $7/month Starter to avoid cold starts.
- **Vercel Python Functions**: Not recommended. Numerical work needs warm memory; serverless cold starts for numpy/scipy are 3-5s.

---

## Security

- `X-Quant-Key` header is checked on every endpoint except `/health`.
- If `QUANT_ENGINE_API_KEY` is unset, the service allows all requests (dev mode). Don't deploy to production without setting it.
- The key is the only thing preventing random internet traffic from hitting the compute endpoints. Rotate it if you leak it (update Railway AND Vercel env vars in the same deploy).
