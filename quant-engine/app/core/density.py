"""Breeden-Litzenberger risk-neutral density extraction.

Port of the core algorithm in RND.py §build_density (line 304-423),
adapted for crypto per the Phase 3 PRD §3 Step 2:
  - Input IVs come from Deribit mark_iv (percent, converted to decimal)
  - No American early-exercise haircut (crypto options are European)
  - Forward taken from input (Deribit underlying_price), not inferred
  - Risk-free rate configurable, default 0.0

Algorithm:
  1. Fit UnivariateSpline(k=4) to the (strike, IV) pairs.
  2. Build a dense strike grid over a wide maturity-dependent bracket.
  3. Evaluate the spline on the grid with lognormal wing extrapolation.
  4. Price BS calls at every grid point using the fitted IV.
  5. Enforce no-arbitrage: monotonically-decreasing call prices in K, and
     nonnegative convexity (dC/dK >= 0 second derivative).
  6. Take the second finite-difference → density (Breeden-Litzenberger).
  7. Clip negatives, normalize to integrate to 1.
"""

from __future__ import annotations

import numpy as np

from .black_scholes import bs_call
from .bounds import get_strike_bounds
from .spline import evaluate_iv_with_wings, fit_iv_spline


DENSITY_GRID_POINTS = 500
WING_SIGMA = 4.0


def build_density(
    spot: float,
    strikes: np.ndarray,
    ivs: np.ndarray,
    t_years: float,
    r: float = 0.0,
    atm_iv_hint: float | None = None,
) -> tuple[np.ndarray, np.ndarray, dict] | None:
    """Return (k_grid, density, diagnostics) for a single expiration.

    `strikes` and `ivs` are the cleaned pairs from one expiration. `ivs`
    must be in decimal (0.52 for 52%). Returns None when the input is too
    sparse to fit a k=4 spline.
    """
    if t_years <= 0 or spot <= 0:
        return None
    if len(strikes) < 6:
        return None

    strikes = np.asarray(strikes, dtype=float)
    ivs = np.asarray(ivs, dtype=float)

    # 1. Fit spline
    spline = fit_iv_spline(strikes, ivs, degree=4, smoothing=0.01)
    if spline is None:
        return None

    # 2. Strike grid — 4σ bracket around spot
    atm_iv = (
        float(atm_iv_hint)
        if atm_iv_hint is not None
        else float(spline(spot))
    )
    if not np.isfinite(atm_iv) or atm_iv <= 0:
        atm_iv = float(np.median(ivs))
    k_min, k_max = get_strike_bounds(spot, atm_iv, t_years, n_sigma=WING_SIGMA)
    k_grid = np.linspace(k_min, k_max, DENSITY_GRID_POINTS)

    # 3. Evaluate IV with wing extrapolation
    iv_grid = evaluate_iv_with_wings(
        spline,
        k_grid,
        k_min_obs=float(strikes.min()),
        k_max_obs=float(strikes.max()),
        atm_iv=atm_iv,
    )

    # 4. Call prices via BS on the dense grid
    c_grid = bs_call(spot, k_grid, r, iv_grid, t_years)
    c_grid = np.asarray(c_grid, dtype=float)

    # 5. Monotonicity enforcement: C(K) should be non-increasing in K.
    #    Walk left-to-right, clamping each value to the running minimum.
    for i in range(1, len(c_grid)):
        if c_grid[i] > c_grid[i - 1]:
            c_grid[i] = c_grid[i - 1]

    # 5b. Convexity enforcement via isotonic regression on dC/dK.
    #     We want d²C/dK² >= 0 — approximate by ensuring the first
    #     difference is non-decreasing (i.e. becomes less negative).
    dk = k_grid[1] - k_grid[0]
    dc = np.diff(c_grid) / dk
    for i in range(1, len(dc)):
        if dc[i] < dc[i - 1]:
            dc[i] = dc[i - 1]
    # Reconstruct c_grid from the monotonized differences
    c_grid_fixed = np.empty_like(c_grid)
    c_grid_fixed[0] = c_grid[0]
    c_grid_fixed[1:] = c_grid[0] + np.cumsum(dc) * dk
    # Blend lightly back toward original to avoid excessive smoothing
    c_grid = 0.5 * (c_grid + c_grid_fixed)

    # 6. Second derivative → density (Breeden-Litzenberger)
    #    density(K) = exp(rT) * d²C / dK²
    second = np.gradient(np.gradient(c_grid, k_grid), k_grid)
    density = np.exp(r * t_years) * second

    # 7. Clip negatives, normalize
    density = np.clip(density, 0.0, None)
    mass_raw = float(np.trapezoid(density, k_grid))
    if mass_raw <= 0 or not np.isfinite(mass_raw):
        return None
    density = density / mass_raw
    mass_final = float(np.trapezoid(density, k_grid))

    diagnostics = {
        "atm_iv_used": atm_iv,
        "strike_min_observed": float(strikes.min()),
        "strike_max_observed": float(strikes.max()),
        "strike_min_grid": float(k_min),
        "strike_max_grid": float(k_max),
        "n_strikes_input": int(len(strikes)),
        "mass_pre_normalize": mass_raw,
        "mass_post_normalize": mass_final,
        "grid_points": DENSITY_GRID_POINTS,
    }
    return k_grid, density, diagnostics
