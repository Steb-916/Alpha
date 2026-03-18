"use client";
import { cn } from "@/lib/utils";

interface GlassButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "default" | "ghost";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "px-4 py-2 text-xs rounded-[var(--radius-sm)]",
  md: "px-6 py-3 text-sm rounded-[var(--radius-md)]",
  lg: "px-8 py-4 text-base rounded-[var(--radius-lg)]",
};

export function GlassButton({
  children,
  variant = "default",
  size = "md",
  onClick,
  disabled,
  className,
}: GlassButtonProps) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative font-bold font-body tracking-tight cursor-pointer overflow-hidden",
        "transition-all duration-200",
        sizeClasses[size],
        isPrimary && "text-white",
        !isPrimary && !isGhost && "glass",
        isGhost && "border border-[var(--glass-border)] hover:bg-[var(--glass-bg)]",
        disabled && "opacity-50 cursor-not-allowed",
        "active:scale-[0.95]",
        className
      )}
      style={{
        ...(isPrimary
          ? {
              background: "linear-gradient(135deg, var(--accent-green), var(--accent-green-dim))",
              boxShadow:
                "0 4px 16px var(--accent-green-glow), var(--glass-shadow)",
              transition: "all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
            }
          : isGhost
          ? {
              background: "transparent",
              transition: "all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
            }
          : {
              transition: "all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
            }),
      }}
    >
      {/* Specular highlight for primary */}
      {isPrimary && (
        <span
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 60%)",
            borderRadius: "inherit",
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
