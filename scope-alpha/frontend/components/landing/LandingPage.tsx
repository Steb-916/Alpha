"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { loginAsDemo } from "@/lib/demoLogin";
import Image from "next/image";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function Counter({ end, suffix = "", prefix = "", duration = 2000 }: {
  end: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, end, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

function Reveal({ children, delay = 0, direction = "up" }: {
  children: React.ReactNode; delay?: number; direction?: "up" | "down" | "left" | "right" | "none";
}) {
  const [ref, inView] = useInView(0.1);
  const transforms = {
    up: "translateY(40px)", down: "translateY(-40px)",
    left: "translateX(40px)", right: "translateX(-40px)", none: "none",
  };
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "none" : transforms[direction],
      transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

function DashboardMockup() {
  const bars = [35, 58, 42, 72, 55, 88, 65, 78, 50, 92, 70, 60, 82, 45, 75, 68, 85, 52, 90, 63];
  return (
    <div className="glass rounded-[var(--radius-xl)] overflow-hidden w-full max-w-[800px]"
      style={{
        boxShadow: "0 40px 80px rgba(0,0,0,0.3), 0 0 120px var(--accent-green-glow)",
      }}>
      {/* Title bar */}
      <div className="flex items-center px-4 py-3 gap-2 relative z-10" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>Scope Alpha — Derivatives Terminal</span>
      </div>
      <div className="p-5 relative z-10">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "BTC Funding", value: "+0.0142%", color: "var(--data-green)", sub: "8h avg" },
            { label: "Aggregate OI", value: "$18.4B", color: "var(--data-blue)", sub: "+4.2% 24h" },
            { label: "Liquidations 24h", value: "$284M", color: "var(--data-yellow)", sub: "62% longs" },
            { label: "Basis Ann.", value: "12.8%", color: "var(--data-purple)", sub: "perp vs spot" },
          ].map((s, i) => (
            <div key={i} className="rounded-[var(--radius-sm)] p-3" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <div className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* Chart Area */}
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent-yellow)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>BTC/USDT</span>
              <span className="text-[11px] font-mono" style={{ color: "var(--positive)" }}>$67,842</span>
            </div>
            <div className="flex gap-1">
              {["1H", "4H", "1D"].map(tf => (
                <span key={tf} className="text-[9px] px-2 py-0.5 rounded-[var(--radius-sm)] font-mono font-semibold" style={{
                  background: tf === "4H" ? "rgba(0,212,170,0.15)" : "var(--glass-bg)",
                  color: tf === "4H" ? "var(--accent-green)" : "var(--text-muted)",
                }}>{tf}</span>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-[3px] h-24">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-[2px]" style={{
                height: `${h}%`,
                background: i % 3 === 0
                  ? "linear-gradient(180deg, var(--data-red) 0%, rgba(239,68,68,0.27) 100%)"
                  : "linear-gradient(180deg, var(--data-green) 0%, rgba(16,185,129,0.27) 100%)",
                animation: `barGrow 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
              }} />
            ))}
          </div>
          <svg width="100%" height="30" viewBox="0 0 400 30" preserveAspectRatio="none" className="mt-2">
            <defs>
              <linearGradient id="fundGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--accent-green)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,20 Q50,5 100,15 T200,10 T300,18 T400,8" fill="none" stroke="url(#fundGrad)" strokeWidth="2" />
            <text x="10" y="10" fill="var(--text-muted)" fontSize="7" fontFamily="monospace">FUNDING RATE OVERLAY</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    { icon: "⚡", title: "Funding Intelligence", desc: "Real-time funding rates across all major exchanges. Z-score normalization, regime detection, and annualized carry calculations.", color: "var(--data-green)" },
    { icon: "◎", title: "Open Interest Dynamics", desc: "Aggregate OI broken down by exchange. Momentum tracking, price divergence alerts, and OI-weighted funding.", color: "var(--data-blue)" },
    { icon: "🔥", title: "Liquidation Engine", desc: "Live liquidation feed with cumulative volume charts. Identify cluster zones before they trigger.", color: "var(--data-yellow)" },
    { icon: "◈", title: "Basis Analysis", desc: "Perp-to-spot basis across exchanges with annualized yield calculations and historical curves.", color: "var(--data-purple)" },
    { icon: "◆", title: "Derivatives Health Score", desc: "Composite metric synthesizing all signals into a single regime indicator. Risk-on, risk-off — at a glance.", color: "var(--accent-pink)" },
    { icon: "⊞", title: "Cross-Asset Screener", desc: "Rank 20+ assets by every derivatives metric simultaneously. Heatmap view with quick-switch analytics.", color: "var(--accent-green)" },
  ];

  return (
    <div className="font-body overflow-x-hidden min-h-screen" style={{ color: "var(--text-primary)" }}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-10 h-16 flex items-center justify-between transition-all duration-400" style={{
        background: scrollY > 50 ? "var(--surface-topbar)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(var(--glass-blur)) saturate(var(--glass-saturate))" : "none",
        WebkitBackdropFilter: scrollY > 50 ? "blur(var(--glass-blur)) saturate(var(--glass-saturate))" : "none",
        borderBottom: scrollY > 50 ? "1px solid var(--glass-border)" : "1px solid transparent",
        boxShadow: scrollY > 50 ? "var(--glass-shadow)" : "none",
      }}>
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 relative overflow-hidden rounded-lg" style={{
            filter: "drop-shadow(0 0 12px var(--accent-green-glow))",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="Scope Alpha" style={{ position: "absolute", width: "300%", maxWidth: "none", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
          <span className="text-lg font-display font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>Scope Alpha</span>
        </a>
        <div className="flex items-center gap-8">
          {["Features", "Analytics", "Marketplace", "Pricing", "Docs"].map(item => (
            <a key={item} href={item === "Marketplace" ? "/marketplace" : `#${item.toLowerCase()}`}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; }}
            >{item}</a>
          ))}
          <ThemeToggle />
          {session?.user ? (
            <GlassButton variant="primary" size="sm" onClick={() => router.push("/terminal")}>
              Go to Terminal
            </GlassButton>
          ) : (
            <>
              <GlassButton variant="ghost" size="sm" onClick={() => loginAsDemo()}>
                Try Demo
              </GlassButton>
              <GlassButton variant="ghost" size="sm" onClick={() => router.push("/login")}>
                Sign In
              </GlassButton>
              <GlassButton variant="primary" size="sm" onClick={() => router.push("/signup")}>
                Get Started
              </GlassButton>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-32 pb-16 px-10 relative z-10 text-center">
        <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, var(--accent-green-glow) 0%, transparent 60%)",
          filter: "blur(40px)", animation: "heroGlow 6s ease-in-out infinite",
        }} />

        <div style={{ animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          <span className="glass inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-5 py-2 text-xs font-mono font-semibold tracking-widest" style={{
            color: "var(--accent-green)",
            border: "1px solid var(--border-accent)",
          }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)", animation: "pulse 2s infinite" }} />
            DERIVATIVES INTELLIGENCE
          </span>
        </div>

        <h1 className="font-display font-black leading-[1.05] tracking-tighter mt-7" style={{
          fontSize: "clamp(40px, 7vw, 82px)",
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both",
          color: "var(--text-primary)",
        }}>
          See Through<br />
          The Market{" "}
          <span className="shimmer-text" style={{ paddingRight: "0.15em", letterSpacing: "0" }}>Noise</span>
        </h1>

        <p className="max-w-[560px] leading-relaxed mt-6 font-normal" style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both",
          color: "var(--text-secondary)",
        }}>
          Funding rates. Open interest. Liquidation clusters. Basis analysis.
          One terminal for every derivatives signal that matters.
        </p>

        <div className="flex gap-4 mt-10" style={{ animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.8s both" }}>
          {session?.user ? (
            <GlassButton variant="primary" onClick={() => router.push("/terminal")}>Go to Terminal</GlassButton>
          ) : (
            <>
              <GlassButton variant="primary" onClick={() => router.push("/signup")}>Get Started Free</GlassButton>
              <GlassButton variant="default" onClick={() => loginAsDemo()}>Try Live Demo →</GlassButton>
            </>
          )}
        </div>

        {/* Floating Dashboard */}
        <div className="mt-16 w-full max-w-[840px]" style={{
          perspective: "1200px",
          animation: "fadeInUp 1s cubic-bezier(0.16,1,0.3,1) 1s both",
        }}>
          <div style={{ animation: "float 8s ease-in-out infinite", transformStyle: "preserve-3d" }}>
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="py-16 px-10 relative z-10" style={{ borderTop: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)" }}>
        <div className="max-w-[1100px] mx-auto grid grid-cols-4 gap-6">
          {[
            { value: 20, suffix: "+", label: "Assets Tracked" },
            { value: 500, suffix: "ms", label: "Data Latency", prefix: "<" },
            { value: 14, suffix: "", label: "Data Sources" },
            { value: 99, suffix: "%", label: "Uptime Target" },
          ].map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <GlassCard className="text-center">
                <div className="text-4xl font-display font-extrabold tracking-tighter" style={{
                  background: "linear-gradient(135deg, var(--accent-green), var(--data-blue))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  <Counter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </div>
                <div className="text-xs mt-1.5 font-medium tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-10 relative z-10">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase font-mono" style={{ color: "var(--accent-green)" }}>Core Modules</span>
              <h2 className="font-display font-extrabold tracking-tight mt-3" style={{
                fontSize: "clamp(32px, 4vw, 52px)",
                color: "var(--text-primary)",
              }}>Every Signal.<br />One Terminal.</h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <GlassCard interactive glow="green" animate>
                  <div className="w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center text-xl mb-4" style={{
                    background: `linear-gradient(135deg, ${f.color}18, ${f.color}08)`,
                    border: `1px solid var(--glass-border)`,
                    boxShadow: `0 0 30px ${f.color}10`,
                  }}>{f.icon}</div>
                  <h3 className="text-lg font-display font-bold tracking-tight mb-2.5" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TECH STRIP */}
      <section className="py-20 px-10 relative z-10">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase font-mono" style={{ color: "var(--text-muted)" }}>Built With</span>
            </div>
          </Reveal>
          <div className="flex justify-center flex-wrap gap-4">
            {["Next.js", "FastAPI", "TimescaleDB", "Redis", "Binance WS", "CoinGlass", "WebSocket", "Python"].map((tech, i) => (
              <Reveal key={tech} delay={i * 0.06}>
                <div className="glass px-5 py-2.5 rounded-[var(--radius-pill)] text-sm font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <span className="relative z-10">{tech}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-10 relative z-10 text-center">
        <Reveal>
          <GlassCard interactive glow="green" className="max-w-[700px] mx-auto p-16">
            <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none" style={{
              background: "radial-gradient(ellipse, var(--accent-green-glow), transparent)",
              filter: "blur(40px)",
            }} />
            <h2 className="font-display font-extrabold tracking-tight mb-4 relative" style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              color: "var(--text-primary)",
            }}>
              Ready to See the<br /><span style={{ color: "var(--accent-green)" }}>Full Picture?</span>
            </h2>
            <p className="text-base leading-relaxed mb-9 relative" style={{ color: "var(--text-secondary)" }}>
              Stop guessing. Start seeing funding regimes, liquidation pressure, and positioning data in one workspace.
            </p>
            <div className="relative">
              <GlassButton variant="primary" size="lg" onClick={() => router.push("/terminal")}>
                Launch Scope Alpha
              </GlassButton>
            </div>
          </GlassCard>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-10 relative z-10 text-center" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-8 h-8 relative overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-full.png" alt="Scope Alpha" style={{ position: "absolute", width: "300%", maxWidth: "none", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
          </div>
          <span className="text-[15px] font-display font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Scope Alpha</span>
        </div>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Derivatives analytics terminal — Built 2026</p>
      </footer>
    </div>
  );
}
