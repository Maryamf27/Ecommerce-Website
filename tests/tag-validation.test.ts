import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateProductCreate, validateProductUpdate } from "../lib/product-validation";
import { normalizeTagName } from "../lib/tag-validation";

const tagId = "507f1f77bcf86cd799439011";

describe("tag validation", () => {
  it("normalizes tag names to URL-safe slugs", () => {
    assert.deepEqual(normalizeTagName("  Best Sellers  "), { name: "Best Sellers", slug: "best-sellers" });
    assert.deepEqual(normalizeTagName("Café & Audio"), { name: "Café & Audio", slug: "cafe-audio" });
    assert.equal(normalizeTagName("🔥"), null);
    assert.equal(normalizeTagName("x".repeat(61)), null);
  });

  it("accepts unique ObjectId tag assignments on create and update", () => {
    const product = {
      title: "Test",
      description: "Description",
      price: 10,
      category: "Audio",
      image: "/test.png",
      tagIds: [tagId],
    };
    assert.deepEqual(validateProductCreate(product), { success: true, data: product });
    assert.deepEqual(validateProductUpdate({ tagIds: [] }), { success: true, data: { tagIds: [] } });
  });

  it("rejects malformed, duplicate, or excessive tag assignments", () => {
    assert.equal(validateProductUpdate({ tagIds: ["not-an-id"] }).success, false);
    assert.equal(validateProductUpdate({ tagIds: [tagId, tagId] }).success, false);
    const tooManyTags = Array.from({ length: 21 }, (_, index) => index.toString(16).padStart(24, "0"));
    assert.equal(validateProductUpdate({ tagIds: tooManyTags }).success, false);
  });
});
