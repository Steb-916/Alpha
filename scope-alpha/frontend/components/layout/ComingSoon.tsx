"use client";

import {
  Activity,
  ArrowLeftRight,
  FlaskConical,
  Filter,
  GitBranch,
  Globe,
  MessageCircle,
  TrendingUp,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  ArrowLeftRight,
  FlaskConical,
  Filter,
  GitBranch,
  Globe,
  MessageCircle,
  TrendingUp,
};

interface ComingSoonProps {
  icon: string;
  title: string;
  description: string;
  phase: number;
}

export function ComingSoon({ icon, title, description, phase }: ComingSoonProps) {
  const Icon = ICON_MAP[icon] ?? Sparkles;

  return (
    <div className="h-full flex items-center justify-center p-6">
      <GlassCard className="max-w-xl w-full text-center">
        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(0, 212, 170, 0.08)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Icon
              size={28}
              strokeWidth={1.5}
              style={{ color: "var(--accent-green)" }}
            />
          </div>
        </div>
        <h1
          className="text-xl font-bold font-display mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        <p
          className="text-sm font-body leading-relaxed mb-6 mx-auto max-w-md"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
        <div
          className="inline-block px-3 py-1 rounded-[var(--radius-pill)] text-[11px] font-body uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-muted)",
          }}
        >
          Coming in Phase {phase}
        </div>
      </GlassCard>
    </div>
  );
}
