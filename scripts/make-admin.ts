import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

async function main() {
  loadEnvConfig(process.cwd());
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run make:admin -- user@example.com");
  try {
    await connectToDatabase();
    const result = await User.updateOne({ email }, { $set: { role: "admin" } });
    if (result.matchedCount === 0) throw new Error(`No account found for ${email}. Register it on /register first.`);
    console.log(`${email} is now an administrator. Sign out and back in if you are already signed in.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  logServerError("make:admin", error);
  console.error(error instanceof Error ? error.message : "Could not update the account.");
  process.exitCode = 1;
});
