"use client";

/**
 * Single feed event renderer. Delegates to a typed sub-renderer based on
 * the event type. Renders a glass card with avatar, copy, and a deep link
 * to the relevant content.
 */

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export interface FeedActor {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitial: string;
}

export interface FeedItemData {
  id: string;
  type: string;
  actor: FeedActor;
  analystId: string | null;
  signalId: string | null;
  metadata: Record<string, unknown>;
  visibility: string;
  isFullAccess: boolean;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ActorLine({ actor, when }: { actor: FeedActor; when: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{
          background: "rgba(0, 212, 170, 0.15)",
          color: "var(--accent-green)",
          border: "1px solid rgba(0, 212, 170, 0.3)",
        }}
      >
        {actor.avatarInitial}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/analyst/${actor.slug}`}
          className="text-xs font-bold font-display no-underline"
          style={{ color: "var(--text-primary)" }}
        >
          {actor.displayName}
        </Link>
      </div>
      <span
        className="text-[9px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        {relativeTime(when)}
      </span>
    </div>
  );
}

export function FeedItem({ item }: { item: FeedItemData }) {
  const m = item.metadata;

  switch (item.type) {
    case "signal_published": {
      const asset = String(m.asset ?? "—");
      const direction = String(m.direction ?? "long");
      const isLong = direction === "long";
      return (
        <GlassCard>
          <ActorLine actor={item.actor} when={item.createdAt} />
          <p
            className="text-xs font-body mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Published a{" "}
            <span
              style={{ color: isLong ? "#10B981" : "#EF4444" }}
              className="font-bold"
            >
              {direction.toUpperCase()}
            </span>{" "}
            signal on{" "}
            <span style={{ color: "var(--text-primary)" }}>{asset}</span>
            {item.isFullAccess && m.conviction
              ? ` (${m.conviction} conviction, ${m.timeframe})`
              : ""}
          </p>
          {item.signalId && (
            <Link
              href={`/signal/${item.signalId}`}
              className="text-[10px] font-body no-underline"
              style={{ color: "var(--accent-green)" }}
            >
              {item.isFullAccess ? "View signal →" : "Subscribe to see details →"}
            </Link>
          )}
        </GlassCard>
      );
    }

    case "signal_resolved": {
      const asset = String(m.asset ?? "—");
      const direction = String(m.direction ?? "long");
      const pnl = typeof m.resultPnl === "number" ? m.resultPnl : null;
      const isWin = pnl != null && pnl > 0;
      return (
        <GlassCard>
          <ActorLine actor={item.actor} when={item.createdAt} />
          <p
            className="text-xs font-body mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Resolved {direction.toUpperCase()} on{" "}
            <span style={{ color: "var(--text-primary)" }}>{asset}</span>
            {pnl != null && (
              <>
                {": "}
                <span
                  style={{ color: isWin ? "#10B981" : "#EF4444" }}
                  className="font-bold font-mono"
                >
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(2)}%
                </span>
              </>
            )}
          </p>
          {item.signalId && (
            <Link
              href={`/signal/${item.signalId}`}
              className="text-[10px] font-body no-underline"
              style={{ color: "var(--accent-green)" }}
            >
              View signal →
            </Link>
          )}
        </GlassCard>
      );
    }

    case "milestone_signals":
    case "milestone_subscribers":
    case "milestone_winstreak": {
      const count = typeof m.count === "number" ? m.count : "?";
      const label =
        item.type === "milestone_signals"
          ? `hit ${count} total signals`
          : item.type === "milestone_subscribers"
            ? `reached ${count} subscribers`
            : `is on a ${count}-signal win streak`;
      return (
        <GlassCard glow="green">
          <ActorLine actor={item.actor} when={item.createdAt} />
          <p
            className="text-xs font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            🎉{" "}
            <span style={{ color: "var(--text-primary)" }}>
              {item.actor.displayName}
            </span>{" "}
            <span style={{ color: "var(--accent-green)" }} className="font-bold">
              {label}
            </span>
          </p>
        </GlassCard>
      );
    }

    case "announcement": {
      const title = String(m.title ?? "Announcement");
      return (
        <GlassCard>
          <ActorLine actor={item.actor} when={item.createdAt} />
          <p
            className="text-xs font-body mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            📢 Posted an announcement
          </p>
          <p
            className="text-xs font-bold font-body"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </p>
          {item.isFullAccess && m.preview && (
            <p
              className="text-[10px] font-body mt-1 line-clamp-2"
              style={{ color: "var(--text-muted)" }}
            >
              {String(m.preview)}
            </p>
          )}
          <Link
            href={`/analyst/${item.actor.slug}`}
            className="inline-block mt-2 text-[10px] font-body no-underline"
            style={{ color: "var(--accent-green)" }}
          >
            {item.isFullAccess ? "Read more →" : "Subscribe to read →"}
          </Link>
        </GlassCard>
      );
    }

    case "new_analyst": {
      const tagline = m.tagline ? String(m.tagline) : null;
      return (
        <GlassCard>
          <ActorLine actor={item.actor} when={item.createdAt} />
          <p
            className="text-xs font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            ✨ Joined Scope Alpha as an analyst
          </p>
          {tagline && (
            <p
              className="text-[10px] font-body italic mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              &ldquo;{tagline}&rdquo;
            </p>
          )}
          <Link
            href={`/analyst/${item.actor.slug}`}
            className="inline-block mt-2 text-[10px] font-body no-underline"
            style={{ color: "var(--accent-green)" }}
          >
            View profile →
          </Link>
        </GlassCard>
      );
    }

    default:
      return null;
  }
}
