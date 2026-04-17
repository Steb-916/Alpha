"""
Scope Alpha — Quant Engine

FastAPI microservice for the 5 volatility analytics the TypeScript frontend
delegates to Python: vol-surface fitting, RND extraction, skew, vol cone, VRP.

The frontend at /lib/quant-engine.ts calls these endpoints over HTTP with a
shared-secret header (X-Quant-Key). Every request/response is strictly
Pydantic-validated so the shapes never drift from the TypeScript types in
scope-alpha/frontend/types/options.ts.

DEPLOY:
    1. Install: pip install -r requirements.txt
    2. Set env: QUANT_ENGINE_API_KEY=<shared secret>
    3. Run:     uvicorn main:app --host 0.0.0.0 --port 8000

Railway auto-runs via the Dockerfile in this directory.

PLUGGING IN REAL MATH:
    Each endpoint has a handler function prefixed with `compute_*`. These
    currently return realistic placeholder data so the frontend pipeline
    verifies end-to-end. Replace each with your real implementation — the
    input/output shapes are fully specified.
"""

from __future__ import annotations

import math
import os
from datetime import datetime
from typing import List, Literal, Optional, Tuple

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

# ─── Auth ────────────────────────────────────────────────────────────────

EXPECTED_KEY = os.environ.get("QUANT_ENGINE_API_KEY", "")


def require_quant_key(x_quant_key: Optional[str] = Header(default=None)) -> None:
    """Guard every endpoint with a shared-secret header."""
    if not EXPECTED_KEY:
        # Service running without a key configured — dev mode, allow through
        # but log a warning. Production MUST set QUANT_ENGINE_API_KEY.
        return
    if x_quant_key != EXPECTED_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing X-Quant-Key")


# ─── Pydantic models ─────────────────────────────────────────────────────
# These mirror scope-alpha/frontend/types/options.ts. Keep them in sync.

OptionType = Literal["call", "put"]


class OptionQuote(BaseModel):
    strike: float
    expiry_days: float
    option_type: OptionType
    mark_iv: float
    bid_iv: Optional[float] = None
    ask_iv: Optional[float] = None
    open_interest: float
    volume_24h: float


class ExpirationMeta(BaseModel):
    date: str
    days_to_expiry: float


class VolSurfaceInput(BaseModel):
    asset: str
    spot_price: float
    options: List[OptionQuote]
    expirations: List[ExpirationMeta]


class VolSurfacePoint(BaseModel):
    strike: float
    delta: float
    expiry_days: float
    expiry_date: str
    raw_iv: float
    fitted_iv: float
    residual: float


class AtmByExpiry(BaseModel):
    expiry_days: float
    atm_iv: float


class Skew25dByExpiry(BaseModel):
    expiry_days: float
    skew_25d: float


class VolSurfaceSummary(BaseModel):
    atm_iv_by_expiry: List[AtmByExpiry]
    skew_25d_by_expiry: List[Skew25dByExpiry]


class FitQuality(BaseModel):
    rmse: float
    max_residual: float
    method: str


class VolSurfaceOutput(BaseModel):
    asset: str
    spot_price: float
    surface: List[VolSurfacePoint]
    fit_quality: FitQuality
    summary: VolSurfaceSummary
    computed_at: str


class RNDOptionQuote(BaseModel):
    strike: float
    call_price_usd: float
    iv: float
    option_type: OptionType


class RNDInput(BaseModel):
    asset: str
    spot_price: float
    expiry_date: str
    expiry_days: float
    risk_free_rate: float
    options: List[RNDOptionQuote]


class DensityPoint(BaseModel):
    price: float
    probability: float


class RNDStatistics(BaseModel):
    mean: float
    median: float
    mode: float
    std_dev: float
    skewness: float
    kurtosis: float
    prob_above_spot: float
    prob_below_80k: float
    prob_above_90k: float


class RNDConfidence(BaseModel):
    method: str
    n_options_used: int
    strike_range: Tuple[float, float]
    quality: str


class RNDOutput(BaseModel):
    asset: str
    expiry_date: str
    expiry_days: float
    spot_price: float
    density: List[DensityPoint]
    statistics: RNDStatistics
    confidence: RNDConfidence


