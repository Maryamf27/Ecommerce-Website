import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import AuthSession from "@/models/AuthSession";
import User from "@/models/User";
import LoginAttempt from "@/models/LoginAttempt";
import { connectToDatabase } from "@/lib/db";
import { checkRequestOrigin, logOriginRejection } from "@/lib/origin";

export const SESSION_COOKIE = "nexora_access";
export const REFRESH_COOKIE = "nexora_refresh";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 10 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const BCRYPT_ROUNDS = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const MAX_SIGNUP_ATTEMPTS = 5;

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

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
};

async function storeToken(userId: string, token: string, expiresAt: Date, tokenType: "access" | "refresh") {
  await AuthSession.create({ tokenHash: hashToken(token), userId, expiresAt, tokenType });
}

export async function createUserSession(userId: string): Promise<TokenPair> {
  await connectToDatabase();
  const accessToken = randomBytes(32).toString("base64url");
  const refreshToken = randomBytes(48).toString("base64url");
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_MAX_AGE_SECONDS * 1000);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000);
  await AuthSession.insertMany([
    { tokenHash: hashToken(accessToken), userId, expiresAt: accessExpiresAt, tokenType: "access" },
    { tokenHash: hashToken(refreshToken), userId, expiresAt: refreshExpiresAt, tokenType: "refresh" },
  ]);
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}

export async function refreshUserSession(refreshToken: string | undefined): Promise<{ user: PublicUser; tokens: TokenPair } | null> {
  if (!refreshToken || !/^[A-Za-z0-9_-]{60,70}$/.test(refreshToken)) return null;
  await connectToDatabase();
  // Delete the presented refresh token before issuing another pair. This makes rotation one-time.
  const oldToken = await AuthSession.findOneAndDelete({
    tokenHash: hashToken(refreshToken),
    tokenType: "refresh",
    expiresAt: { $gt: new Date() },
  }).select("userId").lean<{ userId: Types.ObjectId } | null>();
  if (!oldToken) return null;
  const user = await User.findById(oldToken.userId).select("name email role").lean<{ _id: { toString(): string }; name: string; email: string; role?: "customer" | "admin" } | null>();
  if (!user) return null;
  // Revoke any remaining access token from the previous pair before rotating.
  await AuthSession.deleteMany({ userId: oldToken.userId, tokenType: "access" });
  return { user: serializePublicUser(user), tokens: await createUserSession(oldToken.userId.toString()) };
}

export async function findSessionUser(token: string | undefined): Promise<PublicUser | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  await connectToDatabase();
  const session = await AuthSession.findOne({ tokenHash: hashToken(token), tokenType: "access", expiresAt: { $gt: new Date() } })
    .select("userId")
    .lean<{ userId: { toString(): string } } | null>();
  if (!session) return null;
  const user = await User.findById(session.userId).select("name email role").lean<{ _id: { toString(): string }; name: string; email: string; role?: "customer" | "admin" } | null>();
  return user ? serializePublicUser(user) : null;
}

export async function revokeUserSession(token: string | undefined): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{40,70}$/.test(token)) return;
  await connectToDatabase();
  await AuthSession.deleteOne({ tokenHash: hashToken(token) });
}

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

/** Limit account creation per client IP to reduce automated signup abuse. */
export async function isSignupRateLimited(request: Request): Promise<boolean> {
  const forwarded = request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const key = createHash("sha256").update(`signup\u0000${forwarded}`).digest("hex");
  const now = new Date();
  const resetAt = new Date(now.getTime() + LOGIN_WINDOW_MS);
  const result = await LoginAttempt.findOneAndUpdate(
    { key },
    [{ $set: {
      count: { $cond: [{ $gt: ["$expiresAt", now] }, { $add: [{ $ifNull: ["$count", 0] }, 1] }, 1] },
      expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", resetAt] },
    } }],
    { new: true, upsert: true, setDefaultsOnInsert: false, updatePipeline: true },
  ).lean<{ count: number } | null>();
  return (result?.count ?? 0) > MAX_SIGNUP_ATTEMPTS;
}

export function requestHasValidOrigin(request: Request): boolean {
  const check = checkRequestOrigin(request, process.env);
  if (check.ok) return true;
  logOriginRejection(check, process.env, new URL(request.url).pathname);
  return false;
}

function cookieOptions(expiresAt: Date) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function setTokenCookies(response: Response, tokens: TokenPair): Response {
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${tokens.accessToken}; ${cookieOptions(tokens.accessExpiresAt)}`);
  response.headers.append("Set-Cookie", `${REFRESH_COOKIE}=${tokens.refreshToken}; ${cookieOptions(tokens.refreshExpiresAt)}`);
  return response;
}

export function clearSessionCookie(response: Response): Response {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
  response.headers.append("Set-Cookie", `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
  return response;
}
