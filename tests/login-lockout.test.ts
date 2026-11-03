import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLoginFailure,
  BASE_LOGIN_LOCKOUT_MS,
  getLoginLockoutDurationMs,
  loginAccountAttemptKey,
  MAX_LOGIN_LOCKOUT_MS,
  type LoginFailureState,
} from "../lib/login-lockout";
import { authenticateLogin } from "../services/login-authentication";

const request = new Request("https://shop.example.com/api/auth/login");
const resetPeriodMs = 24 * 60 * 60 * 1000;

function createHarness(options: { accountExists?: boolean; state?: LoginFailureState } = {}) {
  const accountExists = options.accountExists ?? true;
  let state: LoginFailureState = options.state ?? { failedLoginAttempts: 0, loginLockoutCount: 0 };
  let passwordChecks = 0;
  let failureWrites = 0;

  const dependencies = {
    async isRateLimited() { return false; },
    async getLoginLockoutUntil() { return state.loginLockoutUntil ?? null; },
    async findAccount() {
      return accountExists
        ? { _id: { toString: () => "account-1" }, name: "Test", email: "user@example.com", role: "customer" as const, passwordHash: "stored-hash" }
        : null;
    },
    async verifyPassword(password: string, passwordHash?: string) {
      passwordChecks += 1;
      return password === "correct-password" && passwordHash === "stored-hash";
    },
    async recordFailedLogin() {
      failureWrites += 1;
      state = applyLoginFailure(state, new Date(), resetPeriodMs);
      return state.loginLockoutUntil ?? null;
    },
    async resetFailedLoginState() {
      if (state.loginLockoutUntil && state.loginLockoutUntil > new Date()) return false;
      state = { failedLoginAttempts: 0, loginLockoutCount: 0 };
      return true;
    },
  };

  return {
    login: (password: string) => authenticateLogin("user@example.com", password, request, dependencies),
    getState: () => state,
    getPasswordChecks: () => passwordChecks,
    getFailureWrites: () => failureWrites,
  };
}

function failFiveTimes(state: LoginFailureState, now: Date, resetMs = resetPeriodMs): LoginFailureState {
  let next = state;
  for (let attempt = 0; attempt < 5; attempt += 1) next = applyLoginFailure(next, now, resetMs);
  return next;
}

