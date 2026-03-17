import { useState, useEffect, useRef } from "react";

// ─── Intersection Observer Hook ───
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ─── Animated Counter ───
function Counter({ end, suffix = "", prefix = "", duration = 2000 }) {
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

// ─── Reveal Wrapper ───
function Reveal({ children, delay = 0, direction = "up" }) {
  const [ref, inView] = useInView(0.1);
  const transforms = { up: "translateY(40px)", down: "translateY(-40px)", left: "translateX(40px)", right: "translateX(-40px)", none: "none" };
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "none" : transforms[direction],
      transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

// ─── Neumorphic Button ───
function NeuButton({ children, primary, onClick, style: s }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        background: primary
          ? "linear-gradient(135deg, #00D4AA 0%, #00B894 100%)"
          : "linear-gradient(145deg, #1a1f2e, #151925)",
        color: primary ? "#0B0E14" : "#E2E8F0",
        border: primary ? "none" : "1px solid #2a3040",
        borderRadius: 14,
        padding: "14px 32px",
        fontSize: 15,
        fontWeight: 700,
        fontFamily: "'Satoshi', 'General Sans', -apple-system, sans-serif",
        cursor: "pointer",
        letterSpacing: "-0.01em",
        boxShadow: pressed
          ? (primary ? "inset 2px 2px 6px rgba(0,0,0,0.3)" : "inset 2px 2px 8px rgba(0,0,0,0.4)")
          : (primary
            ? "4px 4px 16px rgba(0,212,170,0.25), -2px -2px 8px rgba(0,212,170,0.1), 0 0 40px rgba(0,212,170,0.15)"
            : "4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.03)"),
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        ...s,
      }}
    >{children}</button>
  );
}

// ─── Neumorphic Card ───
function NeuCard({ children, style: s, glow }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "linear-gradient(145deg, #12162099, #0d101a99)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${hover ? "rgba(0,212,170,0.2)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 20,
        padding: 32,
        boxShadow: hover
          ? `8px 8px 24px rgba(0,0,0,0.5), -4px -4px 12px rgba(255,255,255,0.02)${glow ? ", 0 0 60px rgba(0,212,170,0.08)" : ""}`
          : "6px 6px 20px rgba(0,0,0,0.4), -3px -3px 10px rgba(255,255,255,0.02)",
        transform: hover ? "translateY(-4px)" : "none",
        transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
        ...s,
      }}
    >{children}</div>
  );
}

// ─── Mini Dashboard Mockup ───
function DashboardMockup() {
  const bars = [35, 58, 42, 72, 55, 88, 65, 78, 50, 92, 70, 60, 82, 45, 75, 68, 85, 52, 90, 63];
  return (
    <div style={{
      background: "linear-gradient(160deg, #0F1219 0%, #0B0E14 100%)",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
      boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 120px rgba(0,212,170,0.06)",
      width: "100%",
      maxWidth: 800,
    }}>
      {/* Title bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
        <span style={{ marginLeft: 12, fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>CryptoLens — Derivatives Terminal</span>
      </div>
      {/* Dashboard Content */}
      <div style={{ padding: 20 }}>
        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "BTC Funding", value: "+0.0142%", color: "#10B981", sub: "8h avg" },
            { label: "Aggregate OI", value: "$18.4B", color: "#3B82F6", sub: "+4.2% 24h" },
            { label: "Liquidations 24h", value: "$284M", color: "#F59E0B", sub: "62% longs" },
            { label: "Basis Ann.", value: "12.8%", color: "#8B5CF6", sub: "perp vs spot" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.02)",
              borderRadius: 10,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "#475569", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{s.sub}</div>
            </div>
          ))}
        </div>
        {/* Chart Area */}
        <div style={{ background: "rgba(255,255,255,0.015)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#E2E8F0" }}>BTC/USDT</span>
              <span style={{ fontSize: 11, color: "#10B981", fontFamily: "'JetBrains Mono', monospace" }}>$67,842</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["1H", "4H", "1D"].map(tf => (
                <span key={tf} style={{
                  fontSize: 9, padding: "3px 8px", borderRadius: 6,
                  background: tf === "4H" ? "rgba(0,212,170,0.15)" : "rgba(255,255,255,0.04)",
                  color: tf === "4H" ? "#00D4AA" : "#64748B",
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                }}>{tf}</span>
              ))}
            </div>
          </div>
          {/* Fake candlestick bars */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${h}%`,
                background: i % 3 === 0
                  ? "linear-gradient(180deg, #EF4444 0%, #EF444444 100%)"
                  : "linear-gradient(180deg, #10B981 0%, #10B98144 100%)",
                borderRadius: 2,
                animation: `barGrow 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
              }} />
            ))}
          </div>
          {/* Funding overlay line */}
          <svg width="100%" height="30" viewBox="0 0 400 30" preserveAspectRatio="none" style={{ marginTop: 8 }}>
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

