/**
 * CSV export for the trade journal.
 *
 * Columns:
 *   Date, Asset, Direction, Entry, Target(s), Stop, Timeframe, Conviction,
 *   Result P&L %, Holding Period, Notes
 *
 * Multi-target signals serialize their targets as `"price1(pct1%),price2(pct2%)"`.
 * Single-target signals just print the one price + 100%.
 */

import type { SerializedSignal } from '@/lib/signals/serializer';

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatTargets(signal: SerializedSignal): string {
  if (!signal.targets || signal.targets.length === 0) {
    return String(signal.targetPrice);
  }
  return signal.targets
    .map((t) => `${t.price}(${t.closePercent}%)`)
    .join(',');
}

function holdingPeriod(signal: SerializedSignal): string {
  if (!signal.publishedAt || !signal.resolvedAt) return '';
  const start = new Date(signal.publishedAt).getTime();
  const end = new Date(signal.resolvedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '';
  const ms = end - start;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function signalsToCSV(signals: SerializedSignal[]): string {
  const headers = [
    'Date',
    'Asset',
    'Direction',
    'Entry',
    'Target(s)',
    'Stop',
    'Timeframe',
    'Conviction',
    'Result P&L %',
    'Holding Period',
    'Notes',
  ];
  const rows = signals.map((s) => [
    s.publishedAt ? new Date(s.publishedAt).toISOString().slice(0, 10) : '',
    s.assetSymbol,
    s.direction.toUpperCase(),
    s.entryPrice,
    formatTargets(s),
    s.stopLossPrice,
    s.timeframe,
    s.conviction.toUpperCase(),
    s.resultPnlPercent != null ? s.resultPnlPercent : '',
    holdingPeriod(s),
    s.notes ?? '',
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}
