"use client";

/**
 * Phase 7: active session management page.
 *
 * Lists all UserSession rows for the current user. Each row shows the
 * device/browser, IP, last active time, and a Revoke button. The session
 * making the request gets a "This device" badge and is not revokable from
 * here — use the "Log out everywhere else" action to revoke siblings.
 */

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/ui/GlassCard";

interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActive: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.includes("Mobile")) return "Mobile browser";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 40);
}

export default function SessionsPage() {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR<{ sessions: SessionRow[] }>(
    session?.user?.id ? "/api/auth/sessions" : null,
    fetcher,
  );

  async function revokeOne(id: string) {
    if (!confirm("Sign this session out?")) return;
    await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
    mutate();
  }

  async function revokeOthers() {
    if (!confirm("Sign all OTHER devices out? You'll stay signed in here.")) return;
    await fetch("/api/auth/sessions", { method: "DELETE" });
    mutate();
  }

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-md mx-auto pt-12">
          <GlassCard>
            <p className="text-sm font-body text-center" style={{ color: "var(--text-muted)" }}>
              Sign in to manage your sessions.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center gap-3"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <Link
          href="/profile"
          className="text-sm font-body cursor-pointer no-underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Profile
        </Link>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          /profile/sessions
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
            Active Sessions
          </h1>
          <p className="text-sm font-body mt-1" style={{ color: "var(--text-muted)" }}>
            Devices and browsers currently signed into your account. Revoke any session you don&apos;t recognize.
          </p>
        </div>

        {error && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--accent-red)" }}>
              Failed to load sessions.
            </p>
          </GlassCard>
        )}

        {isLoading && !data && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          </GlassCard>
        )}

        {data && data.sessions.length === 0 && (
          <GlassCard>
            <p className="text-xs font-body text-center" style={{ color: "var(--text-muted)" }}>
              No active sessions found. (You may be using a legacy session.)
            </p>
          </GlassCard>
        )}

        {data && data.sessions.length > 0 && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={revokeOthers}
                className="px-3 py-2 text-xs font-bold cursor-pointer rounded-[var(--radius-sm)]"
                style={{
                  background: "transparent",
                  color: "var(--accent-red)",
                  border: "1px solid var(--accent-red)",
                }}
              >
                Log out everywhere else
              </button>
            </div>

            <div className="space-y-3">
              {data.sessions.map((s) => (
                <GlassCard key={s.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold font-display"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {shortDevice(s.userAgent)}
                        </span>
                        {s.isCurrent && (
                          <span
                            className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full"
                            style={{
                              background: "rgba(0, 212, 170, 0.15)",
                              color: "var(--accent-green)",
                              border: "1px solid rgba(0, 212, 170, 0.3)",
                            }}
                          >
                            THIS DEVICE
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[10px] font-mono mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {s.ipAddress ?? "Unknown IP"} · last active {formatRelative(s.lastActive)}
                      </p>
                      <p
                        className="text-[10px] font-mono"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Created {formatRelative(s.createdAt)} · expires{" "}
                        {new Date(s.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => revokeOne(s.id)}
                        className="px-3 py-1.5 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
                        style={{
                          background: "transparent",
                          color: "var(--accent-red)",
                          border: "1px solid var(--accent-red)",
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
