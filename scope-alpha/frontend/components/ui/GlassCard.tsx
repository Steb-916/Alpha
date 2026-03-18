"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useMousePosition } from "@/lib/useMousePosition";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: "green" | "blue" | "purple" | "pink" | "none";
  noPadding?: boolean;
  onClick?: () => void;
  interactive?: boolean;
  animate?: boolean;
}

const glowClasses: Record<string, string> = {
  green: "glass-glow-green",
  blue: "glass-glow-blue",
  purple: "",
  pink: "",
  none: "",
};

export function GlassCard({
  children,
  className,
  glow = "none",
  noPadding,
  onClick,
  interactive,
  animate,
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  if (interactive) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMousePosition(ref);
  }

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        "glass rounded-[var(--radius-lg)]",
        interactive && "glass-glare",
        glowClasses[glow],
        !noPadding && "p-5",
        onClick && "cursor-pointer active:scale-[0.97]",
        animate && "animate-glassReveal",
        className
      )}
      style={{
        animation: animate ? "glassReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" : undefined,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
