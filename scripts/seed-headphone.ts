import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import { ensureHeadphoneProduct } from "@/services/product-service";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    await connectToDatabase();
    const { product, created } = await ensureHeadphoneProduct();
    console.log(created
      ? `Headphone product was missing, so it was added: "${product.title}" (${product._id}).`
      : `Headphone product already exists, nothing to add: "${product.title}" (${product._id}).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  logServerError("seed:headphone", error);
  console.error("Headphone seed failed. See the server-side error above for details.");
  process.exitCode = 1;
});
