"""compute_stats baseline checks on synthetic densities."""

from __future__ import annotations

import numpy as np

from app.core.statistics import (
    compute_stats,
    prob_above_strike,
    prob_below_strike,
)


def test_stats_on_uniform():
    # Uniform on [80, 120], spot = 100
    k = np.linspace(80, 120, 401)
    density = np.full_like(k, 1.0 / (120 - 80))
    stats = compute_stats(k, density, spot=100.0)
    # Mean = midpoint
    assert abs(stats.mean - 100.0) < 0.5
    # Std of U(a,b) = (b-a)/sqrt(12) = 40/sqrt(12) ≈ 11.547
    assert abs(stats.std_dev - 40.0 / np.sqrt(12)) < 0.5
    # Symmetric → skew ≈ 0
    assert abs(stats.skewness) < 0.05
    # 50/50 above/below spot
    assert abs(stats.prob_above_spot - 0.5) < 0.05


def test_stats_on_gaussian():
    # Gaussian centered at 100 with sigma 10 on a wide grid
    k = np.linspace(50, 150, 2001)
    sigma = 10.0
    density = (
        1.0 / (sigma * np.sqrt(2 * np.pi))
    ) * np.exp(-0.5 * ((k - 100.0) / sigma) ** 2)
    stats = compute_stats(k, density, spot=100.0)
    assert abs(stats.mean - 100.0) < 0.01
    assert abs(stats.std_dev - sigma) < 0.05
    assert abs(stats.skewness) < 0.05
    # Kurtosis excess for normal = 0
    assert abs(stats.kurtosis) < 0.1


def test_prob_thresholds():
    k = np.linspace(50, 150, 1001)
    sigma = 10.0
    density = (
        1.0 / (sigma * np.sqrt(2 * np.pi))
    ) * np.exp(-0.5 * ((k - 100.0) / sigma) ** 2)
    # P[S_T >= 100] = 0.5 for symmetric Gaussian at mean
    p_above = prob_above_strike(k, density, 100.0)
    assert abs(p_above - 0.5) < 0.02
    p_below = prob_below_strike(k, density, 100.0)
    assert abs(p_below - 0.5) < 0.02
