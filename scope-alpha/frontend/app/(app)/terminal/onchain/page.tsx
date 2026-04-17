import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function OnchainPage() {
  const item = getNavItem("/terminal/onchain")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="On-Chain Intelligence"
      description={item.description}
      phase={item.phase}
    />
  );
}
