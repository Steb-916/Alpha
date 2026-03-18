"use client";

import { useState } from "react";
import { GlassButton } from "@/components/ui/GlassButton";

export interface ReviewData {
  id: string;
  authorName: string;
  authorInitial: string;
  rating: number;
  content: string;
  analystResponse: string | null;
  subscriptionMonths: number;
  createdAt: string;
}

// Mock reviews for demo
export function generateMockReviews(analystSlug: string): ReviewData[] {
  const reviews: ReviewData[] = [
    {
      id: `rev-${analystSlug}-1`,
      authorName: "TraderJoe",
      authorInitial: "T",
      rating: 5,
      content: "Incredible calls. The BTC long from 63k was perfectly timed. Annotations on chart are super clear and easy to follow. Worth every penny.",
      analystResponse: "Thanks Joe! That was a textbook bounce off the weekly support. Glad you caught it.",
      subscriptionMonths: 6,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      id: `rev-${analystSlug}-2`,
      authorName: "CryptoApe",
      authorInitial: "C",
      rating: 4,
      content: "Solid signals overall. Win rate is legit. Only downside is sometimes the timeframes are a bit slow for my style.",
      analystResponse: null,
      subscriptionMonths: 3,
      createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
    {
      id: `rev-${analystSlug}-3`,
      authorName: "DeFiDegen",
      authorInitial: "D",
      rating: 5,
      content: "The annotations on the chart are game-changing. Being able to see their thesis drawn directly on my own terminal is so much better than Discord screenshots.",
      analystResponse: "Appreciate it! That's exactly the experience we're building for.",
      subscriptionMonths: 4,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: `rev-${analystSlug}-4`,
      authorName: "WhaleHunter",
      authorInitial: "W",
      rating: 3,
      content: "Good when the market is trending, but the ranging period signals were rough. Still net positive though.",
      analystResponse: "Fair point. Range-bound markets are tough — I've been adjusting my approach for chop. Stay tuned.",
      subscriptionMonths: 2,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];
  return reviews;
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
  reviews: ReviewData[];
  analystName: string;
  canReview?: boolean;
}

export function ReviewsSection({ reviews, analystName, canReview = true }: ReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  const handleSubmit = () => {
    if (rating > 0 && content.trim()) {
      // In production, this would be an API call
      setShowForm(false);
      setRating(0);
      setContent("");
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
        {canReview && !showForm && (
          <GlassButton variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            Write Review
          </GlassButton>
        )}
      </div>

      {/* Write review form */}
      {showForm && (
        <div
          className="p-4 rounded-[var(--radius-md)] mb-4"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <h3 className="text-xs font-bold font-body mb-2" style={{ color: "var(--text-primary)" }}>
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
          <div className="flex gap-2 mt-2">
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSubmit}
            >
              Submit Review
            </GlassButton>
            <GlassButton variant="ghost" size="sm" onClick={() => setShowForm(false)}>
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
          {reviews.map((review) => (
            <div
              key={review.id}
              className="p-3 rounded-[var(--radius-md)]"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
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
                  <div>
                    <span className="text-xs font-bold font-body" style={{ color: "var(--text-primary)" }}>
                      {review.authorName}
                    </span>
                    {review.subscriptionMonths > 0 && (
                      <span className="text-[10px] font-body ml-2" style={{ color: "var(--text-muted)" }}>
                        Subscribed {review.subscriptionMonths}mo
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StarDisplay rating={review.rating} />
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <p className="text-xs font-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {review.content}
              </p>

              {/* Analyst response */}
              {review.analystResponse && (
                <div
                  className="mt-2 p-2.5 rounded-[var(--radius-sm)]"
                  style={{
                    background: "rgba(0, 212, 170, 0.03)",
                    borderLeft: "2px solid var(--accent-green)",
                  }}
                >
                  <span className="text-[10px] font-bold font-body" style={{ color: "var(--accent-green)" }}>
                    Analyst Response
                  </span>
                  <p className="text-xs font-body mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {review.analystResponse}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
