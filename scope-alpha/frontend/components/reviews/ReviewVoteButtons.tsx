"use client";

import { useState } from "react";

interface Props {
  reviewId: string;
  helpfulCount: number;
  unhelpfulCount: number;
  /** Disable when the current user is the review author or the analyst being reviewed. */
  disabled?: boolean;
}

export function ReviewVoteButtons({
  reviewId,
  helpfulCount,
  unhelpfulCount,
  disabled,
}: Props) {
  const [helpful, setHelpful] = useState(helpfulCount);
  const [unhelpful, setUnhelpful] = useState(unhelpfulCount);
  const [pending, setPending] = useState(false);

  const submit = async (isHelpful: boolean) => {
    if (disabled || pending) return;
    setPending(true);

    // Optimistic update.
    if (isHelpful) {
      setHelpful((c) => c + 1);
    } else {
      setUnhelpful((c) => c + 1);
    }

    try {
      const res = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful: isHelpful }),
      });
      if (!res.ok) {
        // Revert.
        if (isHelpful) setHelpful((c) => c - 1);
        else setUnhelpful((c) => c - 1);
      } else {
        const data = await res.json();
        if (typeof data.helpfulCount === "number") setHelpful(data.helpfulCount);
        if (typeof data.unhelpfulCount === "number") setUnhelpful(data.unhelpfulCount);
      }
    } catch {
      if (isHelpful) setHelpful((c) => c - 1);
      else setUnhelpful((c) => c - 1);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => submit(true)}
        className="flex items-center gap-1 text-[10px] font-body cursor-pointer"
        style={{
          color: "var(--text-muted)",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.color = "#10B981";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        👍 {helpful}
      </button>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => submit(false)}
        className="flex items-center gap-1 text-[10px] font-body cursor-pointer"
        style={{
          color: "var(--text-muted)",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.color = "#EF4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        👎 {unhelpful}
      </button>
    </div>
  );
}
