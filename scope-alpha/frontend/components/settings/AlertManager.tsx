"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SUPPORTED_ASSETS } from "@/config/assets";
import { Trash2, Plus, Bell, BellOff, Send, Mail } from "lucide-react";

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
  notifyEmail: boolean;
  notifyTelegram: boolean;
}

const ALERT_TYPES = [
  { value: "price", label: "Price" },
  { value: "funding_rate", label: "Funding Rate" },
  { value: "oi_change", label: "OI Change %" },
  { value: "liquidation", label: "Liquidation Volume" },
  { value: "basis", label: "Basis" },
  { value: "health_score", label: "Health Score" },
  { value: "cvd_divergence", label: "CVD Divergence" },
  { value: "arb_yield", label: "Arb Yield" },
  { value: "iv_above", label: "IV Above" },
  { value: "iv_below", label: "IV Below" },
  { value: "skew_extreme", label: "Skew Extreme" },
  { value: "vrp_extreme", label: "VRP Extreme" },
];

const CONDITIONS = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
  { value: "crosses_above", label: "Crosses Above" },
  { value: "crosses_below", label: "Crosses Below" },
  { value: "change_exceeds", label: "Change Exceeds %" },
];

const inputStyle = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

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
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [saving, setSaving] = useState(false);

  // Telegram link state
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [alertsRes, prefsRes] = await Promise.all([
        fetch("/api/alerts"),
        fetch("/api/users/preferences"),
      ]);
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.items ?? []);
      }
      if (prefsRes.ok) {
        const prefs = await prefsRes.json();
        setTelegramChatId(prefs.telegramChatId ?? null);
        setTelegramLinked(!!prefs.telegramChatId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const s = await res.json();
      setUserId(s?.user?.id ?? null);
    }
  }

  useEffect(() => {
    load();
    loadSession();
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
          notifyEmail,
          notifyTelegram,
        }),
      });
      if (res.ok) {
        setName("");
        setValue("");
        setNotifyEmail(false);
        setNotifyTelegram(false);
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

  async function unlinkTelegram() {
    setUnlinkingTelegram(true);
    try {
      await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: null }),
      });
      setTelegramLinked(false);
      setTelegramChatId(null);
    } finally {
      setUnlinkingTelegram(false);
    }
  }

  const telegramBotName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? "ScopeAlphaBot";
  const telegramLink = userId
    ? `https://t.me/${telegramBotName}?start=tg_${userId}`
    : null;

  return (
    <div className="space-y-6">
      {/* Telegram connection card */}
      <GlassCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,136,204,0.12)", border: "1px solid rgba(0,136,204,0.2)" }}
            >
              <Send size={16} style={{ color: "#0088cc" }} />
            </div>
            <div>
              <div className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
                Telegram Alerts
              </div>
              <div className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>
                {telegramLinked
                  ? `Connected · Chat ID: ${telegramChatId}`
                  : "Get instant alerts via Telegram"}
              </div>
            </div>
          </div>
          {telegramLinked ? (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={unlinkTelegram}
              disabled={unlinkingTelegram}
            >
              {unlinkingTelegram ? "Unlinking…" : "Unlink"}
            </GlassButton>
          ) : (
            telegramLink && (
              <a href={telegramLink} target="_blank" rel="noopener noreferrer">
                <GlassButton variant="primary" size="sm">
                  Connect
                </GlassButton>
              </a>
            )
          )}
        </div>
        {!telegramLinked && (
          <p className="text-xs font-body mt-3" style={{ color: "var(--text-muted)" }}>
            Click Connect, open the Telegram bot, and send <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: "var(--glass-bg)", color: "var(--text-secondary)" }}>/start</code> to link your account.
          </p>
        )}
      </GlassCard>

      {/* Alert list header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-secondary)" }}>
          Alert Rules
        </h2>
        {!showNew && (
          <GlassButton variant="primary" size="sm" onClick={() => setShowNew(true)}>
            <Plus size={13} className="mr-1 inline" /> New alert
          </GlassButton>
        )}
      </div>

      {/* New alert form */}
      {showNew && (
        <GlassCard>
          <div className="text-xs font-bold font-body uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
            New Alert
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BTC funding spike"
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Asset
              </label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              >
                {SUPPORTED_ASSETS.map((a) => (
                  <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Metric
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Value
              </label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Delivery options */}
          <div className="mt-4">
            <label className="block text-xs font-bold font-body mb-2 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Notify via
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setNotifyEmail((v) => !v)}
                  className="w-4 h-4 rounded-[3px] flex items-center justify-center cursor-pointer border"
                  style={{
                    background: notifyEmail ? "var(--accent-green)" : "transparent",
                    borderColor: notifyEmail ? "var(--accent-green)" : "var(--glass-border)",
                  }}
                >
                  {notifyEmail && <span style={{ color: "#000", fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <Mail size={13} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setNotifyTelegram((v) => !v)}
                  className="w-4 h-4 rounded-[3px] flex items-center justify-center cursor-pointer border"
                  style={{
                    background: notifyTelegram ? "#0088cc" : "transparent",
                    borderColor: notifyTelegram ? "#0088cc" : "var(--glass-border)",
                    opacity: telegramLinked ? 1 : 0.4,
                  }}
                >
                  {notifyTelegram && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <Send size={13} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs font-body" style={{ color: telegramLinked ? "var(--text-secondary)" : "var(--text-muted)" }}>
                  Telegram{!telegramLinked && " (not connected)"}
                </span>
              </label>
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
            <GlassButton variant="ghost" size="md" onClick={() => setShowNew(false)}>
              Cancel
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Alert list */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : alerts.length === 0 ? (
        <GlassCard>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No alerts configured.</p>
        </GlassCard>
      ) : (
        alerts.map((alert) => (
          <GlassCard key={alert.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
                  {alert.name}
                </div>
                <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {alert.asset} · {alert.type.replace(/_/g, " ")} · {alert.condition.replace(/_/g, " ")} {alert.value}
                </div>
                {(alert.notifyEmail || alert.notifyTelegram) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {alert.notifyEmail && (
                      <span className="flex items-center gap-1 text-[10px] font-body px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,212,170,0.08)", color: "var(--accent-green)", border: "1px solid rgba(0,212,170,0.15)" }}>
                        <Mail size={9} /> Email
                      </span>
                    )}
                    {alert.notifyTelegram && (
                      <span className="flex items-center gap-1 text-[10px] font-body px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,136,204,0.08)", color: "#0088cc", border: "1px solid rgba(0,136,204,0.15)" }}>
                        <Send size={9} /> Telegram
                      </span>
                    )}
                  </div>
                )}
                {alert.lastTriggered && (
                  <div className="text-[10px] font-body mt-1" style={{ color: "var(--text-muted)" }}>
                    Last fired: {new Date(alert.lastTriggered).toLocaleString()} · {alert.triggerCount}×
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(alert)}
                  className="px-2 py-1 text-[10px] font-bold font-body uppercase tracking-wider rounded-[var(--radius-pill)] cursor-pointer flex items-center gap-1"
                  style={{
                    background: alert.isActive ? "rgba(0,212,170,0.1)" : "var(--glass-bg)",
                    color: alert.isActive ? "var(--accent-green)" : "var(--text-muted)",
                    border: `1px solid ${alert.isActive ? "var(--accent-green)" : "var(--glass-border)"}`,
                  }}
                >
                  {alert.isActive ? <Bell size={10} /> : <BellOff size={10} />}
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
