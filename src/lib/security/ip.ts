import { headers } from "next/headers";

/**
 * IP / location handling is deliberately an *abstraction*, not a real
 * geo-IP integration: shipping a MaxMind-style database or third-party geo
 * API key is out of scope for a portfolio project, and treating precise IPs
 * as a first-class stored field is a privacy liability. Swap
 * `resolveApproxLocation` for a real provider (ipapi, MaxMind GeoLite2,
 * Cloudflare's `cf-ipcountry` header, ...) in production.
 */

export function getRequestIp(): string | null {
  const h = headers();
  // Most platforms (Vercel, most reverse proxies) set one of these.
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp;
  return null;
}

/** Truncates an IP so the stored value is a coarse network identifier, not a precise fingerprint. */
export function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(".")) {
    // IPv4: zero out the last octet (e.g. 203.0.113.42 -> 203.0.113.0)
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(":")) {
    // IPv6: keep the first 4 groups only
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::";
  }
  return ip;
}

/**
 * Stubbed reverse-geocoding. Returns a deterministic placeholder rather than
 * calling out to a real geo-IP service. Replace the body with a real
 * provider call — the signature (IP in, "City, Country" string out) is the
 * contract the rest of the app relies on.
 */
export async function resolveApproxLocation(_ip: string | null): Promise<string | null> {
  if (!_ip) return null;
  return "Unknown location";
}

export function getUserAgent(): string | null {
  return headers().get("user-agent");
}
