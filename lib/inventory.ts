export const DEFAULT_DEMO_INITIAL_STOCK = 12;
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function readNonNegativeInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error(`${name} must be a non-negative integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) throw new Error(`${name} must be between 0 and ${maximum}.`);
  return value;
}

export function getDemoInitialStock(): number {
  return readNonNegativeInteger("DEMO_INITIAL_STOCK", DEFAULT_DEMO_INITIAL_STOCK, 100_000);
}

export function getLowStockThreshold(): number {
  return readNonNegativeInteger("LOW_STOCK_THRESHOLD", DEFAULT_LOW_STOCK_THRESHOLD, 100_000);
}

export function getStockStatus(stock: number): "out-of-stock" | "low-stock" | "in-stock" {
  if (!Number.isSafeInteger(stock) || stock < 1) return "out-of-stock";
  return stock <= getLowStockThreshold() ? "low-stock" : "in-stock";
}
