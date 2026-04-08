"use client";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Store,
  LayoutDashboard,
  Zap,
  Target,
  Flame,
  GitCompare,
  Grid3X3,
  Pencil,
  Signal,
  Wallet,
  Rss,
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  Icon: LucideIcon;
  path: string;
}

const discoverItems: NavItem[] = [
  { label: "Marketplace", Icon: Store, path: "/marketplace" },
  // Phase 5: subscriber portfolio
  { label: "Portfolio", Icon: Wallet, path: "/portfolio" },
  // Phase 6: community feed + bookmarks
  { label: "Feed", Icon: Rss, path: "/feed" },
  { label: "Bookmarks", Icon: Bookmark, path: "/bookmarks" },
];

const terminalItems: NavItem[] = [
  { label: "Dashboard", Icon: LayoutDashboard, path: "/terminal" },
  { label: "Funding", Icon: Zap, path: "/terminal/funding" },
  { label: "Open Interest", Icon: Target, path: "/terminal/oi" },
  { label: "Liquidations", Icon: Flame, path: "/terminal/liquidations" },
  { label: "Basis", Icon: GitCompare, path: "/terminal/basis" },
  { label: "Screener", Icon: Grid3X3, path: "/terminal/screener" },
];

const analystItems: NavItem[] = [
  { label: "My Workspace", Icon: Pencil, path: "/terminal" },
  { label: "My Signals", Icon: Signal, path: "/terminal" },
];

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="mx-auto my-2 w-5 h-px" style={{ background: "var(--glass-border)" }} />;
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { data: session } = useSession();
  const isAnalyst = session?.user?.role === "analyst";

  const isMarketplaceActive =
    pathname === "/marketplace" || pathname.startsWith("/analyst/");

  function renderNavItem(item: NavItem, active: boolean) {
    return (
      <button
        key={item.label + item.path}
        onClick={() => router.push(item.path)}
        className={cn(
          "w-full flex items-center gap-3 relative cursor-pointer",
          sidebarCollapsed ? "px-0 py-2 justify-center" : "px-3 py-2",
          "active:scale-[0.97]"
        )}
        style={{
          color: active ? "var(--accent-green)" : "var(--text-secondary)",
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
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }}
      >
        <item.Icon size={18} strokeWidth={1.75} className="shrink-0" />
        {!sidebarCollapsed && (
          <span className="text-xs font-medium tracking-wide whitespace-nowrap">{item.label}</span>
        )}
      </button>
    );
  }

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
        onClick={(e) => { e.preventDefault(); router.push("/"); }}
        className="flex items-center gap-2.5 p-3 h-12 shrink-0 cursor-pointer"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div className="w-7 h-7 rounded-lg relative overflow-hidden shrink-0" style={{
          filter: "drop-shadow(0 0 8px var(--accent-green-glow))",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Scope Alpha" style={{ position: "absolute", width: "300%", maxWidth: "none", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
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

      {/* Nav Items with Sections */}
      <nav className="flex-1 py-1 px-1 space-y-0.5 relative z-10 overflow-y-auto">
        {/* DISCOVER section */}
        <SectionLabel label="Discover" collapsed={sidebarCollapsed} />
        {discoverItems.map((item) => renderNavItem(item, isMarketplaceActive))}

        {/* TERMINAL section */}
        <SectionLabel label="Terminal" collapsed={sidebarCollapsed} />
        {terminalItems.map((item) => {
          const isActive =
            item.path === "/terminal"
              ? pathname === "/terminal"
              : pathname.startsWith(item.path);
          return renderNavItem(item, isActive);
        })}

        {/* ANALYST section (role-gated) */}
        {isAnalyst && (
          <>
            <SectionLabel label="Analyst" collapsed={sidebarCollapsed} />
            {analystItems.map((item) => renderNavItem(item, false))}
          </>
        )}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center p-3 cursor-pointer relative z-10"
        style={{
          borderTop: "1px solid var(--glass-border)",
          color: "var(--text-muted)",
          transition: "color 0.2s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        {sidebarCollapsed ? <ChevronsRight size={16} strokeWidth={1.75} /> : <ChevronsLeft size={16} strokeWidth={1.75} />}
      </button>
    </aside>
  );
}
