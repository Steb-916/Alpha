"""Multi-expiry vol-surface orchestration.

Replaces RND.py §load_ticker (line 586-654)'s data-fetching loop with a
stateless function that accepts the full chain input and produces the
fitted surface grid for the /vol-surface endpoint.

For each expiration:
  1. Split the chain by expiry
  2. Fit IV spline (via density module's spline helpers)
  3. Extract fitted IV at each raw strike + compute residuals
  4. Record ATM IV + 25d skew in the cross-expiry summary
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .black_scholes import bs_delta
from .spline import fit_iv_spline


@dataclass
class SurfacePoint:
    strike: float
    expiry_date: str
    expiry_days: float
    delta: float
    raw_iv: float  # Deribit percent
    fitted_iv: float  # Deribit percent
    residual: float  # fitted - raw


@dataclass
class SurfaceSlice:
    expiry_date: str
    expiry_days: float
    atm_iv_pct: float
    skew_25d_pct: float


@dataclass
class SurfaceResult:
    points: list[SurfacePoint]
    slices: list[SurfaceSlice]
    rmse: float
    max_residual: float


def build_surface(
    spot_price: float,
    chain: list[dict],
    r: float = 0.0,
) -> SurfaceResult:
    """Chain is a list of dicts with keys:
    strike, expiry_days, option_type, mark_iv (percent), expiry_date (str).
    """
    # Group by expiry_date
    groups: dict[str, list[dict]] = {}
    for c in chain:
        groups.setdefault(c["expiry_date"], []).append(c)

    points: list[SurfacePoint] = []
    slices: list[SurfaceSlice] = []
    residuals: list[float] = []

    for expiry_date, items in groups.items():
        if len(items) < 6:
            continue
        expiry_days = float(items[0]["expiry_days"])
        if expiry_days <= 0:
            continue

        strikes = np.array([x["strike"] for x in items], dtype=float)
        iv_pct = np.array([x["mark_iv"] for x in items], dtype=float)
        order = np.argsort(strikes)
        strikes = strikes[order]
        iv_pct = iv_pct[order]
        items_sorted = [items[i] for i in order]

        spline = fit_iv_spline(strikes, iv_pct, degree=4, smoothing=0.01)
        if spline is None:
            continue

        fitted = np.asarray(spline(strikes), dtype=float)
        fitted = np.clip(fitted, 1.0, 500.0)

        t_years = expiry_days / 365.0

        for i, item in enumerate(items_sorted):
            strike = float(strikes[i])
            raw = float(iv_pct[i])
            fit = float(fitted[i])
            residuals.append(fit - raw)
            delta = bs_delta(
                spot_price,
                strike,
                r,
                fit / 100.0,
                t_years,
                item["option_type"],
            )
            points.append(
                SurfacePoint(
                    strike=strike,
                    expiry_date=expiry_date,
                    expiry_days=expiry_days,
                    delta=float(delta),
                    raw_iv=raw,
                    fitted_iv=fit,
                    residual=fit - raw,
                )
            )

        atm_iv_pct = float(spline(spot_price))
        # 25d skew: approximate with nearest strikes at ~0.25 delta magnitudes.
        # Use the analytic BS delta on the FITTED IV to pick strikes consistent
        # with the surface we just built.
        def iv_at_delta(target_d: float, option_type: str) -> float | None:
            best = None
            best_diff = 1e9
            for i in range(len(strikes)):
                iv_dec = float(fitted[i]) / 100.0
                d = bs_delta(
                    spot_price,
                    float(strikes[i]),
                    r,
                    iv_dec,
                    t_years,
                    option_type,
                )
                if abs(d - target_d) < best_diff:
                    best_diff = abs(d - target_d)
                    best = float(fitted[i])
            return best

        put_25 = iv_at_delta(-0.25, "put")
        call_25 = iv_at_delta(0.25, "call")
        skew_25 = (
            float(put_25 - call_25) if put_25 is not None and call_25 is not None else 0.0
        )

        slices.append(
            SurfaceSlice(
                expiry_date=expiry_date,
                expiry_days=expiry_days,
                atm_iv_pct=atm_iv_pct,
                skew_25d_pct=skew_25,
            )
        )

    if residuals:
        resid = np.array(residuals, dtype=float)
        rmse = float(np.sqrt(np.mean(resid**2)))
        max_resid = float(np.max(np.abs(resid)))
    else:
        rmse = 0.0
        max_resid = 0.0

    return SurfaceResult(
        points=points,
        slices=slices,
        rmse=rmse,
        max_residual=max_resid,
    )
