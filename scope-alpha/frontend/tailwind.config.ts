import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0B0E14",
        "bg-surface": "#0F1219",
        "bg-elevated": "#131620",
        "bg-card": "rgba(18, 22, 32, 0.6)",
        "border-subtle": "rgba(255, 255, 255, 0.05)",
        "border-medium": "rgba(255, 255, 255, 0.08)",
        "border-accent": "rgba(0, 212, 170, 0.2)",
        "text-primary": "#F1F5F9",
        "text-secondary": "#94A3B8",
        "text-muted": "#64748B",
        "text-dim": "#475569",
        "accent-green": "#00D4AA",
        "accent-green-dim": "#00B894",
        "accent-blue": "#3B82F6",
        "accent-yellow": "#F59E0B",
        "accent-red": "#EF4444",
        "accent-purple": "#8B5CF6",
        "accent-pink": "#EC4899",
        positive: "#10B981",
        negative: "#EF4444",
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
        body: ["Satoshi", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        raised: "4px 4px 16px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.03)",
        pressed: "inset 2px 2px 8px rgba(0,0,0,0.4)",
        "glow-green": "0 0 40px rgba(0,212,170,0.15)",
        "card-hover": "8px 8px 24px rgba(0,0,0,0.5), -4px -4px 12px rgba(255,255,255,0.02), 0 0 60px rgba(0,212,170,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
