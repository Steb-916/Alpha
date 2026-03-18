import { GlassCard } from "@/components/ui/GlassCard";

export const metadata = {
  title: "Disclaimer — Scope Alpha",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <GlassCard>
          <h1
            className="text-2xl font-bold font-display mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            Risk Disclaimer
          </h1>
          <div className="space-y-4 text-sm font-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <div
              className="p-4 rounded-[var(--radius-md)] mb-4"
              style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
            >
              <p className="font-bold" style={{ color: "var(--accent-red)" }}>
                Trading cryptocurrencies and derivatives carries substantial risk of loss and is not suitable for every investor.
              </p>
            </div>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>Not Financial Advice</h2>
            <p>Content on Scope Alpha, including signals, annotations, and commentary from analysts, is for informational purposes only. Nothing constitutes financial, investment, or trading advice.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>Past Performance</h2>
            <p>Past performance is not indicative of future results. Track records displayed are historical and auto-calculated from verified signal data.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>Your Responsibility</h2>
            <p>You are solely responsible for your trading decisions. Always conduct your own research and consider your financial situation before trading.</p>

            <h2 className="text-lg font-bold font-display mt-6" style={{ color: "var(--text-primary)" }}>Platform Liability</h2>
            <p>Scope Alpha is a marketplace connecting analysts and subscribers. We do not endorse, guarantee, or verify the quality of any analyst&apos;s trading approach.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
