import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkRequestOrigin, getAllowedOrigins, getIgnoredOriginEntries, normalizeConfiguredOrigin } from "../lib/origin";

const PROD = "https://ecommerce-website-xi-eosin-72.vercel.app";
const req = (origin: string | null, headers: Record<string, string> = {}, url = `${PROD}/api/auth/login`) =>
  new Request(url, { method: "POST", headers: { ...(origin === null ? {} : { origin }), ...headers } });
const ok = (request: Request, env: Record<string, string | undefined>) => checkRequestOrigin(request, env).ok;

describe("origin validation (production)", () => {
  it("fails closed when nothing is configured (the reported production bug)", () => {
    const result = checkRequestOrigin(req(PROD), { NODE_ENV: "production" });
    assert.deepEqual(result, { ok: false, reason: "not-configured", origin: PROD });
  });

  it("accepts the configured APP_ORIGIN, with or without a trailing slash", () => {
    assert.equal(ok(req(PROD), { NODE_ENV: "production", APP_ORIGIN: PROD }), true);
    assert.equal(ok(req(PROD), { NODE_ENV: "production", APP_ORIGIN: `${PROD}/` }), true);
  });

  it("rejects a scheme, host, port or subdomain mismatch", () => {
    const env = { NODE_ENV: "production", APP_ORIGIN: PROD };
    assert.equal(ok(req("http://ecommerce-website-xi-eosin-72.vercel.app"), env), false);
    assert.equal(ok(req("https://www.ecommerce-website-xi-eosin-72.vercel.app"), env), false);
    assert.equal(ok(req("https://ecommerce-website-xi-eosin-72.vercel.app:8443"), env), false);
    assert.equal(ok(req("https://evil.example"), env), false);
    assert.equal(ok(req(`${PROD}.evil.example`), env), false);
    assert.equal(ok(req("https://evil.example/https://ecommerce-website-xi-eosin-72.vercel.app"), env), false);
  });

  it("rejects missing, malformed and opaque origins", () => {
    const env = { NODE_ENV: "production", APP_ORIGIN: PROD };
    assert.equal(checkRequestOrigin(req(null), env).ok, false);
    assert.equal(ok(req("not a url"), env), false);
    assert.equal(ok(req("null"), env), false);
  });

  it("ignores spoofable forwarding headers and the request URL host", () => {
    const env = { NODE_ENV: "production", APP_ORIGIN: PROD };
    const spoofed = req("https://evil.example", { host: "ecommerce-website-xi-eosin-72.vercel.app", "x-forwarded-host": "ecommerce-website-xi-eosin-72.vercel.app", "x-forwarded-proto": "https", forwarded: "host=ecommerce-website-xi-eosin-72.vercel.app" }, "https://evil.example/api/auth/login");
    assert.equal(ok(spoofed, env), false);
    // Not configured + a request URL that matches the Origin must still fail closed in production.
    assert.equal(ok(req("https://evil.example", {}, "https://evil.example/api/auth/login"), { NODE_ENV: "production" }), false);
  });

  it("supports several comma-separated origins and ignores invalid entries", () => {
    const env = { NODE_ENV: "production", APP_ORIGIN: `https://shop.example.com, ${PROD}, javascript:alert(1), *.vercel.app, http://shop.example.net` };
    assert.deepEqual(getAllowedOrigins(env), ["https://shop.example.com", PROD]);
    assert.equal(ok(req("https://shop.example.com"), env), true);
    assert.equal(ok(req(PROD), env), true);
    assert.equal(ok(req("http://shop.example.net"), env), false);
  });

  it("trusts the Vercel production URL automatically on production deployments only", () => {
    const vercel = { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "ecommerce-website-xi-eosin-72.vercel.app" };
    assert.equal(ok(req(PROD), vercel), true);
    assert.equal(ok(req("https://evil.example"), vercel), false);
    assert.equal(ok(req(PROD), { ...vercel, VERCEL_ENV: "preview" }), false);
    assert.equal(ok(req(PROD), { ...vercel, VERCEL_ENV: undefined }), false);
  });

  it("trusts preview deployment URLs only when explicitly enabled", () => {
    const preview = { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "app-abc123-team.vercel.app", VERCEL_BRANCH_URL: "app-git-feature-team.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app" };
    assert.equal(ok(req("https://app-abc123-team.vercel.app"), preview), false);
    const enabled = { ...preview, APP_ALLOW_VERCEL_PREVIEW: "true" };
    assert.equal(ok(req("https://app-abc123-team.vercel.app"), enabled), true);
    assert.equal(ok(req("https://app-git-feature-team.vercel.app"), enabled), true);
    assert.equal(ok(req("https://app-other-team.vercel.app"), enabled), false);
    // Production URL is not trusted from a preview deployment, and the opt-in does nothing on production.
    assert.equal(ok(req("https://app.vercel.app"), enabled), false);
    assert.equal(ok(req("https://app-abc123-team.vercel.app"), { ...enabled, VERCEL_ENV: "production" }), false);
  });

  it("does not accept malformed Vercel host values", () => {
    const base = { NODE_ENV: "production", VERCEL_ENV: "production" };
    for (const host of ["evil.example/path", "user@evil.example", "a b.example", ""]) {
      assert.deepEqual(getAllowedOrigins({ ...base, VERCEL_PROJECT_PRODUCTION_URL: host }), [], host);
    }
  });
});

describe("origin validation (development)", () => {
  it("falls back to the request's own origin when nothing is configured", () => {
    assert.equal(ok(req("http://localhost:3000", {}, "http://localhost:3000/api/auth/login"), { NODE_ENV: "development" }), true);
    assert.equal(ok(req("http://evil.example", {}, "http://localhost:3000/api/auth/login"), { NODE_ENV: "development" }), false);
  });
});

describe("configuration diagnostics", () => {
  it("reports APP_ORIGIN entries that were ignored (e.g. http:// on a public host)", () => {
    assert.deepEqual(getIgnoredOriginEntries({ NODE_ENV: "production", APP_ORIGIN: `${PROD},http://shop.example.net, ,*.vercel.app` }), ["http://shop.example.net", "*.vercel.app"]);
    assert.deepEqual(getIgnoredOriginEntries({ NODE_ENV: "production" }), []);
  });
});

describe("normalizeConfiguredOrigin", () => {
  it("requires HTTPS in production except for loopback hosts", () => {
    assert.equal(normalizeConfiguredOrigin("http://example.com", true), null);
    assert.equal(normalizeConfiguredOrigin("http://localhost:3000", true), "http://localhost:3000");
    assert.equal(normalizeConfiguredOrigin("https://user:pw@example.com", true), null);
    assert.equal(normalizeConfiguredOrigin("ftp://example.com", false), null);
  });
});
