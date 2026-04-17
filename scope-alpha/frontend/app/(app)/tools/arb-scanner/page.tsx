import { ArbScannerTable } from "@/components/tools/ArbScannerTable";

export const metadata = {
  title: "Arb Scanner — Scope Alpha",
};

export default function ArbScannerPage() {
  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h1
          className="text-xl font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Arbitrage Scanner
        </h1>
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Cross-exchange funding + basis
        </span>
      </div>
      <ArbScannerTable />
    </div>
  );
}
