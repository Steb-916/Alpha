"""Skew metrics from an options chain.

Ported from RND.py §slice_greeks (line 996-1054) with Phase 3 extensions:
  - Emit 25-delta, 10-delta, and 5-delta skew (original only had 25-delta)
  - Emit a full smile array (delta → IV) for frontend smile plots
  - Emit cross-expiry term structure (expiry_days → ATM IV) + shape label

Operates directly on the raw (strike, iv, delta) tuples from the Deribit
chain — no need to go through the density here. For delta we use the
analytic BS delta (spline fits + BS Greeks give the same answer in the
infinite-data limit and the chain IVs are already cleaned).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from .black_scholes import bs_delta


OptionType = Literal["call", "put"]


@dataclass
class SmilePoint:
    delta: float
    iv: float


@dataclass
class ExpirySkew:
    expiry_date: str
    expiry_days: float
    atm_iv: float
    put_iv_25d: float
    call_iv_25d: float
    skew_25d: float
    skew_10d: float
    skew_5d: float
    smile: list[SmilePoint]


def _nearest_iv_at_delta(
    target_delta: float,
    strikes: np.ndarray,
    ivs: np.ndarray,
    deltas: np.ndarray,
) -> float:
    """Find the strike whose BS delta is closest to `target_delta`, return its IV."""
    if len(strikes) == 0:
        return float("nan")
    diffs = np.abs(deltas - target_delta)
    idx = int(np.argmin(diffs))
    return float(ivs[idx])


def compute_expiry_skew(
    expiry_date: str,
    expiry_days: float,
    spot_price: float,
    strikes: list[float],
    ivs_pct: list[float],
    option_types: list[OptionType],
    r: float = 0.0,
) -> ExpirySkew | None:
    """Build the skew/smile row for one expiration.

    IVs come in Deribit percent (52.3 = 52.3%) and are converted to decimals
    internally; the output fields match Deribit's percent convention since
    that's what the frontend displays.
    """
    if len(strikes) == 0 or spot_price <= 0 or expiry_days <= 0:
        return None

    k = np.asarray(strikes, dtype=float)
    iv_pct = np.asarray(ivs_pct, dtype=float)
    iv_dec = iv_pct / 100.0
    t_years = expiry_days / 365.0

    # Compute delta for each instrument given its own option type + IV
    deltas = np.array(
        [
            bs_delta(spot_price, float(k[i]), r, float(iv_dec[i]), t_years, option_types[i])
            for i in range(len(k))
        ],
        dtype=float,
    )

    # Split by option type for the delta lookups
    call_mask = np.array([o == "call" for o in option_types])
    put_mask = ~call_mask

    if not call_mask.any() or not put_mask.any():
        # Need both sides to compute risk reversals
        return None

    call_deltas = deltas[call_mask]
    put_deltas = deltas[put_mask]
    call_ivs = iv_pct[call_mask]
    put_ivs = iv_pct[put_mask]
    call_strikes = k[call_mask]
    put_strikes = k[put_mask]

    # ATM IV: IV at the strike nearest spot (any option type)
    atm_idx = int(np.argmin(np.abs(k - spot_price)))
    atm_iv = float(iv_pct[atm_idx])

    # 25d call is delta ≈ +0.25; 25d put is delta ≈ -0.25
    call_iv_25 = _nearest_iv_at_delta(0.25, call_strikes, call_ivs, call_deltas)
    put_iv_25 = _nearest_iv_at_delta(-0.25, put_strikes, put_ivs, put_deltas)
    call_iv_10 = _nearest_iv_at_delta(0.10, call_strikes, call_ivs, call_deltas)
    put_iv_10 = _nearest_iv_at_delta(-0.10, put_strikes, put_ivs, put_deltas)
    call_iv_05 = _nearest_iv_at_delta(0.05, call_strikes, call_ivs, call_deltas)
    put_iv_05 = _nearest_iv_at_delta(-0.05, put_strikes, put_ivs, put_deltas)

    def skew_or_zero(put_v: float, call_v: float) -> float:
        if np.isnan(put_v) or np.isnan(call_v):
            return 0.0
        return float(put_v - call_v)

    # Build smile in delta order. For puts we map to positive delta
    # magnitudes so the plot reads left-to-right.
    smile_pairs = []
    for i in range(len(k)):
        d = float(deltas[i])
        # Put-side deltas are negative; represent as (1 - |delta|) for plotting
        display_delta = d if option_types[i] == "call" else -d
        smile_pairs.append((display_delta, float(iv_pct[i])))
    smile_pairs.sort(key=lambda pt: pt[0])
    # Deduplicate by delta bucket — averages IVs that end up at the same
    # delta (rare but possible near ATM boundary)
    smile: list[SmilePoint] = []
    last_delta = None
    last_iv_sum = 0.0
    last_count = 0
    for d, iv in smile_pairs:
        bucket = round(d, 3)
        if last_delta is None or bucket != last_delta:
            if last_delta is not None:
                smile.append(SmilePoint(delta=last_delta, iv=last_iv_sum / last_count))
            last_delta = bucket
            last_iv_sum = iv
            last_count = 1
        else:
            last_iv_sum += iv
            last_count += 1
    if last_delta is not None:
        smile.append(SmilePoint(delta=last_delta, iv=last_iv_sum / last_count))

    return ExpirySkew(
        expiry_date=expiry_date,
        expiry_days=expiry_days,
        atm_iv=atm_iv,
        put_iv_25d=put_iv_25 if not np.isnan(put_iv_25) else atm_iv,
        call_iv_25d=call_iv_25 if not np.isnan(call_iv_25) else atm_iv,
        skew_25d=skew_or_zero(put_iv_25, call_iv_25),
        skew_10d=skew_or_zero(put_iv_10, call_iv_10),
        skew_5d=skew_or_zero(put_iv_05, call_iv_05),
        smile=smile,
    )


def classify_term_structure(
    term_points: list[tuple[float, float]],
) -> Literal["contango", "backwardation", "flat"]:
    """Label the ATM-IV term structure.

    Contango = longer-dated IV > shorter-dated IV (usual in calm markets).
    Backwardation = front-dated IV > back-dated IV (event-driven stress).
    Flat = no meaningful slope.
    """
    if len(term_points) < 2:
        return "flat"
    xs = np.array([t[0] for t in term_points], dtype=float)
    ys = np.array([t[1] for t in term_points], dtype=float)
    # Linear regression slope — positive = contango, negative = backwardation
    if xs.std() <= 0:
        return "flat"
    slope = float(np.polyfit(xs, ys, 1)[0])
    # Threshold in IV-pct per day — 0.05 per day is a mild shape
    if slope > 0.05:
        return "contango"
    if slope < -0.05:
        return "backwardation"
    return "flat"
