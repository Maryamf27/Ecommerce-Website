import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import AuthSession from "@/models/AuthSession";
import User from "@/models/User";
import LoginAttempt from "@/models/LoginAttempt";
import { connectToDatabase } from "@/lib/db";

export const SESSION_COOKIE = "nexora_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const BCRYPT_ROUNDS = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

export type PublicUser = { id: string; name: string; email: string; role: "customer" | "admin" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function serializePublicUser(user: { _id: { toString(): string }; name: string; email: string; role?: "customer" | "admin" }): PublicUser {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role === "admin" ? "admin" : "customer" };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

let dummyHashPromise: Promise<string> | undefined;

export async function verifyPassword(password: string, passwordHash?: string): Promise<boolean> {
  const comparisonHash = passwordHash ?? await (dummyHashPromise ??= bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS));
  const matches = await bcrypt.compare(password, comparisonHash);
  return Boolean(passwordHash) && matches;
}

export async function createUserSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await connectToDatabase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await AuthSession.create({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function findSessionUser(token: string | undefined): Promise<PublicUser | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  await connectToDatabase();
  const session = await AuthSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } })
    .select("userId")
    .lean<{ userId: { toString(): string } } | null>();
  if (!session) return null;
  const user = await User.findById(session.userId).select("name email role").lean<{ _id: { toString(): string }; name: string; email: string; role?: "customer" | "admin" } | null>();
  return user ? serializePublicUser(user) : null;
}

export async function revokeUserSession(token: string | undefined): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return;
  await connectToDatabase();
  await AuthSession.deleteOne({ tokenHash: hashToken(token) });
}

/** Sign out every other device after a password change. */
export async function revokeOtherUserSessions(userId: string, currentToken: string | undefined): Promise<void> {
  await connectToDatabase();
  const keep = currentToken && /^[A-Za-z0-9_-]{40,50}$/.test(currentToken) ? hashToken(currentToken) : "";
  await AuthSession.deleteMany({ userId, tokenHash: { $ne: keep } });
}

export function getRequestSessionToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
}

function loginAttemptKey(email: string, request: Request): string {
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(`${email}\u0000${forwarded}`).digest("hex");
}

export async function isLoginRateLimited(email: string, request: Request): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + LOGIN_WINDOW_MS);
  const result = await LoginAttempt.findOneAndUpdate(
    { key: loginAttemptKey(email, request) },
    [{ $set: {
      count: { $cond: [{ $gt: ["$expiresAt", now] }, { $add: [{ $ifNull: ["$count", 0] }, 1] }, 1] },
      expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", resetAt] },
    } }],
    { new: true, upsert: true, setDefaultsOnInsert: false, updatePipeline: true },
  ).lean<{ count: number } | null>();
  return (result?.count ?? 0) > MAX_LOGIN_ATTEMPTS;
}

export async function clearLoginAttempts(email: string, request: Request): Promise<void> {
  await LoginAttempt.deleteOne({ key: loginAttemptKey(email, request) });
}

export function requestHasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin && process.env.NODE_ENV === "production") return false;
  try {
    const expected = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date): Response {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}${secure}`);
  return response;
}

export function clearSessionCookie(response: Response): Response {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
  return response;
}
