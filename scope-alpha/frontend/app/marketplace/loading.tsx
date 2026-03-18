import { MarketplaceSkeleton } from "@/components/ui/Skeleton";

export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="h-9 w-64 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-96 mt-2 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-10 w-80 mb-4 rounded bg-white/5 animate-pulse" />
        <div className="h-14 mb-4 rounded bg-white/5 animate-pulse" />
        <MarketplaceSkeleton />
      </div>
    </div>
  );
}
