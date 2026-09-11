# AuthForge

A developer-first identity and authentication platform — the parts of "add auth to your product" that are tedious to build correctly and expensive to get wrong: sessions, organizations, RBAC, API keys, 2FA, and audit logging, built as one coherent Next.js + PostgreSQL backend.

This is a portfolio project demonstrating a production-shaped authentication service, not a wrapper around a third-party auth provider.

---

## Table of contents

1. [Architecture](#architecture)
2. [Authentication flow](#authentication-flow)
3. [Security decisions](#security-decisions)
4. [Database schema](#database-schema)
5. [API documentation](#api-documentation)
6. [Environment variables](#environment-variables)
7. [Local development](#local-development)
8. [Deployment](#deployment)
9. [Known limitations & extension points](#known-limitations--extension-points)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js App Router                                             │
│                                                                   │
│  Marketing / docs (SSR)     Dashboard (SSR + client islands)     │
│  ─────────────────────      ──────────────────────────────      │
│  /            /docs         /dashboard/*  (session-gated by      │
│  /demo                       middleware.ts + getCurrentSession)  │
│                                                                   │
│  ┌─────────────────────────── /api/* ────────────────────────┐  │
│  │  Route Handlers — every one: Zod-validated input,          │  │
│  │  session/permission check, Prisma query, audit log write   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  src/lib/                                                        │
│   ├─ auth/      session.ts, rbac.ts, two-factor.ts, tokens.ts,  │
│   │              api-keys.ts, audit.ts, challenge.ts,           │
│   │              next-auth-options.ts (OAuth handshake only)    │
│   ├─ security/  password.ts, crypto.ts, ip.ts, rate-limit.ts    │
│   ├─ validation.ts   (all Zod schemas, one file)                │
│   └─ prisma.ts, env.ts, email.ts, api-response.ts               │
└─────────────────────────────────────────────────────────────────┘
                              │
                       PostgreSQL (Prisma)
```

**Layering principle:** route handlers stay thin. They parse/validate input, call one or two functions from `src/lib/`, and shape a response. All actual logic — hashing, session creation, permission checks, audit writes — lives in `src/lib` so it's unit-testable independent of Next.js and can't drift between two routes that need the same behavior (e.g. every session-revoking action funnels through `revokeSession`/`revokeAllSessions` in `lib/auth/session.ts`).

**Why Auth.js only handles OAuth, not sessions:** Auth.js's default session strategy is a signed JWT held entirely client-side. That's fine until you need "show me all my devices and let me kill one" — a pure JWT has no server-side record to look up or invalidate. AuthForge needs that (session dashboard, "revoke this device", "revoke all others" after a password reset), so every session — password login, OAuth login, or 2FA-completed login — is a **row in the `Session` table**, looked up by an opaque cookie value. Auth.js is used purely for the OAuth redirect/token-exchange dance (`src/lib/auth/next-auth-options.ts`); once it succeeds, `events.signIn` immediately creates a first-class AuthForge session and that's the cookie the rest of the app reads. Adding a third OAuth provider is one entry in the `providers` array, activated only when its client id/secret env vars are present.

---

## Authentication flow

**Password login**
```
POST /api/auth/login  { email, password, rememberDevice }
  → rate limit (per-email AND per-IP) + brute-force lockout check
  → verify Argon2id hash
  → if 2FA disabled:  create Session row, set httpOnly cookie → done
  → if 2FA enabled:   issue a short-lived signed "challenge" JWT (5 min)
                       and return { twoFactorRequired: true, challengeToken }

POST /api/auth/2fa/verify  { challengeToken, code, isBackupCode }
  → verify challenge JWT → verify TOTP code (or consume a backup code)
  → create Session row, set httpOnly cookie → done
```

The challenge token is deliberately **not** a database row: a password-verified-but-not-yet-2FA-verified user isn't authenticated, so it shouldn't have a session. Encoding that intermediate state as a signed, short-lived, stateless JWT keeps the invariant "every row in `Session` is a fully authenticated session" simple everywhere else in the codebase.

**OAuth login (Google / GitHub)**
```
Browser → /api/auth/signin/google (Auth.js) → provider consent screen
  → /api/auth/callback/google → Auth.js verifies the token, upserts
    User + Account via PrismaAdapter → events.signIn fires
  → AuthForge creates a Session row + cookie, exactly like password login
```

**Registration**
```
POST /api/auth/register  { email, password, name }
  → Argon2id-hash password, create User
  → issue an email verification token (24h TTL, hash stored — raw token emailed)
  → POST /api/auth/verify-email { token } later confirms `emailVerified`
```

**Password reset**
```
POST /api/auth/forgot-password { email }
  → always returns the same message whether or not the account exists
    (prevents email enumeration); if it exists, emails a 1-hour reset link
POST /api/auth/reset-password { token, password }
  → re-hashes password, revokes EVERY existing session (a password reset
    is either a compromise-recovery action or a real compromise — either
    way, every other logged-in device should be forced to re-authenticate)
```

---

## Security decisions

| Concern | Decision | Where |
|---|---|---|
| Password storage | Argon2id, OWASP-recommended cost params. Never logged, never emailed. | `lib/security/password.ts` |
| Sessions | Opaque random token in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie; resolved server-side against a DB row on every request. | `lib/auth/session.ts` |
| CSRF | `SameSite=Lax` cookies block cross-site form/script submission for state-changing requests; all mutating routes are JSON `POST`/`PATCH`/`DELETE`, which browsers won't send cross-site with the session cookie attached under `Lax`. | cookie config in `session.ts` |
| Rate limiting | Per-email **and** per-IP buckets on login/register/reset, pluggable backend (Upstash Redis in prod, in-memory fallback for local dev). | `lib/security/rate-limit.ts` |
| Brute-force lockout | Independent of the rate limiter: after 10 failed logins on one account within 30 minutes, the account locks regardless of source IP (defeats IP-rotating attacks that a rate limiter alone can't catch). | `lib/security/rate-limit.ts`, `api/auth/login/route.ts` |
| Input validation | Every route parses its body/query through a Zod schema before touching the database; nothing trusts client-side validation. | `lib/validation.ts` |
| Authorization | Central RBAC permission matrix (`lib/auth/rbac.ts`); org-scoped routes call `requireOrgPermission` before doing anything. | `lib/auth/rbac.ts` |
| 2FA secret storage | AES-256-GCM, key derived from `AUTH_SECRET` via scrypt — recoverable (needed to verify codes), unlike a password hash. | `lib/security/crypto.ts` |
| Backup codes | Hashed with SHA-256 like a lookup token, single-use, shown exactly once. | `lib/auth/two-factor.ts` |
| API key secrets | Only a SHA-256 hash is stored; the full secret is returned in the HTTP response body **exactly once**, at creation time. | `lib/auth/api-keys.ts` |
| Session/2FA-downgrade actions | Changing password or disabling 2FA both require re-entering the current password even though the user already has a valid session. | `api/user/password`, `api/2fa/disable` |
| Audit trail | Every security-relevant action writes one `AuditLog` row (actor, event, IP abstraction, user agent, timestamp) through a single `logAuditEvent()` function, so the log can't drift from what actually happened. | `lib/auth/audit.ts` |
| IP/location | IPs are truncated (last octet zeroed for IPv4) before storage — a coarse network identifier, not a personally-identifying fingerprint. Geo-lookup is a documented stub, not a real third-party integration. | `lib/security/ip.ts` |

---

## Database schema

Full schema with inline design-rationale comments: [`prisma/schema.prisma`](./prisma/schema.prisma). Summary:

- **Identity** — `User`, `Account` (OAuth links, Auth.js shape), `Session` (server-side, revocable), `VerificationToken`, `PasswordResetToken`.
- **2FA** — `TwoFactor` (encrypted TOTP secret), `BackupCode` (hashed, single-use).
- **Organizations & RBAC** — `Organization`, `OrganizationMember` (join table carrying a `RoleKey`: `OWNER` / `ADMIN` / `MEMBER` / `VIEWER`), `Permission` (optional fine-grained catalogue for future custom roles).
- **Developer surface** — `Application` (a registered consumer app with `clientId`/hashed `clientSecret`), `ApiKey` (hashed secret, non-secret `prefix` for display).
- **Audit/security** — `AuditLog` (human-facing, append-only, denormalized actor label so history survives a deleted user), `SecurityEvent` (lower-level telemetry feeding brute-force lockout).

Design choices worth calling out:
- Sessions are a **table**, not just JWT claims — see [Architecture](#architecture).
- `AuditLog.actorLabel` is a denormalized snapshot (email at time of event), not just a foreign key, so the log stays meaningful even if the account is later deleted.
- `ApiKey`/`Application` store only hashes of their secrets — the schema makes it structurally impossible to leak a plaintext secret via a database dump or a stray `SELECT *`.

---

## API documentation

A full endpoint reference (method, path, auth requirement, request/response shape) is rendered at **`/docs`** once the app is running, and is generated from a single source list in `src/app/docs/page.tsx`. Highlights:

- `POST /api/auth/register`, `/login`, `/auth/2fa/verify`, `/logout`, `/forgot-password`, `/reset-password`, `/verify-email`
- `GET /api/user` · `PATCH /api/user/password`
- `GET /api/sessions` · `DELETE /api/sessions` (revoke others) · `DELETE /api/sessions/:id`
- `POST /api/2fa/setup` · `/confirm` · `/disable` · `/backup-codes`
- `GET|POST /api/organizations` · `GET|POST /api/organizations/:id/members` · `PATCH|DELETE .../members/:memberId`
- `GET|POST /api/api-keys` · `DELETE /api/api-keys/:id`
- `GET|POST /api/applications`
- `GET /api/audit-logs?organizationId=&cursor=&limit=`
- `GET /api/demo` — example endpoint protected by an AuthForge API key (`Authorization: Bearer af_live_...`), used by the `/demo` page.

---

## Environment variables

See [`.env.example`](./.env.example) for the full, commented list. Nothing is hardcoded — `src/lib/env.ts` validates every value with Zod at boot. Minimum to run locally: `DATABASE_URL` and a 32+ character `AUTH_SECRET`. OAuth, Redis-backed rate limiting, and real email delivery are all optional and degrade gracefully (OAuth buttons simply aren't wired up without provider credentials; rate limiting falls back to in-memory; emails log to the console).

---

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL (a local Postgres works fine) and AUTH_SECRET:
#   openssl rand -base64 48

npm install
npx prisma generate
npx prisma db push        # or: npm run db:migrate
npm run db:seed           # optional — creates demo@authforge.dev / Password123!

npm run dev                # http://localhost:3000
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run db:studio` (Prisma Studio, a GUI over your local database).

> **Note on this build:** this codebase was generated in a sandboxed environment whose network egress does not allow downloading Prisma's query-engine binary (`binaries.prisma.sh`), so `npx prisma generate` / `npm run typecheck` could not be executed here as a final automated pass. The code was reviewed manually instead. Run `npm install && npx prisma generate && npm run typecheck` as your first step after unpacking this project — that combination works normally on a standard machine with internet access, and will catch anything a human reviewer might have missed.

---

## Deployment

1. Provision PostgreSQL (Neon, Supabase, RDS, Railway, etc.) and set `DATABASE_URL`.
2. Set `AUTH_SECRET` (32+ random characters — do not reuse the local dev value) and `APP_URL`/`NEXTAUTH_URL` to your production domain.
3. Optionally configure `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (redirect URI: `{APP_URL}/api/auth/callback/{provider}`), `UPSTASH_REDIS_REST_URL`/`_TOKEN` for shared rate limiting across instances, and `RESEND_API_KEY`/`EMAIL_FROM` for real email delivery.
4. `npx prisma migrate deploy` against production, then deploy the Next.js app (Vercel, Fly.io, a container — no platform-specific code is used).
5. Rotate `AUTH_SECRET` by setting the old value as `AUTH_SECRET_PREVIOUS` during the overlap window (session cookies signed under the old secret continue to validate until they naturally expire).

---

## Known limitations & extension points

Documented honestly rather than hidden:

- **Rate limiting** falls back to an in-memory counter without Upstash configured — fine for local dev, *not* safe across multiple production instances (state isn't shared). Configure Upstash for production.
- **Geo-IP** (`lib/security/ip.ts`) is a stub that returns a placeholder string, not a real MaxMind/ipapi integration — swapping in a real provider is one function.
- **Email delivery** logs to the console without `RESEND_API_KEY` configured — fine for developing the verification/reset flows locally, not for production.
- **Fine-grained custom permissions**: the `Permission` model exists in the schema as an extension point, but authorization currently checks the four built-in `RoleKey` roles against a hardcoded matrix (`lib/auth/rbac.ts`) rather than reading custom per-org permission grants from that table.
- **Organization invites** require the invitee to already have an AuthForge account; inviting an email with no account returns a clear error rather than sending a signup invite — the next step for a real product.
- **CSRF**: relies on `SameSite=Lax` cookies plus JSON-only mutating endpoints (no `<form>`-based cross-site submission is possible against a JSON body). A double-submit CSRF token is a reasonable next hardening step if the API is ever consumed from a context where `SameSite=Lax` isn't sufficient (e.g. a top-level cross-site redirect flow).
