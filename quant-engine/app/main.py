"""Scope Alpha Quant Engine — FastAPI service.

Stateless compute microservice. The Vercel backend POSTs raw Deribit
options data here and gets back computed analytics (vol surface, RND,
skew, vol cone, VRP). No database, no external API calls.

Auth: every non-/health request must include X-Quant-Key matching the
QUANT_API_KEY env var. When QUANT_API_KEY is unset, auth is disabled so
local development works out of the box.

Error handling: computation failures never return 500. The route either
returns valid empty output with `quality: "failed"` in the confidence
block (where applicable) or a 422 from Pydantic when the input itself is
malformed. The TS client treats any non-2xx as null → inert mode.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import VERSION, get_api_key, is_auth_enabled
from .core.confidence import compute_confidence_score
from .core.density import build_density
from .core.filters import QuoteFilter, filter_quotes
from .core.forward import infer_forward_pcp
from .core.greeks import classify_term_structure, compute_expiry_skew
from .core.realized_vol import (
    point_realized_vol,
    rolling_realized_vol,
)
from .core.statistics import compute_stats, prob_above_strike, prob_below_strike
from .core.surface import build_surface
from .models.inputs import (
    RNDInput,
    SkewInput,
    VolConeInput,
    VolSurfaceInput,
    VRPInput,
)
from .models.outputs import (
    ATMByExpiry,
    DensityPoint,
    RNDConfidence,
    RNDOutput,
    RNDStatistics,
    SkewByExpiry,
    Skew25dByExpiry,
    SkewOutput,
    SmilePoint,
    TermStructurePoint,
    VolConeOutput,
    VolConePercentiles,
    VolConeWindow,
    VolSurfaceFitQuality,
    VolSurfaceOutput,
    VolSurfacePoint,
    VolSurfaceSummary,
    VRPOutput,
    VRPSeriesPoint,
)


app = FastAPI(
    title="Scope Alpha Quant Engine",
    version=VERSION,
    description=(
        "Stateless options analytics microservice. Computes vol surface, "
        "RND, skew, vol cone, and VRP from Deribit chain inputs."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ─── Auth dependency ───────────────────────────────────────────────────────


async def require_api_key(
    x_quant_key: str | None = Header(default=None),
) -> None:
    if not is_auth_enabled():
        return
    if x_quant_key != get_api_key():
        raise HTTPException(status_code=401, detail="Invalid or missing X-Quant-Key")


# ─── Health ────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": VERSION,
        "auth_enabled": is_auth_enabled(),
    }


# ─── /rnd — Breeden-Litzenberger density ───────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _empty_rnd(inp: RNDInput, reason: str) -> RNDOutput:
    return RNDOutput(
        asset=inp.asset,
        expiry_date=inp.expiry_date,
        expiry_days=inp.expiry_days,
        spot_price=inp.spot_price,
        density=[],
        statistics=RNDStatistics(
            mean=0.0,
            median=0.0,
            mode=0.0,
            std_dev=0.0,
            skewness=0.0,
            kurtosis=0.0,
            prob_above_spot=0.0,
            prob_below_80k=0.0,
            prob_above_90k=0.0,
        ),
        confidence=RNDConfidence(
            method=f"breeden_litzenberger ({reason})",
            n_options_used=0,
            strike_range=(0.0, 0.0),
            quality="failed",
        ),
    )


@app.post("/rnd", response_model=RNDOutput, dependencies=[Depends(require_api_key)])
async def rnd_endpoint(inp: RNDInput) -> RNDOutput:
    if len(inp.options) < 6 or inp.expiry_days <= 0:
        return _empty_rnd(inp, "sparse input")

    # Build the (strike, iv) pairs in decimal form.
    call_prices: list[float] = []
    put_prices: list[float] = []
    call_strikes: list[float] = []
    put_strikes: list[float] = []
    quotes: list[QuoteFilter] = []

    for o in inp.options:
        if o.iv <= 0:
            continue
        # `iv` is the normalized Deribit mark_iv in decimal.
        iv = o.iv if o.iv <= 5.0 else o.iv / 100.0
        quotes.append(
            QuoteFilter(
                strike=o.strike,
                iv=iv,
                call_price_usd=o.call_price_usd,
                option_type=o.option_type,
                open_interest=1.0,  # OI not in RNDInput; treat as present
            )
        )
        if o.option_type == "call":
            call_prices.append(o.call_price_usd)
            call_strikes.append(o.strike)
        else:
            put_prices.append(o.call_price_usd)
            put_strikes.append(o.strike)

    cleaned, liquidity = filter_quotes(quotes, inp.spot_price)
    if len(cleaned) < 6:
        return _empty_rnd(inp, "post-filter sparsity")

    strikes = np.array([q.strike for q in cleaned], dtype=float)
    ivs = np.array([q.iv for q in cleaned], dtype=float)
    t_years = inp.expiry_days / 365.0

    dens = build_density(
        spot=inp.spot_price,
        strikes=strikes,
        ivs=ivs,
        t_years=t_years,
        r=inp.risk_free_rate,
    )
    if dens is None:
        return _empty_rnd(inp, "density fit failed")
    k_grid, density, diag = dens

    stats = compute_stats(k_grid, density, inp.spot_price)

    # BTC-specific hardcoded thresholds that the TS contract requires.
    # These are literal strike probabilities — they apply to BTC; for ETH
    # they represent arbitrary fixed levels downstream ignores.
    prob_below_80k = prob_below_strike(k_grid, density, 80_000.0)
    prob_above_90k = prob_above_strike(k_grid, density, 90_000.0)

    # Forward diagnostic (only useful when both sides present)
    common_strikes = set(call_strikes) & set(put_strikes)
    forward_err_pct: float | None = None
    if len(common_strikes) >= 3:
        common_sorted = sorted(common_strikes)
        cp = np.array(
            [call_prices[call_strikes.index(k)] for k in common_sorted],
            dtype=float,
        )
        pp = np.array(
            [put_prices[put_strikes.index(k)] for k in common_sorted],
            dtype=float,
        )
        f_pcp = infer_forward_pcp(
            np.array(common_sorted, dtype=float),
            cp,
            pp,
            inp.risk_free_rate,
            t_years,
        )
        if f_pcp is not None and inp.spot_price > 0:
            forward_err_pct = abs(f_pcp - inp.spot_price) / inp.spot_price * 100.0

    score, quality = compute_confidence_score(
        mass=diag["mass_post_normalize"],
        forward_error_pct=forward_err_pct,
        n_strikes_used=len(cleaned),
        retention_pct=liquidity.retention_pct,
    )

    # Thin density for transport — 150 points is plenty for UI rendering
    n_out = min(150, len(k_grid))
    idxs = np.linspace(0, len(k_grid) - 1, n_out).astype(int)
    density_points = [
        DensityPoint(price=float(k_grid[i]), probability=float(density[i]))
        for i in idxs
    ]

    return RNDOutput(
        asset=inp.asset,
        expiry_date=inp.expiry_date,
        expiry_days=inp.expiry_days,
        spot_price=inp.spot_price,
        density=density_points,
        statistics=RNDStatistics(
            mean=stats.mean,
            median=stats.median,
            mode=stats.mode,
            std_dev=stats.std_dev,
            skewness=stats.skewness,
            kurtosis=stats.kurtosis,
            prob_above_spot=stats.prob_above_spot,
            prob_below_80k=prob_below_80k,
            prob_above_90k=prob_above_90k,
        ),
        confidence=RNDConfidence(
            method="breeden_litzenberger",
            n_options_used=len(cleaned),
            strike_range=(float(k_grid[0]), float(k_grid[-1])),
            quality=quality,
        ),
    )


# ─── /vol-surface ──────────────────────────────────────────────────────────


@app.post(
    "/vol-surface",
    response_model=VolSurfaceOutput,
    dependencies=[Depends(require_api_key)],
)
async def vol_surface_endpoint(inp: VolSurfaceInput) -> VolSurfaceOutput:
    chain = [
        {
            "strike": o.strike,
            "expiry_days": o.expiry_days,
            "option_type": o.option_type,
            "mark_iv": o.mark_iv,
            # Match by best-effort nearest expiration date
            "expiry_date": next(
                (
                    e.date
                    for e in inp.expirations
                    if abs(e.days_to_expiry - o.expiry_days) <= 1
                ),
                f"T+{int(o.expiry_days)}d",
            ),
        }
        for o in inp.options
    ]

    result = build_surface(inp.spot_price, chain)

    surface_points = [
        VolSurfacePoint(
            strike=p.strike,
            delta=p.delta,
            expiry_days=int(p.expiry_days),
            expiry_date=p.expiry_date,
            raw_iv=p.raw_iv,
            fitted_iv=p.fitted_iv,
            residual=p.residual,
        )
        for p in result.points
    ]

    atm_iv_by_expiry = [
        ATMByExpiry(expiry_days=int(s.expiry_days), atm_iv=s.atm_iv_pct)
        for s in result.slices
    ]
    skew_25d_by_expiry = [
        Skew25dByExpiry(expiry_days=int(s.expiry_days), skew_25d=s.skew_25d_pct)
        for s in result.slices
    ]

    return VolSurfaceOutput(
        asset=inp.asset,
        spot_price=inp.spot_price,
        surface=surface_points,
        fit_quality=VolSurfaceFitQuality(
            rmse=result.rmse,
            max_residual=result.max_residual,
            method="spline_k4_per_expiry",
        ),
        summary=VolSurfaceSummary(
            atm_iv_by_expiry=atm_iv_by_expiry,
            skew_25d_by_expiry=skew_25d_by_expiry,
        ),
        computed_at=_now_iso(),
    )


# ─── /skew ─────────────────────────────────────────────────────────────────


@app.post(
    "/skew",
    response_model=SkewOutput,
    dependencies=[Depends(require_api_key)],
)
async def skew_endpoint(inp: SkewInput) -> SkewOutput:
    # Group by expiry_days — the caller doesn't send expiry_date on the
    # skew input, so we derive a stable synthetic key.
    groups: dict[float, list] = {}
    for o in inp.options:
        groups.setdefault(o.expiry_days, []).append(o)

    by_expiry: list[SkewByExpiry] = []
    term_points: list[tuple[float, float]] = []

    for expiry_days, items in sorted(groups.items()):
        if len(items) < 4:
            continue
        expiry_date = f"T+{int(expiry_days)}d"  # synthetic — SkewInput doesn't carry it
        skew = compute_expiry_skew(
            expiry_date=expiry_date,
            expiry_days=expiry_days,
            spot_price=inp.spot_price,
            strikes=[o.strike for o in items],
            ivs_pct=[o.mark_iv for o in items],
            option_types=[o.option_type for o in items],
        )
        if skew is None:
            continue

        by_expiry.append(
            SkewByExpiry(
                expiry_date=skew.expiry_date,
                expiry_days=int(skew.expiry_days),
                skew_25d=skew.skew_25d,
                skew_10d=skew.skew_10d,
                skew_5d=skew.skew_5d,
                put_iv_25d=skew.put_iv_25d,
                call_iv_25d=skew.call_iv_25d,
                atm_iv=skew.atm_iv,
                smile=[SmilePoint(delta=p.delta, iv=p.iv) for p in skew.smile],
            )
        )
        term_points.append((skew.expiry_days, skew.atm_iv))

    shape = classify_term_structure(term_points)

    return SkewOutput(
        asset=inp.asset,
        by_expiry=by_expiry,
        term_structure=[
            TermStructurePoint(expiry_days=int(d), atm_iv=iv) for d, iv in term_points
        ],
        term_structure_shape=shape,
    )


# ─── /vol-cone ─────────────────────────────────────────────────────────────


_WINDOWS = [7, 30, 60, 90, 180]


@app.post(
    "/vol-cone",
    response_model=VolConeOutput,
    dependencies=[Depends(require_api_key)],
)
async def vol_cone_endpoint(inp: VolConeInput) -> VolConeOutput:
    closes = np.asarray(inp.daily_closes, dtype=float)
    windows: list[VolConeWindow] = []
    rv30_history: np.ndarray | None = None

    for days in _WINDOWS:
        if len(closes) < days + 1:
            continue
        all_rvs = rolling_realized_vol(closes, days)
        if len(all_rvs) == 0:
            continue
        current_rv = float(all_rvs[-1])
        ps = np.percentile(all_rvs, [10, 25, 50, 75, 90])
        windows.append(
            VolConeWindow(
                days=days,
                current_rv=current_rv,
                percentiles=VolConePercentiles(
                    p10=float(ps[0]),
                    p25=float(ps[1]),
                    p50=float(ps[2]),
                    p75=float(ps[3]),
                    p90=float(ps[4]),
                ),
            )
        )
        if days == 30:
            rv30_history = all_rvs

    # IV percentile vs 30d RV history — converts current ATM IV to decimal
    current_iv_dec = (
        inp.current_atm_iv if inp.current_atm_iv <= 5.0 else inp.current_atm_iv / 100.0
    )
    if rv30_history is not None and len(rv30_history) > 0:
        rank = float(np.searchsorted(np.sort(rv30_history), current_iv_dec))
        pct = rank / len(rv30_history) * 100.0
    else:
        pct = 50.0

    if pct < 25:
        assessment = "IV cheap vs historical RV — options underpricing future volatility."
    elif pct > 75:
        assessment = "IV rich vs historical RV — options overpricing future volatility."
    else:
        assessment = "IV roughly in line with historical RV."

    return VolConeOutput(
        asset=inp.asset,
        windows=windows,
        current_atm_iv=inp.current_atm_iv,
        iv_percentile_vs_rv30d=pct,
        assessment=assessment,
    )


# ─── /vrp ──────────────────────────────────────────────────────────────────


@app.post(
    "/vrp",
    response_model=VRPOutput,
    dependencies=[Depends(require_api_key)],
)
async def vrp_endpoint(inp: VRPInput) -> VRPOutput:
    # Build date-aligned lookup
    iv_by_date = {p.date: p.atm_iv_30d for p in inp.iv_history}
    rv_by_date = {p.date: p.rv_30d for p in inp.rv_history}
    common = sorted(set(iv_by_date.keys()) & set(rv_by_date.keys()))

    series: list[VRPSeriesPoint] = []
    vrp_values: list[float] = []
    for d in common:
        iv = iv_by_date[d]
        rv = rv_by_date[d]
        # Normalize both to decimal if they came in as percent
        iv_dec = iv / 100.0 if iv > 5.0 else iv
        rv_dec = rv / 100.0 if rv > 5.0 else rv
        vrp = iv_dec - rv_dec
        series.append(VRPSeriesPoint(date=d, vrp=vrp, iv=iv_dec, rv=rv_dec))
        vrp_values.append(vrp)

    if not vrp_values:
        return VRPOutput(
            asset=inp.asset,
            current_vrp=0.0,
            current_vrp_percentile=50.0,
            vrp_series=[],
            assessment="Insufficient aligned IV/RV history.",
            mean_vrp=0.0,
            std_vrp=0.0,
        )

    vrp_arr = np.asarray(vrp_values, dtype=float)
    current = float(vrp_arr[-1])
    sorted_arr = np.sort(vrp_arr)
    rank = float(np.searchsorted(sorted_arr, current))
    pct = rank / len(vrp_arr) * 100.0

    mean = float(np.mean(vrp_arr))
    std = float(np.std(vrp_arr, ddof=1)) if len(vrp_arr) > 1 else 0.0

    if current > mean + 0.5 * std:
        assessment = (
            "VRP elevated — IV is paying a premium over realized vol. Options sellers favored."
        )
    elif current < mean - 0.5 * std:
        assessment = (
            "VRP compressed — realized vol catching up to IV. Options buyers favored."
        )
    else:
        assessment = "VRP near historical mean — no clear vol-risk-premium edge."

    return VRPOutput(
        asset=inp.asset,
        current_vrp=current,
        current_vrp_percentile=pct,
        vrp_series=series,
        assessment=assessment,
        mean_vrp=mean,
        std_vrp=std,
    )
