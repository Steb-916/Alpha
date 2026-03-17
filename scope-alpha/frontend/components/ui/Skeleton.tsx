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
      className={cn("skeleton", className)}
      style={{ width: width || "100%", height: height || "20px" }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-6 space-y-4">
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
