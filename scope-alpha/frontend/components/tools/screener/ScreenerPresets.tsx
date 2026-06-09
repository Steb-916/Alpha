"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Trash2, ChevronDown } from "lucide-react";
import type { FilterRule } from "@/hooks/useScreener";

const STORAGE_KEY = "screener:presets";

interface Preset {
  name: string;
  rules: FilterRule[];
  savedAt: string;
}

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* storage full or unavailable */
  }
}

export function ScreenerPresets({
  rules,
  onLoad,
}: {
  rules: FilterRule[];
  onLoad: (rules: FilterRule[]) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  function handleSave() {
    if (!name.trim() || rules.length === 0) return;
    const updated = [
      ...presets.filter((p) => p.name !== name.trim()),
      { name: name.trim(), rules, savedAt: new Date().toISOString() },
    ];
    setPresets(updated);
    savePresets(updated);
    setName("");
  }

  function handleDelete(presetName: string) {
    const updated = presets.filter((p) => p.name !== presetName);
    setPresets(updated);
    savePresets(updated);
  }

  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  function handleToggle() {
    if (!open && btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
    setOpen((v) => !v);
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-mono transition-all"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          color: "var(--text-secondary)",
        }}
      >
        <Save size={12} />
        Presets
        {presets.length > 0 && (
          <span
            className="px-1 rounded-[var(--radius-pill)] text-[9px] font-bold"
            style={{ background: "var(--accent-blue)", color: "#000" }}
          >
            {presets.length}
          </span>
        )}
        <ChevronDown
          size={11}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && anchorRect && (
        <div
          className="fixed z-50 rounded-[var(--radius-lg)] p-4 space-y-3 w-64"
          style={{
            top: anchorRect.bottom + 8,
            left: Math.max(0, anchorRect.right - 256),
            background: "var(--glass-bg-solid, #141414)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* Save current */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
              Save current filters
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Preset name…"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="flex-1 px-2 py-1.5 rounded text-xs font-mono"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSave}
                disabled={!name.trim() || rules.length === 0}
                className="px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--accent-blue)", color: "#000" }}
              >
                Save
              </button>
            </div>
            {rules.length === 0 && (
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                Add filters first
              </p>
            )}
          </div>

          {/* Saved presets */}
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
                Saved
              </p>
              {presets.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-1.5"
                  style={{ borderBottom: "1px solid var(--glass-border)" + "33" }}
                >
                  <button
                    onClick={() => {
                      onLoad(p.rules);
                      setOpen(false);
                    }}
                    className="flex-1 text-left py-1.5 text-xs font-mono truncate hover:opacity-80 transition-opacity"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {p.name}
                    <span className="ml-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
                      ({p.rules.length} filter{p.rules.length !== 1 ? "s" : ""})
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(p.name)}
                    className="p-1 hover:opacity-70 transition-opacity"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {presets.length === 0 && (
            <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              No presets saved yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
