"use client";

/**
 * Reviews section.
 *
 * Phase 5 rewrite:
 *   - SWR-fetches /api/reviews?analystId=…&sort=…&verified=…&tier=…
 *   - Wires the previously stubbed form to POST /api/reviews
 *   - Renders <VerifiedBadge />, <ReviewVoteButtons />, <AnalystResponse />
 *   - Filter bar above the list
 *
 * Backwards compat: the existing `reviews` prop is still accepted and used
 * as a fallback when SWR has no data (e.g. for the demo mock analysts that
 * aren't backed by the DB).
 */

import { useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useSession } from "next-auth/react";
import { GlassButton } from "@/components/ui/GlassButton";
import { VerifiedBadge } from "@/components/reviews/VerifiedBadge";
import { ReviewVoteButtons } from "@/components/reviews/ReviewVoteButtons";
import { AnalystResponse } from "@/components/reviews/AnalystResponse";
import {
  ReviewFilterBar,
  type ReviewSort,
} from "@/components/reviews/ReviewFilterBar";

export interface ReviewData {
  id: string;
  authorId?: string;
  authorName: string;
  authorInitial: string;
  rating: number;
  content: string;
  analystResponse: string | null;
  subscriptionMonths: number;
  createdAt: string;
  // Phase 5
  helpfulCount?: number;
  unhelpfulCount?: number;
  verifiedSubscriber?: boolean;
  subscriptionTier?: string | null;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// Mock reviews preserved for backward compat with the demo analyst pages
// that pass mock data through the `reviews` prop.
export function generateMockReviews(analystSlug: string): ReviewData[] {
  return [
    {
      id: `rev-${analystSlug}-1`,
      authorName: "TraderJoe",
      authorInitial: "T",
      rating: 5,
      content:
        "Incredible calls. The BTC long from 63k was perfectly timed. Annotations on chart are super clear and easy to follow. Worth every penny.",
      analystResponse:
        "Thanks Joe! That was a textbook bounce off the weekly support. Glad you caught it.",
      subscriptionMonths: 6,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      verifiedSubscriber: true,
      subscriptionTier: "Pro",
    },
    {
      id: `rev-${analystSlug}-2`,
      authorName: "CryptoApe",
      authorInitial: "C",
      rating: 4,
      content:
        "Solid signals overall. Win rate is legit. Only downside is sometimes the timeframes are a bit slow for my style.",
      analystResponse: null,
      subscriptionMonths: 3,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
      verifiedSubscriber: true,
      subscriptionTier: "Standard",
    },
    {
      id: `rev-${analystSlug}-3`,
      authorName: "DeFiDegen",
      authorInitial: "D",
      rating: 5,
      content:
        "The annotations on the chart are game-changing. Being able to see their thesis drawn directly on my own terminal is so much better than Discord screenshots.",
      analystResponse:
        "Appreciate it! That's exactly the experience we're building for.",
      subscriptionMonths: 4,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: `rev-${analystSlug}-4`,
      authorName: "WhaleHunter",
      authorInitial: "W",
      rating: 3,
      content:
        "Good when the market is trending, but the ranging period signals were rough. Still net positive though.",
      analystResponse:
        "Fair point. Range-bound markets are tough — I've been adjusting my approach for chop. Stay tuned.",
      subscriptionMonths: 2,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "md" ? "text-base" : "text-xs";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={starSize}
          style={{
            color: i < rating ? "#F59E0B" : "var(--text-tertiary)",
            opacity: i < rating ? 1 : 0.3,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHover(i + 1)}
          onMouseLeave={() => setHover(0)}
          className="text-xl cursor-pointer"
          style={{
            color: i < (hover || value) ? "#F59E0B" : "var(--text-tertiary)",
            opacity: i < (hover || value) ? 1 : 0.3,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

interface ReviewsSectionProps {
  reviews: ReviewData[]; // fallback when SWR has nothing
  analystName: string;
  analystId?: string;
  canReview?: boolean;
  // When true, the current user is the analyst being reviewed (so vote
  // buttons get disabled and reply buttons appear).
  viewerIsAnalyst?: boolean;
}

export function ReviewsSection({
  reviews: fallbackReviews,
  analystName,
  analystId,
  canReview = true,
  viewerIsAnalyst = false,
}: ReviewsSectionProps) {
  const { data: session } = useSession();

  const [sort, setSort] = useState<ReviewSort>("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [tier, setTier] = useState("");

  const swrKey = analystId
    ? `/api/reviews?analystId=${analystId}&sort=${sort}${verifiedOnly ? "&verified=true" : ""}${tier ? `&tier=${encodeURIComponent(tier)}` : ""}`
    : null;

  const { data: apiReviews, mutate: mutateReviews } = useSWR<ReviewData[]>(
    swrKey,
    fetcher,
  );

  // Hybrid: use API data when present, otherwise fall back to the mock list.
  const reviews: ReviewData[] = useMemo(() => {
    if (apiReviews && apiReviews.length > 0) {
      return apiReviews.map((r) => ({
        ...r,
        authorInitial: (r.authorName?.[0] ?? "?").toUpperCase(),
      }));
    }
    return fallbackReviews;
  }, [apiReviews, fallbackReviews]);

  // Available tiers for the filter bar — derived from the current review set.
  const availableTiers = useMemo(() => {
    const set = new Set<string>();
    for (const r of reviews) {
      if (r.subscriptionTier) set.add(r.subscriptionTier);
    }
    return Array.from(set);
  }, [reviews]);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  const handleSubmit = async () => {
    setFormError(null);
    if (rating < 1 || rating > 5) {
      setFormError("Pick a rating from 1 to 5");
      return;
    }
    if (!content.trim()) {
      setFormError("Review text is required");
      return;
    }
    if (!analystId) {
      // Demo path with no analystId — just clear the form. Mock-only mode.
      setShowForm(false);
      setRating(0);
      setContent("");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analystId, rating, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFormError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      // Refresh review list.
      mutateReviews();
      // Also nudge any other listeners on the same key.
      if (swrKey) globalMutate(swrKey);
      setShowForm(false);
      setRating(0);
      setContent("");
    } catch (e) {
      setFormError((e as Error).message || "Failed to post review");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
            Reviews
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <StarDisplay rating={Math.round(avgRating)} />
              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                {avgRating} ({reviews.length})
              </span>
            </div>
          )}
        </div>
        {canReview && !showForm && !viewerIsAnalyst && (
          <GlassButton variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            Write Review
          </GlassButton>
        )}
      </div>

      {/* Filter bar */}
      {reviews.length > 0 && (
        <ReviewFilterBar
          sort={sort}
          verifiedOnly={verifiedOnly}
          tier={tier}
          availableTiers={availableTiers}
          onChange={(next) => {
            setSort(next.sort);
            setVerifiedOnly(next.verifiedOnly);
            setTier(next.tier);
          }}
        />
      )}

      {/* Write form */}
      {showForm && (
        <div
          className="p-4 rounded-[var(--radius-md)] mb-4"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <h3
            className="text-xs font-bold font-body mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Rate {analystName}
          </h3>
          <StarInput value={rating} onChange={setRating} />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your experience..."
            rows={3}
            className="w-full mt-2 px-3 py-2 rounded-[var(--radius-sm)] text-xs font-body outline-none resize-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
          />
          {formError && (
            <div
              className="mt-2 text-[10px] font-body"
              style={{ color: "var(--accent-red)" }}
            >
              {formError}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
            >
              Cancel
            </GlassButton>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-xs font-body py-4 text-center" style={{ color: "var(--text-muted)" }}>
          No reviews yet. Be the first to review this analyst.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const cannotVote =
              !session?.user?.id ||
              review.authorId === session.user.id ||
              viewerIsAnalyst;

            return (
              <div
                key={review.id}
                className="p-3 rounded-[var(--radius-md)]"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#818CF8",
                        border: "1px solid rgba(99, 102, 241, 0.25)",
                      }}
                    >
                      {review.authorInitial}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold font-body"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {review.authorName}
                      </span>
                      <VerifiedBadge
                        verified={Boolean(review.verifiedSubscriber)}
                        tier={review.subscriptionTier}
                      />
                      {review.subscriptionMonths > 0 && (
                        <span
                          className="text-[10px] font-body"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Subscribed {review.subscriptionMonths}mo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={review.rating} />
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <p
                  className="text-xs font-body leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {review.content}
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <ReviewVoteButtons
                    reviewId={review.id}
                    helpfulCount={review.helpfulCount ?? 0}
                    unhelpfulCount={review.unhelpfulCount ?? 0}
                    disabled={cannotVote}
                  />
                </div>

                <AnalystResponse
                  reviewId={review.id}
                  existingResponse={review.analystResponse}
                  isAnalyst={viewerIsAnalyst}
                  onSubmitted={() => mutateReviews()}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
