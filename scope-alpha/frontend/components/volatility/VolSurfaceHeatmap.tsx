"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useVolSurface } from "@/hooks/useVolSurface";
import { UnavailableBanner } from "./UnavailableBanner";
import { VolSurface3D } from "./VolSurface3D";

interface VolSurfaceHeatmapProps {
  asset: string;
}

export function VolSurfaceHeatmap({ asset }: VolSurfaceHeatmapProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useVolSurface(asset);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 rounded-full"
          style={{
            borderColor: "var(--glass-border)",
            borderTopColor: "var(--accent-green)",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (unavailable || !data || data.surface.length === 0) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Vol Surface"
      />
    );
  }

  return <VolSurface3D data={data} />;
}
