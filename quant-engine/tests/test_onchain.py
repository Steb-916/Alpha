"""MVRV z-score tests — Phase 5 Slice 1.

The correctness bar for a z-score computation is narrow: did we compute
the right mean/stdev over the right window, and did we classify the
regime from the right thresholds? Tests hit those directly and assert
invariants (monotone regime ordering, degenerate-input safety) rather
than pinning to magic numbers.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from app.core.onchain import (
    FlowRegimePoint,
    MVRVPoint,
    classify_regime,
    compute_flow_regime,
    compute_mvrv_z,
)


def _ts(day: int) -> str:
    base = datetime(2022, 1, 1, tzinfo=timezone.utc)
    return (base + timedelta(days=day)).isoformat().replace("+00:00", "Z")


def _series(values: list[float]) -> list[MVRVPoint]:
    return [MVRVPoint(timestamp=_ts(i), mvrv=v) for i, v in enumerate(values)]


# ─── Regime classifier ─────────────────────────────────────────────────────


class TestClassifyRegime:
    def test_deep_value_below_minus_one(self):
        assert classify_regime(-1.5) == "deep_value"

    def test_fair_between_minus_one_and_half(self):
        assert classify_regime(0.0) == "fair"
        assert classify_regime(0.49) == "fair"

    def test_elevated_between_half_and_two_and_half(self):
        assert classify_regime(0.5) == "elevated"
        assert classify_regime(2.49) == "elevated"

    def test_euphoria_above_two_and_half(self):
        assert classify_regime(2.5) == "euphoria"
        assert classify_regime(5.0) == "euphoria"

    def test_boundary_at_minus_one_is_fair(self):
        """-1.0 is the boundary — < -1.0 is deep_value; -1.0 classifies as fair."""
        assert classify_regime(-1.0) == "fair"


# ─── compute_mvrv_z — degenerate inputs ────────────────────────────────────


class TestMVRVDegenerateInputs:
    def test_empty_series_returns_none(self):
        assert compute_mvrv_z([], 1460) is None

    def test_short_series_returns_none(self):
        # Any series with < 30 points is too short to z-score meaningfully.
        assert compute_mvrv_z(_series([1.0, 1.1, 1.2]), 1460) is None

    def test_nan_in_series_returns_none(self):
        values = [1.0] * 40
        values[10] = float("nan")
        assert compute_mvrv_z(_series(values), 1460) is None


# ─── compute_mvrv_z — correctness ──────────────────────────────────────────


class TestMVRVCorrectness:
    def test_constant_series_yields_zero_z_score(self):
        """Zero-variance series forces z=0 (no deviation possible)."""
        result = compute_mvrv_z(_series([1.8] * 60), 1460)
        assert result is not None
        assert result.current_z_score == 0.0
        assert result.current_regime == "fair"

    def test_rising_tail_produces_positive_z(self):
        """Stable baseline then a jump — last point should be well above mean."""
        base = [1.5] * 90
        spike = [3.5] * 10
        result = compute_mvrv_z(_series(base + spike), 1460)
        assert result is not None
        assert result.current_z_score > 2.0
        assert result.current_regime in ("elevated", "euphoria")

    def test_falling_tail_produces_negative_z(self):
        base = [2.5] * 90
        dip = [1.0] * 10
        result = compute_mvrv_z(_series(base + dip), 1460)
        assert result is not None
        assert result.current_z_score < -1.0
        assert result.current_regime == "deep_value"

    def test_series_length_matches_input(self):
        values = [1.5 + 0.01 * i for i in range(120)]
        result = compute_mvrv_z(_series(values), 1460)
        assert result is not None
        assert len(result.series) == len(values)

    def test_series_timestamps_preserved(self):
        values = [1.5 + 0.01 * i for i in range(60)]
        result = compute_mvrv_z(_series(values), 1460)
        assert result is not None
        assert result.series[0].timestamp == _ts(0)
        assert result.series[-1].timestamp == _ts(59)

    def test_percentile_rises_with_rising_series(self):
        """Final value at an all-time high → percentile near 1.0."""
        result = compute_mvrv_z(
            _series([1.0 + 0.01 * i for i in range(120)]),
            1460,
        )
        assert result is not None
        assert result.historical_percentile > 0.95

    def test_percentile_falls_with_falling_tail(self):
        """Recent crash → current MVRV at historical low → percentile near 0."""
        values = [3.0 - 0.005 * i for i in range(120)] + [0.5] * 5
        result = compute_mvrv_z(_series(values), 1460)
        assert result is not None
        assert result.historical_percentile < 0.1

    def test_lookback_window_limits_distribution(self):
        """Short lookback ignores old pre-crash history when z-scoring."""
        # 200 days of 3.0, then 60 days of 1.0.
        # With lookback=60, the last point is at the mean of the last 60 → z near 0.
        # With lookback=260, the old 3.0 baseline dominates → strongly negative z.
        values = [3.0] * 200 + [1.0] * 60
        short = compute_mvrv_z(_series(values), 60)
        long = compute_mvrv_z(_series(values), 260)
        assert short is not None and long is not None
        assert abs(short.current_z_score) < abs(long.current_z_score)

    def test_interpretation_mentions_regime(self):
        result = compute_mvrv_z(_series([2.0 + 0.01 * i for i in range(120)]), 1460)
        assert result is not None
        assert result.current_regime.replace("_", " ") in result.interpretation.lower()


# ─── Regime derivation on series ───────────────────────────────────────────


class TestSeriesRegimes:
    def test_regime_labels_track_z_scores(self):
        """Every series point's regime should match classify_regime(its z_score)."""
        values = [1.5 + 0.02 * np.sin(i / 10) + 0.001 * i for i in range(200)]
        result = compute_mvrv_z(_series(values), 1460)
        assert result is not None
        for point in result.series:
            assert point.regime == classify_regime(point.z_score)


