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
        "bg-primary": "var(--bg-base)",
        "bg-surface": "var(--glass-bg)",
        "bg-elevated": "var(--glass-bg-hover)",
        "bg-card": "var(--glass-bg)",
        "border-subtle": "var(--border-subtle)",
        "border-medium": "var(--border-medium)",
        "border-accent": "var(--border-accent)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "text-dim": "var(--text-dim)",
        "accent-green": "var(--accent-green)",
        "accent-green-dim": "var(--accent-green-dim)",
        "accent-blue": "var(--accent-blue)",
        "accent-yellow": "var(--accent-yellow)",
        "accent-red": "var(--accent-red)",
        "accent-purple": "var(--accent-purple)",
        "accent-pink": "var(--accent-pink)",
        positive: "var(--positive)",
        negative: "var(--negative)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["Satoshi", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        "glass-hover": "var(--glass-shadow-hover)",
        "glass-pressed": "var(--glass-shadow-pressed)",
        "glow-green": "0 0 40px var(--accent-green-glow)",
        "glow-blue": "0 0 40px var(--accent-blue-glow)",
        raised: "var(--glass-shadow)",
        pressed: "var(--glass-shadow-pressed)",
        "card-hover": "var(--glass-shadow-hover)",
      },
      backdropBlur: {
        glass: "50px",
        "glass-heavy": "80px",
      },
    },
  },
  plugins: [],
};
export default config;
