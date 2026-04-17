"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function CTASection() {
  return (
    <section className="px-6 py-16 max-w-4xl mx-auto">
      <GlassCard className="text-center">
        <h2
          className="text-2xl md:text-3xl font-bold font-display mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Ready to see the data?
        </h2>
        <p
          className="text-sm md:text-base font-body mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          Explore the terminal as a guest — no account required. Sign up later
          to save watchlists, configure alerts, and sync your preferences.
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
      </GlassCard>
    </section>
  );
}
