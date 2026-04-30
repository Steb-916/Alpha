/**
 * Sidebar navigation configuration for the analytics platform.
 * Each section renders in the sidebar; disabled entries link to a
 * Coming Soon placeholder page.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: string; // Lucide icon name
  enabled: boolean;
  description: string;
  phase: number;
}

export const TERMINAL_NAV: NavItem[] = [
  {
    label: "Derivatives",
    path: "/terminal/derivatives",
    icon: "TrendingUp",
    enabled: true,
    description:
      "Real-time funding rates, open interest, liquidations, basis analysis, and a multi-asset screener.",
    phase: 1,
  },
  {
    label: "Volatility",
    path: "/terminal/volatility",
    icon: "Activity",
    enabled: true,
    description:
      "Implied volatility surface, risk-neutral density, skew analysis, volatility cone, volatility risk premium, and Greeks exposure maps.",
    phase: 3,
  },
  {
    label: "On-Chain",
    path: "/terminal/onchain",
    icon: "GitBranch",
    enabled: true,
    description:
      "Exchange flows, MVRV z-score, SOPR, NVT ratio, whale tracking, stablecoin flows, and supply dynamics.",
    phase: 5,
  },
  {
    label: "Macro",
    path: "/terminal/macro",
    icon: "Globe",
    enabled: false,
    description:
      "Cross-asset correlations, ETF flow tracking, market regime classification, convergence scoring, and token unlock calendar.",
    phase: 6,
  },
  {
    label: "Sentiment",
    path: "/terminal/sentiment",
    icon: "MessageCircle",
    enabled: false,
    description:
      "Fear & Greed Index, social volume analysis, sector sentiment rotation, and sentiment-price divergence detection.",
    phase: 7,
  },
];

export const TOOLS_NAV: NavItem[] = [
  {
    label: "Arb Scanner",
    path: "/tools/arb-scanner",
    icon: "ArrowLeftRight",
    enabled: true,
    description:
      "Cross-exchange funding rate arbitrage scanner, basis trade monitor, and position P&L calculator.",
    phase: 2,
  },
  {
    label: "Screener",
    path: "/tools/screener",
    icon: "Filter",
    enabled: false,
    description:
      "Custom multi-factor screener across derivatives, options, on-chain, and sentiment data domains.",
    phase: 8,
  },
  {
    label: "Backtester",
    path: "/tools/backtest",
    icon: "FlaskConical",
    enabled: false,
    description:
      "Visual strategy builder with backtesting against historical multi-domain data. No coding required.",
    phase: 8,
  },
];

export function getNavItem(path: string): NavItem | undefined {
  return [...TERMINAL_NAV, ...TOOLS_NAV].find((item) => item.path === path);
}
