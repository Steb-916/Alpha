import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeSignal } from "@/lib/signals/serializer";

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

    // Get recent signals (excluding drafts — drafts are private to the analyst).
    // Phase 4: include the targets relation so the serializer can return
    // a uniform multi-target shape (synthesizing TP1 for legacy single-target).
    const signals = await prisma.signal.findMany({
      where: {
        analystId: user.id,
        status: { not: "draft" },
      },
      include: { targets: { orderBy: { order: "asc" } } },
      orderBy: { publishedAt: "desc" },
      take: 20,
    });

    const serializedSignals = signals.map(serializeSignal);

    const perf = user.analystPerformance;

    // Phase 6: include follower count.
    const followerCount = await prisma.follow.count({
      where: { analystId: user.id },
    });

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
            // Phase 4: drawdown fields
            maxDrawdownPct: perf.maxDrawdownPct ?? null,
            currentDrawdownPct: perf.currentDrawdownPct ?? null,
            maxDrawdownDate: perf.maxDrawdownDate ? perf.maxDrawdownDate.toISOString() : null,
          }
        : null,
      signals: serializedSignals,
      // Phase 6
      followerCount,
    });
  } catch (error) {
    console.error("Analyst profile error:", error);
    return NextResponse.json(
      { error: "Failed to load analyst profile" },
      { status: 500 }
    );
  }
}
