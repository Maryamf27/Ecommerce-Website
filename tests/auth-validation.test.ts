import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeReturnTo, validateAuthForm, validateLogin, validateRegistration } from "../lib/auth-validation";

describe("validateAuthForm (client pre-check)", () => {
  it("flags every empty field on registration", () => {
    assert.deepEqual(validateAuthForm("register", {}), { name: "Enter your name.", email: "Enter your email address.", password: "Enter a password.", confirmPassword: "Confirm your password." });
  });
  it("only requires email and password on login, with no minimum length", () => {
    assert.deepEqual(validateAuthForm("login", { email: "", password: "" }), { email: "Enter your email address.", password: "Enter your password." });
    assert.deepEqual(validateAuthForm("login", { email: "a@b.co", password: "x" }), {});
  });
  it("validates email format, trimming whitespace", () => {
    assert.equal(validateAuthForm("login", { email: "not-an-email", password: "x" }).email, "Enter a valid email address.");
    assert.equal(validateAuthForm("login", { email: "  a@b.co  ", password: "x" }).email, undefined);
  });
  it("enforces the registration password minimum and confirmation", () => {
    const base = { name: "Ada", email: "ada@example.com" };
    assert.equal(validateAuthForm("register", { ...base, password: "short", confirmPassword: "short" }).password, "Use at least 8 characters.");
    assert.equal(validateAuthForm("register", { ...base, password: "longenough", confirmPassword: "different" }).confirmPassword, "Passwords do not match.");
    assert.deepEqual(validateAuthForm("register", { ...base, password: "longenough", confirmPassword: "longenough" }), {});
  });
  it("rejects passwords over bcrypt's 72-byte limit", () => {
    assert.equal(validateAuthForm("login", { email: "a@b.co", password: "é".repeat(40) }).password, "Password is too long. Please choose a shorter one.");
  });
  it("never accepts input the server would reject", () => {
    const cases = [{ name: "Ada", email: "ada@example.com", password: "longenough", confirmPassword: "longenough" }, { name: "x".repeat(81), email: "ada@example.com", password: "longenough", confirmPassword: "longenough" }, { name: "Ada", email: "a@b", password: "longenough", confirmPassword: "longenough" }];
    for (const input of cases) {
      const clientOk = Object.keys(validateAuthForm("register", input)).length === 0;
      assert.equal(clientOk, validateRegistration(input).success);
    }
    assert.equal(Object.keys(validateAuthForm("login", { email: "a@b.co", password: "x" })).length === 0, validateLogin({ email: "a@b.co", password: "x" }).success);
  });
});

describe("safeReturnTo (open-redirect protection)", () => {
  it("keeps same-site paths", () => {
    assert.equal(safeReturnTo("/checkout"), "/checkout");
    assert.equal(safeReturnTo("/shop?category=a#shop"), "/shop?category=a#shop");
  });
  it("falls back for missing or external targets", () => {
    for (const value of [undefined, "", "checkout", "https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "javascript:alert(1)", "/\u0000"]) {
      assert.equal(safeReturnTo(value), "/account", String(value));
    }
  });
  it("rejects dot-segment tricks that normalize to a protocol-relative URL", () => {
    for (const value of ["/.//evil.example", "/..//evil.example", "/a/..//evil.example", "/././/evil.example"]) {
      assert.equal(safeReturnTo(value), "/account", value);
    }
  });
  it("honours a custom fallback", () => {
    assert.equal(safeReturnTo("//evil.example", "/"), "/");
  });
});
