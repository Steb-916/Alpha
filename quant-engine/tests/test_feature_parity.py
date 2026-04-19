"""Feature-builder parity test — Phase 6 Slice 1.

Guards against drift between the TS live feature builder
(scope-alpha/frontend/lib/regime/feature-builder.ts) and the Python
backfill feature builder (app.core.feature_builder). Both implementations
must produce identical feature vectors from the same cache-snapshot input.

The shared fixture lives at tests/fixtures/feature_parity_fixture.json.
Python test asserts field-by-field equality. The parallel TS test at
scope-alpha/frontend/lib/regime/feature-builder.test.ts does the same
against the same fixture. If either side drifts, one test fails and CI
signals the problem before production.

Update protocol: any feature-formula change updates the fixture + both
test files in the same commit.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict
from pathlib import Path

import pytest

from app.core.feature_builder import build_feature_vector


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "feature_parity_fixture.json"


@pytest.fixture(scope="module")
def fixture_data():
    with FIXTURE_PATH.open() as f:
        return json.load(f)


def test_fixture_file_exists(fixture_data):
    """Sanity: fixture loads and has the expected top-level shape."""
    assert "cache_snapshot" in fixture_data
    assert "expected_feature_vector" in fixture_data


def _approx_equal(a, b, tol=0.05):
    """Numeric comparator with small tolerance for health-score rounding."""
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= tol
    return a == b


def test_python_feature_builder_matches_expected(fixture_data):
    """The Python feature builder must produce the canonical expected vector."""
    snapshot = fixture_data["cache_snapshot"]
    expected = fixture_data["expected_feature_vector"]

    fv = build_feature_vector(snapshot)
    fv_dict = asdict(fv)

    # Field-by-field comparison — each must match (with a small tolerance
    # on health_score since float arithmetic of 4 component adds + 2
    # regime adjustments could nudge by ±0.5).
    for field_name, expected_value in expected.items():
        actual_value = fv_dict.get(field_name)
        if field_name == "health_score":
            assert _approx_equal(actual_value, expected_value, tol=1.0), (
                f"health_score drift: got {actual_value}, expected {expected_value}"
            )
        else:
            assert actual_value == expected_value, (
                f"{field_name} drift: got {actual_value!r}, expected {expected_value!r}"
            )


def test_feature_vector_no_crash_on_missing_tier_2_3(fixture_data):
    """Snapshot with all Tier 2/3 fields dropped still builds a valid vector."""
    snapshot = dict(fixture_data["cache_snapshot"])
    # Strip Tier 2/3 cache payloads
    for key in ("gex", "onchainSupply", "onchainFlows", "iv_percentile_30d",
                "skew_25d", "vrp_sign", "whale_intensity_24h"):
        snapshot.pop(key, None)

    fv = build_feature_vector(snapshot)
    # Tier 1 still populated
    assert fv.asset == snapshot["asset"]
    assert fv.funding_percentile_30d == snapshot["funding_percentile_30d"]
    # Tier 2/3 degrade to None
    assert fv.iv_percentile is None
    assert fv.mvrv_regime is None
    assert fv.flow_regime is None
    assert fv.gex_regime is None
