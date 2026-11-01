import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCheckoutRequest } from "../lib/checkout-validation";

const validRequest = () => ({
  requestKey: "checkout-request-1234",
  name: "Ada Lovelace",
  email: "ADA@example.com",
  address: "12 Example Street",
  city: "Multan",
  postalCode: "60000",
  country: "Pakistan",
  expectedItems: [{ productId: "507f1f77bcf86cd799439011", quantity: 2, unitAmount: 1999 }],
});

describe("validateCheckoutRequest", () => {
  it("normalizes valid shipping details and cart identifiers", () => {
    const result = validateCheckoutRequest(validRequest());
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.shipping.email, "ada@example.com");
      assert.equal(result.data.expectedItems[0].quantity, 2);
      assert.equal(result.data.expectedItems[0].unitAmount, 1999);
    }
  });

  it("rejects non-object bodies and missing cart items", () => {
    assert.equal(validateCheckoutRequest(null).success, false);
    const result = validateCheckoutRequest({ ...validRequest(), expectedItems: [] });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.errors.expectedItems);
  });

  it("rejects malformed identifiers, quantities, and amounts", () => {
    for (const item of [
      { productId: "not-an-id", quantity: 1, unitAmount: 100 },
      { productId: "507f1f77bcf86cd799439011", quantity: 0, unitAmount: 100 },
      { productId: "507f1f77bcf86cd799439011", quantity: 100, unitAmount: 100 },
      { productId: "507f1f77bcf86cd799439011", quantity: 1, unitAmount: -1 },
      { productId: "507f1f77bcf86cd799439011", quantity: 1.5, unitAmount: 100 },
    ]) {
      const result = validateCheckoutRequest({ ...validRequest(), expectedItems: [item] });
      assert.equal(result.success, false);
      if (!result.success) assert.ok(result.errors.expectedItems);
    }
  });

  it("rejects duplicate product IDs in the submitted cart", () => {
    const item = validRequest().expectedItems[0];
    const result = validateCheckoutRequest({ ...validRequest(), expectedItems: [item, item] });
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.errors.expectedItems ?? "", /duplicate/i);
  });

  it("rejects invalid shipping fields", () => {
    const result = validateCheckoutRequest({ ...validRequest(), email: "bad-email", postalCode: "!" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.email);
      assert.ok(result.errors.postalCode);
    }
  });
});
