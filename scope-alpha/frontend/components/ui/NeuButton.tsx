"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NeuButtonProps {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function NeuButton({ children, primary, onClick, className, size = "md", disabled }: NeuButtonProps) {
  const [pressed, setPressed] = useState(false);

  const sizeClasses = {
    sm: "px-4 py-2 text-xs rounded-lg",
    md: "px-6 py-3 text-sm rounded-xl",
    lg: "px-8 py-4 text-base rounded-2xl",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className={cn(
        "font-bold font-body tracking-tight cursor-pointer transition-all duration-200",
        sizeClasses[size],
        primary
          ? "bg-gradient-to-br from-accent-green to-accent-green-dim text-bg-primary"
          : "bg-gradient-to-br from-[#1a1f2e] to-[#151925] text-text-primary border border-[#2a3040]",
        pressed ? "scale-[0.97]" : "scale-100",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        boxShadow: pressed
          ? (primary ? "inset 2px 2px 6px rgba(0,0,0,0.3)" : "inset 2px 2px 8px rgba(0,0,0,0.4)")
          : (primary
            ? "4px 4px 16px rgba(0,212,170,0.25), -2px -2px 8px rgba(0,212,170,0.1), 0 0 40px rgba(0,212,170,0.15)"
            : "4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.03)"),
      }}
    >
      {children}
    </button>
  );
}
