"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SUPPORTED_ASSETS } from "@/config/assets";
import { Trash2, Plus } from "lucide-react";

interface Alert {
  id: string;
  name: string;
  asset: string;
  type: string;
  condition: string;
  value: number;
  timeframe: string | null;
  isActive: boolean;
  lastTriggered: string | null;
  triggerCount: number;
  deliveryMethod: string;
}

const ALERT_TYPES = [
  { value: "price", label: "Price" },
  { value: "funding_rate", label: "Funding Rate" },
  { value: "oi_change", label: "OI Change" },
  { value: "liquidation", label: "Liquidation" },
  { value: "basis", label: "Basis" },
];

const CONDITIONS = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
  { value: "crosses_above", label: "Crosses Above" },
  { value: "crosses_below", label: "Crosses Below" },
  { value: "change_exceeds", label: "Change Exceeds" },
];

export function AlertManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [asset, setAsset] = useState("BTC");
  const [type, setType] = useState("price");
  const [condition, setCondition] = useState("above");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createAlert() {
    if (!name.trim() || !value) return;
    setSaving(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          asset,
          type,
          condition,
          value: parseFloat(value),
        }),
      });
      if (res.ok) {
        setName("");
        setValue("");
        setShowNew(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(alert: Alert) {
    const res = await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !alert.isActive }),
    });
    if (res.ok) await load();
  }

  async function deleteAlert(id: string) {
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      {!showNew && (
        <GlassButton
          variant="primary"
          size="md"
          onClick={() => setShowNew(true)}
        >
          <Plus size={14} className="mr-1 inline" /> New alert
        </GlassButton>
      )}

      {showNew && (
        <GlassCard>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label
                className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BTC funding spike"
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Asset
              </label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {SUPPORTED_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Metric
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Value
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <GlassButton
              variant="primary"
              size="md"
              disabled={saving || !name.trim() || !value}
              onClick={createAlert}
            >
              {saving ? "Saving…" : "Create alert"}
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="md"
              onClick={() => setShowNew(false)}
            >
              Cancel
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      ) : alerts.length === 0 ? (
        <GlassCard>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No alerts configured.
          </p>
        </GlassCard>
      ) : (
        alerts.map((alert) => (
          <GlassCard key={alert.id}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div
                  className="text-sm font-bold font-display"
                  style={{ color: "var(--text-primary)" }}
                >
                  {alert.name}
                </div>
                <div
                  className="text-xs font-mono mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {alert.asset} • {alert.type} • {alert.condition} {alert.value}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(alert)}
                  className="px-2 py-1 text-[10px] font-bold font-body uppercase tracking-wider rounded-[var(--radius-pill)] cursor-pointer"
                  style={{
                    background: alert.isActive
                      ? "rgba(0, 212, 170, 0.1)"
                      : "var(--glass-bg)",
                    color: alert.isActive
                      ? "var(--accent-green)"
                      : "var(--text-muted)",
                    border: `1px solid ${alert.isActive ? "var(--accent-green)" : "var(--glass-border)"}`,
                  }}
                >
                  {alert.isActive ? "Active" : "Paused"}
                </button>
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="p-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
