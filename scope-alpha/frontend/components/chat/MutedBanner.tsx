"use client";

interface Props {
  mutedUntil: string | null;
  reason?: string | null;
}

export function MutedBanner({ mutedUntil, reason }: Props) {
  const expiry = mutedUntil ? new Date(mutedUntil) : null;
  const expiryLabel = expiry
    ? `until ${expiry.toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })}`
    : "permanently";

  return (
    <div
      className="mx-3 my-2 px-3 py-2 rounded-[var(--radius-sm)] text-[10px] font-body"
      style={{
        background: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.3)",
        color: "var(--accent-yellow)",
      }}
    >
      🔇 You are muted in this room {expiryLabel}. You can still read messages.
      {reason && (
        <div
          className="mt-1 text-[9px]"
          style={{ color: "var(--text-muted)" }}
        >
          Reason: {reason}
        </div>
      )}
    </div>
  );
}
