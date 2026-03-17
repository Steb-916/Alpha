"use client";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "red" | "yellow" | "blue" | "purple" | "gray";
  className?: string;
}

const variants = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  gray: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
