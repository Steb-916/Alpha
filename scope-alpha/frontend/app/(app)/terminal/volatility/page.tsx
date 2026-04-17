import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function VolatilityPage() {
  const item = getNavItem("/terminal/volatility")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Volatility Analytics"
      description={item.description}
      phase={item.phase}
    />
  );
}
