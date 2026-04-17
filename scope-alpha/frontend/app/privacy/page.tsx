import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = {
  title: "Privacy Policy — Scope Alpha",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <div
            className="space-y-4 text-sm font-body leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Last updated:</strong> April 2026
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              1. Information We Collect
            </h2>
            <p>
              We collect account information (email, display name), authentication data (via Google OAuth or
              email/password), and usage data (pages visited, features used, saved watchlists and alerts).
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              2. How We Use Information
            </h2>
            <p>
              We use your information to provide the analytics platform, personalize your dashboard, deliver
              alerts, and improve our services.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              3. Data Sharing
            </h2>
            <p>
              We do not sell your data. We share data only with infrastructure providers required to operate
              the service (hosting, database, email delivery) and as required by law.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              4. Data Security
            </h2>
            <p>
              We implement industry-standard security measures including encryption in transit and at rest and
              per-device session tracking with revocation.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              5. Your Rights
            </h2>
            <p>
              You may request data export or deletion by contacting privacy@scopealpha.com.
            </p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>
              6. Cookies
            </h2>
            <p>
              We use essential cookies for authentication. Any analytics cookies require your explicit consent.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
