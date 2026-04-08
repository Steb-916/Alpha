"use client";

interface Props {
  reason?: string | null;
}

export function BannedState({ reason }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="text-center p-6 rounded-[var(--radius-md)] max-w-xs"
        style={{
          background: "rgba(239, 68, 68, 0.06)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
        }}
      >
        <div className="text-3xl mb-2">🚫</div>
        <h3
          className="text-sm font-bold font-display mb-1"
          style={{ color: "var(--accent-red)" }}
        >
          You have been banned
        </h3>
        <p
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          You no longer have access to this room.
        </p>
        {reason && (
          <p
            className="text-[10px] font-body mt-2 italic"
            style={{ color: "var(--text-tertiary)" }}
          >
            Reason: {reason}
          </p>
        )}
      </div>
    </div>
  );
}
