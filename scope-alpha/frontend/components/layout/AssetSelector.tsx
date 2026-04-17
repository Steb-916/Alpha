"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SUPPORTED_ASSETS } from "@/config/assets";
import { useAppStore } from "@/lib/store";

export function AssetSelector() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const setAsset = useAppStore((s) => s.setAsset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] cursor-pointer"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          transition: "all 0.2s ease",
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--accent-green)" }}
        />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {selectedAsset} / USDT
        </span>
        <ChevronDown size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-56 py-1 rounded-[var(--radius-md)] z-50 max-h-80 overflow-y-auto"
          style={{
            background: "var(--surface-modal, var(--glass-bg))",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "var(--glass-shadow-hover)",
          }}
        >
          {SUPPORTED_ASSETS.map((asset) => (
            <button
              key={asset.symbol}
              onClick={() => {
                setAsset(asset.symbol);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-body cursor-pointer"
              style={{
                color:
                  asset.symbol === selectedAsset
                    ? "var(--accent-green)"
                    : "var(--text-secondary)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--glass-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="font-semibold">{asset.symbol}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {asset.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
