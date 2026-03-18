"use client";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "red" | "yellow" | "blue" | "purple" | "gray";
  className?: string;
}

const variantStyles: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: "rgba(0, 212, 170, 0.1)", text: "var(--data-green)", border: "rgba(0, 212, 170, 0.2)" },
  red: { bg: "rgba(239, 68, 68, 0.1)", text: "var(--data-red)", border: "rgba(239, 68, 68, 0.2)" },
  yellow: { bg: "rgba(245, 158, 11, 0.1)", text: "var(--data-yellow)", border: "rgba(245, 158, 11, 0.2)" },
  blue: { bg: "rgba(59, 130, 246, 0.1)", text: "var(--data-blue)", border: "rgba(59, 130, 246, 0.2)" },
  purple: { bg: "rgba(139, 92, 246, 0.1)", text: "var(--data-purple)", border: "rgba(139, 92, 246, 0.2)" },
  gray: { bg: "rgba(148, 163, 184, 0.1)", text: "var(--text-secondary)", border: "rgba(148, 163, 184, 0.2)" },
};

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-[10px] font-mono font-semibold border",
        className
      )}
      style={{
        background: s.bg,
        color: s.text,
        borderColor: s.border,
        borderRadius: "var(--radius-pill)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.1)",
      }}
    >
      {children}
    </span>
  );
}
