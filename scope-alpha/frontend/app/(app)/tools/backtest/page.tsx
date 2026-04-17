import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function BacktestPage() {
  const item = getNavItem("/tools/backtest")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Strategy Backtester"
      description={item.description}
      phase={item.phase}
    />
  );
}
