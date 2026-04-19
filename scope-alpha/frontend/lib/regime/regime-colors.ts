/**
 * Single source of truth for regime colors + labels.
 * Used by timeline heatmap, badge, feature-contribution highlights, and the
 * derivatives-page regime chip.
 */

import type { RegimeLabel } from '@/types/regime';

export const REGIME_COLORS: Record<RegimeLabel, string> = {
  trending_bull: 'var(--data-green)',
  trending_bear: 'var(--data-red)',
  range_bound: 'var(--text-muted)',
  volatility_expansion: 'var(--data-yellow)',
  capitulation: '#7f1d1d', // deep red — tail event emphasis
};

export const REGIME_LABELS: Record<RegimeLabel, string> = {
  trending_bull: 'Trending Bull',
  trending_bear: 'Trending Bear',
  range_bound: 'Range Bound',
  volatility_expansion: 'Volatility Expansion',
  capitulation: 'Capitulation',
};

/** Short single-word label used in compact contexts (badges, sparklines). */
export const REGIME_LABELS_SHORT: Record<RegimeLabel, string> = {
  trending_bull: 'Bull',
  trending_bear: 'Bear',
  range_bound: 'Range',
  volatility_expansion: 'Vol',
  capitulation: 'Capit.',
};
