"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function DemoBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem("demo-banner-dismissed") === "true");
      // Check for demo cookie or demo session
      const hasDemoCookie = document.cookie.includes("scope-alpha-demo=true");
      const hasDemoSession = session?.user?.email === "demo@scopealpha.com";
      setIsDemo(hasDemoCookie || hasDemoSession);
    }
  }, [session]);

  if (!isDemo || dismissed) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 shrink-0"
      style={{
        height: 32,
        background: "rgba(0, 212, 170, 0.08)",
        borderBottom: "1px solid rgba(0, 212, 170, 0.15)",
      }}
    >
      <span className="text-[13px] font-body" style={{ color: "var(--text-secondary)" }}>
        You&apos;re exploring Scope Alpha as a demo user.
      </span>
      <button
        onClick={() => router.push("/signup")}
        className="text-[13px] font-bold font-body cursor-pointer"
        style={{ color: "var(--accent-green)" }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        Create Account →
      </button>
      <button
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("demo-banner-dismissed", "true");
        }}
        className="text-[13px] cursor-pointer ml-2"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        ✕
      </button>
    </div>
  );
}
