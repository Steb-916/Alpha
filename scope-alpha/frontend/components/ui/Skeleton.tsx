"use client";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn("rounded-[var(--radius-sm)]", className)}
      style={{
        width: width || "100%",
        height: height || "20px",
        background: "linear-gradient(90deg, var(--glass-bg), rgba(255,255,255,0.08), var(--glass-bg))",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
        border: "1px solid var(--glass-border)",
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-[var(--radius-lg)] p-6 space-y-4">
      <Skeleton height="16px" width="40%" />
      <Skeleton height="32px" width="60%" />
      <Skeleton height="12px" width="80%" />
      <Skeleton height="120px" />
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton height="36px" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="44px" />
      ))}
    </div>
  );
}

export function AnalystCardSkeleton() {
  return (
    <div
      className="p-4 rounded-[var(--radius-md)]"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="flex items-start gap-3 mb-3">
        <Skeleton width="40px" height="40px" className="rounded-full" />
        <div className="flex-1">
          <Skeleton height="16px" width="120px" />
          <Skeleton height="12px" width="80px" className="mt-1" />
        </div>
        <Skeleton height="20px" width="60px" />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Skeleton height="40px" />
        <Skeleton height="40px" />
        <Skeleton height="40px" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton height="24px" width="80px" />
        <Skeleton height="16px" width="100px" />
      </div>
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <AnalystCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div
        className="p-6 rounded-[var(--radius-md)]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <div className="flex gap-5">
          <Skeleton width="80px" height="80px" className="rounded-full" />
          <div className="flex-1">
            <Skeleton height="28px" width="200px" />
            <Skeleton height="16px" width="300px" className="mt-2" />
            <Skeleton height="12px" width="100%" className="mt-3" />
            <div className="flex gap-2 mt-3">
              <Skeleton height="24px" width="48px" />
              <Skeleton height="24px" width="48px" />
              <Skeleton height="24px" width="64px" />
            </div>
          </div>
        </div>
      </div>
      <div
        className="p-4 rounded-[var(--radius-md)]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height="64px" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton height="200px" />
        <Skeleton height="200px" />
      </div>
    </div>
  );
}
