"use client";

import Link from "next/link";
import { useAnnotationStore } from "@/lib/annotationStore";

interface AnalystLayer {
  id: string;
  name: string;
  color: string;
  annotationCount: number;
}

interface LayersPanelProps {
  layers: AnalystLayer[];
}

export function LayersPanel({ layers }: LayersPanelProps) {
  const { layerVisibility, toggleLayerVisibility, annotations } =
    useAnnotationStore();

  if (layers.length === 0) {
    return (
      <div className="p-3">
        <h3
          className="text-xs font-bold font-body uppercase tracking-wider mb-3"
          style={{ color: "var(--text-tertiary)" }}
        >
          Layers
        </h3>
        <p
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          No analyst layers yet. Subscribe to analysts in the Marketplace to see their signals and annotations on your charts.
        </p>
        <Link
          href="/marketplace"
          className="inline-block mt-2 text-xs font-body font-bold no-underline px-3 py-1.5 rounded-[var(--radius-sm)]"
          style={{
            color: "var(--accent-green)",
            background: "rgba(0, 212, 170, 0.08)",
            border: "1px solid rgba(0, 212, 170, 0.2)",
          }}
        >
          Go to Marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3
        className="text-xs font-bold font-body uppercase tracking-wider mb-3"
        style={{ color: "var(--text-tertiary)" }}
      >
        Layers
      </h3>
      <div className="space-y-1.5">
        {layers.map((layer) => {
          const visible = layerVisibility[layer.id] ?? true;
          const count = annotations.filter(
            (a) => a.analystId === layer.id && a.isActive && !a.isDraft
          ).length;

          return (
            <button
              key={layer.id}
              onClick={() => toggleLayerVisibility(layer.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-sm)] cursor-pointer transition-all"
              style={{
                background: visible
                  ? "rgba(0, 212, 170, 0.06)"
                  : "transparent",
                border: `1px solid ${visible ? "rgba(0, 212, 170, 0.15)" : "var(--glass-border)"}`,
                opacity: visible ? 1 : 0.5,
              }}
            >
              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  background: layer.color,
                  boxShadow: visible
                    ? `0 0 6px ${layer.color}40`
                    : "none",
                }}
              />

              {/* Name */}
              <span
                className="text-xs font-body font-medium flex-1 text-left truncate"
                style={{
                  color: visible
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                }}
              >
                {layer.name}
              </span>

              {/* Count */}
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {count}
              </span>

              {/* Toggle indicator */}
              <div
                className="w-6 h-3.5 rounded-full relative transition-colors"
                style={{
                  background: visible
                    ? "var(--accent-green)"
                    : "var(--glass-border)",
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full absolute top-0.5 transition-all"
                  style={{
                    background: "#fff",
                    left: visible ? "12px" : "2px",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