class VolConeInput(BaseModel):
    asset: str
    daily_closes: List[float]
    current_atm_iv: float


class Percentiles(BaseModel):
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float


class VolConeWindow(BaseModel):
    days: int
    current_rv: float
    percentiles: Percentiles


class VolConeOutput(BaseModel):
    asset: str
    windows: List[VolConeWindow]
    current_atm_iv: float
    iv_percentile_vs_rv30d: float
    assessment: str


class IVHistoryPoint(BaseModel):
    date: str
    atm_iv_30d: float


class RVHistoryPoint(BaseModel):
    date: str
    rv_30d: float


class VRPInput(BaseModel):
    asset: str
    iv_history: List[IVHistoryPoint]
    rv_history: List[RVHistoryPoint]


class VRPSeriesPoint(BaseModel):
    date: str
    vrp: float
    iv: float
    rv: float


class VRPOutput(BaseModel):
    asset: str
    current_vrp: float
    current_vrp_percentile: float
    vrp_series: List[VRPSeriesPoint]
    assessment: str
    mean_vrp: float
    std_vrp: float


class SkewOption(BaseModel):
    strike: float
    expiry_days: float
    option_type: OptionType
    mark_iv: float
    open_interest: float


class SkewInput(BaseModel):
    asset: str
    spot_price: float
    options: List[SkewOption]


class SmilePoint(BaseModel):
    delta: float
    iv: float


class SkewByExpiry(BaseModel):
    expiry_date: str
    expiry_days: float
    skew_25d: float
    skew_10d: float
    skew_5d: float
    put_iv_25d: float
    call_iv_25d: float
    atm_iv: float
    smile: List[SmilePoint]


class TermStructurePoint(BaseModel):
    expiry_days: float
    atm_iv: float


class SkewOutput(BaseModel):
    asset: str
    by_expiry: List[SkewByExpiry]
    term_structure: List[TermStructurePoint]
    term_structure_shape: Literal["contango", "backwardation", "flat"]


# ─── Placeholder math ────────────────────────────────────────────────────
# Each of these produces a realistic-shaped response so the Vercel frontend
# pipeline works end-to-end before the real math is plugged in. Replace them
# one at a time with validated Python code from the research notebooks.


def compute_vol_surface(inp: VolSurfaceInput) -> VolSurfaceOutput:
    """PLACEHOLDER — returns the raw IVs unchanged (zero residuals).

    Replace with SVI parameterization or cubic spline fit.
    """
    surface = []
    expiries_map = {e.days_to_expiry: e.date for e in inp.expirations}
    for opt in inp.options:
        expiry_date = expiries_map.get(opt.expiry_days, "")
        # Fake Black-Scholes delta using log-moneyness — good enough for UI
        m = math.log(opt.strike / inp.spot_price)
        t = max(opt.expiry_days / 365.0, 0.001)
        sigma = max(opt.mark_iv / 100, 0.01)
        d1 = (-m + 0.5 * sigma ** 2 * t) / (sigma * math.sqrt(t))
        delta = 0.5 * (1 + math.erf(d1 / math.sqrt(2)))
        if opt.option_type == "put":
            delta -= 1
        surface.append(
            VolSurfacePoint(
                strike=opt.strike,
                delta=round(delta, 4),
                expiry_days=opt.expiry_days,
                expiry_date=expiry_date,
                raw_iv=opt.mark_iv,
                fitted_iv=opt.mark_iv,  # placeholder: no fit
                residual=0.0,
            )
        )

    # Summary: ATM IV and 25d skew per expiry
    atm: List[AtmByExpiry] = []
    skew25: List[Skew25dByExpiry] = []
    for e in inp.expirations:
        # Nearest-to-ATM proxy: strike closest to spot
        group = [o for o in inp.options if abs(o.expiry_days - e.days_to_expiry) < 0.5]
        if not group:
            continue
        near_atm = min(group, key=lambda o: abs(o.strike - inp.spot_price))
        atm.append(AtmByExpiry(expiry_days=e.days_to_expiry, atm_iv=near_atm.mark_iv))
        # 25d skew proxy: IV at 85% strike - IV at 115% strike (rough)
        low = min(group, key=lambda o: abs(o.strike - inp.spot_price * 0.85))
        high = min(group, key=lambda o: abs(o.strike - inp.spot_price * 1.15))
        skew25.append(
            Skew25dByExpiry(
                expiry_days=e.days_to_expiry,
                skew_25d=round(high.mark_iv - low.mark_iv, 2),
            )
        )

    return VolSurfaceOutput(
        asset=inp.asset,
        spot_price=inp.spot_price,
        surface=surface,
        fit_quality=FitQuality(rmse=0.0, max_residual=0.0, method="placeholder_raw"),
        summary=VolSurfaceSummary(
            atm_iv_by_expiry=atm, skew_25d_by_expiry=skew25
        ),
        computed_at=datetime.utcnow().isoformat() + "Z",
    )


