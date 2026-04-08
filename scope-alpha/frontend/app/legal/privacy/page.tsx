/**
 * Phase 7: Privacy Policy page. See terms/page.tsx for the rendering pattern.
 */

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { MarkdownRenderer } from "@/components/legal/MarkdownRenderer";

export const dynamic = "force-static";

function loadPrivacy(): string {
  try {
    const filePath = path.join(process.cwd(), "content", "legal", "privacy.md");
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "# Privacy Policy\n\nContent unavailable. Please try again later.";
  }
}

export const metadata = {
  title: "Privacy Policy · Scope Alpha",
  description: "How Scope Alpha collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  const content = loadPrivacy();
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
          href="/"
          className="text-sm font-body cursor-pointer no-underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Home
        </Link>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          /legal/privacy
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <GlassCard>
          <MarkdownRenderer content={content} />
        </GlassCard>
      </div>
    </div>
  );
}
