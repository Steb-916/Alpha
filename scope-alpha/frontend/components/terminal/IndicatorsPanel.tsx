"use client";

import { useState, useRef, useEffect } from "react";
import {
  useIndicatorStore,
  INDICATOR_LABELS,
  formatIndicatorName,
  type IndicatorKind,
  type IndicatorInstance,
} from "@/lib/indicatorStore";

const ADDABLE_KINDS: IndicatorKind[] = [
  "sma",
  "ema",
  "bollinger",
  "vwap",
  "rsi",
  "macd",
];

function ParamEditor({
  inst,
  onChange,
}: {
  inst: IndicatorInstance;
  onChange: (params: Record<string, number>) => void;
}) {
  const paramKeys = Object.keys(inst.params);
  if (paramKeys.length === 0) {
    return (
      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        no params
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {paramKeys.map((key) => (
        <label
          key={key}
          className="flex items-center gap-1 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{key}</span>
          <input
            type="number"
            value={inst.params[key]}
            min={1}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v > 0) onChange({ [key]: v });
            }}
            className="w-12 px-1 py-0.5 rounded font-mono text-[10px] outline-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
        </label>
      ))}
    </div>
  );
}

export function IndicatorsPanel() {
  const {
    indicators,
    addIndicator,
    removeIndicator,
    updateIndicatorParams,
    toggleVisibility,
  } = useIndicatorStore();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAdd(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Indicators
        </h3>
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded cursor-pointer"
            style={{
              color: "var(--accent-green)",
              background: "rgba(0, 212, 170, 0.08)",
              border: "1px solid rgba(0, 212, 170, 0.2)",
            }}
          >
            + Add
          </button>
          {showAdd && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded w-44 z-50"
              style={{
                background: "var(--surface-modal, var(--glass-bg))",
                border: "1px solid var(--glass-border)",
                backdropFilter: "blur(20px)",
                boxShadow: "var(--glass-shadow-hover)",
              }}
            >
              {ADDABLE_KINDS.map((kind) => (
                <button
                  key={kind}
                  onClick={() => {
                    addIndicator(kind);
                    setShowAdd(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-body cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--glass-bg)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  {INDICATOR_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {indicators.length === 0 && (
        <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          No indicators yet. Click + Add to get started.
        </p>
      )}

      <div className="space-y-1.5">
        {indicators.map((inst) => {
          const expanded = expandedId === inst.id;
          return (
            <div
              key={inst.id}
              className="rounded-[var(--radius-sm)] overflow-hidden"
              style={{
                background: inst.visible
                  ? "rgba(0, 212, 170, 0.04)"
                  : "transparent",
                border: `1px solid ${inst.visible ? "rgba(0, 212, 170, 0.12)" : "var(--glass-border)"}`,
                opacity: inst.visible ? 1 : 0.55,
              }}
            >
              <button
                onClick={() =>
                  setExpandedId(expanded ? null : inst.id)
                }
                className="w-full flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-all text-left"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    background: inst.color,
                    boxShadow: inst.visible ? `0 0 6px ${inst.color}40` : "none",
                  }}
                />
                <span
                  className="text-xs font-body font-medium flex-1 truncate"
                  style={{
                    color: inst.visible
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {formatIndicatorName(inst)}
                </span>
                <span
                  role="button"
                  aria-label={inst.visible ? "Hide" : "Show"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(inst.id);
                  }}
                  className="w-6 h-3.5 rounded-full relative transition-colors cursor-pointer shrink-0"
                  style={{
                    background: inst.visible
                      ? "var(--accent-green)"
                      : "var(--glass-border)",
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full absolute top-0.5 transition-all"
                    style={{
                      background: "#fff",
                      left: inst.visible ? "12px" : "2px",
                    }}
                  />
                </span>
                <span
                  role="button"
                  aria-label="Remove"
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeIndicator(inst.id);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded text-[14px] font-mono cursor-pointer shrink-0"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLSpanElement).style.color =
                      "var(--accent-red)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLSpanElement).style.color =
                      "var(--text-muted)";
                  }}
                >
                  ×
                </span>
              </button>
              {expanded && (
                <div
                  className="px-2.5 py-2"
                  style={{ borderTop: "1px solid var(--glass-border)" }}
                >
                  <ParamEditor
                    inst={inst}
                    onChange={(params) =>
                      updateIndicatorParams(inst.id, params)
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
