/**
 * Signal validation + multi-target P&L math.
 *
 * Used by:
 *   - app/api/signals/route.ts (POST)
 *   - app/api/signals/[id]/resolve/route.ts
 *   - components/signals/SignalCreationForm.tsx (instant client-side feedback)
 *   - components/signals/MultiTargetInput.tsx (sum-to-100 indicator)
 *
 * Pure functions only — no Prisma, no React. Safe to import from anywhere.
 */

import {
  ALLOWED_CONVICTIONS,
  ALLOWED_DIRECTIONS,
  ALLOWED_STATUSES,
  ALLOWED_TIMEFRAMES,
  CLOSE_PERCENT_EPSILON,
  MAX_TARGETS,
  MIN_TARGETS,
  type Conviction,
  type Direction,
  type SignalStatus,
  type Timeframe,
} from '@/config/signals';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SignalTargetInput {
  label: string;
  price: number;
  closePercent: number;
}

export interface SignalBodyInput {
  assetSymbol: string;
  direction: Direction;
  entryPrice: number;
  /** Single-target backward-compat field. Optional when targets[] is supplied. */
  targetPrice?: number;
  stopLossPrice: number;
  timeframe: Timeframe;
  conviction?: Conviction;
  notes?: string | null;
  status?: SignalStatus;
  templateId?: string | null;
  screenshotUrl?: string | null;
  /** New multi-target array. If present (length > 0), it overrides targetPrice. */
  targets?: SignalTargetInput[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

// ─── Body validation ────────────────────────────────────────────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function validateSignalBody(body: SignalBodyInput): ValidationResult {
  const errors: ValidationError[] = [];

  if (!body.assetSymbol || typeof body.assetSymbol !== 'string') {
    errors.push({ field: 'assetSymbol', message: 'assetSymbol is required' });
  }

  if (!ALLOWED_DIRECTIONS.includes(body.direction)) {
    errors.push({
      field: 'direction',
      message: `direction must be one of ${ALLOWED_DIRECTIONS.join(', ')}`,
    });
  }

  if (!isFiniteNumber(body.entryPrice) || body.entryPrice <= 0) {
    errors.push({ field: 'entryPrice', message: 'entryPrice must be a positive number' });
  }

  if (!isFiniteNumber(body.stopLossPrice) || body.stopLossPrice <= 0) {
    errors.push({ field: 'stopLossPrice', message: 'stopLossPrice must be a positive number' });
  }

  if (!ALLOWED_TIMEFRAMES.includes(body.timeframe)) {
    errors.push({
      field: 'timeframe',
      message: `timeframe must be one of ${ALLOWED_TIMEFRAMES.join(', ')}`,
    });
  }

  if (body.conviction && !ALLOWED_CONVICTIONS.includes(body.conviction)) {
    errors.push({
      field: 'conviction',
      message: `conviction must be one of ${ALLOWED_CONVICTIONS.join(', ')}`,
    });
  }

  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push({
      field: 'status',
      message: `status must be one of ${ALLOWED_STATUSES.join(', ')}`,
    });
  }

  // Stop loss side must match direction.
  if (
    isFiniteNumber(body.entryPrice) &&
    isFiniteNumber(body.stopLossPrice) &&
    body.entryPrice > 0
  ) {
    if (body.direction === 'long' && body.stopLossPrice >= body.entryPrice) {
      errors.push({
        field: 'stopLossPrice',
        message: 'Stop loss must be below entry for long signals',
      });
    }
    if (body.direction === 'short' && body.stopLossPrice <= body.entryPrice) {
      errors.push({
        field: 'stopLossPrice',
        message: 'Stop loss must be above entry for short signals',
      });
    }
  }

