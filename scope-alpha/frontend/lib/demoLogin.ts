import { signIn } from "next-auth/react";

export async function loginAsDemo() {
  return signIn("credentials", {
    email: "demo@scopealpha.com",
    demo: "true",
    callbackUrl: "/terminal",
  });
}
