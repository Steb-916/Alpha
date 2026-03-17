"use client";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import Image from "next/image";

const navItems = [
  { label: "Dashboard", icon: "⌘", path: "/terminal" },
  { label: "Funding", icon: "⚡", path: "/terminal/funding" },
  { label: "Open Interest", icon: "◎", path: "/terminal/oi" },
  { label: "Liquidations", icon: "🔥", path: "/terminal/liquidations" },
  { label: "Basis", icon: "◈", path: "/terminal/basis" },
  { label: "Screener", icon: "⊞", path: "/terminal/screener" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className="h-screen flex flex-col border-r border-white/[0.05] transition-all duration-300 ease-out relative z-20"
      style={{
        width: sidebarCollapsed ? 56 : 220,
        background: "linear-gradient(180deg, #0F1219 0%, #0B0E14 100%)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 p-3 border-b border-white/[0.05] h-12 shrink-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <Image src="/logo.png" alt="Scope Alpha" width={32} height={32} style={{ width: "auto", height: "auto" }} />
        </div>
        {!sidebarCollapsed && (
          <span className="font-display font-extrabold text-sm tracking-tight whitespace-nowrap">
            Scope Alpha
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-3 px-1.5 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.path ||
            (item.path !== "/terminal" && pathname.startsWith(item.path));
          const isDashboard = item.path === "/terminal" && pathname === "/terminal";

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg transition-all duration-200 group relative",
                sidebarCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
                (isActive || isDashboard)
                  ? "bg-accent-green/[0.08] text-accent-green"
                  : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
              )}
            >
              {(isActive || isDashboard) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-green rounded-r-full" />
              )}
              <span className="text-base shrink-0">{item.icon}</span>
              {!sidebarCollapsed && (
                <span className="text-xs font-medium tracking-wide whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="p-3 border-t border-white/[0.05] text-text-dim hover:text-text-secondary transition-colors text-xs"
      >
        {sidebarCollapsed ? "→" : "← Collapse"}
      </button>
    </aside>
  );
}