  // If neither targets[] nor targetPrice supplied, that's an error.
  const hasTargetsArray = Array.isArray(body.targets) && body.targets.length > 0;
  if (!hasTargetsArray && !isFiniteNumber(body.targetPrice)) {
    errors.push({
      field: 'targets',
      message: 'Either targets[] or targetPrice must be provided',
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── Multi-target validation ────────────────────────────────────────────────

export function validateTargets(
  targets: SignalTargetInput[],
  direction: Direction,
  entryPrice: number,
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(targets) || targets.length < MIN_TARGETS) {
    errors.push({
      field: 'targets',
      message: `At least ${MIN_TARGETS} target required`,
    });
    return { ok: false, errors };
  }

  if (targets.length > MAX_TARGETS) {
    errors.push({
      field: 'targets',
      message: `At most ${MAX_TARGETS} targets allowed`,
    });
  }

  // closePercent sum check
  const totalPercent = targets.reduce((sum, t) => sum + Number(t.closePercent || 0), 0);
  if (Math.abs(totalPercent - 100) > CLOSE_PERCENT_EPSILON) {
    errors.push({
      field: 'targets',
      message: `closePercent values must sum to exactly 100 (got ${totalPercent.toFixed(2)})`,
    });
  }

  // Per-target checks
  const seenLabels = new Set<string>();
  let prevDistance = -Infinity;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const idx = i + 1;

    if (!t.label || typeof t.label !== 'string') {
      errors.push({ field: `targets[${i}].label`, message: `Target ${idx}: label required` });
    } else if (seenLabels.has(t.label)) {
      errors.push({ field: `targets[${i}].label`, message: `Duplicate target label: ${t.label}` });
    } else {
      seenLabels.add(t.label);
    }

    if (!isFiniteNumber(t.price) || t.price <= 0) {
      errors.push({
        field: `targets[${i}].price`,
        message: `Target ${idx}: price must be a positive number`,
      });
      continue;
    }

    if (!isFiniteNumber(t.closePercent) || t.closePercent <= 0 || t.closePercent > 100) {
      errors.push({
        field: `targets[${i}].closePercent`,
        message: `Target ${idx}: closePercent must be between 0 and 100`,
      });
    }

    // Direction check
    if (direction === 'long' && t.price <= entryPrice) {
      errors.push({
        field: `targets[${i}].price`,
        message: `Target ${idx}: long target ${t.price} must be above entry ${entryPrice}`,
      });
      continue;
    }
    if (direction === 'short' && t.price >= entryPrice) {
      errors.push({
        field: `targets[${i}].price`,
        message: `Target ${idx}: short target ${t.price} must be below entry ${entryPrice}`,
      });
      continue;
    }

    // Monotonic distance check (TP1 closest to entry, TP2 farther, etc.)
    const distance =
      direction === 'long' ? t.price - entryPrice : entryPrice - t.price;
    if (distance <= prevDistance) {
      errors.push({
        field: `targets[${i}].price`,
        message: `Target ${idx} must be farther from entry than the previous target`,
      });
    }
    prevDistance = distance;
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── P&L calculation ────────────────────────────────────────────────────────

export interface ResolvedTarget {
  /** closePercent at the time the target was created */
  closePercent: number;
  /** Actual fill price when the target was hit */
  hitPrice: number;
}

/**
 * Multi-target P&L. For each hit target, the closePercent fraction of the
 * position closes at the hit price; the remaining fraction (100 - sum) closes
 * at finalClosePrice.
 *
 * Returns the total P&L percentage for the signal as a single number.
 *
 * Worked example (from the plan, long, entry=65000):
 *   targets: [{closePercent: 50, hitPrice: 66050}]
 *   finalClosePrice: 64200
 *
 *   hit:  0.50 × ((66050 - 65000) / 65000) × 100 = 0.50 × 0.016154 × 100 = +0.8077
 *   rem:  0.50 × ((64200 - 65000) / 65000) × 100 = 0.50 × -0.012308 × 100 = -0.6154
 *   total: +0.1923%
 */
export function calculateMultiTargetPnL(
  hitTargets: ResolvedTarget[],
  finalClosePrice: number,
  direction: Direction,
  entryPrice: number,
): number {
  if (entryPrice <= 0) return 0;
  const sign = direction === 'long' ? 1 : -1;

  let total = 0;
  let hitPercent = 0;

  for (const t of hitTargets) {
    const fraction = t.closePercent / 100;
    const pctChange = ((t.hitPrice - entryPrice) / entryPrice) * 100 * sign;
    total += fraction * pctChange;
    hitPercent += t.closePercent;
  }

  const remainingFraction = (100 - hitPercent) / 100;
  if (remainingFraction > 0) {
    const remPct = ((finalClosePrice - entryPrice) / entryPrice) * 100 * sign;
    total += remainingFraction * remPct;
  }

  // Round to 4 decimal places to match the Decimal(10,4) DB column.
  return Math.round(total * 10000) / 10000;
}

/** Single-target legacy P&L. Used when no SignalTarget rows exist. */
export function calculateLegacySinglePnL(
  finalClosePrice: number,
  direction: Direction,
  entryPrice: number,
): number {
  if (entryPrice <= 0) return 0;
  const sign = direction === 'long' ? 1 : -1;
  const pct = ((finalClosePrice - entryPrice) / entryPrice) * 100 * sign;
  return Math.round(pct * 10000) / 10000;
}

// ─── Status transitions ─────────────────────────────────────────────────────

const PRICE_FIELDS = ['entryPrice', 'targetPrice', 'stopLossPrice', 'direction', 'targets'] as const;

/**
 * Returns true if the proposed update touches any immutable price/direction
 * field. Only drafts may modify these.
 */
export function updatesContainPriceFields(updates: Record<string, unknown>): boolean {
  return PRICE_FIELDS.some((f) => f in updates && updates[f] !== undefined);
}
