"use client";

/**
 * Signal screenshot picker — built inert when R2 is not configured.
 *
 * Two paths to capture an image:
 *  1. "Capture chart" — finds the chart container's <canvas> element and
 *     calls toDataURL('image/png'), then converts to a Blob.
 *  2. File upload — standard <input type="file" />.
 *
 * The actual upload happens in two steps controlled by the parent form:
 *   a) parent POSTs the signal first (as draft) → gets the signalId back
 *   b) parent calls onSelected(file) which it uses to POST to
 *      /api/signals/[id]/screenshot
 *
 * This component only manages the *staged* file; it does not perform the
 * upload itself.
 */

import { useRef, useState } from "react";
import { ALLOWED_SCREENSHOT_TYPES, MAX_SCREENSHOT_BYTES } from "@/config/signals";

interface Props {
  /** Called when the user picks/captures an image. */
  onSelected: (file: File | null, previewUrl: string | null) => void;
  /** Looks up the chart canvas. Pass a ref to your chart container. */
  chartContainerRef?: React.RefObject<HTMLDivElement>;
}

export function SignalScreenshotPicker({ onSelected, chartContainerRef }: Props) {
  const enabled = process.env.NEXT_PUBLIC_SCREENSHOTS_ENABLED === "true";
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stageFile = (file: File) => {
    setError(null);
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setError(`File must be smaller than ${MAX_SCREENSHOT_BYTES / 1024 / 1024} MB`);
      return;
    }
    if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type as never)) {
      setError(`File type ${file.type} not allowed`);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onSelected(file, url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
  };

  const captureChart = async () => {
    setError(null);
    if (!chartContainerRef?.current) {
      setError("Chart not available");
      return;
    }
    const canvas = chartContainerRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) {
      setError("No chart canvas found to capture");
      return;
    }
    try {
      // Convert canvas to PNG blob via dataURL → Blob.
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `chart-${Date.now()}.png`, { type: "image/png" });
      stageFile(file);
    } catch (err) {
      setError((err as Error).message || "Capture failed");
    }
  };

  const clear = () => {
    setPreview(null);
    setError(null);
    onSelected(null, null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Inert state ──
  if (!enabled) {
    return (
      <div>
        <label
          className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Chart screenshot
        </label>
        <button
          type="button"
          disabled
          className="w-full py-2 text-xs font-body rounded-[var(--radius-sm)] cursor-not-allowed"
          style={{
            background: "var(--glass-bg)",
            border: "1px dashed var(--glass-border)",
            color: "var(--text-muted)",
          }}
        >
          📷 Chart screenshots coming soon
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        Chart screenshot (optional)
      </label>

      {preview ? (
        <div className="space-y-2">
          <img
            src={preview}
            alt="Screenshot preview"
            className="w-full rounded-[var(--radius-sm)]"
            style={{ border: "1px solid var(--glass-border)", maxHeight: 200, objectFit: "contain" }}
          />
          <button
            type="button"
            onClick={clear}
            className="text-[10px] font-body cursor-pointer"
            style={{ color: "var(--accent-red)" }}
          >
            Remove screenshot
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={captureChart}
            className="flex-1 py-2 text-xs font-body rounded-[var(--radius-sm)] cursor-pointer"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            📸 Capture chart
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 text-xs font-body rounded-[var(--radius-sm)] cursor-pointer"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            📎 Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_SCREENSHOT_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <div className="mt-1 text-[10px] font-body" style={{ color: "var(--accent-red)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
