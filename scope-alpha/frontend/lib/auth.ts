import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
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
      },
      async authorize(credentials) {
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
          user.passwordHash,
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.name,
          image: user.avatar,
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
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.slug = dbUser.slug;
          token.displayName = dbUser.displayName;
          token.tosAcceptedAt = dbUser.tosAcceptedAt
            ? dbUser.tosAcceptedAt.toISOString()
            : null;
        }

        // Create a UserSession row + embed jti so the session can be revoked
        // later. Best-effort — DB hiccups must not block sign-in.
        try {
          const jti = randomUUID();
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

      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
        });
        if (dbUser) {
          token.slug = dbUser.slug;
          token.displayName = dbUser.displayName;
          token.tosAcceptedAt = dbUser.tosAcceptedAt
            ? dbUser.tosAcceptedAt.toISOString()
            : null;
        }
      }

      return token;
    },
    async session({ session, token }) {
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
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth] UserSession lookup failed (best-effort):", err);
          }
        }
      }

      if (session.user) {
        session.user.id = token.id;
        session.user.slug = token.slug;
        session.user.displayName = token.displayName;
        session.user.tosAcceptedAt = token.tosAcceptedAt;
      }
      return session;
    },
  },
};
