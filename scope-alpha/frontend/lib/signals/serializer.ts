/**
 * Signal serializer.
 *
 * Converts Prisma Signal rows (Decimal, snake-case relations) into the
 * uniform JSON shape the frontend expects. Handles the legacy single-target
 * backward-compat path: when a signal has no SignalTarget rows, we
 * synthesize a single TP1 from the legacy `targetPrice` column so callers
 * never have to special-case it.
 */

import type { Signal, SignalTarget } from '@prisma/client';

type SignalWithTargets = Signal & { targets?: SignalTarget[] };

export interface SerializedTarget {
  id: string;
  label: string;
  price: number;
  closePercent: number;
  hitAt: string | null;
  hitPrice: number | null;
  order: number;
}

export interface SerializedSignal {
  id: string;
  analystId: string;
  assetSymbol: string;
  direction: string;
  entryPrice: number;
  /** Legacy single target. Always populated. */
  targetPrice: number;
  stopLossPrice: number;
  timeframe: string;
  conviction: string;
  notes: string | null;
  status: string;
  publishedAt: string | null;
  resolvedAt: string | null;
  resolvedPrice: number | null;
  resultPnlPercent: number | null;
  templateId: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  /** Multi-target array. For legacy single-target signals, this is a synthesized 1-element array. */
  targets: SerializedTarget[];
}

function serializeTarget(t: SignalTarget): SerializedTarget {
  return {
    id: t.id,
    label: t.label,
    price: Number(t.price),
    closePercent: t.closePercent,
    hitAt: t.hitAt ? t.hitAt.toISOString() : null,
    hitPrice: t.hitPrice != null ? Number(t.hitPrice) : null,
    order: t.order,
  };
}

export function serializeSignal(signal: SignalWithTargets): SerializedSignal {
  // Multi-target path: real SignalTarget rows present.
  let targets: SerializedTarget[];
  if (signal.targets && signal.targets.length > 0) {
    targets = [...signal.targets]
      .sort((a, b) => a.order - b.order)
      .map(serializeTarget);
  } else {
    // Legacy single-target synthesis.
    targets = [
      {
        id: `${signal.id}-legacy-tp1`,
        label: 'TP1',
        price: Number(signal.targetPrice),
        closePercent: 100,
        hitAt: signal.resolvedAt ? signal.resolvedAt.toISOString() : null,
        hitPrice: signal.resolvedPrice != null ? Number(signal.resolvedPrice) : null,
        order: 1,
      },
    ];
  }

  return {
    id: signal.id,
    analystId: signal.analystId,
    assetSymbol: signal.assetSymbol,
    direction: signal.direction,
    entryPrice: Number(signal.entryPrice),
    targetPrice: Number(signal.targetPrice),
    stopLossPrice: Number(signal.stopLossPrice),
    timeframe: signal.timeframe,
    conviction: signal.conviction,
    notes: signal.notes,
    status: signal.status,
    publishedAt: signal.publishedAt ? signal.publishedAt.toISOString() : null,
    resolvedAt: signal.resolvedAt ? signal.resolvedAt.toISOString() : null,
    resolvedPrice: signal.resolvedPrice != null ? Number(signal.resolvedPrice) : null,
    resultPnlPercent: signal.resultPnlPercent != null ? Number(signal.resultPnlPercent) : null,
    templateId: signal.templateId,
    screenshotUrl: signal.screenshotUrl,
    createdAt: signal.createdAt.toISOString(),
    targets,
  };
}
