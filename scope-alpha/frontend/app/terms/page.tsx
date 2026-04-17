import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = {
  title: "Terms of Service — Scope Alpha",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-block mb-6 text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to home
        </Link>
        <GlassCard>
          <h1
            className="text-2xl font-bold font-display mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Terms of Service
          </h1>
          <div
            className="space-y-4 text-sm font-body leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Last updated:</strong> April 2026
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing Scope Alpha, you agree to these Terms of Service. If you do not agree, do not use
              the platform.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              2. Platform Description
            </h2>
            <p>
              Scope Alpha is a crypto analytics and quantitative intelligence platform. It provides derivatives
              data, options analytics, on-chain metrics, and quantitative tools. The platform does not provide
              financial advice.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              3. User Accounts
            </h2>
            <p>
              You must provide accurate information when creating an account. You are responsible for
              maintaining the security of your account credentials.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              4. Data Usage
            </h2>
            <p>
              Data displayed on Scope Alpha is aggregated from third-party exchanges and on-chain sources. The
              platform does not guarantee accuracy, completeness, or timeliness. Consult primary sources before
              making trading decisions.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              5. No Financial Advice
            </h2>
            <p>
              Scope Alpha provides data, tools, and computation. Nothing on the platform constitutes financial,
              investment, tax, or legal advice. You are solely responsible for your trading decisions.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              6. Limitation of Liability
            </h2>
            <p>
              Scope Alpha is not responsible for trading losses, missed opportunities, or decisions made using
              information from the platform. Users trade at their own risk.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              7. Contact
            </h2>
            <p>For questions, contact legal@scopealpha.com.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
