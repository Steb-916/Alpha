"""
SVI (Stochastic Volatility Inspired) vol surface fitting.

Per-expiry slice calibration using the raw SVI parametrisation:
  w(k) = a + b * (rho*(k-m) + sqrt((k-m)^2 + sigma^2))

where:
  k     = log(K/F)  — log-moneyness
  w     = sigma_BS^2 * T  — total variance
  a,b,rho,m,sigma = SVI parameters per expiry slice
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from itertools import groupby
from typing import Optional

import numpy as np
from scipy.optimize import minimize
from scipy.stats import norm

from models import (
    VolSurfaceInput,
    VolSurfaceOutput,
    VolSurfacePoint,
    FitQuality,
    VolSurfaceSummary,
)


# ── Black-Scholes helpers ─────────────────────────────────────────────────────

def bs_call_delta(S: float, K: float, T: float, r: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0:
        return 1.0 if S > K else 0.0
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    return float(norm.cdf(d1))


# ── SVI parametrisation ───────────────────────────────────────────────────────

def svi_w(k: np.ndarray, a: float, b: float, rho: float, m: float, sigma: float) -> np.ndarray:
    return a + b * (rho * (k - m) + np.sqrt((k - m) ** 2 + sigma**2))


def calibrate_svi_slice(
    k_mkt: np.ndarray,
    w_mkt: np.ndarray,
    weights: Optional[np.ndarray] = None,
) -> tuple[np.ndarray, float]:
    """Least-squares SVI fit for one expiry slice. Returns (params, rmse)."""
    if weights is None:
        weights = np.ones_like(k_mkt)

    best_res = None
    best_rmse = np.inf

    # Multiple starting points to avoid local minima
    starts = [
        [0.04, 0.2, -0.5, 0.0, 0.3],
        [0.06, 0.3, -0.3, 0.05, 0.2],
        [0.02, 0.1, -0.7, -0.05, 0.4],
    ]

    def objective(params: list) -> float:
        a, b, rho, m, sigma = params
        if b <= 0 or sigma <= 0 or abs(rho) >= 1:
            return 1e10
        w_fit = svi_w(k_mkt, a, b, rho, m, sigma)
        if np.any(w_fit <= 0):
            return 1e10
        return float(np.sum(weights * (w_fit - w_mkt) ** 2))

    bounds = [
        (-0.5, 2.0),    # a
        (1e-4, 2.0),    # b
        (-0.999, 0.999),# rho
        (-2.0, 2.0),    # m
        (1e-4, 2.0),    # sigma
    ]

    for x0 in starts:
        try:
            res = minimize(objective, x0, method="L-BFGS-B", bounds=bounds,
                           options={"maxiter": 500, "ftol": 1e-12})
            rmse = math.sqrt(res.fun / max(1, len(k_mkt)))
            if res.success and rmse < best_rmse:
                best_rmse = rmse
                best_res = res.x
        except Exception:
            continue

    if best_res is None:
        # Fallback: flat surface at market mean
        mean_w = float(np.mean(w_mkt))
        best_res = np.array([mean_w, 0.001, 0.0, 0.0, 0.1])
        best_rmse = 999.0

    return best_res, best_rmse


# ── Main compute function ─────────────────────────────────────────────────────

def compute_vol_surface(inp: VolSurfaceInput) -> VolSurfaceOutput:
    S = inp.spot_price
    r = 0.05  # risk-free rate approximation

    # Group options by expiry (using expiry_days rounded to nearest day)
    grouped: dict[float, list] = {}
    for o in inp.options:
        key = round(o.expiry_days)
        grouped.setdefault(key, []).append(o)

    surface_points: list[VolSurfacePoint] = []
    atm_iv_by_expiry: list[dict] = []
    skew_25d_by_expiry: list[dict] = []
    all_residuals: list[float] = []

    expiry_dates: dict[float, str] = {
        round(e.days_to_expiry): e.date for e in inp.expirations
    }

    for expiry_days_key in sorted(grouped.keys()):
        opts = grouped[expiry_days_key]
        T = expiry_days_key / 365.0
        if T <= 0:
            continue

        F = S * math.exp(r * T)  # Forward price
        expiry_date = expiry_dates.get(expiry_days_key, "")

        # Use calls only (avoid put-call ambiguity); filter by IV validity
        calls = [o for o in opts if o.option_type == "call" and 5 < o.mark_iv < 500]
        if len(calls) < 3:
            # Fall back to all options
            calls = [o for o in opts if 5 < o.mark_iv < 500]
        if len(calls) < 2:
            continue

        # Build market data arrays
        strikes = np.array([o.strike for o in calls])
        iv_mkt = np.array([o.mark_iv / 100.0 for o in calls])
        w_mkt = iv_mkt**2 * T
        k_mkt = np.log(strikes / F)

        # Weight by open interest + volume
        oi = np.array([max(1.0, o.open_interest) for o in calls])
        vol_w = np.array([max(1.0, o.volume_24h) for o in calls])
        weights = np.sqrt(oi * vol_w)
        weights /= weights.sum()

        # Fit SVI
        params, slice_rmse = calibrate_svi_slice(k_mkt, w_mkt, weights)
        a, b, rho, m, sigma = params

        # Evaluate surface at all input strikes + extra interpolated points
        eval_strikes = sorted(set([o.strike for o in opts]))
        atm_strike = min(eval_strikes, key=lambda k: abs(k - S))

        for strike in eval_strikes:
            k = math.log(strike / F)
            w_fit = float(svi_w(np.array([k]), *params)[0])
            if w_fit <= 0:
                w_fit = 1e-4
            fitted_iv = math.sqrt(w_fit / T) * 100.0

            # Raw IV: closest market option at this strike
            dists = [abs(o.strike - strike) for o in opts]
            closest = opts[int(np.argmin(dists))]
            raw_iv = closest.mark_iv
            residual = raw_iv - fitted_iv

            delta = bs_call_delta(S, strike, T, r, fitted_iv / 100.0)

            surface_points.append(VolSurfacePoint(
                strike=strike,
                delta=round(delta, 4),
                expiry_days=float(expiry_days_key),
                expiry_date=expiry_date,
                raw_iv=round(raw_iv, 2),
                fitted_iv=round(fitted_iv, 2),
                residual=round(residual, 2),
            ))
            all_residuals.append(abs(residual))

        # ATM IV (fitted at spot)
        k_atm = math.log(S / F)
        w_atm = float(svi_w(np.array([k_atm]), *params)[0])
        atm_iv = math.sqrt(max(1e-6, w_atm) / T) * 100.0
        atm_iv_by_expiry.append({"expiry_days": float(expiry_days_key), "atm_iv": round(atm_iv, 2)})

        # 25-delta strikes via bisection
        def call_delta_fn(K: float) -> float:
            return bs_call_delta(S, K, T, r, atm_iv / 100.0)

        try:
            lo, hi = S * 0.5, S * 1.5
            # 25d put → call delta = 0.75
            K_put25 = _bisect_delta(call_delta_fn, 0.75, lo, hi)
            # 25d call → call delta = 0.25
            K_call25 = _bisect_delta(call_delta_fn, 0.25, lo, hi)

            k_put25 = math.log(K_put25 / F)
            k_call25 = math.log(K_call25 / F)
            w_put = float(svi_w(np.array([k_put25]), *params)[0])
            w_call = float(svi_w(np.array([k_call25]), *params)[0])
            iv_put25 = math.sqrt(max(1e-6, w_put) / T) * 100.0
            iv_call25 = math.sqrt(max(1e-6, w_call) / T) * 100.0
            skew_25d = round(iv_call25 - iv_put25, 2)
        except Exception:
            skew_25d = 0.0

        skew_25d_by_expiry.append({"expiry_days": float(expiry_days_key), "skew_25d": skew_25d})

    # Overall fit quality
    if all_residuals:
        rmse = math.sqrt(sum(r**2 for r in all_residuals) / len(all_residuals))
        max_res = max(all_residuals)
    else:
        rmse = 0.0
        max_res = 0.0

    return VolSurfaceOutput(
        asset=inp.asset.upper(),
        spot_price=S,
        surface=surface_points,
        fit_quality=FitQuality(
            rmse=round(rmse, 3),
            max_residual=round(max_res, 3),
            method="SVI",
        ),
        summary=VolSurfaceSummary(
            atm_iv_by_expiry=atm_iv_by_expiry,
            skew_25d_by_expiry=skew_25d_by_expiry,
        ),
        computed_at=datetime.now(tz=timezone.utc).isoformat(),
    )


def _bisect_delta(fn, target: float, lo: float, hi: float, tol: float = 0.5) -> float:
    for _ in range(50):
        mid = (lo + hi) / 2
        val = fn(mid)
        if abs(val - target) < 1e-6:
            return mid
        if val > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
