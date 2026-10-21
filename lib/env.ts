/** Read a required server-side environment variable with a useful error. */
export function getRequiredEnv(name: "MONGODB_URI"): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
