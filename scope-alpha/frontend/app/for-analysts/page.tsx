"use client";

import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Badge } from "@/components/ui/Badge";

const BENEFITS = [
  {
    icon: "📊",
    title: "Verified Track Record",
    description: "Every signal you publish is timestamped and auto-graded against market outcomes. No more screenshots — your performance speaks for itself.",
  },
  {
    icon: "🎯",
    title: "Draw Directly on Charts",
    description: "Your annotations, zones, and trend lines appear on your subscribers' actual trading charts. No more cropped screenshots in Discord.",
  },
  {
    icon: "💰",
    title: "Professional Monetization",
    description: "Set your own subscription tiers ($50–$2,000/mo). Stripe handles payments. You keep 82% — we handle billing, disputes, and infrastructure.",
  },
  {
    icon: "📈",
    title: "Discovery & Growth",
    description: "Our marketplace puts your verified performance in front of subscribers actively looking for analysts. Your track record is your marketing.",
  },
  {
    icon: "💬",
    title: "Built-in Community",
    description: "Chat rooms, announcements, and real-time interaction — all within the trading terminal. No more managing a separate Discord server.",
  },
  {
    icon: "🔒",
    title: "Signal Immutability",
    description: "Published signals cannot be edited or deleted. This builds trust with subscribers and differentiates you from signal providers who delete losing calls.",
  },
];

const MIGRATION_STEPS = [
  { step: "1", title: "Create your analyst account", description: "Sign up and complete your profile with bio, assets, and trading style." },
  { step: "2", title: "Set up subscription tiers", description: "Create up to 3 tiers with different prices and feature access." },
  { step: "3", title: "Publish your first signals", description: "Start building your verified track record with timestamped signals." },
  { step: "4", title: "Invite your community", description: "Share your Scope Alpha profile link with your existing Discord/Telegram followers." },
];

export default function ForAnalystsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Nav */}
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <a href="/" className="text-sm font-display font-bold" style={{ color: "var(--text-primary)" }}>
          Scope Alpha
        </a>
        <GlassButton variant="primary" size="sm" onClick={() => router.push("/signup")}>
          Get Started
        </GlassButton>
      </div>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <Badge variant="green">For Signal Providers & Analysts</Badge>
        <h1
          className="text-4xl md:text-5xl font-bold font-display mt-4 leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Your Discord makes you money.
          <br />
          <span style={{ color: "var(--accent-green)" }}>Scope Alpha makes you credible.</span>
        </h1>
        <p
          className="text-lg font-body mt-4 max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Migrate your paid community to a professional trading workspace. Every signal verified, every call auto-graded, every subscriber managed — on one platform.
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <GlassButton variant="primary" size="lg" onClick={() => router.push("/signup")}>
            Start Free → Build Your Track Record
          </GlassButton>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2
          className="text-2xl font-bold font-display text-center mb-8"
          style={{ color: "var(--text-primary)" }}
        >
          Why Analysts Choose Scope Alpha
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b) => (
            <GlassCard key={b.title}>
              <div className="text-2xl mb-2">{b.icon}</div>
              <h3 className="text-sm font-bold font-display mb-1" style={{ color: "var(--text-primary)" }}>
                {b.title}
              </h3>
              <p className="text-xs font-body leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {b.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Migration Steps */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2
          className="text-2xl font-bold font-display text-center mb-8"
          style={{ color: "var(--text-primary)" }}
        >
          Migrate in 4 Steps
        </h2>
        <div className="space-y-4">
          {MIGRATION_STEPS.map((s) => (
            <div
              key={s.step}
              className="flex gap-4 p-4 rounded-[var(--radius-md)]"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  background: "rgba(0, 212, 170, 0.15)",
                  color: "var(--accent-green)",
                  border: "1px solid rgba(0, 212, 170, 0.3)",
                }}
              >
                {s.step}
              </div>
              <div>
                <h3 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
                  {s.title}
                </h3>
                <p className="text-xs font-body mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <GlassCard glow="green">
          <h2 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
            Ready to build your verified track record?
          </h2>
          <p className="text-sm font-body mt-2" style={{ color: "var(--text-muted)" }}>
            Free to start. Publish signals. Build credibility. Get paid.
          </p>
          <GlassButton variant="primary" size="lg" className="mt-4" onClick={() => router.push("/signup")}>
            Create Analyst Account
          </GlassButton>
        </GlassCard>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex flex-wrap gap-6 justify-center text-xs font-body" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--glass-border)" }}>
        <a href="/terms" className="hover:underline">Terms of Service</a>
        <a href="/privacy" className="hover:underline">Privacy Policy</a>
        <a href="/disclaimer" className="hover:underline">Risk Disclaimer</a>
        <a href="/marketplace" className="hover:underline">Marketplace</a>
      </footer>
    </div>
  );
}
