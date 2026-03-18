import type { Metadata } from "next";

// Dynamic metadata for analyst profiles
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const slug = params.slug;
  const displayName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return {
    title: `${displayName} — Analyst Profile | Scope Alpha`,
    description: `View ${displayName}'s verified trading performance, signals, and reviews on Scope Alpha. Auto-graded signals, real track record.`,
    openGraph: {
      title: `${displayName} — Verified Trading Analyst`,
      description: `Check out ${displayName}'s signal track record on Scope Alpha. Every signal timestamped, every result auto-graded.`,
      type: "profile",
      siteName: "Scope Alpha",
    },
    twitter: {
      card: "summary_large_image",
      title: `${displayName} on Scope Alpha`,
      description: `Verified trading signals and performance from ${displayName}`,
    },
  };
}

export default function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
