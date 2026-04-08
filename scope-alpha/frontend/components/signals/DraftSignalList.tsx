"use client";

/**
 * Draft signals panel for analysts.
 *
 * Lists the current analyst's draft signals (status='draft'), each with
 * Edit / Publish / Delete actions. Renders nothing if there are no drafts.
 */

import { useSession } from "next-auth/react";
import useSWR from "swr";
import type { Signal } from "@/lib/signals";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  onEdit?: (signal: Signal) => void;
}

export function DraftSignalList({ onEdit }: Props) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data, mutate, error } = useSWR<Signal[]>(
    userId ? `/api/signals?analystId=${userId}&status=draft&limit=20` : null,
    fetcher,
  );

  if (!userId || error) return null;
  if (!data || data.length === 0) return null;

  const publish = async (id: string) => {
    const res = await fetch(`/api/signals/${id}/publish`, { method: "POST" });
    if (res.ok) mutate();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this draft signal? This cannot be undone.")) return;
    const res = await fetch(`/api/signals/${id}`, { method: "DELETE" });
    if (res.ok) mutate();
  };

  return (
    <GlassCard noPadding>
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <span
          className="text-[10px] font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Drafts ({data.length})
        </span>
      </div>
      <div className="p-2 space-y-2 max-h-[200px] overflow-auto">
        {data.map((sig) => (
          <div
            key={sig.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-sm)]"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: sig.direction === "long" ? "#10B981" : "#EF4444" }}
            >
              {sig.direction === "long" ? "▲" : "▼"}
            </span>
            <span
              className="text-xs font-mono font-bold flex-1"
              style={{ color: "var(--text-primary)" }}
            >
              {sig.assetSymbol}
            </span>
            <span
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              ${sig.entryPrice.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(sig)}
                  className="text-[10px] font-body cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => publish(sig.id)}
                className="text-[10px] font-body cursor-pointer"
                style={{ color: "var(--accent-green)" }}
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => remove(sig.id)}
                className="text-[10px] font-body cursor-pointer"
                style={{ color: "var(--accent-red)" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
