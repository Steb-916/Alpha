import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function MacroPage() {
  const item = getNavItem("/terminal/macro")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Macro Dashboard"
      description={item.description}
      phase={item.phase}
    />
  );
}
