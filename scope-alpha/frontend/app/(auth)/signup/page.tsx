"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Auto-login after signup
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but login failed. Please sign in manually.");
      } else {
        router.push("/terminal/derivatives");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  return (
    <GlassCard className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1
          className="text-2xl font-bold font-display mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Create your account
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Start using the Scope Alpha analytics terminal
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
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none transition-colors"
            style={inputStyle}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-green)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--glass-border)")
            }
            placeholder="Your display name"
          />
        </div>

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
            style={inputStyle}
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
            minLength={8}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none transition-colors"
            style={inputStyle}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-green)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--glass-border)")
            }
            placeholder="Min 8 characters"
          />
        </div>

        <div>
          <label
            className="block text-xs font-bold font-body mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-[var(--radius-md)] text-sm font-body outline-none transition-colors"
            style={inputStyle}
            onFocus={(e) =>
              (e.target.style.borderColor = "var(--accent-green)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--glass-border)")
            }
            placeholder="Re-enter your password"
          />
        </div>

        <GlassButton
          variant="primary"
          size="lg"
          className="w-full"
          disabled={loading}
          onClick={() => {}}
        >
          {loading ? "Creating account..." : "Create Account"}
        </GlassButton>
      </form>

      <p
        className="mt-6 text-center text-sm font-body"
        style={{ color: "var(--text-secondary)" }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold hover:underline"
          style={{ color: "var(--accent-green)" }}
        >
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}
