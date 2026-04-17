import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function ArbScannerPage() {
  const item = getNavItem("/tools/arb-scanner")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Arbitrage Scanner"
      description={item.description}
      phase={item.phase}
    />
  );
}
