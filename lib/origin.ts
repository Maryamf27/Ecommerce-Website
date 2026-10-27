/**
 * Origin (CSRF) validation for state-changing requests.
 *
 * The allowed origins come ONLY from server-side configuration, never from request
 * headers such as Host / X-Forwarded-Host / X-Forwarded-Proto, which a client can spoof:
 *
 *  1. `APP_ORIGIN` - one exact origin or a comma-separated list of exact origins
 *     (scheme + host [+ port], e.g. `https://shop.example.com`). No wildcards.
 *  2. Vercel system variables, which the platform sets for each deployment and which a
 *     request cannot influence:
 *       - `VERCEL_PROJECT_PRODUCTION_URL` on production deployments,
 *       - `VERCEL_URL` / `VERCEL_BRANCH_URL` on preview deployments, but ONLY when
 *         `APP_ALLOW_VERCEL_PREVIEW=true` is set (opt-in).
 *
 * Outside production (local development) the request's own origin is accepted when
 * nothing is configured, matching the previous behaviour.
 */

export type OriginEnv = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Returns the normalized origin for a configured value, or null when it is not acceptable. */
export function normalizeConfiguredOrigin(value: string, production: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try { url = new URL(trimmed); } catch { return null; }
  if (url.username || url.password) return null;
  if (url.protocol === "https:") return url.origin;
  // Plain HTTP is only meaningful for a loopback host (e.g. `next start` on a laptop).
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return url.origin;
  // In development any http(s) origin is tolerated so LAN testing keeps working.
  if (!production && url.protocol === "http:") return url.origin;
  return null;
}

function hostToOrigin(host: string | undefined, production: boolean): string | null {
  const value = host?.trim();
  if (!value || value.includes("/") || value.includes("@") || /\s/.test(value)) return null;
  return normalizeConfiguredOrigin(`https://${value}`, production);
}

/** All origins the server is configured to trust (normalized, de-duplicated). */
export function getAllowedOrigins(env: OriginEnv): string[] {
  const production = env.NODE_ENV === "production";
  const origins = new Set<string>();

  for (const entry of (env.APP_ORIGIN ?? "").split(",")) {
    const origin = normalizeConfiguredOrigin(entry, production);
    if (origin) origins.add(origin);
  }

  if (env.VERCEL_ENV === "production") {
    const origin = hostToOrigin(env.VERCEL_PROJECT_PRODUCTION_URL, production);
    if (origin) origins.add(origin);
  } else if (env.VERCEL_ENV === "preview" && env.APP_ALLOW_VERCEL_PREVIEW === "true") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      const origin = hostToOrigin(host, production);
      if (origin) origins.add(origin);
    }
  }

  return [...origins];
}

/** `APP_ORIGIN` entries that were ignored because they are not usable origins (for diagnostics). */
export function getIgnoredOriginEntries(env: OriginEnv): string[] {
  const production = env.NODE_ENV === "production";
  return (env.APP_ORIGIN ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry && !normalizeConfiguredOrigin(entry, production));
}

export type OriginCheck =
  | { ok: true }
  | { ok: false; reason: "missing-origin" | "invalid-origin" | "not-configured" | "not-allowed"; origin?: string };

export function checkRequestOrigin(request: Request, env: OriginEnv): OriginCheck {
  const header = request.headers.get("origin");
  if (!header) return { ok: false, reason: "missing-origin" };

  let requestOrigin: string;
  try { requestOrigin = new URL(header).origin; } catch { return { ok: false, reason: "invalid-origin", origin: header }; }
  // `Origin: null` (opaque origins) parses to the string "null"; it never matches a real origin.
  if (requestOrigin === "null") return { ok: false, reason: "invalid-origin", origin: header };

  const allowed = getAllowedOrigins(env);
  if (allowed.length > 0) return allowed.includes(requestOrigin) ? { ok: true } : { ok: false, reason: "not-allowed", origin: requestOrigin };

  // Nothing configured: fail closed in production, fall back to the request URL in development.
  if (env.NODE_ENV === "production") return { ok: false, reason: "not-configured", origin: requestOrigin };
  try {
    return new URL(request.url).origin === requestOrigin ? { ok: true } : { ok: false, reason: "not-allowed", origin: requestOrigin };
  } catch {
    return { ok: false, reason: "invalid-origin", origin: header };
  }
}

/**
 * Logs why a request was rejected, to help operators fix configuration. Origins are public
 * values (not secrets), but the attacker-controlled value is truncated and sanitized.
 */
export function logOriginRejection(check: Extract<OriginCheck, { ok: false }>, env: OriginEnv, context: string): void {
  const safe = (value: string | undefined) => (value ?? "-").replace(/[^\x20-\x7e]/g, "?").slice(0, 120);
  console.warn(`[origin] ${context} rejected: reason=${check.reason} origin=${safe(check.origin)} allowed=[${getAllowedOrigins(env).map(safe).join(", ")}] ignoredAppOriginEntries=[${getIgnoredOriginEntries(env).map(safe).join(", ")}] vercelEnv=${safe(env.VERCEL_ENV)}`);
}
