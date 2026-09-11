import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/auth/audit";

/**
 * Auth.js is used specifically for the OAuth *handshake* (redirect to
 * Google/GitHub, exchange the code, verify the id token) — it is the
 * provider-abstraction layer the brief asks for, and adding a third OAuth
 * provider later is a matter of adding one entry to `providers`, reading
 * its client id/secret from the environment, with no other code changes.
 *
 * AuthForge intentionally does NOT use Auth.js's own session cookie as the
 * source of truth. Every other part of this app (session listing, "revoke
 * this device", session expiry) depends on a session being a real row in
 * the `Session` table that can be looked up and individually revoked — a
 * pure JWT session (Auth.js's default) can't support that without a
 * separate revocation list, which would just be this Session table again.
 * So: `signIn` event below creates a first-class AuthForge session (see
 * lib/auth/session.ts) as soon as the OAuth handshake succeeds, and that's
 * the cookie the rest of the app reads.
 *
 * Providers only activate when their env vars are present, so the app runs
 * fine with zero OAuth configured (email/password still works).
 */
const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await createSession({ userId: user.id });
      await logAuditEvent({
        event: "LOGIN_SUCCESS",
        actorId: user.id,
        actorLabel: user.email ?? user.id,
        metadata: { method: "oauth" },
      });
    },
  },
};
