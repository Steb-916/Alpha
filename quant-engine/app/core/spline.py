"""IV spline fitting with lognormal wing extrapolation.

Extracted from RND.py §build_density (line 304-423). Uses UnivariateSpline
with degree 4 (matches original). Beyond the observed strike range, we blend
toward a lognormal tail so the density has well-behaved wings (avoids
spurious left/right-tail mass that breaks the integration).
"""

from __future__ import annotations

import numpy as np
from scipy.interpolate import UnivariateSpline


def fit_iv_spline(
    strikes: np.ndarray,
    ivs: np.ndarray,
    degree: int = 4,
    smoothing: float = 0.01,
) -> UnivariateSpline | None:
    """Fit a smoothing spline to (strike, IV). Returns None if the input
    doesn't have enough unique strikes to fit a k-th order spline.
    """
    if len(strikes) < degree + 1:
        return None

    # UnivariateSpline requires strictly-increasing x — average duplicates.
    order = np.argsort(strikes)
    strikes = strikes[order]
    ivs = ivs[order]

    dedup_x = [strikes[0]]
    dedup_y = [ivs[0]]
    for i in range(1, len(strikes)):
        if strikes[i] == dedup_x[-1]:
            dedup_y[-1] = 0.5 * (dedup_y[-1] + ivs[i])
        else:
            dedup_x.append(float(strikes[i]))
            dedup_y.append(float(ivs[i]))
    x = np.asarray(dedup_x)
    y = np.asarray(dedup_y)

    if len(x) < degree + 1:
        return None

    try:
        # s = smoothing * len(x) keeps the parameter meaningful as the
        # input size changes — same convention as the original RND.py.
        return UnivariateSpline(x, y, k=degree, s=smoothing * len(x))
    except Exception:
        return None


def evaluate_iv_with_wings(
    spline: UnivariateSpline,
    k_query: np.ndarray,
    k_min_obs: float,
    k_max_obs: float,
    atm_iv: float,
    blend_fraction: float = 0.15,
) -> np.ndarray:
    """Evaluate the spline on `k_query` and blend wings toward a flat
    lognormal-consistent extrapolation outside [k_min_obs, k_max_obs].

    Keeps the spline pinned to the observed ATM IV far from spot — crucial
    for avoiding exploding density in the tails. `blend_fraction` controls
    how much of the observed range is used to smooth the transition.
    """
    iv = np.asarray(spline(k_query), dtype=float)

    # Wing bands: 15% of observed range on each side by default
    lo_band = k_min_obs * (1 - blend_fraction)
    hi_band = k_max_obs * (1 + blend_fraction)

    # Below the lowest observed strike: blend down to ATM IV
    left_mask = k_query < k_min_obs
    if left_mask.any():
        alpha = np.clip(
            (k_query[left_mask] - lo_band) / (k_min_obs - lo_band + 1e-12),
            0.0,
            1.0,
        )
        iv_left_edge = float(spline(k_min_obs))
        iv[left_mask] = alpha * iv_left_edge + (1.0 - alpha) * atm_iv

    # Above the highest observed strike: same blend on the right side
    right_mask = k_query > k_max_obs
    if right_mask.any():
        alpha = np.clip(
            (hi_band - k_query[right_mask]) / (hi_band - k_max_obs + 1e-12),
            0.0,
            1.0,
        )
        iv_right_edge = float(spline(k_max_obs))
        iv[right_mask] = alpha * iv_right_edge + (1.0 - alpha) * atm_iv

    # Sanity clip — never allow extrapolated IV to go out of a sane band
    iv = np.clip(iv, 0.05, 5.0)
    return iv
