/**
 * Signal template helpers.
 *
 * Templates store relative values (% from entry) so they apply across price
 * levels. `applyTemplateToEntry` is the pure function used by both the
 * server route (POST /api/signal-templates/[id]/apply) and the client form
 * for instant preview as the analyst types an entry price.
 */

import type { Direction } from '@/config/signals';
import type { SignalTargetInput } from './validation';

export interface RelativeTarget {
  label: string;
  /** Percentage distance from entry (positive number, sign comes from direction) */
  percentFromEntry: number;
  closePercent: number;
}

export interface TemplateBody {
  asset?: string | null;
  direction?: Direction | null;
  timeframe?: string | null;
  conviction?: string | null;
  stopPercent?: number | null;
  targets?: RelativeTarget[] | null;
  notes?: string | null;
}

export interface AppliedTemplate {
  asset: string | null;
  direction: Direction | null;
  timeframe: string | null;
  conviction: string | null;
  stopLossPrice: number | null;
  targets: SignalTargetInput[];
  notes: string | null;
}

/**
 * Convert a template's relative percentages into absolute prices anchored
 * at the given entry price + direction.
 *
 * For longs: stop = entry × (1 - stopPercent/100), targets above entry.
 * For shorts: stop = entry × (1 + stopPercent/100), targets below entry.
 *
 * `directionOverride` lets the form pass the user's currently selected
 * direction even if the template doesn't specify one.
 */
export function applyTemplateToEntry(
  template: TemplateBody,
  entryPrice: number,
  directionOverride?: Direction,
): AppliedTemplate {
  const direction = (template.direction || directionOverride || null) as
    | Direction
    | null;
  const sign = direction === 'long' ? 1 : direction === 'short' ? -1 : 0;

  const out: AppliedTemplate = {
    asset: template.asset ?? null,
    direction,
    timeframe: template.timeframe ?? null,
    conviction: template.conviction ?? null,
    stopLossPrice: null,
    targets: [],
    notes: template.notes ?? null,
  };

  if (entryPrice <= 0 || sign === 0) {
    return out;
  }

  if (
    typeof template.stopPercent === 'number' &&
    Number.isFinite(template.stopPercent) &&
    template.stopPercent > 0
  ) {
    out.stopLossPrice = roundPrice(
      entryPrice * (1 - sign * (template.stopPercent / 100)),
    );
  }

  if (Array.isArray(template.targets) && template.targets.length > 0) {
    out.targets = template.targets.map((t) => ({
      label: t.label,
      price: roundPrice(entryPrice * (1 + sign * (t.percentFromEntry / 100))),
      closePercent: t.closePercent,
    }));
  }

  return out;
}

function roundPrice(p: number): number {
  // Round to 8 decimals to match Decimal(20,8) — the form will show
  // fewer digits in the UI but the underlying data preserves precision.
  return Math.round(p * 1e8) / 1e8;
}
