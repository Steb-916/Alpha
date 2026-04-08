"use client";

interface Props {
  verified: boolean;
  tier?: string | null;
}

export function VerifiedBadge({ verified, tier }: Props) {
  if (!verified) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-[var(--radius-pill)]"
      style={{
        background: "rgba(16, 185, 129, 0.15)",
        color: "#10B981",
        border: "1px solid rgba(16, 185, 129, 0.3)",
      }}
      title={tier ? `Subscribed on ${tier} tier when reviewing` : "Subscribed when reviewing"}
    >
      ✓ Verified Subscriber
    </span>
  );
}
