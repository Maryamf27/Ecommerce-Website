import { createHash } from "node:crypto";

export const MAX_CONSECUTIVE_LOGIN_FAILURES = 5;
export const BASE_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
export const MAX_LOGIN_LOCKOUT_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_LOGIN_LOCKOUT_RESET_HOURS = 24;
export const IP_LOGIN_ATTEMPT_LIMIT = 300;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export function loginAccountAttemptKey(email: string): string {
  const emailHash = createHash("sha256").update(email).digest("hex");
  return createHash("sha256").update(`login-account\u0000${emailHash}`).digest("hex");
}

export type LoginFailureState = {
  failedLoginAttempts: number;
  loginLockoutUntil?: Date;
  loginLockoutCount: number;
  loginLockoutResetAt?: Date;
};

export function getLoginLockoutDurationMs(previousLockouts: number): number {
  return Math.min(
    BASE_LOGIN_LOCKOUT_MS * 2 ** Math.max(0, previousLockouts),
    MAX_LOGIN_LOCKOUT_MS,
  );
}

export function getLoginLockoutEscalationResetMs(): number {
  const configuredHours = Number(process.env.LOGIN_LOCKOUT_ESCALATION_RESET_HOURS ?? DEFAULT_LOGIN_LOCKOUT_RESET_HOURS);
  if (!Number.isFinite(configuredHours) || configuredHours <= 0) {
    throw new Error("LOGIN_LOCKOUT_ESCALATION_RESET_HOURS must be a positive number.");
  }
  const resetMs = Math.ceil(configuredHours * 60 * 60 * 1000);
  if (!Number.isSafeInteger(resetMs)) {
    throw new Error("LOGIN_LOCKOUT_ESCALATION_RESET_HOURS is outside the supported range.");
  }
  return resetMs;
}

export function getRetryAfterSeconds(lockoutUntil: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((lockoutUntil.getTime() - now.getTime()) / 1000));
}

export function applyLoginFailure(
  state: LoginFailureState,
  now: Date,
  escalationResetMs: number,
): LoginFailureState {
  if (state.loginLockoutUntil && state.loginLockoutUntil > now) return state;

  const previousLockouts = state.loginLockoutResetAt && state.loginLockoutResetAt > now
    ? state.loginLockoutCount
    : 0;
  const failedLoginAttempts = state.failedLoginAttempts + 1;
  if (failedLoginAttempts < MAX_CONSECUTIVE_LOGIN_FAILURES) {
    return {
      failedLoginAttempts,
      loginLockoutCount: previousLockouts,
      ...(previousLockouts > 0 ? { loginLockoutResetAt: state.loginLockoutResetAt } : {}),
    };
  }

  return {
    failedLoginAttempts: 0,
    loginLockoutUntil: new Date(now.getTime() + getLoginLockoutDurationMs(previousLockouts)),
    loginLockoutCount: previousLockouts + 1,
    loginLockoutResetAt: new Date(
      now.getTime() + getLoginLockoutDurationMs(previousLockouts) + escalationResetMs,
    ),
  };
}
