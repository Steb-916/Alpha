import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/auth/demo — one-click demo login
// Creates demo user if needed, sets session cookie, redirects to /terminal
export async function GET() {
  try {
    // Find or create demo user
    let user = await prisma.user.findUnique({
      where: { email: "demo@scopealpha.com" },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "demo@scopealpha.com",
          displayName: "Demo User",
          slug: "demo",
          role: "analyst",
          bio: "Demo account for exploring Scope Alpha",
        },
      });

      // Create analyst profile
      await prisma.analystProfile.create({
        data: {
          userId: user.id,
          tagline: "Demo trading analyst",
          primaryAssets: ["BTC", "ETH", "SOL"],
          tradingStyle: "swing",
          experienceYears: 3,
          isAcceptingSubscribers: true,
        },
      });

      // Seed demo subscription tiers
      await prisma.subscriptionTier.createMany({
        data: [
          {
            analystId: user.id,
            name: "Basic",
            description: "Signals and annotations",
            priceUsd: 99,
            features: ["Trading signals", "Chart annotations", "Market analysis"],
            sortOrder: 0,
          },
          {
            analystId: user.id,
            name: "Pro",
            description: "Everything + chat access",
            priceUsd: 299,
            features: ["Everything in Basic", "Private chat access", "Priority alerts", "1-on-1 sessions"],
            sortOrder: 1,
          },
        ],
      });

      // Seed demo signals
      await prisma.signal.createMany({
        data: [
          {
            analystId: user.id,
            assetSymbol: "BTC",
            direction: "long",
            entryPrice: 65000,
            targetPrice: 72000,
            stopLossPrice: 62000,
            timeframe: "1D",
            conviction: "high",
            notes: "Bullish structure forming on the daily. Watching for a break above 68k resistance.",
            status: "active",
          },
          {
            analystId: user.id,
            assetSymbol: "ETH",
            direction: "short",
            entryPrice: 3600,
            targetPrice: 3200,
            stopLossPrice: 3800,
            timeframe: "4H",
            conviction: "medium",
            notes: "Bearish divergence on 4H RSI. Expecting retest of 3200 support.",
            status: "target_hit",
            resolvedPrice: 3200,
            resultPnlPercent: 11.11,
            resolvedAt: new Date(),
          },
          {
            analystId: user.id,
            assetSymbol: "SOL",
            direction: "long",
            entryPrice: 140,
            targetPrice: 165,
            stopLossPrice: 128,
            timeframe: "1D",
            conviction: "low",
            notes: "Speculative long on SOL breakout attempt.",
            status: "stopped_out",
            resolvedPrice: 128,
            resultPnlPercent: -8.57,
            resolvedAt: new Date(),
          },
        ],
      });

      // Seed demo announcements
      await prisma.announcement.createMany({
        data: [
          {
            analystId: user.id,
            title: "Weekly Market Update — March 2026",
            content: "BTC holding above key support at $64k. Watching for a decisive break above $68k to confirm bullish continuation.",
            isPinned: true,
          },
          {
            analystId: user.id,
            title: "New BTC signal posted",
            content: "Just published a new long signal on BTC. Check the signals panel for entry, target, and stop levels.",
            isPinned: false,
          },
        ],
      });

      // Seed demo performance
      await prisma.analystPerformance.create({
        data: {
          analystId: user.id,
          totalSignals: 47,
          winCount: 31,
          lossCount: 16,
          winRate: 65.96,
          avgPnlPercent: 4.82,
          profitFactor: 2.14,
          avgRrRatio: 2.35,
          bestStreak: 8,
          worstStreak: 3,
          totalPnlPercent: 226.54,
          last90dPnlPercent: 34.2,
          last90dWinRate: 68.0,
          subscriberCount: 142,
          avgRating: 4.7,
        },
      });
    }

    // Create JWT token manually
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const token = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.displayName || user.name,
        picture: user.avatarUrl || user.image,
        role: user.role,
        slug: user.slug,
        displayName: user.displayName,
        sub: user.id,
      },
      secret,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Determine cookie name — NextAuth uses __Secure- prefix in production
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    // Set the session cookie and redirect
    const response = NextResponse.redirect(
      new URL("/terminal", process.env.NEXTAUTH_URL || "http://localhost:3000")
    );

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Demo login error:", error);
    return NextResponse.json({ error: "Demo login failed" }, { status: 500 });
  }
}
