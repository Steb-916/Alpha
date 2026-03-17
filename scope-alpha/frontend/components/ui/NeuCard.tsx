"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NeuCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  noPadding?: boolean;
  onClick?: () => void;
}

export function NeuCard({ children, className, glow, noPadding, onClick }: NeuCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "rounded-xl transition-all duration-400 cursor-default",
        !noPadding && "p-6",
        onClick && "cursor-pointer",
        className
      )}
      style={{
        background: "linear-gradient(145deg, rgba(18,22,32,0.6), rgba(13,16,26,0.6))",
        backdropFilter: "blur(20px)",
        border: `1px solid ${hover ? "rgba(0,212,170,0.2)" : "rgba(255,255,255,0.05)"}`,
        boxShadow: hover
          ? `8px 8px 24px rgba(0,0,0,0.5), -4px -4px 12px rgba(255,255,255,0.02)${glow ? ", 0 0 60px rgba(0,212,170,0.08)" : ""}`
          : "6px 6px 20px rgba(0,0,0,0.4), -3px -3px 10px rgba(255,255,255,0.02)",
        transform: hover && onClick ? "translateY(-2px)" : "none",
      }}
    >
      {children}
    </div>
  );
}
