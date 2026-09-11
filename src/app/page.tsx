import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  ScrollText,
  Fingerprint,
  Building2,
  Terminal,
  Lock,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#security", label: "Security" },
  { href: "#developers", label: "Developers" },
  { href: "#pricing", label: "Pricing" },
];

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Sessions that can be revoked",
    body: "Server-side session records, not just signed JWTs — list every active device and end any one of them instantly.",
  },
  {
    icon: Building2,
    title: "Organizations & RBAC",
    body: "Users belong to many organizations. Four built-in roles — Owner, Admin, Member, Viewer — enforced by one permission matrix.",
  },
  {
    icon: KeyRound,
    title: "API keys, shown once",
    body: "Generate scoped keys for server-to-server calls. The secret is displayed exactly once; only its hash is ever stored.",
  },
  {
    icon: ScrollText,
    title: "Audit log by default",
    body: "Every login, role change, and key rotation is recorded with actor, event, IP, user agent, and timestamp — queryable per user or org.",
  },
  {
    icon: ShieldCheck,
    title: "TOTP two-factor",
    body: "Standard authenticator-app 2FA with QR setup, single-use backup codes, and a documented recovery path.",
  },
  {
    icon: Terminal,
    title: "A real API, not just a UI",
    body: "Register, sessions, organizations, API keys, and audit logs are all REST endpoints with Zod-validated input.",
  },
];

const SECURITY_ITEMS = [
  "Passwords hashed with Argon2id — never stored, logged, or emailed in plain text",
  "httpOnly, SameSite cookies; sessions are opaque tokens resolved server-side",
  "Per-account and per-IP rate limiting on login, register, and password reset",
  "Automatic account lockout after repeated failed sign-ins, independent of IP",
  "CSRF protection on all state-changing requests",
  "Every input validated server-side with Zod — the client never decides what's valid",
  "Password reset revokes every existing session",
  "2FA secrets encrypted at rest (AES-256-GCM); backup codes hashed like passwords",
];

const PRICING = [
  {
    name: "Hobby",
    price: "$0",
    period: "/mo",
    description: "For side projects and evaluation.",
    features: ["Up to 1,000 monthly active users", "Email/password + OAuth", "Community support"],
  },
  {
    name: "Team",
    price: "$49",
    period: "/mo",
    description: "For products with real users.",
    features: ["Up to 25,000 MAU", "Organizations & RBAC", "Full audit log retention", "Priority support"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For platforms with compliance needs.",
    features: ["Unlimited MAU", "SSO / SCIM", "Custom audit log export", "Dedicated support"],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Start building</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid relative overflow-hidden border-b border-border">
        <div className="container grid gap-12 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
          <div>
            <Badge variant="outline" className="mb-6 font-mono">
              v1.0 — identity infrastructure
            </Badge>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Authentication your product can grow into.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Sessions, organizations, roles, API keys, and audit logs — the parts of auth that are
              tedious to build correctly and expensive to get wrong. AuthForge ships them as one
              coherent backend you control.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Create an account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">View the demo app</Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              Next.js · PostgreSQL · Prisma · Auth.js · Argon2 · Zod
            </p>
          </div>
          <CodeBlock label="terminal">{`$ curl https://api.authforge.dev/v1/auth/login \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@acme.dev","password":"••••••••••"}'

{
  "twoFactorRequired": false,
  "userId": "usr_9k2xQ1a3",
  "sessionId": "ses_p8y0F5m2"
}`}</CodeBlock>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border py-24">
        <div className="container">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight">Everything under one roof</h2>
            <p className="mt-3 text-muted-foreground">
              Not just login — the full lifecycle of an identity in a multi-tenant product.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6">
                <f.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="border-b border-border py-24">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <Lock className="h-5 w-5 text-accent" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Security isn&apos;t a checklist item here.
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Every principle below is enforced in the code, not just described in a security page.
            </p>
            <ul className="mt-8 space-y-3">
              {SECURITY_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <CodeBlock label="lib/security/password.ts">{`const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false; // never throw into an auth path
  }
}`}</CodeBlock>
        </div>
      </section>

      {/* Developer experience */}
      <section id="developers" className="border-b border-border py-24">
        <div className="container">
          <div className="max-w-xl">
            <Terminal className="h-5 w-5 text-accent" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Built for the terminal, not just the dashboard</h2>
            <p className="mt-3 text-muted-foreground">
              Register an application, get a client ID and secret, and every route below is live.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <CodeBlock label="POST /api/api-keys">{`{
  "name": "My SaaS — production",
  "scopes": ["users:read"],
  "expiresInDays": 365
}

// 201 Created
{
  "apiKey": { "id": "ak_3jL9", "prefix": "af_live_9k2xQ1a3" },
  "secret": "af_live_9k2xQ1a3f7Hh2Bv1..."  // shown once
}`}</CodeBlock>
            <CodeBlock label="GET /api/demo">{`curl https://your-app.dev/api/demo \\
  -H "Authorization: Bearer af_live_9k2xQ1a3..."

{
  "message": "Hello, jane@acme.dev. Authenticated with key \\"My SaaS — production\\".",
  "authenticatedAs": { "userId": "usr_9k2x", "email": "jane@acme.dev" }
}`}</CodeBlock>
          </div>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/docs">
                Read the API docs <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-3 text-muted-foreground">Mockup pricing for demonstration purposes.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PRICING.map((tier) => (
              <Card
                key={tier.name}
                className={tier.highlighted ? "relative border-accent shadow-[0_0_0_1px_hsl(var(--accent))]" : ""}
              >
                <div className="p-6">
                  {tier.highlighted && (
                    <Badge variant="accent" className="mb-4">
                      Most common
                    </Badge>
                  )}
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                  <p className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                  <ul className="mt-6 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-8 w-full" variant={tier.highlighted ? "accent" : "outline"}>
                    <Link href="/register">Get started</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <p className="font-mono text-xs text-muted-foreground">Portfolio project — not a production service.</p>
        </div>
      </footer>
    </div>
  );
}
