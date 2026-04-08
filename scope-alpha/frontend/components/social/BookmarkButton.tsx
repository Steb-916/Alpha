"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSocialStore } from "@/stores/socialStore";

interface Props {
  signalId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ signalId, initialBookmarked }: Props) {
  const { data: session } = useSession();
  const bookmarked = useSocialStore((s) =>
    s.bookmarkedSignalIds.has(signalId),
  );
  const loadedBookmarks = useSocialStore((s) => s.loadedBookmarks);
  const loadBookmarks = useSocialStore((s) => s.loadBookmarks);
  const markBookmarked = useSocialStore((s) => s.markBookmarked);
  const markUnbookmarked = useSocialStore((s) => s.markUnbookmarked);
  const [busy, setBusy] = useState(false);

  // Lazy-load the user's bookmarks once.
  useEffect(() => {
    if (session?.user?.id && !loadedBookmarks) {
      void loadBookmarks();
    }
  }, [session?.user?.id, loadedBookmarks, loadBookmarks]);

  const isBookmarked = bookmarked || initialBookmarked || false;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy || !session?.user?.id) return;
    setBusy(true);

    if (isBookmarked) markUnbookmarked(signalId);
    else markBookmarked(signalId);

    try {
      const res = await fetch(`/api/signals/${signalId}/bookmark`, {
        method: "POST",
      });
      if (!res.ok) {
        if (isBookmarked) markBookmarked(signalId);
        else markUnbookmarked(signalId);
        return;
      }
      const data = await res.json();
      if (data.bookmarked) markBookmarked(signalId);
      else markUnbookmarked(signalId);
    } catch {
      if (isBookmarked) markBookmarked(signalId);
      else markUnbookmarked(signalId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || !session?.user?.id}
      className="text-[10px] font-body cursor-pointer"
      style={{
        color: isBookmarked ? "var(--accent-yellow)" : "var(--text-muted)",
        opacity: !session?.user?.id ? 0.5 : 1,
        cursor: !session?.user?.id ? "not-allowed" : "pointer",
      }}
      title={isBookmarked ? "Remove bookmark" : "Bookmark"}
    >
      {isBookmarked ? "🔖" : "☆"}
    </button>
  );
}
