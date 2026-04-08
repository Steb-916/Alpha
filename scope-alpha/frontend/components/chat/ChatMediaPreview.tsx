"use client";

/**
 * Inline image preview for chat messages.
 *
 * Renders a constrained-size thumbnail. Click opens a full-screen lightbox
 * modal.
 */

import { useState } from "react";

interface Props {
  url: string;
  type: string;
}

export function ChatMediaPreview({ url, type }: Props) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Chat attachment"
        className="mt-2 rounded-[var(--radius-sm)] cursor-pointer"
        style={{
          maxWidth: "100%",
          maxHeight: 200,
          objectFit: "contain",
          border: "1px solid var(--glass-border)",
        }}
        onClick={() => setShowLightbox(true)}
        loading="lazy"
      />

      {showLightbox && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 cursor-zoom-out"
          style={{ background: "rgba(0, 0, 0, 0.85)" }}
          onClick={() => setShowLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Chat attachment full size"
            className="rounded-[var(--radius-md)]"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      )}
    </>
  );
}
