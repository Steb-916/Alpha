import type { Metadata } from "next";
import Link from "next/link";
import { GlassButton } from "@/components/ui/GlassButton";
import { AnimatedHero } from "@/components/landing/AnimatedHero";
import { FeatureCards } from "@/components/landing/FeatureCards";
import { Differentiators } from "@/components/landing/Differentiators";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Scope Alpha — Institutional-Grade Crypto Analytics",
  description:
    "Derivatives data, options analytics, on-chain intelligence, and quantitative tools in one platform.",
  openGraph: {
    title: "Scope Alpha — Crypto Analytics Terminal",
    description:
      "Real-time derivatives data, volatility analytics, and quantitative tools for crypto traders.",
    siteName: "Scope Alpha",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Scope Alpha crypto analytics terminal",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scope Alpha — Crypto Analytics Terminal",
    description:
      "Real-time derivatives data, volatility analytics, and quantitative tools for crypto traders.",
    images: ["/og-image.png"],
  },
};

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between relative z-20">
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

      <main className="flex-1">
        <AnimatedHero />
        <FeatureCards />
        <Differentiators />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
