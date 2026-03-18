"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Badge } from "@/components/ui/Badge";
import { BecomeAnalystForm } from "@/components/auth/BecomeAnalystForm";
import { MeshBackground } from "@/components/layout/MeshBackground";

interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  slug: string | null;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: Record<string, string>;
  createdAt: string;
  analystProfile: {
    tagline: string | null;
    primaryAssets: string[];
    tradingStyle: string | null;
    experienceYears: number | null;
  } | null;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAnalystForm, setShowAnalystForm] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [telegram, setTelegram] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/users/me");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setDisplayName(data.displayName || "");
          setBio(data.bio || "");
          const links = (data.socialLinks || {}) as Record<string, string>;
          setTwitter(links.twitter || "");
          setDiscord(links.discord || "");
          setTelegram(links.telegram || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio,
          socialLinks: { twitter, discord, telegram },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
        setMessage("Profile saved successfully");
        // Refresh session to update displayName in nav
        await update();
      } else {
        setMessage("Failed to save profile");
      }
    } catch {
      setMessage("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalystUpgrade = async () => {
    // Reload profile to show analyst fields
    const res = await fetch("/api/users/me");
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
    }
    setShowAnalystForm(false);
    await update();
  };

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MeshBackground />
        <div className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <MeshBackground />
      <div className="space-y-6 relative z-10">
        {/* Back button */}
        <button
          onClick={() => router.push("/terminal")}
          className="text-sm font-body cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          &larr; Back to Terminal
        </button>

        {/* Profile Header */}
        <GlassCard>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--accent-green), var(--accent-green-dim))",
                color: "#fff",
              }}
            >
              {(profile?.displayName || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
                {profile?.displayName || "User"}
              </h1>
              <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
                {profile?.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={profile?.role === "analyst" ? "green" : "blue"}>
                  {profile?.role || "subscriber"}
                </Badge>
                {profile?.slug && (
                  <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                    @{profile.slug}
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Edit Profile */}
        <GlassCard>
          <h2 className="text-sm font-bold font-body uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
            Edit Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none resize-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                placeholder="Tell others about yourself..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Twitter
                </label>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-body outline-none"
                  style={inputStyle}
                  placeholder="@handle"
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                />
              </div>
              <div>
                <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Discord
                </label>
                <input
                  type="text"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-body outline-none"
                  style={inputStyle}
                  placeholder="username"
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                />
              </div>
              <div>
                <label className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Telegram
                </label>
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-body outline-none"
                  style={inputStyle}
                  placeholder="@username"
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
                />
              </div>
            </div>

            {message && (
              <p className="text-sm font-body" style={{ color: message.includes("success") ? "var(--accent-green)" : "var(--accent-red)" }}>
                {message}
              </p>
            )}

            <GlassButton variant="primary" size="md" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </GlassButton>
          </div>
        </GlassCard>

        {/* Analyst Profile (if analyst) */}
        {profile?.role === "analyst" && profile.analystProfile && (
          <GlassCard glow="green">
            <h2 className="text-sm font-bold font-body uppercase tracking-wider mb-4" style={{ color: "var(--accent-green)" }}>
              Analyst Profile
            </h2>
            <div className="space-y-3">
              {profile.analystProfile.tagline && (
                <div>
                  <span className="text-xs font-body" style={{ color: "var(--text-tertiary)" }}>Tagline: </span>
                  <span className="text-sm font-body" style={{ color: "var(--text-primary)" }}>{profile.analystProfile.tagline}</span>
                </div>
              )}
              {profile.analystProfile.primaryAssets.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-body" style={{ color: "var(--text-tertiary)" }}>Assets: </span>
                  {profile.analystProfile.primaryAssets.map((a) => (
                    <Badge key={a} variant="blue">{a}</Badge>
                  ))}
                </div>
              )}
              {profile.analystProfile.tradingStyle && (
                <div>
                  <span className="text-xs font-body" style={{ color: "var(--text-tertiary)" }}>Style: </span>
                  <Badge variant="purple">{profile.analystProfile.tradingStyle}</Badge>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Become an Analyst CTA */}
        {profile?.role === "subscriber" && !showAnalystForm && (
          <GlassCard glow="green" interactive>
            <div className="text-center py-4">
              <h2 className="text-lg font-bold font-display mb-2" style={{ color: "var(--text-primary)" }}>
                Become an Analyst
              </h2>
              <p className="text-sm font-body mb-4" style={{ color: "var(--text-secondary)" }}>
                Publish signals, build a verified track record, and earn from your trading expertise.
              </p>
              <GlassButton variant="primary" onClick={() => setShowAnalystForm(true)}>
                Apply Now
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {showAnalystForm && (
          <BecomeAnalystForm onSuccess={handleAnalystUpgrade} onCancel={() => setShowAnalystForm(false)} />
        )}
      </div>
    </div>
  );
}
