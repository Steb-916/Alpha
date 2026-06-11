"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { SUPPORTED_ASSETS } from "@/config/assets";
import { Trash2, Plus, Pencil, Check, X } from "lucide-react";

interface Watchlist {
  id: string;
  name: string;
  assets: string[];
  sortOrder: number;
}

const inputStyle = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function WatchlistManager() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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

  async function saveName(id: string) {
    if (!editingName.trim()) return;
    const res = await fetch(`/api/watchlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      await load();
    }
  }

  function startEdit(list: Watchlist) {
    setEditingId(list.id);
    setEditingName(list.name);
  }

  return (
    <div className="space-y-4">
      {/* Create new */}
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
              onKeyDown={(e) => e.key === "Enter" && createList()}
              placeholder="e.g. High Beta, Layer 2s"
              className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none"
              style={inputStyle}
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
        <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : lists.length === 0 ? (
        <GlassCard>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No watchlists yet.</p>
        </GlassCard>
      ) : (
        lists.map((list) => (
          <GlassCard key={list.id}>
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              {editingId === list.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(list.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 text-sm font-body rounded-[var(--radius-sm)] outline-none"
                    style={inputStyle}
                  />
                  <button
                    onClick={() => saveName(list.id)}
                    className="p-1 rounded-[var(--radius-sm)] cursor-pointer"
                    style={{ color: "var(--accent-green)" }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded-[var(--radius-sm)] cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
                    {list.name}
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "var(--glass-bg)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {list.assets.length} assets
                  </span>
                </div>
              )}
              {editingId !== list.id && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(list)}
                    className="p-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                    title="Rename"
                  >
                    <Pencil size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => deleteList(list.id)}
                    className="p-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                    title="Delete"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </div>

            {/* Asset pills */}
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_ASSETS.map((asset) => {
                const active = list.assets.includes(asset.symbol);
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => toggleAsset(list, asset.symbol)}
                    className="px-2 py-1 text-[11px] font-mono rounded-[var(--radius-pill)] cursor-pointer transition-all"
                    style={{
                      background: active ? "rgba(0, 212, 170, 0.1)" : "var(--glass-bg)",
                      border: `1px solid ${active ? "var(--accent-green)" : "var(--glass-border)"}`,
                      color: active ? "var(--accent-green)" : "var(--text-secondary)",
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
