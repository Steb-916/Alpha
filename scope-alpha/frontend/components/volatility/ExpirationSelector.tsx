"use client";

import { GlassPill } from "@/components/ui/GlassPill";

interface ExpirationSelectorProps {
  expirations: Array<{ expiration: string; daysToExpiry: number }>;
  selected: string | null;
  onChange: (iso: string) => void;
}

export function ExpirationSelector({
  expirations,
  selected,
  onChange,
}: ExpirationSelectorProps) {
  if (expirations.length === 0) return null;
  const items = expirations.map((e) => ({
    label: `${Math.round(e.daysToExpiry)}d`,
    value: e.expiration,
  }));
  return (
    <GlassPill
      items={items}
      activeValue={selected ?? items[0].value}
      onChange={onChange}
    />
  );
}
