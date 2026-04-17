import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Authenticated app shell. Session is optional — `/terminal/*` and `/tools/*`
 * are guest-accessible. The middleware still hard-redirects `/settings/*`
 * without a session, so we don't need to gate here.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.id;
  return <AppShell isGuest={isGuest}>{children}</AppShell>;
}
