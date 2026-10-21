import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import { importFakeStoreProducts } from "@/services/product-service";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection opened without a selected database.");
    const beforeCount = await db.collection("products").countDocuments();
    console.log(`Connected to MongoDB database "${db.databaseName}"; found ${beforeCount} product documents before import.`);

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
    const afterCount = await db.collection("products").countDocuments();
    console.log(`MongoDB now contains ${afterCount} product documents.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  logServerError("import:products", error);
  console.error("Product import failed. See the server-side error above for details.");
  process.exitCode = 1;
});