describe("login lockout", () => {
  it("uses a one-way hash rather than storing an email address in the account key", () => {
    const key = loginAccountAttemptKey("user@example.com");
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key.includes("user@example.com"), false);
  });

  it("allows 1–4 incorrect passwords without locking the account", async () => {
    const harness = createHarness();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      assert.deepEqual(await harness.login("wrong-password"), { kind: "invalid_credentials" });
      assert.equal(harness.getState().failedLoginAttempts, attempt);
      assert.equal(harness.getState().loginLockoutUntil, undefined);
    }
  });

  it("locks on the fifth consecutive failure and supplies a retry interval", async () => {
    const harness = createHarness();
    for (let attempt = 0; attempt < 4; attempt += 1) await harness.login("wrong-password");
    const result = await harness.login("wrong-password");
    assert.equal(result.kind, "rate_limited");
    if (result.kind === "rate_limited") assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 900);
    assert.equal(harness.getState().failedLoginAttempts, 0);
    assert.equal(harness.getState().loginLockoutCount, 1);
  });

  it("rejects a correct password during lockout before password verification", async () => {
    const harness = createHarness();
    for (let attempt = 0; attempt < 5; attempt += 1) await harness.login("wrong-password");
    const checksBefore = harness.getPasswordChecks();
    assert.equal((await harness.login("correct-password")).kind, "rate_limited");
    assert.equal(harness.getPasswordChecks(), checksBefore);
  });

  it("allows login after lockout expiry", async () => {
    const harness = createHarness({
      state: {
        failedLoginAttempts: 0,
        loginLockoutUntil: new Date(Date.now() - 1000),
        loginLockoutCount: 1,
        loginLockoutResetAt: new Date(Date.now() + resetPeriodMs),
      },
    });
    assert.equal((await harness.login("correct-password")).kind, "authenticated");
    assert.deepEqual(harness.getState(), { failedLoginAttempts: 0, loginLockoutCount: 0 });
  });

  it("progressively increases lockouts and caps them at 24 hours", () => {
    let state: LoginFailureState = { failedLoginAttempts: 0, loginLockoutCount: 0 };
    let now = new Date();
    const durations: number[] = [];
    for (let lockout = 0; lockout < 10; lockout += 1) {
      state = failFiveTimes(state, now);
      assert.ok(state.loginLockoutUntil);
      durations.push(state.loginLockoutUntil.getTime() - now.getTime());
      now = new Date(state.loginLockoutUntil.getTime() + 1);
    }
    assert.deepEqual(durations.slice(0, 3), [15, 30, 60].map((minutes) => minutes * 60 * 1000));
    assert.equal(durations[0], BASE_LOGIN_LOCKOUT_MS);
    assert.equal(durations.at(-1), MAX_LOGIN_LOCKOUT_MS);
    assert.equal(getLoginLockoutDurationMs(1000), MAX_LOGIN_LOCKOUT_MS);
  });

  it("resets consecutive failures and escalation after successful authentication", async () => {
    const harness = createHarness({
      state: {
        failedLoginAttempts: 3,
        loginLockoutUntil: new Date(Date.now() - 1000),
        loginLockoutCount: 2,
        loginLockoutResetAt: new Date(Date.now() + resetPeriodMs),
      },
    });
    assert.equal((await harness.login("correct-password")).kind, "authenticated");
    assert.deepEqual(harness.getState(), { failedLoginAttempts: 0, loginLockoutCount: 0 });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      assert.equal((await harness.login("wrong-password")).kind, "invalid_credentials");
    }
    assert.equal(harness.getState().failedLoginAttempts, 4);
  });

  it("resets escalation after the configured inactivity period", () => {
    const now = new Date();
    const expiredEscalation: LoginFailureState = {
      failedLoginAttempts: 0,
      loginLockoutUntil: new Date(now.getTime() - 1),
      loginLockoutCount: 4,
      loginLockoutResetAt: new Date(now.getTime() - 1),
    };
    const next = failFiveTimes(expiredEscalation, now, 60 * 60 * 1000);
    assert.equal(next.loginLockoutCount, 1);
    assert.ok(next.loginLockoutUntil);
    assert.equal(next.loginLockoutUntil.getTime() - now.getTime(), BASE_LOGIN_LOCKOUT_MS);
  });

  it("handles nonexistent emails with the same generic failure and lockout threshold", async () => {
    const harness = createHarness({ accountExists: false });
    assert.deepEqual(await harness.login("wrong-password"), { kind: "invalid_credentials" });
    assert.equal(harness.getFailureWrites(), 1);
    assert.equal(harness.getPasswordChecks(), 1);
    for (let attempt = 0; attempt < 3; attempt += 1) await harness.login("wrong-password");
    assert.equal((await harness.login("wrong-password")).kind, "rate_limited");
  });

  it("handles concurrent failed attempts without exceeding the lockout state", async () => {
    const harness = createHarness();
    const results = await Promise.all(Array.from({ length: 20 }, () => harness.login("wrong-password")));
    assert.equal(results.filter((result) => result.kind === "rate_limited").length, 16);
    assert.equal(harness.getState().loginLockoutCount, 1);
    assert.equal(harness.getState().failedLoginAttempts, 0);
    assert.ok(harness.getState().loginLockoutUntil);
  });

  it("never creates a permanent lockout", () => {
    const now = new Date();
    const state = failFiveTimes(
      {
        failedLoginAttempts: 0,
        loginLockoutCount: 100,
        loginLockoutResetAt: new Date(now.getTime() + resetPeriodMs),
      },
      now,
    );
    assert.ok(state.loginLockoutUntil);
    assert.equal(state.loginLockoutUntil.getTime() - now.getTime(), MAX_LOGIN_LOCKOUT_MS);
  });
});