def compute_rnd(inp: RNDInput) -> RNDOutput:
    """PLACEHOLDER — generates a lognormal density centered on spot.

    Replace with Breeden-Litzenberger:
        second derivative of call price w.r.t. strike, discounted at r·T.
    """
    spot = inp.spot_price
    # Implied sigma from ATM IV of the chain (or fallback)
    ivs = [o.iv for o in inp.options if o.iv > 0]
    sigma_annual = (sum(ivs) / len(ivs) / 100) if ivs else 0.6
    t = max(inp.expiry_days / 365.0, 0.001)
    sigma_t = sigma_annual * math.sqrt(t)

    # 100-point lognormal density across ±3σ around spot
    log_spot = math.log(spot)
    min_log = log_spot - 3 * sigma_t
    max_log = log_spot + 3 * sigma_t
    log_prices = np.linspace(min_log, max_log, 100)
    prices = np.exp(log_prices)
    # Lognormal pdf
    mu = log_spot - 0.5 * sigma_t ** 2
    pdf = (1 / (prices * sigma_t * math.sqrt(2 * math.pi))) * np.exp(
        -0.5 * ((log_prices - mu) / sigma_t) ** 2
    )
    # Normalize so it integrates to 1 across our discrete grid
    dx = prices[1] - prices[0]
    pdf = pdf / (pdf.sum() * dx)

    density = [
        DensityPoint(price=float(p), probability=float(q))
        for p, q in zip(prices, pdf)
    ]

    # Statistics
    mean = float(np.sum(prices * pdf) * dx)
    var = float(np.sum((prices - mean) ** 2 * pdf) * dx)
    std = math.sqrt(var)
    # CDF for percentile-like stats
    cdf = np.cumsum(pdf) * dx
    median = float(prices[np.searchsorted(cdf, 0.5)])
    mode = float(prices[int(np.argmax(pdf))])
    prob_above_spot = float(1 - cdf[np.searchsorted(prices, spot)])
    idx_80k = np.searchsorted(prices, 80000)
    idx_90k = np.searchsorted(prices, 90000)
    prob_below_80k = float(cdf[idx_80k]) if idx_80k < len(cdf) else 0.0
    prob_above_90k = float(1 - cdf[idx_90k]) if idx_90k < len(cdf) else 0.0

    strikes = [o.strike for o in inp.options]
    return RNDOutput(
        asset=inp.asset,
        expiry_date=inp.expiry_date,
        expiry_days=inp.expiry_days,
        spot_price=spot,
        density=density,
        statistics=RNDStatistics(
            mean=round(mean, 2),
            median=round(median, 2),
            mode=round(mode, 2),
            std_dev=round(std, 2),
            skewness=0.0,
            kurtosis=3.0,
            prob_above_spot=round(prob_above_spot, 4),
            prob_below_80k=round(prob_below_80k, 4),
            prob_above_90k=round(prob_above_90k, 4),
        ),
        confidence=RNDConfidence(
            method="placeholder_lognormal",
            n_options_used=len(inp.options),
            strike_range=(min(strikes) if strikes else 0.0, max(strikes) if strikes else 0.0),
            quality="placeholder",
        ),
    )


