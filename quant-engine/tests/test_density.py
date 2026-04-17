"""Breeden-Litzenberger density sanity checks.

Inject a known smooth IV smile → density should integrate to ~1, have no
negatives, and have its mean near the input forward (spot when r=0).
"""

from __future__ import annotations

import numpy as np
import pytest

from app.core.density import build_density


def test_density_from_flat_smile():
    spot = 77_000.0
    t = 30 / 365
    # 21 strikes bracketing spot, flat 50% IV
    strikes = np.linspace(50_000, 110_000, 21)
    ivs = np.full_like(strikes, 0.50, dtype=float)

    result = build_density(spot, strikes, ivs, t_years=t, r=0.0)
    assert result is not None
    k_grid, density, diag = result

    # Density integrates to approximately 1
    mass = float(np.trapezoid(density, k_grid))
    assert 0.85 <= mass <= 1.15, f"mass={mass}"

    # Non-negative
    assert float(density.min()) >= 0

    # Mean reasonably close to spot (flat smile → lognormal → mean ≈ S·exp(σ²T/2))
    expected_mean = spot * np.exp(0.5 * 0.5 * 0.5 * t)
    actual_mean = float(np.trapezoid(k_grid * density, k_grid))
    rel_err = abs(actual_mean - expected_mean) / expected_mean
    assert rel_err < 0.05, f"mean rel err {rel_err:.3%}"


def test_density_from_smile_with_skew():
    # Build a realistic smile with put skew — left tail should be heavier
    spot = 80_000.0
    t = 60 / 365
    strikes = np.linspace(55_000, 110_000, 23)
    # IV higher on left (OTM puts), lower on right (OTM calls)
    k0 = spot
    ivs = 0.55 + 0.0005 * (k0 - strikes) * 0.01
    ivs = np.clip(ivs, 0.35, 0.9)

    result = build_density(spot, strikes, ivs, t_years=t)
    assert result is not None
    k_grid, density, _ = result

    assert float(density.min()) >= 0
    # Left tail mass > right tail mass (put skew implies larger P[S_T low])
    left_mass = float(
        np.trapezoid(
            density[k_grid < spot * 0.85],
            k_grid[k_grid < spot * 0.85],
        )
    )
    right_mass = float(
        np.trapezoid(
            density[k_grid > spot * 1.15],
            k_grid[k_grid > spot * 1.15],
        )
    )
    assert left_mass > right_mass


def test_density_rejects_sparse_input():
    # Only 3 strikes — too few to fit a k=4 spline
    result = build_density(
        spot=77_000,
        strikes=np.array([70_000, 80_000, 90_000]),
        ivs=np.array([0.5, 0.5, 0.5]),
        t_years=30 / 365,
    )
    assert result is None
