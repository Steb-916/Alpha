"use client";

/**
 * Trade journal page for an analyst.
 *
 * Subscriber-gated. The API returns 403 with code SUBSCRIPTION_REQUIRED
 * when the viewer is neither the owner nor an active subscriber.
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { TradeJournalTable } from "@/components/analytics/TradeJournalTable";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AnalystJournalPage({ params }: { params: { slug: string } }) {
  const { data: session } = useSession();
  const { data: analyst } = useSWR<{
    id: string;
    displayName: string;
    slug: string;
  }>(`/api/analysts/${params.slug}`, fetcher);

  // Probe the journal endpoint to see if we have access — fall back to a
  // paywall placeholder if not.
  const { data: journalProbe, error: journalError } = useSWR<unknown>(
    `/api/analysts/${params.slug}/journal?limit=1`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const isOwner = Boolean(session?.user?.id && analyst?.id === session.user.id);

  // SWR doesn't expose status codes, so we check the error/payload shape.
  const blocked =
    journalError ||
    (journalProbe &&
      typeof journalProbe === "object" &&
      (journalProbe as { code?: string }).code === "SUBSCRIPTION_REQUIRED");

  if (!analyst) {
    return (
      <div className="p-6">
        <div className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/analyst/${params.slug}`}
            className="text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            ← Back to {analyst.displayName}
          </Link>
          <h1
            className="text-2xl font-bold font-display mt-1"
            style={{ color: "var(--text-primary)" }}
          >
            Trade Journal
          </h1>
        </div>
      </div>

      {blocked && !isOwner ? (
        <GlassCard glow="green">
          <div className="text-center py-8">
            <div
              className="text-base font-bold font-display mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Subscribe to view {analyst.displayName}&apos;s trade journal
            </div>
            <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
              The full journal is available to active subscribers.
            </p>
            <Link
              href={`/analyst/${params.slug}`}
              className="inline-block mt-4 px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] cursor-pointer"
              style={{ background: "var(--accent-green)", color: "#fff" }}
            >
              View tiers →
            </Link>
          </div>
        </GlassCard>
      ) : (
        <TradeJournalTable slug={params.slug} isOwner={isOwner} />
      )}
    </div>
  );
}
