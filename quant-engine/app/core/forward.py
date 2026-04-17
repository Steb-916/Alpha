"""Put-call parity forward inference (diagnostic only).

Ported from RND.py §infer_forward (line 155-201). Deribit provides
underlying_price directly, so this is only used as a consistency check —
if the put-call-parity forward diverges significantly from Deribit's
underlying, the confidence score gets dinged.

F_pcp = K + (C - P) * e^(rT)
"""

from __future__ import annotations

import math

import numpy as np


def infer_forward_pcp(
    strikes: np.ndarray,
    call_prices: np.ndarray,
    put_prices: np.ndarray,
    r: float,
    t_years: float,
    near_atm_strike: float | None = None,
) -> float | None:
    """Median put-call-parity forward across strikes near ATM.

    Uses a 20% band around the nearest-ATM strike to pick stable pairs.
    Returns None if insufficient pairs are available.
    """
    if len(strikes) == 0 or t_years <= 0:
        return None

    strikes = np.asarray(strikes, dtype=float)
    c = np.asarray(call_prices, dtype=float)
    p = np.asarray(put_prices, dtype=float)

    if near_atm_strike is None:
        near_atm_strike = float(strikes[len(strikes) // 2])

    band_lo = near_atm_strike * 0.8
    band_hi = near_atm_strike * 1.2
    mask = (strikes >= band_lo) & (strikes <= band_hi)
    if mask.sum() < 3:
        mask = np.ones_like(strikes, dtype=bool)

    discount = math.exp(r * t_years)
    forwards = strikes[mask] + (c[mask] - p[mask]) * discount
    valid = forwards[np.isfinite(forwards)]
    if len(valid) == 0:
        return None
    return float(np.median(valid))
