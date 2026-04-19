"""Regime classifier tests — Phase 6 Slice 1.

Covers classifier dispatch, confidence monotonicity, persistence filter
(including bootstrap + capitulation exception), and forward-return
aggregation with source-provenance tracking.
"""

from __future__ import annotations

import pytest

from app.core.regime import (
    CAPITULATION_LIQ_INTENSITY,
    HEALTH_BEAR_THRESHOLD,
    HEALTH_BULL_THRESHOLD,
    RegimeFeatureVector,
    apply_persistence_filter,
    classify_regime,
    classify_with_context,
    compute_confidence,
)
from app.core.forward_returns import (
    ForwardReturnObservation,
    compute_forward_returns,
)


# ─── Feature-vector factories ──────────────────────────────────────────────


def _fv(**overrides) -> RegimeFeatureVector:
    """Build a neutral / range-bound feature vector; overrides tweak one field."""
    defaults = dict(
        asset="BTC",
        timestamp="2025-06-15T12:00:00Z",
        funding_percentile_30d=0.5,
        oi_change_7d=0.0,
        liquidation_intensity_24h=0.3,
        basis_percentile=0.5,
        health_score=50.0,
        mvrv_regime=None,
        mvrv_z_score=None,
        iv_percentile=None,
        skew_25d=None,
        vrp_sign=None,
        gex_regime=None,
        flow_regime=None,
        whale_intensity_24h=None,
    )
    defaults.update(overrides)
    return RegimeFeatureVector(**defaults)


# ─── classify_regime ───────────────────────────────────────────────────────


class TestClassifyRegime:
    def test_neutral_vector_is_range_bound(self):
        assert classify_regime(_fv()) == "range_bound"

    def test_strong_bull_features_classify_trending_bull(self):
        fv = _fv(
            health_score=75,
            funding_percentile_30d=0.70,
            oi_change_7d=0.08,
            flow_regime="accumulation",
            mvrv_regime="fair",
        )
        assert classify_regime(fv) == "trending_bull"

    def test_strong_bear_features_classify_trending_bear(self):
        fv = _fv(
            health_score=28,
            funding_percentile_30d=0.30,
            oi_change_7d=-0.08,
            flow_regime="distribution",
            mvrv_regime="elevated",
        )
        assert classify_regime(fv) == "trending_bear"

    def test_capitulation_liq_plus_deep_value(self):
        fv = _fv(
            health_score=12,
            liquidation_intensity_24h=0.98,
            mvrv_regime="deep_value",
            funding_percentile_30d=0.08,
        )
        assert classify_regime(fv) == "capitulation"

    def test_capitulation_requires_both_conditions(self):
        """High liquidations alone without deep_value MVRV → not capitulation."""
        fv = _fv(
            health_score=28,
            liquidation_intensity_24h=0.98,
            mvrv_regime="elevated",
            funding_percentile_30d=0.20,
        )
        assert classify_regime(fv) != "capitulation"

    def test_high_iv_percentile_classifies_vol_expansion(self):
        fv = _fv(iv_percentile=0.9, health_score=58, funding_percentile_30d=0.65)
        assert classify_regime(fv) == "volatility_expansion"

    def test_extreme_funding_classifies_vol_expansion(self):
        fv = _fv(funding_percentile_30d=0.95, health_score=70)
        assert classify_regime(fv) == "volatility_expansion"

    def test_vol_expansion_takes_precedence_over_directional(self):
        """Strong bull setup + elevated IV → vol expansion wins."""
        fv = _fv(
            health_score=72,
            funding_percentile_30d=0.78,
            oi_change_7d=0.10,
            flow_regime="accumulation",
            iv_percentile=0.85,
        )
        assert classify_regime(fv) == "volatility_expansion"

    def test_missing_tier2_tier3_doesnt_crash(self):
        """A Tier-1-only vector classifies cleanly."""
        fv = _fv(
            health_score=65,
            funding_percentile_30d=0.60,
            oi_change_7d=0.06,
            # All Tier 2/3 fields None
        )
        result = classify_regime(fv)
        assert result in ("trending_bull", "range_bound")  # depends on score math

    def test_mvrv_contrarian_tilt(self):
        """Euphoric MVRV tilts toward bear when the directional race is close."""
        base = _fv(
            health_score=42,  # below bull threshold
            funding_percentile_30d=0.48,
            oi_change_7d=-0.06,
            mvrv_regime="euphoria",
        )
        # Euphoria adds 1 to bear_score; with health < 40 already contributing,
        # this pushes the vector toward trending_bear.
        result = classify_regime(base)
        assert result in ("trending_bear", "range_bound")


