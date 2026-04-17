"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TERMINAL_NAV, TOOLS_NAV, type NavItem } from "@/config/navigation";
import {
  Activity,
  ArrowLeftRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  FlaskConical,
  GitBranch,
  Globe,
  LogIn,
  MessageCircle,
  Settings,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  ArrowLeftRight,
  Filter,
  FlaskConical,
  GitBranch,
  Globe,
  MessageCircle,
  TrendingUp,
};

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return (
      <div
        className="mx-auto my-2 w-5 h-px"
        style={{ background: "var(--glass-border)" }}
      />
    );
  }
  return (
    <div
      className="uppercase"
      style={{
        fontSize: "10px",
        fontFamily: "var(--font-mono)",
        color: "#475569",
        letterSpacing: "0.12em",
        paddingLeft: "14px",
        marginTop: "20px",
        marginBottom: "6px",
      }}
    >
      {label}
    </div>
  );
}

interface SidebarProps {
  isGuest?: boolean;
}

export function Sidebar({ isGuest = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  function renderNavItem(item: NavItem) {
    const Icon = ICON_MAP[item.icon] ?? TrendingUp;
    const active = pathname === item.path || pathname.startsWith(item.path + "/");

    return (
      <button
        key={item.path}
        onClick={() => router.push(item.path)}
        className={cn(
          "w-full flex items-center gap-3 relative cursor-pointer",
          sidebarCollapsed ? "px-0 py-2 justify-center" : "px-3 py-2",
          "active:scale-[0.97]",
        )}
        style={{
          color: active ? "var(--accent-green)" : item.enabled ? "var(--text-secondary)" : "var(--text-muted)",
          background: active ? "rgba(0, 212, 170, 0.06)" : "transparent",
          borderLeft: active ? "3px solid var(--accent-green)" : "3px solid transparent",
          borderRadius: active ? "0 8px 8px 0" : "0 var(--radius-sm) var(--radius-sm) 0",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
            e.currentTarget.style.color = "var(--text-primary)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = item.enabled
              ? "var(--text-secondary)"
              : "var(--text-muted)";
          }
        }}
        title={!item.enabled ? `Coming in Phase ${item.phase}` : undefined}
      >
        <Icon size={18} strokeWidth={1.75} className="shrink-0" />
        {!sidebarCollapsed && (
          <span className="text-xs font-medium tracking-wide whitespace-nowrap flex-1 text-left">
            {item.label}
          </span>
        )}
        {!sidebarCollapsed && !item.enabled && (
          <span
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Soon
          </span>
        )}
      </button>
    );
  }

  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <aside
      className="h-full flex flex-col relative z-20 glass overflow-visible"
      style={{
        width: sidebarCollapsed ? 56 : 200,
        borderRadius: "var(--radius-lg)",
        transition: "width 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
        background: "var(--surface-sidebar)",
      }}
    >
      {/* Logo */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          router.push("/");
        }}
        className="flex items-center gap-2.5 p-3 h-12 shrink-0 cursor-pointer"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div
          className="w-7 h-7 rounded-lg relative overflow-hidden shrink-0"
          style={{ filter: "drop-shadow(0 0 8px var(--accent-green-glow))" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full.png"
            alt="Scope Alpha"
            style={{
              position: "absolute",
              width: "300%",
              maxWidth: "none",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        {!sidebarCollapsed && (
          <span
            className="font-display font-extrabold text-sm tracking-tight whitespace-nowrap"
            style={{ color: "var(--text-primary)", transition: "opacity 0.3s ease" }}
          >
            Scope Alpha
          </span>
        )}
      </a>

      <nav className="flex-1 py-1 px-1 space-y-0.5 relative z-10 overflow-y-auto">
        <SectionLabel label="Terminal" collapsed={sidebarCollapsed} />
        {TERMINAL_NAV.map((item) => renderNavItem(item))}

        <SectionLabel label="Tools" collapsed={sidebarCollapsed} />
        {TOOLS_NAV.map((item) => renderNavItem(item))}
      </nav>

      {/* Settings (authed) or Sign Up / Log In (guest) */}
      {isGuest ? (
        <div
          className={cn(
            "flex flex-col gap-1",
            sidebarCollapsed ? "items-center py-3" : "p-2",
          )}
          style={{ borderTop: "1px solid var(--glass-border)" }}
        >
          <Link
            href="/signup"
            className={cn(
              "flex items-center gap-2 w-full rounded-[var(--radius-sm)]",
              sidebarCollapsed ? "p-2 justify-center" : "px-3 py-2",
            )}
            style={{
              background: "rgba(0, 212, 170, 0.1)",
              border: "1px solid var(--accent-green)",
              color: "var(--accent-green)",
            }}
            title="Create free account"
          >
            <UserPlus size={14} strokeWidth={1.75} className="shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-xs font-bold tracking-wide">Sign up</span>
            )}
          </Link>
          <Link
            href="/login"
            className={cn(
              "flex items-center gap-2 w-full rounded-[var(--radius-sm)]",
              sidebarCollapsed ? "p-2 justify-center" : "px-3 py-2",
            )}
            style={{
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
            title="Log in"
          >
            <LogIn size={14} strokeWidth={1.75} className="shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-xs font-medium tracking-wide">Log in</span>
            )}
          </Link>
        </div>
      ) : (
        <button
          onClick={() => router.push("/settings")}
          className={cn(
            "flex items-center gap-3 relative cursor-pointer",
            sidebarCollapsed ? "px-0 py-3 justify-center" : "px-3 py-3",
          )}
          style={{
            color: isSettingsActive ? "var(--accent-green)" : "var(--text-secondary)",
            borderTop: "1px solid var(--glass-border)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isSettingsActive) e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            if (!isSettingsActive) e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <Settings size={18} strokeWidth={1.75} className="shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-xs font-medium tracking-wide">Settings</span>
          )}
        </button>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center p-3 cursor-pointer relative z-10"
        style={{
          borderTop: "1px solid var(--glass-border)",
          color: "var(--text-muted)",
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        {sidebarCollapsed ? (
          <ChevronsRight size={16} strokeWidth={1.75} />
        ) : (
          <ChevronsLeft size={16} strokeWidth={1.75} />
        )}
      </button>
    </aside>
  );
}
