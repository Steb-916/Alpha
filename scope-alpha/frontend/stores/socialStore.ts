/**
 * Social Zustand store — Phase 6.
 *
 * Tracks the current user's:
 *   - followed analyst IDs
 *   - liked signal IDs (with denormalized counts)
 *   - bookmarked signal IDs
 *
 * Lazy-loaded on first mount via the social action hooks. Optimistic
 * updates fire before the network round trip; rollbacks on error.
 */

import { create } from "zustand";

interface SocialState {
  followedAnalystIds: Set<string>;
  likedSignalIds: Set<string>;
  bookmarkedSignalIds: Set<string>;
  likeCounts: Record<string, number>;

  // Lazy loaders — only fetch once.
  loadedBookmarks: boolean;

  // Marks (called by individual buttons after a successful API call).
  markFollowed: (analystId: string) => void;
  markUnfollowed: (analystId: string) => void;
  markLiked: (signalId: string, count: number) => void;
  markUnliked: (signalId: string, count: number) => void;
  markBookmarked: (signalId: string) => void;
  markUnbookmarked: (signalId: string) => void;

  loadBookmarks: () => Promise<void>;
  reset: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  followedAnalystIds: new Set<string>(),
  likedSignalIds: new Set<string>(),
  bookmarkedSignalIds: new Set<string>(),
  likeCounts: {},
  loadedBookmarks: false,

  markFollowed: (analystId) =>
    set((state) => {
      const next = new Set(state.followedAnalystIds);
      next.add(analystId);
      return { followedAnalystIds: next };
    }),

  markUnfollowed: (analystId) =>
    set((state) => {
      const next = new Set(state.followedAnalystIds);
      next.delete(analystId);
      return { followedAnalystIds: next };
    }),

  markLiked: (signalId, count) =>
    set((state) => {
      const next = new Set(state.likedSignalIds);
      next.add(signalId);
      return {
        likedSignalIds: next,
        likeCounts: { ...state.likeCounts, [signalId]: count },
      };
    }),

  markUnliked: (signalId, count) =>
    set((state) => {
      const next = new Set(state.likedSignalIds);
      next.delete(signalId);
      return {
        likedSignalIds: next,
        likeCounts: { ...state.likeCounts, [signalId]: count },
      };
    }),

  markBookmarked: (signalId) =>
    set((state) => {
      const next = new Set(state.bookmarkedSignalIds);
      next.add(signalId);
      return { bookmarkedSignalIds: next };
    }),

  markUnbookmarked: (signalId) =>
    set((state) => {
      const next = new Set(state.bookmarkedSignalIds);
      next.delete(signalId);
      return { bookmarkedSignalIds: next };
    }),

  loadBookmarks: async () => {
    if (get().loadedBookmarks) return;
    try {
      const res = await fetch("/api/bookmarks?limit=100");
      if (!res.ok) {
        set({ loadedBookmarks: true });
        return;
      }
      const data = await res.json();
      const ids = new Set<string>(
        (data.items ?? []).map((b: { signal: { id: string } }) => b.signal.id),
      );
      set({ bookmarkedSignalIds: ids, loadedBookmarks: true });
    } catch {
      set({ loadedBookmarks: true });
    }
  },

  reset: () =>
    set({
      followedAnalystIds: new Set<string>(),
      likedSignalIds: new Set<string>(),
      bookmarkedSignalIds: new Set<string>(),
      likeCounts: {},
      loadedBookmarks: false,
    }),
}));
