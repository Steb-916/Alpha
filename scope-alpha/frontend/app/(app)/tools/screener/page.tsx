import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function ScreenerToolPage() {
  const item = getNavItem("/tools/screener")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Multi-Factor Screener"
      description={item.description}
      phase={item.phase}
    />
  );
}
