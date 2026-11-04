export type OriginEnv = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeConfiguredOrigin(value: string, production: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try { url = new URL(trimmed); } catch { return null; }
  if (url.username || url.password) return null;
  if (url.protocol === "https:") return url.origin;
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return url.origin;
  if (!production && url.protocol === "http:") return url.origin;
  return null;
}

function hostToOrigin(host: string | undefined, production: boolean): string | null {
  const value = host?.trim();
  if (!value || value.includes("/") || value.includes("@") || /\s/.test(value)) return null;
  return normalizeConfiguredOrigin(`https://${value}`, production);
}

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
  
  if (requestOrigin === "null") return { ok: false, reason: "invalid-origin", origin: header };

  const allowed = getAllowedOrigins(env);
  if (allowed.length > 0) return allowed.includes(requestOrigin) ? { ok: true } : { ok: false, reason: "not-allowed", origin: requestOrigin };

  if (env.NODE_ENV === "production") return { ok: false, reason: "not-configured", origin: requestOrigin };
  try {
    return new URL(request.url).origin === requestOrigin ? { ok: true } : { ok: false, reason: "not-allowed", origin: requestOrigin };
  } catch {
    return { ok: false, reason: "invalid-origin", origin: header };
  }
}


export function logOriginRejection(check: Extract<OriginCheck, { ok: false }>, env: OriginEnv, context: string): void {
  const safe = (value: string | undefined) => (value ?? "-").replace(/[^\x20-\x7e]/g, "?").slice(0, 120);
  console.warn(JSON.stringify({ level: "warn", event: "origin_rejected", context: safe(context), reason: check.reason, origin: safe(check.origin), allowedOrigins: getAllowedOrigins(env).map(safe), ignoredAppOriginEntries: getIgnoredOriginEntries(env).map(safe), vercelEnv: safe(env.VERCEL_ENV), timestamp: new Date().toISOString() }));
}