def compute_skew(inp: SkewInput) -> SkewOutput:
    """PLACEHOLDER — grouped smile from raw IVs + term structure as ATM per expiry.

    Replace with Black-Scholes delta-based skew computation.
    """
    spot = inp.spot_price
    by_expiry_map: dict[float, List[SkewOption]] = {}
    for o in inp.options:
        by_expiry_map.setdefault(o.expiry_days, []).append(o)

    by_expiry: List[SkewByExpiry] = []
    term: List[TermStructurePoint] = []

    for days in sorted(by_expiry_map.keys()):
        group = by_expiry_map[days]
        near_atm = min(group, key=lambda o: abs(o.strike - spot))
        # Approximate 25-delta strikes at ±10% of spot
        p25 = min(group, key=lambda o: abs(o.strike - spot * 0.9))
        c25 = min(group, key=lambda o: abs(o.strike - spot * 1.1))
        smile = sorted(
            [
                SmilePoint(delta=-0.1, iv=min(group, key=lambda o: abs(o.strike - spot * 0.85)).mark_iv),
                SmilePoint(delta=-0.25, iv=p25.mark_iv),
                SmilePoint(delta=-0.5, iv=near_atm.mark_iv),
                SmilePoint(delta=0.25, iv=c25.mark_iv),
                SmilePoint(delta=0.1, iv=min(group, key=lambda o: abs(o.strike - spot * 1.15)).mark_iv),
            ],
            key=lambda p: p.delta,
        )

        expiry_date = (datetime.utcnow().date().isoformat()) if not group else expiry_date_from_days(days)
        by_expiry.append(
            SkewByExpiry(
                expiry_date=expiry_date,
                expiry_days=days,
                skew_25d=round(p25.mark_iv - c25.mark_iv, 2),
                skew_10d=0.0,
                skew_5d=0.0,
                put_iv_25d=p25.mark_iv,
                call_iv_25d=c25.mark_iv,
                atm_iv=near_atm.mark_iv,
                smile=smile,
            )
        )
        term.append(TermStructurePoint(expiry_days=days, atm_iv=near_atm.mark_iv))

    # Term shape: compare near-term to long-term ATM
    shape: Literal["contango", "backwardation", "flat"] = "flat"
    if len(term) >= 2:
        diff = term[-1].atm_iv - term[0].atm_iv
        if diff > 2:
            shape = "contango"
        elif diff < -2:
            shape = "backwardation"

    return SkewOutput(
        asset=inp.asset,
        by_expiry=by_expiry,
        term_structure=term,
        term_structure_shape=shape,
    )


def expiry_date_from_days(days: float) -> str:
    """Approximate expiry date from days-to-expiry. Frontend only uses this
    as a display label so a rough calendar-date is fine."""
    from datetime import timedelta

    return (datetime.utcnow() + timedelta(days=days)).date().isoformat()


def compute_vol_cone(inp: VolConeInput) -> VolConeOutput:
    """PLACEHOLDER — realized vol percentiles across lookback windows.

    Replace with the validated vol cone calculation from research notebook.
    """
    closes = np.array(inp.daily_closes, dtype=float)
    if len(closes) < 8:
        raise HTTPException(
            status_code=400, detail="need ≥8 daily closes for vol cone"
        )

    returns = np.diff(np.log(closes))
    windows: List[VolConeWindow] = []
    for w in (7, 30, 60, 90, 180):
        if len(returns) < w:
            continue
        rolling = [
            float(np.std(returns[i : i + w], ddof=1) * math.sqrt(365) * 100)
            for i in range(len(returns) - w + 1)
        ]
        if not rolling:
            continue
        current = rolling[-1]
        p10, p25, p50, p75, p90 = np.percentile(rolling, [10, 25, 50, 75, 90])
        windows.append(
            VolConeWindow(
                days=w,
                current_rv=round(current, 2),
                percentiles=Percentiles(
                    p10=round(float(p10), 2),
                    p25=round(float(p25), 2),
                    p50=round(float(p50), 2),
                    p75=round(float(p75), 2),
                    p90=round(float(p90), 2),
                ),
            )
        )

    # IV percentile vs RV30d distribution
    iv_pct = 50.0
    if windows:
        w30 = next((w for w in windows if w.days == 30), None)
        if w30:
            rolling_30 = [
                float(np.std(returns[i : i + 30], ddof=1) * math.sqrt(365) * 100)
                for i in range(len(returns) - 30 + 1)
            ]
            if rolling_30:
                iv_pct = float(
                    100 * (np.array(rolling_30) <= inp.current_atm_iv).mean()
                )

    assessment = (
        f"IV is at the {iv_pct:.0f}th percentile of historical 30d realized vol — "
        + (
            "options are cheap"
            if iv_pct < 30
            else "options are expensive" if iv_pct > 70 else "options are fairly priced"
        )
    )

    return VolConeOutput(
        asset=inp.asset,
        windows=windows,
        current_atm_iv=inp.current_atm_iv,
        iv_percentile_vs_rv30d=round(iv_pct, 1),
        assessment=assessment,
    )


