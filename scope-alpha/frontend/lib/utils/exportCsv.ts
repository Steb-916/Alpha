import type { ScreenerRow } from '@/lib/types';

export function exportScreenerCsv(rows: ScreenerRow[]): void {
  const headers = [
    'Rank', 'Symbol', 'Name', 'Price', 'Change24h%', 'Volume24h',
    'FundingRate', 'FundingZ', 'OI', 'OIChange24h%', 'Liq24h', 'LiqRatio',
    'Basis%', 'HealthScore', 'Regime', 'RegimeV2', 'CVDTrend',
    'ArbYield%yr', 'ATMIV30d%', 'Skew25d%', 'VolRegime',
  ];

  const escape = (v: string | number | undefined | null): string => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.rank, r.symbol, r.name,
        r.price, r.change24h, r.volume24h,
        (r.fundingRate * 100).toFixed(4), r.fundingZ.toFixed(2),
        r.oi, r.oiChange24h.toFixed(2), r.liq24h, r.liqRatio.toFixed(2),
        (r.basis * 100).toFixed(4), r.healthScore,
        r.regime, r.regimeV2 ?? '', r.cvdTrend ?? '',
        r.arbYield != null ? r.arbYield.toFixed(2) : '',
        r.atmIV30d != null ? (r.atmIV30d * 100).toFixed(1) : '',
        r.skew25d != null ? (r.skew25d * 100).toFixed(1) : '',
        r.volRegime ?? '',
      ]
        .map(escape)
        .join(','),
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `screener-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
