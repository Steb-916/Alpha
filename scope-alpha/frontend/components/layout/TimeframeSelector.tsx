"use client";

import { GlassPill } from "@/components/ui/GlassPill";
import { useAppStore } from "@/lib/store";
import type { TimeFrame } from "@/lib/types";

const TIMEFRAME_ITEMS: { label: string; value: string }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1H" },
  { label: "4H", value: "4H" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

export function TimeframeSelector() {
  const selectedTimeframe = useAppStore((s) => s.selectedTimeframe);
  const setTimeframe = useAppStore((s) => s.setTimeframe);

  return (
    <GlassPill
      items={TIMEFRAME_ITEMS}
      activeValue={selectedTimeframe}
      onChange={(v) => setTimeframe(v as TimeFrame)}
    />
  );
}
