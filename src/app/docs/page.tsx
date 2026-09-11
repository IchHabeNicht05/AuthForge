import Link from "next/link";
import { Logo } from "@/components/logo";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  body?: string;
  response?: string;
}

const ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: "Authentication",
    items: [
      {
        method: "POST",
        path: "/api/auth/register",
        description: "Create an account with email + password. Sends a verification email.",
        auth: "None",
        body: `{ "email": "jane@acme.dev", "password": "••••••••••", "name": "Jane" }`,
      },
      {
        method: "POST",
        path: "/api/auth/login",
        description: "Sign in with email + password. Returns a 2FA challenge token if 2FA is enabled.",
        auth: "None",
        body: `{ "email": "jane@acme.dev", "password": "••••••••••", "rememberDevice": false }`,
        response: `{ "twoFactorRequired": false, "userId": "...", "sessionId": "..." }`,
      },
      {
        method: "POST",
        path: "/api/auth/2fa/verify",
        description: "Completes login after a 2FA challenge (TOTP code or backup code).",
        auth: "Challenge token",
        body: `{ "challengeToken": "...", "code": "123456", "isBackupCode": false }`,
      },
      { method: "POST", path: "/api/auth/logout", description: "Ends the current session.", auth: "Session cookie" },
      {
        method: "POST",
        path: "/api/auth/forgot-password",
        description: "Requests a password reset email. Always returns 200 to avoid email enumeration.",
        auth: "None",
        body: `{ "email": "jane@acme.dev" }`,
      },
      {
        method: "POST",
        path: "/api/auth/reset-password",
        description: "Sets a new password from a reset token and revokes all existing sessions.",
        auth: "Reset token",
        body: `{ "token": "...", "password": "••••••••••" }`,
      },
      {
        method: "POST",
        path: "/api/auth/verify-email",
        description: "Confirms an email address from a verification token.",
        auth: "Verification token",
        body: `{ "token": "..." }`,
      },
    ],
  },
  {
    group: "User & sessions",
    items: [
      { method: "GET", path: "/api/user", description: "Returns the current authenticated user.", auth: "Session cookie" },
      {
        method: "PATCH",
        path: "/api/user/password",
        description: "Changes the account password; revokes every other session.",
        auth: "Session cookie",
        body: `{ "currentPassword": "...", "newPassword": "..." }`,
      },
      { method: "GET", path: "/api/sessions", description: "Lists active sessions/devices for the current user.", auth: "Session cookie" },
      { method: "DELETE", path: "/api/sessions", description: "Revokes every session except the caller's.", auth: "Session cookie" },
      { method: "DELETE", path: "/api/sessions/:id", description: "Revokes one specific session.", auth: "Session cookie" },
    ],
  },
  {
    group: "Two-factor authentication",
    items: [
      { method: "POST", path: "/api/2fa/setup", description: "Generates a new TOTP secret + QR code.", auth: "Session cookie" },
      {
        method: "POST",
        path: "/api/2fa/confirm",
        description: "Confirms setup with a code and enables 2FA; returns backup codes once.",
        auth: "Session cookie",
        body: `{ "code": "123456" }`,
      },
      {
        method: "POST",
        path: "/api/2fa/disable",
        description: "Disables 2FA. Requires the account password.",
        auth: "Session cookie",
        body: `{ "currentPassword": "..." }`,
      },
      { method: "POST", path: "/api/2fa/backup-codes", description: "Regenerates backup codes.", auth: "Session cookie" },
    ],
  },
  {
    group: "Organizations",
    items: [
      { method: "GET", path: "/api/organizations", description: "Lists organizations the user belongs to.", auth: "Session cookie" },
      {
        method: "POST",
        path: "/api/organizations",
        description: "Creates an organization; caller becomes Owner.",
        auth: "Session cookie",
        body: `{ "name": "Acme Inc.", "slug": "acme-inc" }`,
      },
      { method: "GET", path: "/api/organizations/:id/members", description: "Lists members and roles.", auth: "Org membership" },
      {
        method: "POST",
        path: "/api/organizations/:id/members",
        description: "Invites an existing AuthForge user. Requires members:invite.",
        auth: "Org permission",
        body: `{ "email": "new@acme.dev", "role": "MEMBER" }`,
      },
      {
        method: "PATCH",
        path: "/api/organizations/:id/members/:memberId",
        description: "Changes a member's role. Requires members:change_role.",
        auth: "Org permission",
        body: `{ "role": "ADMIN" }`,
      },
      {
        method: "DELETE",
        path: "/api/organizations/:id/members/:memberId",
        description: "Removes a member. Requires members:remove.",
        auth: "Org permission",
      },
    ],
  },
  {
    group: "API keys & applications",
    items: [
      { method: "GET", path: "/api/api-keys", description: "Lists the caller's API keys (prefix only, never the secret).", auth: "Session cookie" },
      {
        method: "POST",
        path: "/api/api-keys",
        description: "Creates an API key. The full secret is returned exactly once.",
        auth: "Session cookie",
        body: `{ "name": "My SaaS — production", "scopes": [], "expiresInDays": 365 }`,
      },
      { method: "DELETE", path: "/api/api-keys/:id", description: "Revokes an API key.", auth: "Session cookie" },
      { method: "GET", path: "/api/applications", description: "Lists registered applications.", auth: "Session cookie" },
      {
        method: "POST",
        path: "/api/applications",
        description: "Registers an application; returns a client ID and one-time client secret.",
        auth: "Session cookie",
        body: `{ "name": "My SaaS", "redirectUrls": [] }`,
      },
      {
        method: "GET",
        path: "/api/demo",
        description: "Example protected endpoint — authenticate with Authorization: Bearer af_live_...",
        auth: "API key",
      },
    ],
  },
  {
    group: "Audit log",
    items: [
      {
        method: "GET",
        path: "/api/audit-logs?organizationId=&cursor=&limit=",
        description: "Personal events by default; pass organizationId to view an org's log (requires audit_log:view).",
        auth: "Session cookie or org permission",
      },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="font-mono text-xs text-muted-foreground">API reference</span>
        </div>
      </header>

      <div className="container max-w-3xl py-16">
        <h1 className="text-3xl font-semibold tracking-tight">API reference</h1>
        <p className="mt-3 text-muted-foreground">
          All request/response bodies are JSON and validated server-side with Zod. Session-authenticated routes read the
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">authforge_session</code>
          httpOnly cookie automatically — no header needed from the browser.
        </p>

        <div className="mt-12 space-y-14">
          {ENDPOINTS.map((group) => (
            <section key={group.group}>
              <h2 className="text-lg font-semibold">{group.group}</h2>
              <div className="mt-4 space-y-4">
                {group.items.map((ep) => (
                  <div key={ep.method + ep.path} className="rounded-lg border border-border p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={ep.method === "GET" ? "outline" : ep.method === "DELETE" ? "destructive" : "accent"} className="font-mono">
                        {ep.method}
                      </Badge>
                      <code className="font-mono text-sm">{ep.path}</code>
                      <span className="ml-auto text-xs text-muted-foreground">{ep.auth}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{ep.description}</p>
                    {ep.body && <CodeBlock className="mt-3">{ep.body}</CodeBlock>}
                    {ep.response && <CodeBlock className="mt-3" label="response">{ep.response}</CodeBlock>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