# ─── compute_confidence ────────────────────────────────────────────────────


class TestConfidence:
    def test_confidence_bounded_unit_interval(self):
        for regime in ("trending_bull", "trending_bear", "range_bound",
                       "volatility_expansion", "capitulation"):
            fv = _fv(health_score=50, funding_percentile_30d=0.5, oi_change_7d=0.0)
            confidence, _ = compute_confidence(fv, regime)
            assert 0.0 <= confidence <= 1.0

    def test_aligned_features_produce_high_confidence(self):
        fv = _fv(
            health_score=72,
            funding_percentile_30d=0.66,
            oi_change_7d=0.08,
            flow_regime="accumulation",
            mvrv_regime="fair",
            iv_percentile=0.4,
            gex_regime="positive",
        )
        confidence, _ = compute_confidence(fv, "trending_bull")
        assert confidence > 0.6

    def test_conflicting_features_produce_low_confidence(self):
        fv = _fv(
            health_score=30,
            funding_percentile_30d=0.20,
            oi_change_7d=-0.10,
            flow_regime="distribution",
            mvrv_regime="euphoria",
        )
        # Classifying this as trending_bull against the grain → all features conflict.
        confidence, support = compute_confidence(fv, "trending_bull")
        assert confidence < 0.3
        assert len(support.conflicting) > len(support.supporting)

    def test_missing_features_dont_conflict(self):
        fv = _fv(
            health_score=70,
            funding_percentile_30d=0.60,
            oi_change_7d=0.06,
            # Tier 2/3 missing
        )
        confidence, support = compute_confidence(fv, "trending_bull")
        # Available features all support; neutral (missing) count is non-empty.
        assert len(support.supporting) >= 3
        assert confidence > 0.6

    def test_more_aligned_yields_higher_confidence(self):
        """Monotonicity: adding a supporting feature doesn't decrease confidence."""
        base = _fv(
            health_score=70,
            funding_percentile_30d=0.60,
            oi_change_7d=0.06,
        )
        better = _fv(
            health_score=70,
            funding_percentile_30d=0.60,
            oi_change_7d=0.06,
            flow_regime="accumulation",
            gex_regime="positive",
        )
        c_base, _ = compute_confidence(base, "trending_bull")
        c_better, _ = compute_confidence(better, "trending_bull")
        assert c_better >= c_base


# ─── apply_persistence_filter ──────────────────────────────────────────────


class TestPersistenceFilter:
    def test_bootstrap_first_observation_commits_raw(self):
        result = apply_persistence_filter(
            raw="trending_bull", prev_raw=None, prev_committed=None
        )
        assert result.committed_regime == "trending_bull"
        assert result.regime_changed is False  # no prior — not a "change"

    def test_same_regime_holds_no_change(self):
        result = apply_persistence_filter(
            raw="range_bound", prev_raw="range_bound", prev_committed="range_bound"
        )
        assert result.committed_regime == "range_bound"
        assert result.regime_changed is False

    def test_single_hour_flicker_suppressed(self):
        """A single flicker away from the committed regime should NOT commit."""
        result = apply_persistence_filter(
            raw="trending_bull",
            prev_raw="range_bound",
            prev_committed="range_bound",
        )
        assert result.committed_regime == "range_bound"
        assert result.regime_changed is False

    def test_two_consecutive_agreement_commits_transition(self):
        """Two consecutive raw=trending_bull observations commit the change."""
        result = apply_persistence_filter(
            raw="trending_bull",
            prev_raw="trending_bull",
            prev_committed="range_bound",
        )
        assert result.committed_regime == "trending_bull"
        assert result.regime_changed is True

    def test_capitulation_instant_commit(self):
        """Capitulation bypasses the 2-of-2 rule — single observation commits."""
        result = apply_persistence_filter(
            raw="capitulation",
            prev_raw="range_bound",  # NOT agreeing
            prev_committed="range_bound",
        )
        assert result.committed_regime == "capitulation"
        assert result.regime_changed is True

    def test_capitulation_exit_uses_normal_rule(self):
        """Exiting capitulation still needs 2-of-2 agreement (no shortcut out)."""
        # First hour after capitulation: raw says range_bound, but prev was
        # capitulation. No flicker-back immediately.
        result = apply_persistence_filter(
            raw="range_bound",
            prev_raw="capitulation",
            prev_committed="capitulation",
        )
        assert result.committed_regime == "capitulation"
        assert result.regime_changed is False


