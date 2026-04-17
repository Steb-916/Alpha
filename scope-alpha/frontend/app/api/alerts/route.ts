import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

const ALERT_TYPES = [
  "funding_rate",
  "oi_change",
  "liquidation",
  "price",
  "basis",
  "cvd_divergence",
  "health_score",
  "arb_yield",
  "iv_above",
  "iv_below",
  "skew_extreme",
  "vrp_extreme",
  // Phase 4 — options microstructure
  "gamma_flip_crossed",
  "gex_regime_change",
  "flow_anomaly",
  "pin_risk_high",
] as const;
const CONDITIONS = [
  "above",
  "below",
  "crosses_above",
  "crosses_below",
  "change_exceeds",
] as const;
const DELIVERY_METHODS = ["in_app", "email", "telegram", "webhook"] as const;

type AlertType = (typeof ALERT_TYPES)[number];
type Condition = (typeof CONDITIONS)[number];
type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "true";
    const items = await prisma.alert.findMany({
      where: {
        userId: session.user.id,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/alerts GET",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to load alerts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const name = sanitizeText(body.name);
    const asset = typeof body.asset === "string" ? body.asset.toUpperCase() : "";
    const type = body.type as AlertType;
    const condition = body.condition as Condition;
    const value = typeof body.value === "number" ? body.value : Number.NaN;
    const timeframe = typeof body.timeframe === "string" ? body.timeframe : null;
    const deliveryMethod =
      typeof body.deliveryMethod === "string"
        ? (body.deliveryMethod as DeliveryMethod)
        : "in_app";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!asset) {
      return NextResponse.json({ error: "Asset is required" }, { status: 400 });
    }
    if (!ALERT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!CONDITIONS.includes(condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: "Value must be a number" }, { status: 400 });
    }
    if (!DELIVERY_METHODS.includes(deliveryMethod)) {
      return NextResponse.json(
        { error: "Invalid delivery method" },
        { status: 400 },
      );
    }

    const created = await prisma.alert.create({
      data: {
        userId: session.user.id,
        name,
        asset,
        type,
        condition,
        value,
        timeframe,
        deliveryMethod,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/alerts POST",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 },
    );
  }
}
