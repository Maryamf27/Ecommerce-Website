import mongoose from "mongoose";
import { getRequiredEnv } from "@/lib/env";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache = (globalThis.mongooseCache ??= {
  connection: null,
  promise: null,
});

/** Connect once and reuse the Mongoose connection during development reloads. */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const state = cache.connection?.connection.readyState ?? mongoose.connection.readyState;
  if (state === 1) return cache.connection ?? mongoose;
  if (state !== 2) {
    cache.connection = null;
    cache.promise = null;
  }

  const uri = getRequiredEnv("MONGODB_URI");
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }

  try {
    cache.connection = await cache.promise;
    console.log("Connected to MongoDB");
    return cache.connection;
  } catch (error) {
    cache.promise = null;
    cache.connection = null;
    throw error;
  }
}
