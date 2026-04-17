import { ComingSoon } from "@/components/layout/ComingSoon";
import { getNavItem } from "@/config/navigation";

export default function SentimentPage() {
  const item = getNavItem("/terminal/sentiment")!;
  return (
    <ComingSoon
      icon={item.icon}
      title="Sentiment Analytics"
      description={item.description}
      phase={item.phase}
    />
  );
}
