export function formatPrice(price: number): string {
  if (price >= 1000) return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return "$" + price.toFixed(2);
  if (price >= 0.01) return "$" + price.toFixed(4);
  return "$" + price.toFixed(6);
}

export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return "$" + (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return "$" + (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return "$" + (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return "$" + (num / 1e3).toFixed(1) + "K";
  return "$" + num.toFixed(2);
}

export function formatPercent(pct: number, showSign = true): string {
  const sign = showSign && pct > 0 ? "+" : "";
  return sign + pct.toFixed(2) + "%";
}

export function formatFundingRate(rate: number): string {
  const sign = rate > 0 ? "+" : "";
  return sign + (rate * 100).toFixed(4) + "%";
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getChangeColor(value: number): string {
  if (value > 0) return "text-positive";
  if (value < 0) return "text-negative";
  return "text-text-muted";
}

export function getRegimeColor(regime: string): string {
  switch (regime) {
    case "Risk Off": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "Cautious": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Neutral": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    case "Risk On": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "Overheated": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function getHealthColor(score: number): string {
  if (score >= 90) return "#F59E0B";
  if (score >= 70) return "#10B981";
  if (score >= 50) return "#6B7280";
  if (score >= 30) return "#F59E0B";
  return "#EF4444";
}
