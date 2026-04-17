"use client";

import Link from "next/link";
import { AnimatedBackground } from "./AnimatedBackground";
import { GlassButton } from "@/components/ui/GlassButton";

export function AnimatedHero() {
  return (
    <section className="relative min-h-[88vh] flex items-center justify-center overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6 py-16">
        <div
          className="inline-block mb-6 px-3 py-1 rounded-[var(--radius-pill)] text-[11px] font-mono uppercase tracking-widest"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--accent-green)",
          }}
        >
          Live · Derivatives + Volatility · BTC ETH + 8 more
        </div>
        <h1
          className="text-4xl md:text-6xl font-bold font-display mb-6 leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Institutional-Grade
          <br />
          Crypto Analytics
        </h1>
        <p
          className="text-lg md:text-xl font-body mb-10 leading-relaxed max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Derivatives data, options analytics, on-chain intelligence, and
          quantitative tools — in one platform.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/terminal/derivatives">
            <GlassButton variant="primary" size="lg">
              Explore terminal →
            </GlassButton>
          </Link>
          <Link href="/signup">
            <GlassButton variant="ghost" size="lg">
              Create free account
            </GlassButton>
          </Link>
        </div>

        <p
          className="mt-5 text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          No credit card. No signup required to explore.
        </p>
      </div>
    </section>
  );
}
