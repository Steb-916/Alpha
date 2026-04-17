"use client";

import { useState } from "react";
import { useAnnotationStore } from "@/lib/annotationStore";
import {
  TOOL_LABELS,
  TOOL_ICONS,
  DEFAULT_COLORS,
  type DrawingTool,
  type LineStyle,
} from "@/lib/annotations";

const tools: DrawingTool[] = [
  "select",
  "horizontal_line",
  "trend_line",
  "price_zone",
  "fibonacci",
  "text_note",
  "signal_marker",
  "freehand",
  "eraser",
];

const lineStyles: { value: LineStyle; label: string; icon: string }[] = [
  { value: "solid", label: "Solid", icon: "─" },
  { value: "dashed", label: "Dashed", icon: "╌" },
  { value: "dotted", label: "Dotted", icon: "┈" },
];

export function DrawingToolbar() {
  const {
    activeTool,
    activeColor,
    activeLineStyle,
    setActiveTool,
    setActiveColor,
    setActiveLineStyle,
  } = useAnnotationStore();
  const [showColors, setShowColors] = useState(false);

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-md)]"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Drawing Tools */}
      {tools.map((tool) => (
        <button
          key={tool}
          onClick={() => setActiveTool(tool)}
          title={TOOL_LABELS[tool]}
          className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center text-sm cursor-pointer transition-all"
          style={{
            background:
              activeTool === tool
                ? "rgba(0, 212, 170, 0.15)"
                : "transparent",
            color:
              activeTool === tool
                ? "var(--accent-green)"
                : "var(--text-muted)",
            border:
              activeTool === tool
                ? "1px solid rgba(0, 212, 170, 0.3)"
                : "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            if (activeTool !== tool) {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }
          }}
        >
          {TOOL_ICONS[tool]}
        </button>
      ))}

      {/* Separator */}
      <div
        className="w-px h-6 mx-1"
        style={{ background: "var(--glass-border)" }}
      />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => setShowColors(!showColors)}
          className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}
          title="Color"
        >
          <div
            className="w-4 h-4 rounded-full"
            style={{ background: activeColor }}
          />
        </button>
        {showColors && (
          <div
            className="absolute top-full mt-1 left-0 p-2 rounded-[var(--radius-md)] grid grid-cols-4 gap-1 z-50"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(20px)",
              boxShadow: "var(--glass-shadow-hover)",
            }}
          >
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setActiveColor(color);
                  setShowColors(false);
                }}
                className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110"
                style={{
                  background: color,
                  border:
                    activeColor === color
                      ? "2px solid white"
                      : "2px solid transparent",
                  boxShadow:
                    activeColor === color
                      ? `0 0 8px ${color}`
                      : "none",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Line Style */}
      {(activeTool === "horizontal_line" ||
        activeTool === "trend_line") && (
        <div className="flex items-center gap-0.5">
          {lineStyles.map((ls) => (
            <button
              key={ls.value}
              onClick={() => setActiveLineStyle(ls.value)}
              title={ls.label}
              className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center text-xs cursor-pointer font-mono"
              style={{
                background:
                  activeLineStyle === ls.value
                    ? "rgba(0, 212, 170, 0.15)"
                    : "transparent",
                color:
                  activeLineStyle === ls.value
                    ? "var(--accent-green)"
                    : "var(--text-muted)",
              }}
            >
              {ls.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
