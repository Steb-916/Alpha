"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useSocialStore } from "@/stores/socialStore";

interface Props {
  signalId: string;
  initialLiked?: boolean;
  initialCount?: number;
}

export function LikeButton({ signalId, initialLiked, initialCount }: Props) {
  const { data: session } = useSession();
  const liked = useSocialStore((s) => s.likedSignalIds.has(signalId));
  const storeCount = useSocialStore((s) => s.likeCounts[signalId]);
  const markLiked = useSocialStore((s) => s.markLiked);
  const markUnliked = useSocialStore((s) => s.markUnliked);
  const [busy, setBusy] = useState(false);

  // Initial seed from props (server-provided isLiked / likeCount).
  const isLiked = liked || initialLiked || false;
  const count = storeCount ?? initialCount ?? 0;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !session?.user?.id) return;
    setBusy(true);

    // Optimistic update.
    if (isLiked) markUnliked(signalId, Math.max(0, count - 1));
    else markLiked(signalId, count + 1);

    try {
      const res = await fetch(`/api/signals/${signalId}/like`, {
        method: "POST",
      });
      if (!res.ok) {
        // Roll back.
        if (isLiked) markLiked(signalId, count);
        else markUnliked(signalId, count);
        return;
      }
      const data = await res.json();
      if (data.liked) markLiked(signalId, data.likeCount);
      else markUnliked(signalId, data.likeCount);
    } catch {
      // Roll back.
      if (isLiked) markLiked(signalId, count);
      else markUnliked(signalId, count);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || !session?.user?.id}
      className="flex items-center gap-1 text-[10px] font-body cursor-pointer"
      style={{
        color: isLiked ? "#EF4444" : "var(--text-muted)",
        opacity: !session?.user?.id ? 0.5 : 1,
        cursor: !session?.user?.id ? "not-allowed" : "pointer",
      }}
      title={isLiked ? "Unlike" : "Like"}
    >
      {isLiked ? "❤" : "♡"} {count}
    </button>
  );
}
