"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "DOT", "LINK"];
const STYLES = ["scalper", "swing", "position", "macro"];

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BecomeAnalystForm({ onSuccess, onCancel }: Props) {
  const [tagline, setTagline] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [tradingStyle, setTradingStyle] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleAsset = (asset: string) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/users/become-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline,
          primaryAssets: selectedAssets,
          tradingStyle,
          experienceYears: experienceYears || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to upgrade");
        return;
      }

      onSuccess();
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  return (
    <GlassCard glow="green">
      <h2 className="text-lg font-bold font-display mb-4" style={{ color: "var(--text-primary)" }}>
        Analyst Application
      </h2>

      {error && (
        <div
          className="mb-4 p-3 rounded-[var(--radius-sm)] text-sm"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--accent-red)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Tagline
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={200}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
            placeholder="e.g., Derivatives trader focused on BTC and ETH perpetuals"
          />
        </div>

        <div>
          <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Primary Assets
          </label>
          <div className="flex flex-wrap gap-2">
            {ASSETS.map((asset) => (
              <button
                key={asset}
                type="button"
                onClick={() => toggleAsset(asset)}
                className="px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold font-body cursor-pointer transition-all"
                style={{
                  background: selectedAssets.includes(asset)
                    ? "var(--accent-green)"
                    : "var(--glass-bg)",
                  color: selectedAssets.includes(asset)
                    ? "#fff"
                    : "var(--text-secondary)",
                  border: `1px solid ${selectedAssets.includes(asset) ? "var(--accent-green)" : "var(--glass-border)"}`,
                }}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Trading Style
          </label>
          <div className="flex gap-2">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setTradingStyle(style)}
                className="px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-bold font-body cursor-pointer capitalize transition-all"
                style={{
                  background: tradingStyle === style
                    ? "var(--accent-blue)"
                    : "var(--glass-bg)",
                  color: tradingStyle === style
                    ? "#fff"
                    : "var(--text-secondary)",
                  border: `1px solid ${tradingStyle === style ? "var(--accent-blue)" : "var(--glass-border)"}`,
                }}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Years of Experience
          </label>
          <input
            type="number"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            min={0}
            max={50}
            className="w-32 px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <GlassButton variant="primary" disabled={loading} onClick={() => {}}>
            {loading ? "Applying..." : "Become an Analyst"}
          </GlassButton>
          <GlassButton variant="ghost" onClick={onCancel}>
            Cancel
          </GlassButton>
        </div>
      </form>
    </GlassCard>
  );
}