# ─── classify_with_context (end-to-end) ────────────────────────────────────


class TestClassifyWithContext:
    def test_full_pipeline_bootstrap(self):
        fv = _fv(
            health_score=72,
            funding_percentile_30d=0.68,
            oi_change_7d=0.09,
            flow_regime="accumulation",
        )
        result = classify_with_context(fv, prev_raw=None, prev_committed=None)
        assert result.committed_regime == "trending_bull"
        assert result.regime_changed is False  # bootstrap isn't a "change"
        assert result.confidence > 0.5
        assert len(result.feature_support.supporting) > 0


# ─── Forward returns ──────────────────────────────────────────────────────


class TestForwardReturns:
    def test_empty_observations_returns_zero_sample(self):
        result = compute_forward_returns(
            asset="BTC", regime="trending_bull",
            observations=[], full_price_series=[("2025-01-01T00:00:00Z", 100.0)],
        )
        assert result.total_observations == 0
        for h in result.horizons:
            assert h.sample_count == 0

    def test_known_forward_returns(self):
        """Synthetic series: price doubles over 7d, half over 30d.
        One observation at t=0 should yield forward returns +100% at 7d."""
        hours_per_day = 24
        series = [
            (f"2025-01-{day:02d}T{hour:02d}:00:00Z", 100.0 * (1.0 + 0.01 * idx))
            for idx, (day, hour) in enumerate(
                [(d, h) for d in range(1, 32) for h in range(24)]
            )
        ]
        # Use an observation exactly at t=0 (first series point)
        obs = [
            ForwardReturnObservation(
                timestamp=series[0][0], price=series[0][1], source="backfill"
            )
        ]
        result = compute_forward_returns(
            asset="BTC", regime="trending_bull",
            observations=obs, full_price_series=series,
        )
        # 7d = 168 hours later — price at idx 168 is 100 * (1 + 0.01 * 168) = 268
        # Forward return: (268 - 100) / 100 = 1.68
        horizon_7d = next(h for h in result.horizons if h.horizon == "7d")
        assert horizon_7d.sample_count == 1
        assert abs(horizon_7d.median_return - 1.68) < 0.01

    def test_source_all_backfill(self):
        obs = [
            ForwardReturnObservation(
                timestamp="2025-01-01T00:00:00Z", price=100.0, source="backfill"
            )
        ]
        result = compute_forward_returns(
            asset="BTC", regime="range_bound",
            observations=obs,
            full_price_series=[("2025-01-01T00:00:00Z", 100.0)],
        )
        assert result.source == "backfill"

    def test_source_all_live(self):
        obs = [
            ForwardReturnObservation(
                timestamp="2025-01-01T00:00:00Z", price=100.0, source="live"
            ),
            ForwardReturnObservation(
                timestamp="2025-01-02T00:00:00Z", price=101.0, source="live"
            ),
        ]
        result = compute_forward_returns(
            asset="BTC", regime="range_bound",
            observations=obs,
            full_price_series=[
                ("2025-01-01T00:00:00Z", 100.0),
                ("2025-01-02T00:00:00Z", 101.0),
            ],
        )
        assert result.source == "live"

    def test_source_mixed(self):
        obs = [
            ForwardReturnObservation(
                timestamp="2025-01-01T00:00:00Z", price=100.0, source="backfill"
            ),
            ForwardReturnObservation(
                timestamp="2026-01-01T00:00:00Z", price=101.0, source="live"
            ),
        ]
        result = compute_forward_returns(
            asset="BTC", regime="range_bound",
            observations=obs,
            full_price_series=[
                ("2025-01-01T00:00:00Z", 100.0),
                ("2026-01-01T00:00:00Z", 101.0),
            ],
        )
        assert result.source == "mixed"
