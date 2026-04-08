"use client";

/**
 * Follow / Following ✓ / Subscribed ✓ button.
 *
 * Three states:
 *   - Subscribed   → "Subscribed ✓" disabled (follow is implicit)
 *   - Following    → "Following ✓" with hover-to-Unfollow
 *   - Not following → "Follow"
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useSocialStore } from "@/stores/socialStore";

interface Props {
  analystId: string;
  /** Compact mode for analyst card grid (no padding, smaller text). */
  compact?: boolean;
}

interface StatusResponse {
  isFollowing: boolean;
  isSubscribed: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function FollowButton({ analystId, compact }: Props) {
  const { data: session } = useSession();
  const { data, mutate } = useSWR<StatusResponse>(
    session?.user?.id ? `/api/follow/status?analystId=${analystId}` : null,
    fetcher,
  );

  const markFollowed = useSocialStore((s) => s.markFollowed);
  const markUnfollowed = useSocialStore((s) => s.markUnfollowed);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync the social store with API state.
  useEffect(() => {
    if (data?.isFollowing) markFollowed(analystId);
    else markUnfollowed(analystId);
  }, [data?.isFollowing, analystId, markFollowed, markUnfollowed]);

  if (!session?.user?.id || session.user.id === analystId) return null;

  const isSubscribed = data?.isSubscribed ?? false;
  const isFollowing = data?.isFollowing ?? false;

  const baseStyle: React.CSSProperties = {
    padding: compact ? "4px 10px" : "6px 14px",
    fontSize: compact ? 10 : 11,
    fontWeight: 700,
    borderRadius: "var(--radius-pill)",
    cursor: busy ? "wait" : "pointer",
    border: "1px solid var(--glass-border)",
    background: "var(--glass-bg)",
    color: "var(--text-secondary)",
    transition: "all 0.2s",
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || isSubscribed) return;
    setBusy(true);
    try {
      if (isFollowing) {
        const res = await fetch(`/api/follow?analystId=${analystId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          markUnfollowed(analystId);
          await mutate({ isFollowing: false, isSubscribed }, false);
        }
      } else {
        const res = await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analystId }),
        });
        if (res.ok) {
          markFollowed(analystId);
          await mutate({ isFollowing: true, isSubscribed }, false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // ── State-specific rendering ─────────────────────────────────────────────
  if (isSubscribed) {
    return (
      <button
        type="button"
        disabled
        onClick={(e) => e.preventDefault()}
        style={{
          ...baseStyle,
          background: "rgba(0, 212, 170, 0.15)",
          color: "var(--accent-green)",
          border: "1px solid rgba(0, 212, 170, 0.3)",
          cursor: "default",
        }}
      >
        Subscribed ✓
      </button>
    );
  }

  if (isFollowing) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...baseStyle,
          background: hover ? "rgba(239, 68, 68, 0.1)" : "rgba(0, 212, 170, 0.1)",
          color: hover ? "var(--accent-red)" : "var(--accent-green)",
          border: `1px solid ${hover ? "rgba(239, 68, 68, 0.3)" : "rgba(0, 212, 170, 0.3)"}`,
        }}
      >
        {hover ? "Unfollow" : "Following ✓"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      style={{
        ...baseStyle,
        background: "var(--accent-green)",
        color: "#fff",
        border: "1px solid var(--accent-green)",
      }}
    >
      Follow
    </button>
  );
}
