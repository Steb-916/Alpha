"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/ui/NeuButton";
import { NeuCard } from "@/components/ui/NeuCard";
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
    <div className="rounded-2xl border border-white/[0.06] overflow-hidden w-full max-w-[800px]"
      style={{
        background: "linear-gradient(160deg, #0F1219 0%, #0B0E14 100%)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 120px rgba(0,212,170,0.06)",
      }}>
      {/* Title bar */}
      <div className="flex items-center px-4 py-3 border-b border-white/[0.05] gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] text-text-dim font-mono">Scope Alpha — Derivatives Terminal</span>
      </div>
      <div className="p-5">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "BTC Funding", value: "+0.0142%", color: "#10B981", sub: "8h avg" },
            { label: "Aggregate OI", value: "$18.4B", color: "#3B82F6", sub: "+4.2% 24h" },
            { label: "Liquidations 24h", value: "$284M", color: "#F59E0B", sub: "62% longs" },
            { label: "Basis Ann.", value: "12.8%", color: "#8B5CF6", sub: "perp vs spot" },
          ].map((s, i) => (
            <div key={i} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">{s.label}</div>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] text-text-dim font-mono mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
        {/* Chart Area */}
        <div className="bg-white/[0.015] rounded-lg p-4 border border-white/[0.03]">
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-yellow" />
              <span className="text-xs font-semibold text-text-primary">BTC/USDT</span>
              <span className="text-[11px] text-positive font-mono">$67,842</span>
            </div>
            <div className="flex gap-1">
              {["1H", "4H", "1D"].map(tf => (
                <span key={tf} className={`text-[9px] px-2 py-0.5 rounded-md font-mono font-semibold ${
                  tf === "4H" ? "bg-accent-green/[0.15] text-accent-green" : "bg-white/[0.04] text-text-muted"
                }`}>{tf}</span>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-[3px] h-24">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-[2px]" style={{
                height: `${h}%`,
                background: i % 3 === 0
                  ? "linear-gradient(180deg, #EF4444 0%, rgba(239,68,68,0.27) 100%)"
                  : "linear-gradient(180deg, #10B981 0%, rgba(16,185,129,0.27) 100%)",
                animation: `barGrow 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
              }} />
            ))}
          </div>
          <svg width="100%" height="30" viewBox="0 0 400 30" preserveAspectRatio="none" className="mt-2">
            <defs>
              <linearGradient id="fundGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#00D4AA" stopOpacity="0" />
                <stop offset="50%" stopColor="#00D4AA" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,20 Q50,5 100,15 T200,10 T300,18 T400,8" fill="none" stroke="url(#fundGrad)" strokeWidth="2" />
            <text x="10" y="10" fill="#475569" fontSize="7" fontFamily="monospace">FUNDING RATE OVERLAY</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  const features = [
    { icon: "⚡", title: "Funding Intelligence", desc: "Real-time funding rates across all major exchanges. Z-score normalization, regime detection, and annualized carry calculations.", color: "#10B981" },
    { icon: "◎", title: "Open Interest Dynamics", desc: "Aggregate OI broken down by exchange. Momentum tracking, price divergence alerts, and OI-weighted funding.", color: "#3B82F6" },
    { icon: "🔥", title: "Liquidation Engine", desc: "Live liquidation feed with cumulative volume charts. Identify cluster zones before they trigger.", color: "#F59E0B" },
    { icon: "◈", title: "Basis Analysis", desc: "Perp-to-spot basis across exchanges with annualized yield calculations and historical curves.", color: "#8B5CF6" },
    { icon: "◆", title: "Derivatives Health Score", desc: "Composite metric synthesizing all signals into a single regime indicator. Risk-on, risk-off — at a glance.", color: "#EC4899" },
    { icon: "⊞", title: "Cross-Asset Screener", desc: "Rank 20+ assets by every derivatives metric simultaneously. Heatmap view with quick-switch analytics.", color: "#00D4AA" },
  ];

  return (
    <div className="bg-bg-primary text-text-primary font-body overflow-x-hidden min-h-screen">
      {/* AMBIENT BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full" style={{
          background: "radial-gradient(circle, rgba(0,212,170,0.12) 0%, transparent 70%)",
          top: `${20 + mousePos.y * 10}%`, left: `${30 + mousePos.x * 15}%`,
          transform: "translate(-50%, -50%)", filter: "blur(80px)",
          animation: "orbFloat 12s ease-in-out infinite",
          transition: "top 2s ease, left 2s ease",
        }} />
        <div className="absolute w-[400px] h-[400px] rounded-full" style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          top: "60%", right: "10%", filter: "blur(60px)",
          animation: "orbFloat 16s ease-in-out infinite reverse",
        }} />
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-10 h-16 flex items-center justify-between transition-all duration-400" style={{
        background: scrollY > 50 ? "rgba(11,14,20,0.85)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px) saturate(1.2)" : "none",
        borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
      }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center" style={{
            boxShadow: "0 0 20px rgba(0,212,170,0.3)",
          }}>
            <Image src="/logo.png" alt="Scope Alpha" width={36} height={36} className="object-contain" />
          </div>
          <span className="text-lg font-display font-extrabold tracking-tight">Scope Alpha</span>
        </div>
        <div className="flex items-center gap-8">
          {["Features", "Analytics", "Pricing", "Docs"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className="text-text-secondary text-sm font-medium hover:text-text-primary transition-colors"
            >{item}</a>
          ))}
          <NeuButton primary size="sm" onClick={() => router.push("/terminal")}>
            Launch Terminal
          </NeuButton>
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-32 pb-16 px-10 relative z-10 text-center">
        <div className="absolute -top-[200px] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, rgba(0,212,170,0.15) 0%, transparent 60%)",
          filter: "blur(40px)", animation: "heroGlow 6s ease-in-out infinite",
        }} />

        <div style={{ animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          <span className="inline-flex items-center gap-2 bg-gradient-to-br from-accent-green/[0.12] to-accent-green/[0.04] border border-accent-green/20 rounded-full px-5 py-2 text-xs font-mono font-semibold text-accent-green tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green" style={{ animation: "pulse 2s infinite" }} />
            DERIVATIVES INTELLIGENCE
          </span>
        </div>

        <h1 className="font-display font-black leading-[1.05] tracking-tighter mt-7" style={{
          fontSize: "clamp(40px, 7vw, 82px)",
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both",
        }}>
          <span className="text-text-primary">See Through</span><br />
          <span className="text-text-primary">The Market </span>
          <span className="shimmer-text">Noise</span>
        </h1>

        <p className="text-text-secondary max-w-[560px] leading-relaxed mt-6 font-normal" style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both",
        }}>
          Funding rates. Open interest. Liquidation clusters. Basis analysis.
          One terminal for every derivatives signal that matters.
        </p>

        <div className="flex gap-4 mt-10" style={{ animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.8s both" }}>
          <NeuButton primary onClick={() => router.push("/terminal")}>Launch Terminal</NeuButton>
          <NeuButton>View Demo</NeuButton>
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
      <section className="py-16 px-10 relative z-10 border-y border-white/[0.04]">
        <div className="max-w-[1100px] mx-auto flex justify-around flex-wrap gap-10">
          {[
            { value: 20, suffix: "+", label: "Assets Tracked" },
            { value: 500, suffix: "ms", label: "Data Latency", prefix: "<" },
            { value: 14, suffix: "", label: "Data Sources" },
            { value: 99, suffix: "%", label: "Uptime Target" },
          ].map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="text-5xl font-display font-extrabold tracking-tighter" style={{
                  background: "linear-gradient(135deg, #00D4AA, #3B82F6)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  <Counter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </div>
                <div className="text-xs text-text-muted mt-1.5 font-medium tracking-wider uppercase">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-10 relative z-10">
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold text-accent-green tracking-[0.15em] uppercase font-mono">Core Modules</span>
              <h2 className="font-display font-extrabold tracking-tight mt-3 text-text-primary" style={{
                fontSize: "clamp(32px, 4vw, 52px)",
              }}>Every Signal.<br />One Terminal.</h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <NeuCard glow>
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-xl mb-4" style={{
                    background: `linear-gradient(135deg, ${f.color}18, ${f.color}08)`,
                    border: `1px solid ${f.color}25`,
                    boxShadow: `0 0 30px ${f.color}10`,
                  }}>{f.icon}</div>
                  <h3 className="text-lg font-display font-bold text-text-primary tracking-tight mb-2.5">{f.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                </NeuCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TECH STRIP */}
      <section className="py-20 px-10 relative z-10" style={{
        background: "linear-gradient(180deg, transparent, rgba(0,212,170,0.02), transparent)",
      }}>
        <div className="max-w-[1100px] mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="text-[11px] font-bold text-text-muted tracking-[0.15em] uppercase font-mono">Built With</span>
            </div>
          </Reveal>
          <div className="flex justify-center flex-wrap gap-4">
            {["Next.js", "FastAPI", "TimescaleDB", "Redis", "Binance WS", "CoinGlass", "WebSocket", "Python"].map((tech, i) => (
              <Reveal key={tech} delay={i * 0.06}>
                <div className="px-5 py-2.5 rounded-xl text-sm font-mono font-semibold text-text-secondary" style={{
                  background: "linear-gradient(145deg, rgba(19,23,32,0.6), rgba(14,17,28,0.6))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "4px 4px 12px rgba(0,0,0,0.3), -2px -2px 6px rgba(255,255,255,0.02)",
                }}>{tech}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-10 relative z-10 text-center">
        <Reveal>
          <div className="max-w-[700px] mx-auto rounded-3xl p-16 relative overflow-hidden" style={{
            background: "linear-gradient(145deg, rgba(18,22,32,0.6), rgba(13,16,26,0.6))",
            border: "1px solid rgba(0,212,170,0.1)",
            boxShadow: "0 0 120px rgba(0,212,170,0.06), 12px 12px 40px rgba(0,0,0,0.4)",
          }}>
            <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[300px] h-[200px] pointer-events-none" style={{
              background: "radial-gradient(ellipse, rgba(0,212,170,0.12), transparent)",
              filter: "blur(40px)",
            }} />
            <h2 className="font-display font-extrabold tracking-tight text-text-primary mb-4 relative" style={{
              fontSize: "clamp(28px, 4vw, 44px)",
            }}>
              Ready to See the<br /><span className="text-accent-green">Full Picture?</span>
            </h2>
            <p className="text-base text-text-secondary mb-9 leading-relaxed relative">
              Stop guessing. Start seeing funding regimes, liquidation pressure, and positioning data in one workspace.
            </p>
            <div className="relative">
              <NeuButton primary size="lg" onClick={() => router.push("/terminal")}>
                Launch Scope Alpha
              </NeuButton>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-10 border-t border-white/[0.04] relative z-10 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-6 h-6 rounded-lg overflow-hidden">
            <Image src="/logo.png" alt="Scope Alpha" width={24} height={24} className="object-contain" />
          </div>
          <span className="text-[15px] font-display font-bold tracking-tight">Scope Alpha</span>
        </div>
        <p className="text-xs text-text-dim font-mono">Derivatives analytics terminal — Built 2026</p>
      </footer>
    </div>
  );
}
