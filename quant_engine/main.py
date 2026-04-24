"""
Scope Alpha — Quant Engine
FastAPI microservice for vol surface fitting and options analytics.

Endpoints consumed by the Next.js backend (lib/quant-engine.ts):
  POST /vol-surface   → SVI-fitted implied vol surface
  POST /rnd           → Breeden-Litzenberger risk-neutral density
  POST /vol-cone      → Realized vol percentile cone
  POST /vrp           → Volatility risk premium series
  POST /skew          → 25-delta skew + term structure

Authentication: X-Quant-Key header (constant-time compare).
"""

import hmac
import os
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import (
    RNDInput, RNDOutput,
    SkewInput, SkewOutput,
    VolConeInput, VolConeOutput,
    VolSurfaceInput, VolSurfaceOutput,
    VRPInput, VRPOutput,
)
from engines.vol_surface import compute_vol_surface
from engines.rnd import compute_rnd
from engines.vol_cone import compute_vol_cone
from engines.vrp import compute_vrp
from engines.skew import compute_skew

load_dotenv()

API_KEY = os.getenv("QUANT_ENGINE_API_KEY", "")
if not API_KEY:
    print("WARNING: QUANT_ENGINE_API_KEY is not set — all requests will be rejected.")


# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_api_key(x_quant_key: str = Header(default="")) -> None:
    if not API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="API key not configured on server.")
    if not hmac.compare_digest(x_quant_key, API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid API key.")


# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Quant Engine ready.")
    yield
    print("Quant Engine shutting down.")


app = FastAPI(
    title="Scope Alpha Quant Engine",
    version="1.0.0",
    description="Options analytics microservice — vol surface, RND, skew, vol cone, VRP.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Timing middleware ─────────────────────────────────────────────────────────

@app.middleware("http")
async def add_timing(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Compute-Ms"] = f"{ms:.1f}"
    return response


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "quant-engine"}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/vol-surface", response_model=VolSurfaceOutput, dependencies=[Depends(verify_api_key)])
async def vol_surface(body: VolSurfaceInput) -> VolSurfaceOutput:
    """
    SVI vol surface fitting.
    Receives the full options chain; returns a fitted surface with per-point
    delta, fitted_iv, raw_iv, and residual.
    """
    try:
        return compute_vol_surface(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Vol surface compute failed: {e}")


@app.post("/rnd", response_model=RNDOutput, dependencies=[Depends(verify_api_key)])
async def rnd(body: RNDInput) -> RNDOutput:
    """
    Breeden-Litzenberger risk-neutral density for a single expiration.
    Returns a probability distribution + statistics.
    """
    try:
        return compute_rnd(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"RND compute failed: {e}")


@app.post("/vol-cone", response_model=VolConeOutput, dependencies=[Depends(verify_api_key)])
async def vol_cone(body: VolConeInput) -> VolConeOutput:
    """
    Volatility cone — realized vol percentile bands across multiple windows.
    Requires at least 8 daily closes (200 recommended for robust percentiles).
    """
    try:
        return compute_vol_cone(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Vol cone compute failed: {e}")


@app.post("/vrp", response_model=VRPOutput, dependencies=[Depends(verify_api_key)])
async def vrp(body: VRPInput) -> VRPOutput:
    """
    Volatility risk premium — IV minus realized vol time series + percentile.
    """
    try:
        return compute_vrp(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"VRP compute failed: {e}")


@app.post("/skew", response_model=SkewOutput, dependencies=[Depends(verify_api_key)])
async def skew(body: SkewInput) -> SkewOutput:
    """
    Vol skew + term structure.
    Returns 25-delta risk reversal per expiry and ATM IV term structure shape.
    """
    try:
        return compute_skew(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Skew compute failed: {e}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
