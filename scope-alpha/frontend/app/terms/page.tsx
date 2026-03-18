import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = {
  title: "Terms of Service — Scope Alpha",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <GlassCard>
          <h1
            className="text-2xl font-bold font-display mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Terms of Service
          </h1>
          <div className="space-y-4 text-sm font-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p><strong style={{ color: "var(--text-primary)" }}>Last updated:</strong> March 2026</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>1. Acceptance of Terms</h2>
            <p>By accessing Scope Alpha, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>2. Platform Description</h2>
            <p>Scope Alpha is a marketplace for trading intelligence. Analysts publish signals and annotations; subscribers pay for access. The platform does not provide financial advice.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>3. User Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>4. Analyst Obligations</h2>
            <p>Analysts must not manipulate their track records. All signals are immutable once published. Misleading performance claims may result in account suspension.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>5. Subscription & Payments</h2>
            <p>Subscriptions are billed monthly. Cancellations take effect at the end of the billing period. The platform retains an 18% fee on all transactions.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>6. Limitation of Liability</h2>
            <p>Scope Alpha is not responsible for trading losses. All trading signals are opinions, not financial advice. Users trade at their own risk.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>7. Contact</h2>
            <p>For questions, contact legal@scopealpha.com</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