def compute_vrp(inp: VRPInput) -> VRPOutput:
    """PLACEHOLDER — VRP = IV - subsequent RV, aligned by date.

    Replace with date-aligned merge + percentile calc from research notebook.
    """
    rv_by_date = {p.date: p.rv_30d for p in inp.rv_history}
    series: List[VRPSeriesPoint] = []
    for p in inp.iv_history:
        rv = rv_by_date.get(p.date)
        if rv is None:
            continue
        series.append(
            VRPSeriesPoint(date=p.date, iv=p.atm_iv_30d, rv=rv, vrp=round(p.atm_iv_30d - rv, 2))
        )

    if not series:
        raise HTTPException(status_code=400, detail="no overlapping IV/RV dates")

    vrps = np.array([s.vrp for s in series])
    current_vrp = float(vrps[-1])
    mean_vrp = float(np.mean(vrps))
    std_vrp = float(np.std(vrps, ddof=1)) if len(vrps) >= 2 else 0.0
    percentile = float(100 * (vrps <= current_vrp).mean())

    assessment = (
        f"VRP is {current_vrp:+.2f}%, "
        + ("above" if current_vrp > mean_vrp else "below")
        + f" the {mean_vrp:+.2f}% mean. "
        + (
            "Selling options is modestly favorable."
            if current_vrp > 3
            else "Buying premium looks cheap."
            if current_vrp < -2
            else "Neutral."
        )
    )

    return VRPOutput(
        asset=inp.asset,
        current_vrp=round(current_vrp, 2),
        current_vrp_percentile=round(percentile, 1),
        vrp_series=series,
        assessment=assessment,
        mean_vrp=round(mean_vrp, 2),
        std_vrp=round(std_vrp, 2),
    )


# ─── FastAPI app ─────────────────────────────────────────────────────────

app = FastAPI(
    title="Scope Alpha Quant Engine",
    version="0.1.0",
    description="Volatility analytics: vol surface, RND, skew, vol cone, VRP.",
)


@app.get("/health")
def health() -> dict:
    """Unauthenticated health check for uptime monitors + Railway."""
    return {"ok": True, "version": app.version}


@app.post(
    "/vol-surface",
    response_model=VolSurfaceOutput,
    dependencies=[Depends(require_quant_key)],
)
def vol_surface(inp: VolSurfaceInput) -> VolSurfaceOutput:
    return compute_vol_surface(inp)


@app.post(
    "/rnd",
    response_model=RNDOutput,
    dependencies=[Depends(require_quant_key)],
)
def rnd(inp: RNDInput) -> RNDOutput:
    return compute_rnd(inp)


@app.post(
    "/skew",
    response_model=SkewOutput,
    dependencies=[Depends(require_quant_key)],
)
def skew(inp: SkewInput) -> SkewOutput:
    return compute_skew(inp)


@app.post(
    "/vol-cone",
    response_model=VolConeOutput,
    dependencies=[Depends(require_quant_key)],
)
def vol_cone(inp: VolConeInput) -> VolConeOutput:
    return compute_vol_cone(inp)


@app.post(
    "/vrp",
    response_model=VRPOutput,
    dependencies=[Depends(require_quant_key)],
)
def vrp(inp: VRPInput) -> VRPOutput:
    return compute_vrp(inp)
