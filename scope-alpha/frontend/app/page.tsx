import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div
          className="text-lg font-bold font-display tracking-wide"
          style={{ color: "var(--text-primary)" }}
        >
          SCOPE ALPHA
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-body rounded-[var(--radius-sm)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Log in
          </Link>
          <Link href="/signup">
            <GlassButton variant="primary" size="sm">
              Sign up
            </GlassButton>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-3xl">
          <h1
            className="text-4xl md:text-5xl font-bold font-display mb-6 leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Institutional-Grade Crypto Analytics
          </h1>
          <p
            className="text-lg md:text-xl font-body mb-10 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Derivatives data, options analytics, on-chain intelligence, and
            quantitative tools — in one platform.
          </p>

          <div className="flex items-center justify-center gap-3 mb-16">
            <Link href="/signup">
              <GlassButton variant="primary" size="lg">
                Get started
              </GlassButton>
            </Link>
            <Link href="/login">
              <GlassButton variant="ghost" size="lg">
                Log in
              </GlassButton>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full mt-8">
          {FEATURES.map((feature) => (
            <GlassCard key={feature.title} className="text-left">
              <div
                className="text-xs font-bold font-body uppercase tracking-wider mb-2"
                style={{ color: "var(--accent-green)" }}
              >
                {feature.badge}
              </div>
              <div
                className="text-base font-bold font-display mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {feature.title}
              </div>
              <div
                className="text-sm font-body leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {feature.description}
              </div>
            </GlassCard>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 flex items-center justify-center gap-6">
        <Link
          href="/terms"
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Terms
        </Link>
        <Link
          href="/privacy"
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Privacy
        </Link>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    badge: "Live",
    title: "Derivatives terminal",
    description:
      "Real-time funding rates, open interest, liquidations, basis analysis, and a multi-asset screener across major exchanges.",
  },
  {
    badge: "Coming soon",
    title: "Volatility & options analytics",
    description:
      "Implied volatility surface, risk-neutral density, skew analysis, volatility cone, volatility risk premium, and Greeks exposure maps.",
  },
  {
    badge: "Coming soon",
    title: "On-chain intelligence",
    description:
      "Exchange flows, MVRV, SOPR, NVT, whale tracking, stablecoin flows, and supply dynamics across major chains.",
  },
  {
    badge: "Coming soon",
    title: "Quantitative tools",
    description:
      "Cross-exchange arbitrage scanner, custom multi-factor screener, and visual strategy backtesting.",
  },
];
