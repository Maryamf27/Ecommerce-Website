import { authRepository } from "@/repositories/auth-repository";
import { isLoginRateLimited, verifyPassword } from "@/lib/auth";
import { getRetryAfterSeconds } from "@/lib/login-lockout";

type LoginAccount = {
  _id: { toString(): string };
  name: string;
  email: string;
  role?: "customer" | "admin";
  passwordHash: string;
};

type LoginAuthenticationDependencies = {
  isRateLimited(email: string, request: Request): Promise<boolean>;
  getLoginLockoutUntil(email: string): Promise<Date | null>;
  findAccount(email: string): Promise<LoginAccount | null>;
  verifyPassword(password: string, passwordHash?: string): Promise<boolean>;
  recordFailedLogin(email: string): Promise<Date | null>;
  resetFailedLoginState(email: string): Promise<boolean>;
};

const defaultDependencies: LoginAuthenticationDependencies = {
  isRateLimited: isLoginRateLimited,
  getLoginLockoutUntil: (email) => authRepository.getLoginLockoutUntil(email),
  findAccount: (email) => authRepository.findByEmailWithPassword(email),
  verifyPassword,
  recordFailedLogin: (email) => authRepository.recordFailedLogin(email),
  resetFailedLoginState: (email) => authRepository.resetFailedLoginState(email),
};

export async function authenticateLogin(
  email: string,
  password: string,
  request: Request,
  dependencies: LoginAuthenticationDependencies = defaultDependencies,
) {
  if (await dependencies.isRateLimited(email, request)) {
    return { kind: "rate_limited" as const, retryAfterSeconds: 15 * 60 };
  }

  const now = new Date();
  const lockoutUntil = await dependencies.getLoginLockoutUntil(email);
  if (lockoutUntil && lockoutUntil > now) {
    return {
      kind: "rate_limited" as const,
      retryAfterSeconds: getRetryAfterSeconds(lockoutUntil, now),
    };
  }

  const account = await dependencies.findAccount(email);
  const passwordMatches = await dependencies.verifyPassword(password, account?.passwordHash);
  if (!account || !passwordMatches) {
    const newLockoutUntil = await dependencies.recordFailedLogin(email);
    if (newLockoutUntil && newLockoutUntil > new Date()) {
      return {
        kind: "rate_limited" as const,
        retryAfterSeconds: getRetryAfterSeconds(newLockoutUntil),
      };
    }
    return { kind: "invalid_credentials" as const };
  }

  if (!await dependencies.resetFailedLoginState(email)) {
    const activeLockout = await dependencies.getLoginLockoutUntil(email);
    if (activeLockout && activeLockout > new Date()) {
      return {
        kind: "rate_limited" as const,
        retryAfterSeconds: getRetryAfterSeconds(activeLockout),
      };
    }
    return { kind: "invalid_credentials" as const };
  }
  return { kind: "authenticated" as const, account };
}
