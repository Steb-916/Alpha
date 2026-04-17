"""Black-Scholes pricing and IV solver.

Pure math module ported from RND.py §bs_call (line 391-395) and
§bs_iv_from_price (line 982-994). All inputs are SI units for options
math: sigma as decimal (0.5 = 50% vol), T in years, r as decimal.
"""

from __future__ import annotations

import math
from typing import Literal

import numpy as np
from scipy.stats import norm

OptionType = Literal["call", "put"]


def _d1_d2(
    spot: float,
    strike: float,
    r: float,
    sigma: float,
    t_years: float,
) -> tuple[float, float]:
    sigma_sqrt_t = sigma * math.sqrt(t_years)
    d1 = (
        math.log(spot / strike) + (r + 0.5 * sigma * sigma) * t_years
    ) / sigma_sqrt_t
    d2 = d1 - sigma_sqrt_t
    return d1, d2


def bs_call(
    spot: float | np.ndarray,
    strike: float | np.ndarray,
    r: float,
    sigma: float | np.ndarray,
    t_years: float,
) -> float | np.ndarray:
    """Black-Scholes call price. Vectorized over strike and sigma."""
    sigma = np.asarray(sigma, dtype=float)
    strike = np.asarray(strike, dtype=float)
    sqrt_t = math.sqrt(t_years)
    sigma_sqrt_t = sigma * sqrt_t
    # Avoid divide-by-zero on ATM expiries
    sigma_sqrt_t = np.where(sigma_sqrt_t <= 0, 1e-12, sigma_sqrt_t)
    d1 = (
        np.log(spot / strike) + (r + 0.5 * sigma * sigma) * t_years
    ) / sigma_sqrt_t
    d2 = d1 - sigma_sqrt_t
    price = spot * norm.cdf(d1) - strike * math.exp(-r * t_years) * norm.cdf(d2)
    return price


def bs_put(
    spot: float | np.ndarray,
    strike: float | np.ndarray,
    r: float,
    sigma: float | np.ndarray,
    t_years: float,
) -> float | np.ndarray:
    """Black-Scholes put price via put-call parity."""
    call = bs_call(spot, strike, r, sigma, t_years)
    return call - spot + np.asarray(strike, dtype=float) * math.exp(-r * t_years)


def bs_iv_from_price(
    market_price: float,
    spot: float,
    strike: float,
    r: float,
    t_years: float,
    option_type: OptionType = "call",
    lo: float = 1e-3,
    hi: float = 5.0,
    iterations: int = 60,
    tol: float = 1e-6,
) -> float | None:
    """Bisection IV solver. Returns implied vol as decimal, or None on failure.

    Mirrors RND.py's bisection approach with 60 iterations and a wide
    [0.001, 5.0] bracket. Wide bracket handles extreme crypto vols that
    blow through the equity-typical [0.01, 2.0] range.
    """
    if market_price <= 0 or t_years <= 0:
        return None

    # Intrinsic lower bound for calls; subtracted discount for puts.
    discount = math.exp(-r * t_years)
    intrinsic = (
        max(0.0, spot - strike * discount)
        if option_type == "call"
        else max(0.0, strike * discount - spot)
    )
    if market_price < intrinsic:
        return None

    def price_at(vol: float) -> float:
        if option_type == "call":
            return float(bs_call(spot, strike, r, vol, t_years))
        # Put via parity
        return float(bs_call(spot, strike, r, vol, t_years) - spot + strike * discount)

    lo_v, hi_v = lo, hi
    f_lo = price_at(lo_v) - market_price
    f_hi = price_at(hi_v) - market_price
    if f_lo * f_hi > 0:
        # Market price outside solvable bracket.
        return None

    for _ in range(iterations):
        mid = 0.5 * (lo_v + hi_v)
        f_mid = price_at(mid) - market_price
        if abs(f_mid) < tol:
            return mid
        if f_lo * f_mid < 0:
            hi_v = mid
            f_hi = f_mid
        else:
            lo_v = mid
            f_lo = f_mid
    return 0.5 * (lo_v + hi_v)


def bs_delta(
    spot: float,
    strike: float,
    r: float,
    sigma: float,
    t_years: float,
    option_type: OptionType = "call",
) -> float:
    """Analytic Black-Scholes delta."""
    if sigma <= 0 or t_years <= 0:
        return 1.0 if option_type == "call" and spot > strike else 0.0
    d1, _ = _d1_d2(spot, strike, r, sigma, t_years)
    n_d1 = float(norm.cdf(d1))
    return n_d1 if option_type == "call" else n_d1 - 1.0
