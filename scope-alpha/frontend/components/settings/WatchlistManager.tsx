"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SUPPORTED_ASSETS } from "@/config/assets";
import { Trash2, Plus } from "lucide-react";

interface Watchlist {
  id: string;
  name: string;
  assets: string[];
  sortOrder: number;
}

export function WatchlistManager() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlists");
      if (res.ok) {
        const data = await res.json();
        setLists(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createList() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), assets: [] }),
      });
      if (res.ok) {
        setNewName("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteList(id: string) {
    const res = await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function toggleAsset(list: Watchlist, symbol: string) {
    const hasIt = list.assets.includes(symbol);
    const next = hasIt
      ? list.assets.filter((a) => a !== symbol)
      : [...list.assets, symbol];
    const res = await fetch(`/api/watchlists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: next }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label
              className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              New Watchlist
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. High Beta"
              className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <GlassButton
            variant="primary"
            size="md"
            disabled={saving || !newName.trim()}
            onClick={createList}
          >
            <Plus size={14} className="mr-1 inline" /> Create
          </GlassButton>
        </div>
      </GlassCard>

      {loading ? (
        <p
          className="text-sm font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Loading…
        </p>
      ) : lists.length === 0 ? (
        <GlassCard>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            You don&apos;t have any watchlists yet.
          </p>
        </GlassCard>
      ) : (
        lists.map((list) => (
          <GlassCard key={list.id}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-sm font-bold font-display"
                style={{ color: "var(--text-primary)" }}
              >
                {list.name}
              </div>
              <button
                onClick={() => deleteList(list.id)}
                className="p-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_ASSETS.map((asset) => {
                const active = list.assets.includes(asset.symbol);
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => toggleAsset(list, asset.symbol)}
                    className="px-2 py-1 text-[11px] font-mono rounded-[var(--radius-pill)] cursor-pointer"
                    style={{
                      background: active
                        ? "rgba(0, 212, 170, 0.1)"
                        : "var(--glass-bg)",
                      border: `1px solid ${active ? "var(--accent-green)" : "var(--glass-border)"}`,
                      color: active
                        ? "var(--accent-green)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {asset.symbol}
                  </button>
                );
              })}
            </div>
          </GlassCard>
        ))
      )}
    </div>
  );
}
