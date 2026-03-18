import { ProfileSkeleton } from "@/components/ui/Skeleton";

export default function AnalystProfileLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="sticky top-0 z-50 px-6 py-3" style={{ background: "rgba(10,14,20,0.85)", borderBottom: "1px solid var(--glass-border)" }}>
        <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
      </div>
      <ProfileSkeleton />
    </div>
  );
}