// ─── Main Landing Page ───
export default function CryptoLensLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleMouse = (e) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div style={{
      background: "#0B0E14",
      color: "#E2E8F0",
      fontFamily: "'Satoshi', 'General Sans', -apple-system, sans-serif",
      overflowX: "hidden",
      minHeight: "100vh",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        @keyframes heroGlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotateX(8deg) rotateY(-4deg); }
          50% { transform: translateY(-16px) rotateX(6deg) rotateY(-2deg); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,170,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(0,212,170,0); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes textShimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }

        .shimmer-text {
          background: linear-gradient(90deg, #E2E8F0 0%, #00D4AA 25%, #3B82F6 50%, #00D4AA 75%, #E2E8F0 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: textShimmer 6s linear infinite;
        }
      `}</style>

      {/* ═══ AMBIENT BACKGROUND ═══ */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* Primary orb */}
        <div style={{
          position: "absolute",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,212,170,0.12) 0%, transparent 70%)",
          top: `${20 + mousePos.y * 10}%`,
          left: `${30 + mousePos.x * 15}%`,
          transform: "translate(-50%, -50%)",
          filter: "blur(80px)",
          animation: "orbFloat 12s ease-in-out infinite",
          transition: "top 2s ease, left 2s ease",
        }} />
        {/* Secondary orb */}
        <div style={{
          position: "absolute",
          width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          top: "60%", right: "10%",
          filter: "blur(60px)",
          animation: "orbFloat 16s ease-in-out infinite reverse",
        }} />
        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          opacity: 0.5,
        }} />
        {/* Noise texture */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* ═══ NAV ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrollY > 50 ? "rgba(11,14,20,0.85)" : "transparent",
        backdropFilter: scrollY > 50 ? "blur(20px) saturate(1.2)" : "none",
        borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
        transition: "all 0.4s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: "linear-gradient(135deg, #00D4AA, #00B894)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(0,212,170,0.3)",
            fontSize: 16, fontWeight: 900, color: "#0B0E14",
          }}>◆</div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "'Outfit', sans-serif" }}>
            CryptoLens
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "Analytics", "Pricing", "Docs"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} style={{
              color: "#94A3B8", fontSize: 13, fontWeight: 500, textDecoration: "none",
              letterSpacing: "0.01em",
              transition: "color 0.2s",
            }} onMouseEnter={e => e.target.style.color = "#E2E8F0"} onMouseLeave={e => e.target.style.color = "#94A3B8"}>{item}</a>
          ))}
          <NeuButton primary style={{ padding: "10px 24px", fontSize: 13, borderRadius: 10 }}>
            Launch Terminal
          </NeuButton>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{
        minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "120px 40px 60px",
        position: "relative", zIndex: 1,
        textAlign: "center",
      }}>
        {/* Green arc glow */}
        <div style={{
          position: "absolute",
          top: -200, left: "50%", transform: "translateX(-50%)",
          width: 1200, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,212,170,0.15) 0%, transparent 60%)",
          filter: "blur(40px)",
          animation: "heroGlow 6s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        {/* Badge */}
        <div style={{
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s both",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(145deg, rgba(0,212,170,0.12), rgba(0,212,170,0.04))",
            border: "1px solid rgba(0,212,170,0.2)",
            borderRadius: 100, padding: "8px 20px",
            fontSize: 12, fontWeight: 600, color: "#00D4AA",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.05em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4AA", animation: "pulse 2s infinite" }} />
            DERIVATIVES INTELLIGENCE
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(40px, 7vw, 82px)",
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: "-0.04em",
          fontFamily: "'Outfit', sans-serif",
          marginTop: 28,
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s both",
        }}>
          <span style={{ color: "#F1F5F9" }}>See Through</span><br />
          <span style={{ color: "#F1F5F9" }}>The Market</span>{" "}
          <span className="shimmer-text">Noise</span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          color: "#94A3B8",
          maxWidth: 560,
          lineHeight: 1.6,
          marginTop: 24,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.6s both",
        }}>
          Funding rates. Open interest. Liquidation clusters. Basis analysis.
          One terminal for every derivatives signal that matters.
        </p>

        {/* CTA Buttons */}
        <div style={{
          display: "flex", gap: 16, marginTop: 40,
          animation: "fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.8s both",
        }}>
          <NeuButton primary>Get Started Free</NeuButton>
          <NeuButton>View Demo</NeuButton>
        </div>

        {/* Floating Dashboard */}
        <div style={{
          marginTop: 70,
          perspective: "1200px",
          width: "100%",
          maxWidth: 840,
          animation: "fadeInUp 1s cubic-bezier(0.16,1,0.3,1) 1s both",
        }}>
          <div style={{ animation: "float 8s ease-in-out infinite", transformStyle: "preserve-3d" }}>
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section style={{
        padding: "60px 40px",
        position: "relative", zIndex: 1,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 40 }}>
          {[
            { value: 20, suffix: "+", label: "Assets Tracked" },
            { value: 500, suffix: "ms", label: "Data Latency", prefix: "<" },
            { value: 14, suffix: "", label: "Data Sources" },
            { value: 99, suffix: "%", label: "Uptime Target" },
          ].map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 48, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "-0.04em",
                  background: "linear-gradient(135deg, #00D4AA, #3B82F6)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  <Counter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 6, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase" }}>{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: "100px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#00D4AA", letterSpacing: "0.15em",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace",
              }}>Core Modules</span>
              <h2 style={{
                fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800,
                fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.03em",
                marginTop: 12, color: "#F1F5F9",
              }}>
                Every Signal.<br />One Terminal.
              </h2>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {[
              {
                icon: "⚡", title: "Funding Intelligence",
                desc: "Real-time funding rates across all major exchanges. Z-score normalization, regime detection, and annualized carry calculations surface when positioning is crowded.",
                color: "#10B981",
              },
              {
                icon: "📊", title: "Open Interest Dynamics",
                desc: "Aggregate OI broken down by exchange. Momentum tracking, price divergence alerts, and OI-weighted funding show you where leverage is building.",
                color: "#3B82F6",
              },
              {
                icon: "🔥", title: "Liquidation Engine",
                desc: "Live liquidation feed with cumulative volume charts. See whether longs or shorts are getting flushed and identify cluster zones before they trigger.",
                color: "#F59E0B",
              },
              {
                icon: "📐", title: "Basis Analysis",
                desc: "Perp-to-spot basis across exchanges, annualized yield calculations, and historical basis curves. Know when the market is paying premium for leverage.",
                color: "#8B5CF6",
              },
              {
                icon: "🎯", title: "Derivatives Health Score",
                desc: "Composite metric synthesizing funding, OI, liquidations, and basis into a single regime signal. Risk-on, risk-off, or neutral — at a glance.",
                color: "#EC4899",
              },
              {
                icon: "🔍", title: "Cross-Asset Screener",
                desc: "Rank 20+ assets by every derivatives metric simultaneously. Heatmap view, sortable columns, and quick-switch to any asset's full analytics workspace.",
                color: "#00D4AA",
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <NeuCard glow>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `linear-gradient(135deg, ${f.color}18, ${f.color}08)`,
                    border: `1px solid ${f.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, marginBottom: 18,
                    boxShadow: `0 0 30px ${f.color}10`,
                  }}>{f.icon}</div>
                  <h3 style={{
                    fontSize: 18, fontWeight: 700, color: "#F1F5F9",
                    fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.02em",
                    marginBottom: 10,
                  }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65, fontWeight: 400 }}>{f.desc}</p>
                </NeuCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TECH STRIP ═══ */}
      <section style={{
        padding: "80px 40px",
        position: "relative", zIndex: 1,
        background: "linear-gradient(180deg, transparent, rgba(0,212,170,0.02), transparent)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.15em",
                textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace",
              }}>Built With</span>
            </div>
          </Reveal>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16 }}>
            {["Next.js", "FastAPI", "TimescaleDB", "Redis", "Binance WS", "CoinGlass", "WebSocket", "Python"].map((tech, i) => (
              <Reveal key={tech} delay={i * 0.06}>
                <div style={{
                  background: "linear-gradient(145deg, #13172099, #0e111c99)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  padding: "10px 22px",
                  fontSize: 13, fontWeight: 600, color: "#94A3B8",
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: "4px 4px 12px rgba(0,0,0,0.3), -2px -2px 6px rgba(255,255,255,0.02)",
                  letterSpacing: "-0.01em",
                }}>{tech}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section style={{
        padding: "100px 40px",
        position: "relative", zIndex: 1,
        textAlign: "center",
      }}>
        <Reveal>
          <div style={{
            maxWidth: 700, margin: "0 auto",
            background: "linear-gradient(145deg, #12162099, #0d101a99)",
            border: "1px solid rgba(0,212,170,0.1)",
            borderRadius: 28,
            padding: "64px 48px",
            boxShadow: "0 0 120px rgba(0,212,170,0.06), 12px 12px 40px rgba(0,0,0,0.4)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Glow accent */}
            <div style={{
              position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
              width: 300, height: 200,
              background: "radial-gradient(ellipse, rgba(0,212,170,0.12), transparent)",
              filter: "blur(40px)", pointerEvents: "none",
            }} />
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800,
              fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.03em",
              color: "#F1F5F9", marginBottom: 16, position: "relative",
            }}>
              Ready to See the<br />
              <span style={{ color: "#00D4AA" }}>Full Picture?</span>
            </h2>
            <p style={{ fontSize: 16, color: "#94A3B8", marginBottom: 36, lineHeight: 1.6, position: "relative" }}>
              Stop guessing. Start seeing funding regimes, liquidation pressure, and positioning data in one workspace.
            </p>
            <div style={{ position: "relative" }}>
              <NeuButton primary style={{ padding: "16px 48px", fontSize: 16, borderRadius: 14 }}>
                Launch CryptoLens
              </NeuButton>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        padding: "40px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        position: "relative", zIndex: 1,
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 8,
            background: "linear-gradient(135deg, #00D4AA, #00B894)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 900, color: "#0B0E14",
          }}>◆</div>
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", letterSpacing: "-0.02em" }}>CryptoLens</span>
        </div>
        <p style={{ fontSize: 12, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>
          Derivatives analytics terminal — Built 2026
        </p>
      </footer>
    </div>
  );
}
