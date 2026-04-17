"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface SignUpGateProps {
  children: React.ReactNode;
  /** e.g. "save watchlists", "create alerts" */
  feature: string;
  className?: string;
}

/**
 * Soft auth gate. Renders children for authenticated users; shows a
 * sign-up prompt card for guests. Use this for inline features that need
 * a persistent user record.
 */
export function SignUpGate({ children, feature, className }: SignUpGateProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <>{children}</>;
  }
  if (session?.user) {
    return <>{children}</>;
  }

  return (
    <div className={className}>
      <GlassCard>
        <div className="flex flex-col items-center text-center py-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Lock
              size={18}
              strokeWidth={1.75}
              style={{ color: "var(--text-muted)" }}
            />
          </div>
          <p
            className="text-sm font-body mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign up to {feature}. Free, takes 20 seconds.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="px-4 py-2 text-xs font-bold font-body rounded-[var(--radius-sm)]"
              style={{ background: "var(--accent-green)", color: "#fff" }}
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-body rounded-[var(--radius-sm)]"
              style={{
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              Log in
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
