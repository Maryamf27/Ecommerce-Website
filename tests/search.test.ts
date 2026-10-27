import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSearchFilter } from "../services/product-service";

type Clause = { $or: Array<Record<string, RegExp>> };
const matches = (search: string, text: string) => {
  const filter = buildSearchFilter(search) as { $and: Clause[] } | null;
  if (!filter) return true;
  return filter.$and.every((clause) => clause.$or.some((field) => Object.values(field)[0].test(text)));
};

describe("product search", () => {
  it("does not match a term inside another word (the reported 'ring' bug)", () => {
    for (const text of ["perfect for spring and winter", "comfortable wearing during the day", "Mens Cotton Jacket"]) assert.equal(matches("ring", text), false, text);
  });
  it("matches whole words and word beginnings, case-insensitively", () => {
    assert.equal(matches("ring", "White Gold Plated Princess ring"), true);
    assert.equal(matches("RING", "Diamond rings set"), true);
    assert.equal(matches("jack", "Mens Cotton Jacket"), true);
  });
  it("requires every word of a multi-word search", () => {
    assert.equal(matches("cotton jacket", "Mens Cotton Jacket"), true);
    assert.equal(matches("cotton ring", "Mens Cotton Jacket"), false);
  });
  it("treats regex characters literally and ignores blank searches", () => {
    assert.equal(matches("a.c", "abc"), false);
    assert.equal(buildSearchFilter("   "), null);
  });
});
