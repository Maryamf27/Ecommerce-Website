import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSearchFilter } from "../services/product-service";

describe("product search filter", () => {
  it("uses MongoDB text search for non-empty queries", () => {
    assert.deepEqual(buildSearchFilter("wireless headphones"), {
      $text: { $search: "wireless headphones" },
    });
  });

  it("trims search text and ignores blank searches", () => {
    assert.deepEqual(buildSearchFilter("  headphones  "), {
      $text: { $search: "headphones" },
    });
    assert.equal(buildSearchFilter("   "), null);
  });
});
