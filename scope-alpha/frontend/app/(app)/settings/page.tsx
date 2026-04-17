import { AccountForm } from "@/components/settings/AccountForm";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1
        className="text-xl font-bold font-display mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        Account Settings
      </h1>
      <AccountForm />
    </div>
  );
}
