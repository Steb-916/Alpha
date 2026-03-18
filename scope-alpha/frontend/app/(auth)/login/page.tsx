"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/terminal";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1
          className="text-2xl font-bold font-display mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Sign in to Scope Alpha
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Access your trading terminal
        </p>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-[var(--radius-sm)] text-sm"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--accent-red)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none transition-colors"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-green)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--glass-border)")
            }
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none transition-colors"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-green)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--glass-border)")
            }
            placeholder="Enter your password"
          />
        </div>

        <GlassButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={loading}
          onClick={() => {}}
        >
          {loading ? "Signing in..." : "Sign In"}
        </GlassButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div
          className="flex-1 h-px"
          style={{ background: "var(--glass-border)" }}
        />
        <span
          className="text-xs font-body"
          style={{ color: "var(--text-tertiary)" }}
        >
          or continue with
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--glass-border)" }}
        />
      </div>

      <GlassButton
        variant="ghost"
        size="md"
        className="w-full"
        onClick={() => signIn("google", { callbackUrl })}
      >
        <span className="flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </span>
      </GlassButton>

      <p
        className="mt-6 text-center text-sm font-body"
        style={{ color: "var(--text-secondary)" }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-bold hover:underline"
          style={{ color: "var(--accent-green)" }}
        >
          Sign up
        </Link>
      </p>
    </GlassCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
