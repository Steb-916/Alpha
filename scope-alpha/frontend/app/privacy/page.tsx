import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = {
  title: "Privacy Policy — Scope Alpha",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <GlassCard>
          <h1
            className="text-2xl font-bold font-display mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Privacy Policy
          </h1>
          <div className="space-y-4 text-sm font-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p><strong style={{ color: "var(--text-primary)" }}>Last updated:</strong> March 2026</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>1. Information We Collect</h2>
            <p>We collect account information (email, name), usage data (pages visited, features used), and payment information (processed by Stripe).</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>2. How We Use Information</h2>
            <p>We use your information to provide the platform, process payments, improve our services, and communicate updates.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>3. Data Sharing</h2>
            <p>We do not sell your data. We share data only with payment processors (Stripe) and as required by law.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>4. Data Security</h2>
            <p>We implement industry-standard security measures including encryption in transit and at rest.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>5. Your Rights</h2>
            <p>You may request data export or deletion by contacting privacy@scopealpha.com.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>6. Cookies</h2>
            <p>We use essential cookies for authentication and optional analytics cookies with your consent.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
