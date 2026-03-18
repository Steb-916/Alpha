"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GlassPillProps {
  items: { label: string; value: string }[];
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export function GlassPill({ items, activeValue, onChange, className }: GlassPillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const activeEl = itemRefs.current.get(activeValue);
    const container = containerRef.current;
    if (!activeEl || !container) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    setIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
    });
  }, [activeValue]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Recalculate on resize
  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-0.5 p-1 rounded-[var(--radius-pill)] glass",
        className
      )}
    >
      {/* Sliding active indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-[var(--radius-pill)] pointer-events-none z-0"
        style={{
          left: indicator.left,
          width: indicator.width,
          background: "rgba(0, 212, 170, 0.15)",
          boxShadow: "0 0 20px rgba(0, 212, 170, 0.1)",
          transition: "all 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
        }}
      />

      {items.map((item) => (
        <button
          key={item.value}
          ref={(el) => {
            if (el) itemRefs.current.set(item.value, el);
          }}
          onClick={() => onChange(item.value)}
          className={cn(
            "relative z-10 px-3 py-1.5 text-xs font-mono font-medium rounded-[var(--radius-pill)]",
            "cursor-pointer transition-colors duration-200",
            "active:scale-[0.92]",
            item.value === activeValue
              ? "text-[var(--accent-green)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
          style={{
            background: "transparent",
            border: "none",
            transition: "all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
