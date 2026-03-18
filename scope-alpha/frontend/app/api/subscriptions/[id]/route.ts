import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/subscriptions/[id] — cancel subscription
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (subscription.subscriberId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "cancel") {
      // Cancel: access continues until period end
      const updated = await prisma.subscription.update({
        where: { id: params.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Update subscription error:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
