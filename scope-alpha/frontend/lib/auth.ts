import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import "./auth-types";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        demo: { label: "Demo", type: "text" },
      },
      async authorize(credentials) {
        // Demo bypass — auto-create and sign in as demo analyst
        if (credentials?.email === "demo@scopealpha.com" && credentials?.demo === "true") {
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
                  content: "BTC holding above key support at $64k. Watching for a decisive break above $68k to confirm bullish continuation. Funding rates remain neutral — no overheated positioning yet.",
                  isPinned: true,
                },
                {
                  analystId: user.id,
                  title: "New BTC signal posted",
                  content: "Just published a new long signal on BTC. Watching the 4H structure for confirmation. Check the signals panel for entry, target, and stop levels.",
                  isPinned: false,
                },
              ],
            });

            // Seed demo annotations
            await prisma.annotation.createMany({
              data: [
                {
                  analystId: user.id,
                  assetSymbol: "BTC",
                  annotationType: "horizontal_line",
                  data: { price: 68000, label: "Key Resistance", color: "#EF4444", lineStyle: "solid" },
                  timeframe: "1D",
                  isActive: true,
                },
                {
                  analystId: user.id,
                  assetSymbol: "ETH",
                  annotationType: "zone",
                  data: { priceTop: 3600, priceBottom: 3400, label: "Accumulation Zone", color: "#10B981", opacity: 0.15 },
                  timeframe: "4H",
                  isActive: true,
                },
                {
                  analystId: user.id,
                  assetSymbol: "BTC",
                  annotationType: "text_note",
                  data: { text: "Watch for breakout above this level", price: 67500, color: "#F59E0B" },
                  timeframe: "1D",
                  isActive: true,
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

          return {
            id: user.id,
            email: user.email,
            name: user.displayName || user.name,
            image: user.avatarUrl || user.image,
          };
        }

        // Normal email/password flow
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Update last active
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.name,
          image: user.avatarUrl || user.image,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign in, add user data to token
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.slug = dbUser.slug;
          token.displayName = dbUser.displayName;
          token.tosAcceptedAt = dbUser.tosAcceptedAt
            ? dbUser.tosAcceptedAt.toISOString()
            : null;
          token.analystAgreementAcceptedAt = dbUser.analystAgreementAcceptedAt
            ? dbUser.analystAgreementAcceptedAt.toISOString()
            : null;
        }

        // Phase 7: create a UserSession row + embed jti so the session can
        // be revoked later. Best-effort — failure here must NOT block sign-in
        // (demo mode, DB hiccups).
        try {
          const jti =
            globalThis.crypto && "randomUUID" in globalThis.crypto
              ? globalThis.crypto.randomUUID()
              : `jti_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          await prisma.userSession.create({
            data: {
              userId: dbUser?.id ?? user.id,
              token: jti,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          token.jti = jti;
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth] UserSession create failed (best-effort):", err);
          }
        }
      }

      // When session is updated (e.g., after role change or accepting ToS),
      // refresh the gating fields from DB.
      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.slug = dbUser.slug;
          token.displayName = dbUser.displayName;
          token.tosAcceptedAt = dbUser.tosAcceptedAt
            ? dbUser.tosAcceptedAt.toISOString()
            : null;
          token.analystAgreementAcceptedAt = dbUser.analystAgreementAcceptedAt
            ? dbUser.analystAgreementAcceptedAt.toISOString()
            : null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Phase 7: best-effort session revocation check.
      // - missing UserSession row → pass through (legacy JWTs, demo flow)
      // - row exists with revokedAt set → throw to invalidate the JWT
      if (token.jti) {
        try {
          const userSession = await prisma.userSession.findUnique({
            where: { token: token.jti },
            select: { revokedAt: true },
          });
          if (userSession && userSession.revokedAt) {
            throw new Error("Session revoked");
          }
          if (userSession) {
            // Fire-and-forget lastActive bump.
            prisma.userSession
              .update({
                where: { token: token.jti },
                data: { lastActive: new Date() },
              })
              .catch(() => {
                /* best-effort */
              });
          }
        } catch (err) {
          if ((err as Error).message === "Session revoked") throw err;
          // Any other DB error → silently pass through, don't lock real users out
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth] UserSession lookup failed (best-effort):", err);
          }
        }
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.slug = token.slug;
        session.user.displayName = token.displayName;
        session.user.tosAcceptedAt = token.tosAcceptedAt;
        session.user.analystAgreementAcceptedAt = token.analystAgreementAcceptedAt;
      }
      return session;
    },
  },
};
