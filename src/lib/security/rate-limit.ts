import { env } from "@/lib/env";

/**
 * Rate limiting / brute-force protection abstraction.
 *
 * A real production deployment needs a *shared* store (Redis/Upstash) so
 * limits are enforced across all server instances — a plain in-memory
 * counter only protects a single process. This module exposes one
 * interface, `RateLimiter`, with two implementations:
 *
 *   - `UpstashRateLimiter`  — used automatically when UPSTASH_REDIS_REST_URL
 *                             and UPSTASH_REDIS_REST_TOKEN are configured.
 *   - `InMemoryRateLimiter` — fallback for local development only. State is
 *                             lost on every restart/redeploy and is NOT
 *                             shared across serverless instances.
 *
 * Callers (login, register, password reset, 2FA verify) never talk to
 * either implementation directly — they call `checkRateLimit(bucket, key)`.
 */

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

interface RateLimiter {
  consume(bucket: string, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  async consume(bucket: string, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const compositeKey = `${bucket}:${key}`;
    const now = Date.now();
    const existing = this.hits.get(compositeKey);

    if (!existing || existing.resetAt < now) {
      const resetAt = now + windowSeconds * 1000;
      this.hits.set(compositeKey, { count: 1, resetAt });
      return { success: true, remaining: limit - 1, limit, resetAt: new Date(resetAt) };
    }

    existing.count += 1;
    const success = existing.count <= limit;
    return {
      success,
      remaining: Math.max(0, limit - existing.count),
      limit,
      resetAt: new Date(existing.resetAt),
    };
  }
}

class UpstashRateLimiter implements RateLimiter {
  constructor(private restUrl: string, private restToken: string) {}

  async consume(bucket: string, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    // Fixed-window counter implemented via Upstash's REST pipeline so this
    // module has zero dependency on the `@upstash/ratelimit` package —
    // easy to swap for a sliding-window algorithm later if needed.
    const compositeKey = `ratelimit:${bucket}:${key}`;
    const res = await fetch(`${this.restUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", compositeKey],
        ["EXPIRE", compositeKey, windowSeconds.toString(), "NX"],
      ]),
      cache: "no-store",
    });

    if (!res.ok) {
      // Fail open on infra errors rather than locking every user out.
      return { success: true, remaining: limit, limit, resetAt: new Date(Date.now() + windowSeconds * 1000) };
    }

    const [incrResult] = (await res.json()) as [{ result: number }];
    const count = incrResult.result;
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}

let limiterInstance: RateLimiter | null = null;
function getLimiter(): RateLimiter {
  if (limiterInstance) return limiterInstance;
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = env();
  limiterInstance =
    UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
      ? new UpstashRateLimiter(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
      : new InMemoryRateLimiter();
  return limiterInstance;
}

/** Named limit presets used across the auth flows. */
export const RATE_LIMITS = {
  LOGIN_PER_EMAIL: { bucket: "login:email", limit: 5, windowSeconds: 60 * 15 },
  LOGIN_PER_IP: { bucket: "login:ip", limit: 20, windowSeconds: 60 * 15 },
  REGISTER_PER_IP: { bucket: "register:ip", limit: 10, windowSeconds: 60 * 60 },
  PASSWORD_RESET_PER_EMAIL: { bucket: "pwreset:email", limit: 3, windowSeconds: 60 * 60 },
  TWO_FACTOR_VERIFY: { bucket: "2fa:verify", limit: 8, windowSeconds: 60 * 10 },
  API_KEY_CREATE: { bucket: "apikey:create", limit: 20, windowSeconds: 60 * 60 },
} as const;

export async function checkRateLimit(
  preset: { bucket: string; limit: number; windowSeconds: number },
  key: string,
): Promise<RateLimitResult> {
  return getLimiter().consume(preset.bucket, key, preset.limit, preset.windowSeconds);
}

/**
 * Brute-force protection abstraction, layered on top of rate limiting:
 * after too many *consecutive* failed logins for one account, the account
 * is temporarily locked regardless of which IP the attempts come from
 * (rate limiting alone is bypassed by rotating source IPs; a per-account
 * lock is not). Backed by the SecurityEvent table rather than the limiter
 * store so it survives across limiter backends and is auditable.
 */
export const ACCOUNT_LOCK_THRESHOLD = 10;
export const ACCOUNT_LOCK_WINDOW_MINUTES = 30;
