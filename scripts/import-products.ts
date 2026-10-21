import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { importFakeStoreProducts } from "@/services/product-service";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    await connectToDatabase();

    const response = await fetch("https://fakestoreapi.com/products", {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Fake Store API returned HTTP ${response.status}.`);

    let payload: unknown;
    try { payload = await response.json(); } catch {
      throw new Error("Fake Store API returned invalid JSON.");
    }

    const result = await importFakeStoreProducts(payload);
    console.log(`Product import complete: ${result.inserted} inserted, ${result.updated} refreshed, ${result.skipped} invalid items skipped.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  void error;
  console.error("Product import failed. Check MongoDB and Fake Store API connectivity.");
  process.exitCode = 1;
});
