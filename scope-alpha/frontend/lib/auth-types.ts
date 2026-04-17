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
      slug?: string | null;
      tosAcceptedAt?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    slug?: string | null;
    displayName?: string | null;
    jti?: string;
    tosAcceptedAt?: string | null;
  }
}
