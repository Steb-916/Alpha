import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/analysts/[slug] — public analyst profile
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { slug: params.slug },
      include: {
        analystProfile: true,
        analystPerformance: true,
      },
    });

    if (!user || user.role !== "analyst") {
      return NextResponse.json({ error: "Analyst not found" }, { status: 404 });
    }

    // Get recent signals
    const signals = await prisma.signal.findMany({
      where: { analystId: user.id },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });

    const serializedSignals = signals.map((s) => ({
      ...s,
      entryPrice: Number(s.entryPrice),
      targetPrice: Number(s.targetPrice),
      stopLossPrice: Number(s.stopLossPrice),
      resolvedPrice: s.resolvedPrice ? Number(s.resolvedPrice) : null,
      resultPnlPercent: s.resultPnlPercent ? Number(s.resultPnlPercent) : null,
    }));

    const perf = user.analystPerformance;

    return NextResponse.json({
      id: user.id,
      slug: user.slug,
      displayName: user.displayName || user.name,
      avatarUrl: user.avatarUrl || user.image,
      bio: user.bio,
      socialLinks: user.socialLinks,
      profile: user.analystProfile
        ? {
            tagline: user.analystProfile.tagline,
            primaryAssets: user.analystProfile.primaryAssets,
            tradingStyle: user.analystProfile.tradingStyle,
            experienceYears: user.analystProfile.experienceYears,
            isAcceptingSubscribers: user.analystProfile.isAcceptingSubscribers,
          }
        : null,
      performance: perf
        ? {
            totalSignals: perf.totalSignals,
            winCount: perf.winCount,
            lossCount: perf.lossCount,
            winRate: perf.winRate ? Number(perf.winRate) : null,
            avgPnlPercent: perf.avgPnlPercent ? Number(perf.avgPnlPercent) : null,
            profitFactor: perf.profitFactor ? Number(perf.profitFactor) : null,
            avgRrRatio: perf.avgRrRatio ? Number(perf.avgRrRatio) : null,
            bestStreak: perf.bestStreak,
            worstStreak: perf.worstStreak,
            totalPnlPercent: perf.totalPnlPercent ? Number(perf.totalPnlPercent) : null,
            subscriberCount: perf.subscriberCount,
            avgRating: perf.avgRating ? Number(perf.avgRating) : null,
          }
        : null,
      signals: serializedSignals,
    });
  } catch (error) {
    console.error("Analyst profile error:", error);
    return NextResponse.json(
      { error: "Failed to load analyst profile" },
      { status: 500 }
    );
  }
}
