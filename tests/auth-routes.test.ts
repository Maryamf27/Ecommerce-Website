import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

// These tests never reach MongoDB: the origin gate and body validation both run before any database call.
const PROD = "https://ecommerce-website-xi-eosin-72.vercel.app";
const saved = { ...process.env };
const env = process.env as Record<string, string | undefined>;
beforeEach(() => {
  env.NODE_ENV = "production";
  env.APP_ORIGIN = PROD;
  delete env.VERCEL_ENV;
});
afterEach(() => { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); });

const post = (path: string, origin: string | null, body: unknown) =>
  new Request(`${PROD}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("auth endpoints", () => {
  it("login and register reject an invalid origin with the existing 403 response", async () => {
    const login = await import("../app/api/auth/login/route");
    const register = await import("../app/api/auth/register/route");
    for (const handler of [login.POST, register.POST]) {
      for (const origin of [null, "https://evil.example", "http://ecommerce-website-xi-eosin-72.vercel.app"]) {
        const response = await handler(post("/api/auth/x", origin, { email: "a@b.co", password: "password1" }));
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { success: false, error: { message: "Request origin could not be verified." } });
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
    }
  });

  it("a valid origin passes the origin gate and reaches request validation", async () => {
    const login = await import("../app/api/auth/login/route");
    const register = await import("../app/api/auth/register/route");
    const badJson = await login.POST(post("/api/auth/login", PROD, "{not json"));
    assert.equal(badJson.status, 400);
    assert.equal((await badJson.json()).error.message, "Request body must be valid JSON.");

    const invalidLogin = await login.POST(post("/api/auth/login", PROD, { email: "", password: "" }));
    assert.equal(invalidLogin.status, 400);
    const loginBody = await invalidLogin.json();
    assert.equal(loginBody.success, false);
    assert.ok(loginBody.fields.email && loginBody.fields.password);

    const invalidRegister = await register.POST(post("/api/auth/register", PROD, { name: "", email: "x", password: "short", confirmPassword: "nope" }));
    assert.equal(invalidRegister.status, 400);
    assert.deepEqual(Object.keys((await invalidRegister.json()).fields).sort(), ["confirmPassword", "email", "name", "password"]);
  });

  it("checkout session endpoint rejects bad origins and unauthenticated callers before touching the database", async () => {
    const checkout = await import("../app/api/checkout/session/route");
    const crossSite = await checkout.POST(post("/api/checkout/session", "https://evil.example", {}));
    assert.equal(crossSite.status, 403);
    const anonymous = await checkout.POST(post("/api/checkout/session", PROD, {}));
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.json()).error.message, "Sign in to continue to checkout.");
  });

  it("session cookies stay HttpOnly, SameSite=Lax and Secure in production", async () => {
    const { setTokenCookies } = await import("../lib/auth");
    const now = Date.now();
    const response = setTokenCookies(new Response(null), {
      accessToken: "a".repeat(43),
      refreshToken: "r".repeat(64),
      accessExpiresAt: new Date(now + 10 * 60_000),
      refreshExpiresAt: new Date(now + 7 * 24 * 60 * 60_000),
    });
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    const cookies = cookieHeader.split(/, (?=nexora_(?:access|refresh)=)/);
    assert.equal(cookies.length, 2);
    assert.match(cookies[0], /nexora_access=/);
    assert.match(cookies[1], /nexora_refresh=/);
    for (const cookie of cookies) {
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Secure/);
    }
    assert.match(cookies[0], /Max-Age=600/);
  });
});
