"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useChatStore } from "@/lib/chatStore";
import { cn } from "@/lib/utils";
import { GlassPill } from "@/components/ui/GlassPill";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { TimeFrame } from "@/lib/types";

const timeframeItems: { label: string; value: string }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1H" },
  { label: "4H", value: "4H" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

function ChatButton() {
  const { toggleDrawer, getTotalUnread } = useChatStore();
  const unread = getTotalUnread();

  return (
    <button
      onClick={toggleDrawer}
      className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-green)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--glass-border)";
      }}
      title="Chat"
    >
      <MessageCircle size={18} strokeWidth={1.75} />
      {unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full text-[8px] font-bold leading-[14px] text-center"
          style={{ background: "var(--accent-red)", color: "white" }}
        >
          {unread > 9 ? "+" : unread}
        </span>
      )}
    </button>
  );
}

export function TopBar() {
  const { selectedAsset, selectedTimeframe, setTimeframe, connectionStatus } = useAppStore();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live indicator removed — will be re-added when real WebSocket is implemented

  return (
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0 glass"
      style={{
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-topbar)",
      }}
    >
      {/* Asset Selector */}
      <div className="flex items-center gap-3 relative z-10">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] cursor-pointer"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            transition: "all 0.3s ease",
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--accent-yellow)" }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedAsset} / USDT
          </span>
          <ChevronDown size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Timeframe Pills */}
      <div className="relative z-10">
        <GlassPill
          items={timeframeItems}
          activeValue={selectedTimeframe}
          onChange={(v) => setTimeframe(v as TimeFrame)}
        />
      </div>

      {/* Right: Theme + Chat + Avatar */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Chat Icon + Unread Badge */}
        <ChatButton />

        {/* User Menu */}
        {session?.user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, var(--accent-green), var(--accent-green-dim))",
                color: "#fff",
                border: "2px solid var(--glass-border)",
                transition: "all 0.3s ease",
              }}
            >
              {(session.user.displayName || session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
            </button>
            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-48 py-1 rounded-[var(--radius-md)] z-50"
                style={{
                  background: "var(--surface-modal, var(--glass-bg))",
                  border: "1px solid var(--glass-border)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "var(--glass-shadow-hover)",
                }}
              >
                <div
                  className="px-3 py-2 text-xs font-body"
                  style={{ color: "var(--text-tertiary)", borderBottom: "1px solid var(--glass-border)" }}
                >
                  {session.user.displayName || session.user.name || session.user.email}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-2 text-sm font-body cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--glass-bg)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  Profile
                </Link>
                <button
                  onClick={() => { setShowUserMenu(false); signOut({ callbackUrl: "/" }); }}
                  className="w-full text-left px-3 py-2 text-sm font-body cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--glass-bg)";
                    e.currentTarget.style.color = "var(--accent-red)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-bold font-body rounded-[var(--radius-sm)] cursor-pointer"
            style={{
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
