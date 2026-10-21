import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { getDemoInitialStock } from "@/lib/inventory";
import { logServerError } from "@/lib/server-logging";

type LegacyStock = { _id: mongoose.Types.ObjectId; stock?: unknown; stockManaged?: boolean };

async function main() {
  loadEnvConfig(process.cwd());
  const apply = process.argv.includes("--apply");
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection opened without a selected database.");
    const products = db.collection<LegacyStock>("products");
    const cursor = products.find({}, { projection: { stock: 1, stockManaged: 1 } });
    const demoStock = getDemoInitialStock();
    let visited = 0;
    let candidates = 0;
    let preserved = 0;
    let batch: Array<{ updateOne: { filter: { _id: mongoose.Types.ObjectId }; update: { $set: { stock: number; stockManaged: boolean; updatedAt: Date } } } }> = [];

    for await (const product of cursor) {
      visited += 1;
      const valid = Number.isSafeInteger(product.stock) && (product.stock as number) >= 0;
      const legacyUninitializedZero = valid && product.stock === 0 && product.stockManaged !== true;
      if (valid && !legacyUninitializedZero) { preserved += 1; continue; }
      candidates += 1;
      if (apply) batch.push({ updateOne: { filter: { _id: product._id }, update: { $set: { stock: demoStock, stockManaged: false, updatedAt: new Date() } } } });
      if (batch.length >= 500) { await products.bulkWrite(batch, { ordered: false }); batch = []; }
    }
    if (batch.length > 0) await products.bulkWrite(batch, { ordered: false });
    console.log(`Stock backfill ${apply ? "applied" : "dry run"} on the configured MongoDB target.`);
    console.log(`Products checked: ${visited}; demo stock ${apply ? "assigned" : "to assign"}: ${candidates}; existing valid stock preserved: ${preserved}; demo quantity: ${demoStock}.`);
    if (!apply) console.log("Review this result, then rerun with --apply to update the database.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  logServerError("stock:backfill", error);
  console.error("Stock backfill failed. No product records are deleted.");
  process.exitCode = 1;
});
