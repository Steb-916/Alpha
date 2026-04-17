import { AlertManager } from "@/components/settings/AlertManager";

export default function AlertsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1
        className="text-xl font-bold font-display mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        Alerts
      </h1>
      <p
        className="text-xs font-body mb-6"
        style={{ color: "var(--text-muted)" }}
      >
        Alerts are stored now but triggers fire starting in Phase 2 when live
        data is flowing.
      </p>
      <AlertManager />
    </div>
  );
}
