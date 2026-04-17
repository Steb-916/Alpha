"""Maturity-dependent strike bounds.

Ported from RND.py §get_strike_bounds (line 206-212). Uses the ATM IV
and n-sigma range to bracket the density integration domain.
"""

from __future__ import annotations

import math


def get_strike_bounds(
    spot: float,
    atm_iv: float,
    t_years: float,
    n_sigma: float = 4.0,
) -> tuple[float, float]:
    """Log-space strike bounds: S * exp(±n·σ·√T).

    n=4 captures >99.99% of the risk-neutral measure for log-normal models;
    more than enough cushion for cryptocurrency vol surfaces.
    """
    if spot <= 0 or atm_iv <= 0 or t_years <= 0:
        return (max(spot * 0.5, 1.0), spot * 1.5)
    half_width = n_sigma * atm_iv * math.sqrt(t_years)
    k_min = spot * math.exp(-half_width)
    k_max = spot * math.exp(half_width)
    return (k_min, k_max)
