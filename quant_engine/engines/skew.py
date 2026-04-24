"""
Volatility Skew + Term Structure.

Per expiry:
  1. Black-Scholes delta per strike → interpolate to find 25d/10d/5d put and call strikes.
  2. Evaluate fitted IV at those strikes (linear interpolation of mark_iv).
  3. skew_25d = call_iv_25d − put_iv_25d (negative = puts bid).
  4. Build smile: IV vs call_delta (11 points from 0.10 to 0.90).
  5. Term structure shape: contango / backwardation / flat.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import numpy as np
from scipy.interpolate import interp1d
from scipy.stats import norm

from models import (
    SkewInput,
    SkewOutput,
    SkewByExpiry,
    SmilePoint,
    TermStructurePoint,
)

SMILE_DELTAS = [0.10, 0.15, 0.20, 0.25, 0.35, 0.50, 0.65, 0.75, 0.80, 0.85, 0.90]


# ── Black-Scholes helpers ─────────────────────────────────────────────────────

def bs_call_delta(S: float, K: float, T: float, sigma: float, r: float = 0.0) -> float:
    if T <= 0 or sigma <= 0 or K <= 0:
        return 1.0 if S > K else 0.0
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    return float(norm.cdf(d1))


def _bisect_strike_for_delta(
    target_delta: float, S: float, T: float, sigma: float, r: float = 0.0
) -> float:
    lo, hi = S * 0.1, S * 5.0
    for _ in range(60):
        mid = (lo + hi) / 2
        d = bs_call_delta(S, mid, T, sigma, r)
        if abs(d - target_delta) < 1e-6:
            return mid
        if d > target_delta:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ── Main compute function ─────────────────────────────────────────────────────

def compute_skew(inp: SkewInput) -> SkewOutput:
    S = inp.spot_price
    r = 0.0

    # Group by expiry_days
    grouped: dict[int, list] = {}
    for o in inp.options:
        key = round(o.expiry_days)
        grouped.setdefault(key, []).append(o)

    by_expiry: list[SkewByExpiry] = []
    term_structure: list[TermStructurePoint] = []

    for expiry_days in sorted(grouped.keys()):
        opts = grouped[expiry_days]
        T = expiry_days / 365.0
        if T <= 0:
            continue

        # Filter valid IVs, split calls/puts
        valid = [o for o in opts if 5.0 < o.mark_iv < 500.0]
        if len(valid) < 3:
            continue

        # Build strike→IV map (use calls preferentially; weight by OI)
        strike_iv: dict[float, float] = {}
        for o in sorted(valid, key=lambda x: x.open_interest):
            strike_iv[o.strike] = o.mark_iv  # later (higher OI) overwrites

        strikes_sorted = sorted(strike_iv.keys())
        iv_arr = np.array([strike_iv[k] for k in strikes_sorted]) / 100.0
        K_arr = np.array(strikes_sorted)

        # ATM IV: interpolated at spot
        try:
            iv_interp = interp1d(K_arr, iv_arr, kind="linear", fill_value="extrapolate")
            atm_iv = float(iv_interp(S)) * 100.0
            atm_iv = max(5.0, atm_iv)
        except Exception:
            atm_iv = float(np.mean(iv_arr)) * 100.0

        # Build smile: evaluate IV at target deltas
        smile: list[SmilePoint] = []
        for target_delta in SMILE_DELTAS:
            K_target = _bisect_strike_for_delta(target_delta, S, T, atm_iv / 100.0, r)
            try:
                iv_at_delta = float(iv_interp(K_target)) * 100.0
                iv_at_delta = max(5.0, iv_at_delta)
            except Exception:
                iv_at_delta = atm_iv
            smile.append(SmilePoint(delta=target_delta, iv=round(iv_at_delta, 2)))

        # Extract 25d, 10d, 5d strikes
        K_put25 = _bisect_strike_for_delta(0.75, S, T, atm_iv / 100.0, r)
        K_call25 = _bisect_strike_for_delta(0.25, S, T, atm_iv / 100.0, r)
        K_put10 = _bisect_strike_for_delta(0.90, S, T, atm_iv / 100.0, r)
        K_call10 = _bisect_strike_for_delta(0.10, S, T, atm_iv / 100.0, r)
        K_put5 = _bisect_strike_for_delta(0.95, S, T, atm_iv / 100.0, r)
        K_call5 = _bisect_strike_for_delta(0.05, S, T, atm_iv / 100.0, r)

        try:
            put_iv_25d = float(iv_interp(K_put25)) * 100.0
            call_iv_25d = float(iv_interp(K_call25)) * 100.0
            put_iv_10d = float(iv_interp(K_put10)) * 100.0
            call_iv_10d = float(iv_interp(K_call10)) * 100.0
            put_iv_5d = float(iv_interp(K_put5)) * 100.0
            call_iv_5d = float(iv_interp(K_call5)) * 100.0
        except Exception:
            put_iv_25d = call_iv_25d = atm_iv
            put_iv_10d = call_iv_10d = atm_iv
            put_iv_5d = call_iv_5d = atm_iv

        skew_25d = call_iv_25d - put_iv_25d
        skew_10d = call_iv_10d - put_iv_10d
        skew_5d = call_iv_5d - put_iv_5d

        # Expiry date approximation
        expiry_date = (datetime.utcnow() + timedelta(days=expiry_days)).strftime("%Y-%m-%d")

        by_expiry.append(SkewByExpiry(
            expiry_date=expiry_date,
            expiry_days=float(expiry_days),
            skew_25d=round(skew_25d, 2),
            skew_10d=round(skew_10d, 2),
            skew_5d=round(skew_5d, 2),
            put_iv_25d=round(max(5.0, put_iv_25d), 2),
            call_iv_25d=round(max(5.0, call_iv_25d), 2),
            atm_iv=round(atm_iv, 2),
            smile=smile,
        ))
        term_structure.append(TermStructurePoint(
            expiry_days=float(expiry_days),
            atm_iv=round(atm_iv, 2),
        ))

    if not by_expiry:
        return SkewOutput(
            asset=inp.asset.upper(),
            by_expiry=[],
            term_structure=[],
            term_structure_shape="flat",
        )

    # Determine term structure shape
    shape = _term_structure_shape(term_structure)

    return SkewOutput(
        asset=inp.asset.upper(),
        by_expiry=by_expiry,
        term_structure=term_structure,
        term_structure_shape=shape,
    )


def _term_structure_shape(ts: list[TermStructurePoint]) -> str:
    if len(ts) < 2:
        return "flat"
    # Linear regression slope
    xs = np.array([p.expiry_days for p in ts])
    ys = np.array([p.atm_iv for p in ts])
    slope = float(np.polyfit(xs, ys, 1)[0])
    if slope > 0.03:
        return "contango"
    elif slope < -0.03:
        return "backwardation"
    return "flat"
