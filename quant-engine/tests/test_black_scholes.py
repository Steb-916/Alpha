"""Round-trip + analytic checks on BS pricing and IV inversion."""

from __future__ import annotations

import math

import pytest

from app.core.black_scholes import bs_call, bs_delta, bs_iv_from_price, bs_put


def test_bs_call_atm_price_known():
    # ATM option with T=1, sigma=0.2, r=0 → price ≈ 0.0796·S
    price = bs_call(spot=100.0, strike=100.0, r=0.0, sigma=0.2, t_years=1.0)
    assert 7.9 <= price <= 8.1


def test_iv_round_trip_call():
    spot = 77_000.0
    strike = 80_000.0
    r = 0.0
    t = 30 / 365
    sigma_true = 0.52
    price = float(bs_call(spot, strike, r, sigma_true, t))
    iv = bs_iv_from_price(price, spot, strike, r, t, option_type="call")
    assert iv is not None
    assert abs(iv - sigma_true) < 1e-4


def test_iv_round_trip_put():
    spot = 77_000.0
    strike = 70_000.0
    r = 0.0
    t = 60 / 365
    sigma_true = 0.65
    price = float(bs_put(spot, strike, r, sigma_true, t))
    iv = bs_iv_from_price(price, spot, strike, r, t, option_type="put")
    assert iv is not None
    assert abs(iv - sigma_true) < 1e-4


def test_bs_put_call_parity():
    spot = 50_000.0
    strike = 50_000.0
    r = 0.02
    sigma = 0.5
    t = 0.25
    call = float(bs_call(spot, strike, r, sigma, t))
    put = float(bs_put(spot, strike, r, sigma, t))
    parity = call - put - (spot - strike * math.exp(-r * t))
    assert abs(parity) < 1e-6


def test_delta_atm_is_close_to_half():
    d = bs_delta(100.0, 100.0, 0.0, 0.2, 1.0, option_type="call")
    # ATM call delta with positive r=0 and T=1, sigma=0.2 is ~0.54 (d1 = sigma/2 * sqrt(T))
    assert 0.5 < d < 0.6


def test_iv_returns_none_for_below_intrinsic():
    # Call below intrinsic can't be priced
    iv = bs_iv_from_price(
        market_price=0.01,
        spot=100.0,
        strike=50.0,
        r=0.0,
        t_years=0.25,
        option_type="call",
    )
    assert iv is None
