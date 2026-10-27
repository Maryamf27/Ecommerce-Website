/**
 * Price-filter parsing shared by the catalog UI and the products API so both sides
 * accept and reject exactly the same values.
 */

/** Plain decimal numbers only (optionally with an exponent); no hex, signs, "Infinity" or "NaN". */
const DECIMAL_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:e\+?\d+)?$/i;

/** Parses one raw price value: `undefined` when empty, `null` when invalid, otherwise a finite number >= 0. */
export function parsePriceValue(raw: string | null | undefined): number | undefined | null {
  const value = (raw ?? "").trim();
  if (value === "") return undefined;
  if (!DECIMAL_PATTERN.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}

export type PriceRangeResult =
  | { ok: true; min?: number; max?: number }
  | { ok: false; code: "invalid-min" | "invalid-max" | "range"; message: string };

export const PRICE_MESSAGES = {
  invalidMin: "Enter a minimum price of 0 or more.",
  invalidMax: "Enter a maximum price of 0 or more.",
  range: "Minimum price can't be higher than the maximum price.",
} as const;

/**
 * Validates a min/max pair. `minUnparseable` / `maxUnparseable` let the UI report values the browser
 * itself rejected (a number input reports "" for text such as "e" or "--").
 */
export function validatePriceRange(
  minRaw: string | null | undefined,
  maxRaw: string | null | undefined,
  flags: { minUnparseable?: boolean; maxUnparseable?: boolean } = {},
): PriceRangeResult {
  const min = flags.minUnparseable ? null : parsePriceValue(minRaw);
  const max = flags.maxUnparseable ? null : parsePriceValue(maxRaw);
  if (min === null) return { ok: false, code: "invalid-min", message: PRICE_MESSAGES.invalidMin };
  if (max === null) return { ok: false, code: "invalid-max", message: PRICE_MESSAGES.invalidMax };
  if (min !== undefined && max !== undefined && min > max) return { ok: false, code: "range", message: PRICE_MESSAGES.range };
  return { ok: true, min, max };
}
