import { WatchlistManager } from "@/components/settings/WatchlistManager";

export default function WatchlistsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1
        className="text-xl font-bold font-display mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        Watchlists
      </h1>
      <WatchlistManager />
    </div>
  );
}
