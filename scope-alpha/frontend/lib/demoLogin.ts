import { signIn } from "next-auth/react";

export async function loginAsDemo() {
  const result = await signIn("credentials", {
    email: "demo@scopealpha.com",
    password: "demo",
    demo: "true",
    redirect: false,
  });

  if (result?.ok) {
    window.location.href = "/terminal";
  } else {
    console.error("Demo login failed:", result?.error);
    // Fallback — try with redirect
    window.location.href = "/terminal";
  }
}