# ─── Flow regime ───────────────────────────────────────────────────────────


def _flow_series(values: list[float]) -> list[FlowRegimePoint]:
    return [
        FlowRegimePoint(timestamp=_ts(i), net_flow_usd=v) for i, v in enumerate(values)
    ]


class TestFlowRegimeDegenerateInputs:
    def test_empty_series_returns_none(self):
        assert compute_flow_regime([]) is None

    def test_short_series_returns_none(self):
        # Anything under MIN_HISTORY_DAYS (35) is too short to baseline.
        assert compute_flow_regime(_flow_series([0.0] * 30)) is None

    def test_nan_flows_return_none(self):
        values = [0.0] * 50
        values[20] = float("nan")
        assert compute_flow_regime(_flow_series(values)) is None


class TestFlowRegimeClassification:
    def test_sustained_outflow_is_accumulation(self):
        # 120 days of mild fluctuation, then 30 days of strong outflow.
        base = [1e6 if i % 2 else -1e6 for i in range(120)]  # baseline ~1e6
        outflow = [-5e6] * 30
        result = compute_flow_regime(_flow_series(base + outflow))
        assert result is not None
        assert result.regime == "accumulation"
        assert result.regime_confidence > 0.0
        assert result.net_flow_30d_usd < 0

    def test_sustained_inflow_is_distribution(self):
        base = [1e6 if i % 2 else -1e6 for i in range(120)]
        inflow = [5e6] * 30
        result = compute_flow_regime(_flow_series(base + inflow))
        assert result is not None
        assert result.regime == "distribution"
        assert result.regime_confidence > 0.0
        assert result.net_flow_30d_usd > 0

    def test_small_flows_are_neutral(self):
        # Baseline ~ 1e6, recent flows alternating so 30d sum stays tiny.
        base = [1e6 if i % 2 else -1e6 for i in range(120)]
        small = [1e5 if i % 2 else -1e5 for i in range(30)]
        result = compute_flow_regime(_flow_series(base + small))
        assert result is not None
        assert result.regime == "neutral"

    def test_disagreeing_windows_force_neutral(self):
        # 30d window net inflow, but last 7 days net outflow → neutral.
        base = [0.0] * 120
        mid = [5e6] * 23  # pushes 30d window positive
        tail = [-5e6] * 7  # last 7d outflow
        result = compute_flow_regime(_flow_series(base + mid + tail))
        assert result is not None
        assert result.regime == "neutral"

    def test_confidence_in_unit_range(self):
        base = [0.0] * 120
        outflow = [-10e6] * 30
        result = compute_flow_regime(_flow_series(base + outflow))
        assert result is not None
        assert 0.0 <= result.regime_confidence <= 1.0

    def test_interpretation_mentions_regime(self):
        base = [0.0] * 120
        outflow = [-5e6] * 30
        result = compute_flow_regime(_flow_series(base + outflow))
        assert result is not None
        assert "accumulation" in result.interpretation.lower()


class TestFlowRegimeDistribution:
    def test_distribution_sums_to_one(self):
        values = [1e6 if i % 3 == 0 else -5e5 for i in range(200)]
        result = compute_flow_regime(_flow_series(values))
        assert result is not None
        total = sum(result.historical_regime_distribution.values())
        assert abs(total - 1.0) < 1e-9

    def test_short_history_defaults_to_neutral_distribution(self):
        # Just above MIN_HISTORY_DAYS but below MIN_HISTORICAL_FOR_DISTRIBUTION.
        result = compute_flow_regime(_flow_series([0.0] * 50))
        assert result is not None
        assert result.historical_regime_distribution["neutral"] == 1.0
        assert result.historical_regime_distribution["accumulation"] == 0.0
        assert result.historical_regime_distribution["distribution"] == 0.0
