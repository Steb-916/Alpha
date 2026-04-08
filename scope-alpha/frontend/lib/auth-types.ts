import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      displayName?: string | null;
      image?: string | null;
      role: string;
      slug?: string | null;
      // Phase 7: surface acceptance state to the client so modals can mount.
      tosAcceptedAt?: string | null;
      analystAgreementAcceptedAt?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    slug?: string | null;
    displayName?: string | null;
    // Phase 7
    jti?: string;
    tosAcceptedAt?: string | null;
    analystAgreementAcceptedAt?: string | null;
  }
}
