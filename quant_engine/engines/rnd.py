"""
Risk-Neutral Density extraction via Breeden-Litzenberger (1978).

Steps:
  1. Fit a cubic spline to call prices across strikes.
  2. Take the second derivative: q(K) = e^(r*T) * d²C/dK²
  3. Normalize to a proper probability density.
  4. Compute distribution statistics.
"""

from __future__ import annotations

import math

import numpy as np
from scipy.interpolate import UnivariateSpline
from scipy.stats import moment as scipy_moment

from models import RNDInput, RNDOutput, RNDStatistics, RNDConfidence


def compute_rnd(inp: RNDInput) -> RNDOutput:
    S = inp.spot_price
    T = max(inp.expiry_days / 365.0, 1 / 365)
    r = inp.risk_free_rate
    discount = math.exp(r * T)

    # Filter to calls with valid prices
    calls = [o for o in inp.options if o.option_type == "call" and o.call_price_usd > 0]
    calls = sorted(calls, key=lambda o: o.strike)

    if len(calls) < 5:
        # Not enough data — return degenerate lognormal density
        return _lognormal_fallback(inp)

    strikes = np.array([o.strike for o in calls], dtype=float)
    prices = np.array([o.call_price_usd for o in calls], dtype=float)

    # Remove obvious arbitrage: call prices must be decreasing in strike
    prices = np.maximum.accumulate(prices[::-1])[::-1]

    # Fit cubic spline with smoothing
    try:
        spline = UnivariateSpline(strikes, prices, k=3, s=len(calls) * 0.01, ext=3)
    except Exception:
        return _lognormal_fallback(inp)

    # Evaluate density on fine grid
    K_lo = max(S * 0.40, strikes[0] * 0.85)
    K_hi = min(S * 2.0, strikes[-1] * 1.15)
    K_grid = np.linspace(K_lo, K_hi, 200)

    # Second derivative of call price = risk-neutral PDF
    dK = K_grid[1] - K_grid[0]
    C = spline(K_grid)
    d2C = np.gradient(np.gradient(C, dK), dK)
    q = discount * d2C

    # Zero out negative density values (arbitrage artifacts)
    q = np.maximum(q, 0.0)

    # Normalize
    total = np.trapz(q, K_grid)
    if total <= 0:
        return _lognormal_fallback(inp)
    q /= total

    # Build density list (downsample to ~80 points for API response)
    n_out = 80
    idx = np.round(np.linspace(0, len(K_grid) - 1, n_out)).astype(int)
    density = [
        {"price": round(float(K_grid[i])), "probability": round(float(q[i]), 6)}
        for i in idx
    ]

    # Statistics
    mean = float(np.trapz(K_grid * q, K_grid))
    variance = float(np.trapz((K_grid - mean) ** 2 * q, K_grid))
    std_dev = math.sqrt(max(0, variance))
    skewness = (
        float(np.trapz((K_grid - mean) ** 3 * q, K_grid)) / (std_dev**3)
        if std_dev > 0
        else 0.0
    )
    kurt = (
        float(np.trapz((K_grid - mean) ** 4 * q, K_grid)) / (std_dev**4)
        if std_dev > 0
        else 3.0
    )

    # Median via CDF
    cdf = np.cumsum(q * np.gradient(K_grid))
    cdf /= cdf[-1]
    median_idx = int(np.searchsorted(cdf, 0.5))
    median = float(K_grid[min(median_idx, len(K_grid) - 1)])

    # Mode
    mode_idx = int(np.argmax(q))
    mode = float(K_grid[mode_idx])

    # Probabilities
    prob_above_spot = float(np.trapz(q[K_grid > S], K_grid[K_grid > S])) if np.any(K_grid > S) else 0.5

    thr_lo = 80_000 if inp.asset.upper() == "BTC" else S * 0.81
    thr_hi = 90_000 if inp.asset.upper() == "BTC" else S * 1.19
    prob_below_lo = float(np.trapz(q[K_grid < thr_lo], K_grid[K_grid < thr_lo])) if np.any(K_grid < thr_lo) else 0.0
    prob_above_hi = float(np.trapz(q[K_grid > thr_hi], K_grid[K_grid > thr_hi])) if np.any(K_grid > thr_hi) else 0.0

    return RNDOutput(
        asset=inp.asset.upper(),
        expiry_date=inp.expiry_date,
        expiry_days=inp.expiry_days,
        spot_price=S,
        density=density,
        statistics=RNDStatistics(
            mean=round(mean),
            median=round(median),
            mode=round(mode),
            std_dev=round(std_dev),
            skewness=round(skewness, 3),
            kurtosis=round(kurt, 3),
            prob_above_spot=round(prob_above_spot, 4),
            prob_below_80k=round(prob_below_lo, 4),
            prob_above_90k=round(prob_above_hi, 4),
        ),
        confidence=RNDConfidence(
            method="Breeden-Litzenberger",
            n_options_used=len(calls),
            strike_range=(round(float(strikes[0])), round(float(strikes[-1]))),
            quality="good" if len(calls) >= 10 else "fair",
        ),
    )


def _lognormal_fallback(inp: RNDInput) -> RNDOutput:
    """Fallback: log-normal density using ATM IV."""
    S = inp.spot_price
    T = max(inp.expiry_days / 365.0, 1 / 365)
    sigma = 0.60  # default 60% if no data

    # Use average IV from available options
    ivs = [o.iv / 100.0 for o in inp.options if o.iv > 0]
    if ivs:
        sigma = sum(ivs) / len(ivs)

    sigmaT = sigma * math.sqrt(T)
    K_grid = np.linspace(S * 0.45, S * 1.65, 80)

    q = np.array([
        (1 / (K * sigmaT * math.sqrt(2 * math.pi)))
        * math.exp(-0.5 * ((math.log(K / S) + 0.5 * sigmaT**2) / sigmaT) ** 2)
        for K in K_grid
    ])
    total = np.trapz(q, K_grid)
    if total > 0:
        q /= total

    density = [{"price": round(float(K)), "probability": round(float(p), 6)}
               for K, p in zip(K_grid, q)]

    from scipy.stats import norm as sp_norm
    prob_above_spot = float(sp_norm.cdf(0.5 * sigmaT))

    return RNDOutput(
        asset=inp.asset.upper(),
        expiry_date=inp.expiry_date,
        expiry_days=inp.expiry_days,
        spot_price=S,
        density=density,
        statistics=RNDStatistics(
            mean=round(S * math.exp(0.5 * sigmaT**2)),
            median=round(S),
            mode=round(S * math.exp(-sigmaT**2)),
            std_dev=round(S * math.sqrt((math.exp(sigmaT**2) - 1) * math.exp(sigmaT**2))),
            skewness=round((math.exp(sigmaT**2) + 2) * math.sqrt(math.exp(sigmaT**2) - 1), 3),
            kurtosis=round(math.exp(4 * sigmaT**2) + 2 * math.exp(3 * sigmaT**2) + 3 * math.exp(2 * sigmaT**2) - 3, 3),
            prob_above_spot=round(prob_above_spot, 4),
            prob_below_80k=0.0,
            prob_above_90k=0.0,
        ),
        confidence=RNDConfidence(
            method="Log-normal fallback",
            n_options_used=len(inp.options),
            strike_range=(round(S * 0.45), round(S * 1.65)),
            quality="low",
        ),
    )
