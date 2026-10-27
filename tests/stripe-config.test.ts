import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getAppUrl, getStripe } from "../lib/stripe";

const env = process.env as Record<string, string | undefined>;
const saved = { ...process.env };
afterEach(() => { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); });

describe("Stripe test-mode and app URL guards", () => {
  it("refuses live-mode or missing secret keys", () => {
    delete env.STRIPE_SECRET_KEY;
    assert.throws(() => getStripe(), /STRIPE_SECRET_KEY/);
    env.STRIPE_SECRET_KEY = "sk_live_" + "x".repeat(20);
    assert.throws(() => getStripe(), /test secret key/);
  });
  it("requires NEXT_PUBLIC_APP_URL to be a clean HTTPS origin in production", () => {
    env.NODE_ENV = "production";
    delete env.NEXT_PUBLIC_APP_URL;
    assert.throws(() => getAppUrl(), /NEXT_PUBLIC_APP_URL/);
    for (const value of ["http://example.com", "https://example.com/path", "https://example.com/?x=1", "https://user:pw@example.com"]) {
      env.NEXT_PUBLIC_APP_URL = value;
      assert.throws(() => getAppUrl(), /secure origin/, value);
    }
    env.NEXT_PUBLIC_APP_URL = "https://ecommerce-website-xi-eosin-72.vercel.app";
    assert.equal(getAppUrl().origin, "https://ecommerce-website-xi-eosin-72.vercel.app");
  });
});
