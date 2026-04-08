"use client";

/**
 * Inline analyst response display + reply form.
 *
 * - Shows the existing response indented below the review with a label and timestamp.
 * - If no response exists and the current user is the analyst being reviewed,
 *   shows a "Reply" button that expands an inline textarea + submit.
 */

import { useState } from "react";

interface Props {
  reviewId: string;
  existingResponse: string | null;
  responseTimestamp?: string | null;
  isAnalyst: boolean;
  onSubmitted?: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function AnalystResponse({
  reviewId,
  existingResponse,
  responseTimestamp,
  isAnalyst,
  onSubmitted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingResponse) {
    return (
      <div
        className="mt-2 ml-6 p-3 rounded-[var(--radius-sm)]"
        style={{
          background: "var(--glass-bg)",
          borderLeft: "2px solid var(--accent-green)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[10px] font-bold font-body uppercase tracking-wider"
            style={{ color: "var(--accent-green)" }}
          >
            Analyst response
          </span>
          {responseTimestamp && (
            <span
              className="text-[9px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {new Date(responseTimestamp).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
          {existingResponse}
        </p>
      </div>
    );
  }

  if (!isAnalyst) return null;

  if (!open) {
    return (
      <div className="mt-2 ml-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] font-body cursor-pointer"
          style={{ color: "var(--accent-green)" }}
        >
          Reply
        </button>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    if (!text.trim()) {
      setError("Reply cannot be empty");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      onSubmitted?.();
      setText("");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message || "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 ml-6 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Reply to this review…"
        className="w-full px-3 py-2 text-xs font-body rounded-[var(--radius-sm)] outline-none resize-none"
        style={inputStyle}
      />
      {error && (
        <div className="text-[10px] font-body" style={{ color: "var(--accent-red)" }}>
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] font-body cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
          style={{
            background: "var(--accent-green)",
            color: "#fff",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Posting…" : "Post reply"}
        </button>
      </div>
    </div>
  );
}
