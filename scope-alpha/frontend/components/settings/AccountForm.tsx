"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

interface UserMe {
  id: string;
  email: string;
  displayName: string | null;
  slug: string | null;
  bio: string | null;
  provider: string;
  tosAcceptedAt: string | null;
  createdAt: string;
}

export function AccountForm() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((u) => {
        setUser(u);
        setDisplayName(u.displayName ?? "");
        setBio(u.bio ?? "");
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setUser(updated);
      setMessage("Saved");
    } catch (err) {
      setMessage((err as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <GlassCard>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Email
          </label>
          <div
            className="px-3 py-2 text-sm font-body rounded-[var(--radius-sm)]"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-muted)",
            }}
          >
            {user.email}
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm font-body rounded-[var(--radius-sm)] outline-none resize-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="primary"
            size="md"
            disabled={saving}
            onClick={() => {}}
          >
            {saving ? "Saving…" : "Save changes"}
          </GlassButton>
          {message && (
            <span
              className="text-xs font-body"
              style={{ color: "var(--text-muted)" }}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </GlassCard>
  );
}
