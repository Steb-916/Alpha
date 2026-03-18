import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { MeshBackground } from "@/components/layout/MeshBackground";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Scope Alpha — Derivatives Terminal",
  description: "Real-time crypto derivatives analytics. Funding rates, open interest, liquidations, basis analysis — one terminal.",
};

export const viewport: Viewport = {
  themeColor: "#f0f2f5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('scope-alpha-state')||'{}');var th=(t.state&&t.state.theme)||'system';if(th==='system'){th=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',th)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }} suppressHydrationWarning>
        <MeshBackground />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
