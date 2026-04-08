/**
 * Phase 7: Terms of Service page.
 *
 * Server component that reads the markdown source at request time so the
 * legal team can update content via git without rebuilding TSX.
 */

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { MarkdownRenderer } from "@/components/legal/MarkdownRenderer";

export const dynamic = "force-static";

function loadTerms(): string {
  try {
    const filePath = path.join(process.cwd(), "content", "legal", "terms.md");
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "# Terms of Service\n\nContent unavailable. Please try again later.";
  }
}

export const metadata = {
  title: "Terms of Service · Scope Alpha",
  description: "The terms governing your use of Scope Alpha.",
};

export default function TermsPage() {
  const content = loadTerms();
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
          /legal/terms
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
