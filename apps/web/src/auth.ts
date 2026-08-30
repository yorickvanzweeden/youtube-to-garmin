import type { DefaultSession } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getEnv } from "./env";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();

  return {
    secret: env.authSecret,
    providers: [
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
            googleSub: profile.sub,
          };
        },
      }),
    ],
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== "google" || !profile?.sub) return false;
        if (env.allowedGoogleSub) return profile.sub === env.allowedGoogleSub;
        return Boolean(
          env.bootstrapGoogleEmail &&
            profile.email?.toLowerCase() ===
              env.bootstrapGoogleEmail.toLowerCase(),
        );
      },
      jwt({ token, profile }) {
        if (profile?.sub)
          (token as Record<string, unknown>).googleSub = profile.sub;
        return token;
      },
      session({ session, token }) {
        const googleSub = (token as Record<string, unknown>).googleSub;
        if (session.user && typeof googleSub === "string")
          session.user.googleSub = googleSub;
        return session;
      },
    },
  };
});

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { googleSub?: string };
  }
  interface User {
    googleSub?: string;
  }
}
