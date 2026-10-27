import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePriceValue, PRICE_MESSAGES, validatePriceRange } from "../lib/price-filter";
import { parseProductListQuery } from "../services/product-service";

describe("parsePriceValue", () => {
  it("treats empty input as no filter", () => {
    for (const value of ["", "   ", null, undefined]) assert.equal(parsePriceValue(value), undefined);
  });
  it("accepts finite non-negative decimals", () => {
    assert.equal(parsePriceValue("0"), 0);
    assert.equal(parsePriceValue("19.99"), 19.99);
    assert.equal(parsePriceValue(" .5 "), 0.5);
    assert.equal(parsePriceValue("1e3"), 1000);
  });
  it("rejects negative, non-finite and non-decimal values", () => {
    for (const value of ["-1", "-0.01", "Infinity", "-Infinity", "NaN", "abc", "1,5", "0x10", "1e999", "--5", "1.2.3", "+5"]) assert.equal(parsePriceValue(value), null, value);
  });
});

describe("validatePriceRange", () => {
  it("accepts valid and partial ranges", () => {
    assert.deepEqual(validatePriceRange("", ""), { ok: true, min: undefined, max: undefined });
    assert.deepEqual(validatePriceRange("5", ""), { ok: true, min: 5, max: undefined });
    assert.deepEqual(validatePriceRange("", "10"), { ok: true, min: undefined, max: 10 });
    assert.deepEqual(validatePriceRange("10", "10"), { ok: true, min: 10, max: 10 });
  });
  it("rejects min greater than max with a clear message", () => {
    assert.deepEqual(validatePriceRange("50", "10"), { ok: false, code: "range", message: PRICE_MESSAGES.range });
    assert.deepEqual(validatePriceRange("10.01", "10"), { ok: false, code: "range", message: PRICE_MESSAGES.range });
  });
  it("clears the error once the inputs are corrected", () => {
    assert.equal(validatePriceRange("50", "10").ok, false);
    assert.equal(validatePriceRange("5", "10").ok, true);
  });
  it("rejects invalid individual values and browser-unparseable input", () => {
    const codeOf = (result: ReturnType<typeof validatePriceRange>) => result.ok ? "ok" : result.code;
    assert.equal(codeOf(validatePriceRange("-5", "")), "invalid-min");
    assert.equal(codeOf(validatePriceRange("", "Infinity")), "invalid-max");
    assert.equal(codeOf(validatePriceRange("", "", { minUnparseable: true })), "invalid-min");
    assert.equal(codeOf(validatePriceRange("", "", { maxUnparseable: true })), "invalid-max");
  });
});

describe("product API query validation (server side)", () => {
  const parse = (query: string) => parseProductListQuery(new URLSearchParams(query));
  it("rejects min greater than max instead of returning misleading results", () => {
    assert.deepEqual(parse("minPrice=50&maxPrice=10"), { success: false, message: "minPrice cannot be greater than maxPrice." });
  });
  it("rejects negative and non-finite prices", () => {
    for (const query of ["minPrice=-1", "maxPrice=-5", "minPrice=Infinity", "maxPrice=NaN", "minPrice=abc", "maxPrice=0x10"]) {
      assert.deepEqual(parse(query), { success: false, message: "Price filters must be finite non-negative numbers." }, query);
    }
  });
  it("accepts valid ranges and blank values, and preserves sort and pagination", () => {
    const result = parse("minPrice=5&maxPrice=500&sort=price_asc&page=2&limit=12");
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual({ min: result.data.minPrice, max: result.data.maxPrice, sort: result.data.sort, page: result.data.page, limit: result.data.limit }, { min: 5, max: 500, sort: "price_asc", page: 2, limit: 12 });
    const blank = parse("minPrice=&maxPrice=");
    assert.equal(blank.success && blank.data.minPrice, undefined);
  });
});
