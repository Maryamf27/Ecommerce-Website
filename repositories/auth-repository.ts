import User from "@/models/User";
import LoginAttempt from "@/models/LoginAttempt";
import {
  BASE_LOGIN_LOCKOUT_MS,
  LOGIN_ATTEMPT_WINDOW_MS,
  loginAccountAttemptKey,
  MAX_CONSECUTIVE_LOGIN_FAILURES,
  MAX_LOGIN_LOCKOUT_MS,
  getLoginLockoutEscalationResetMs,
} from "@/lib/login-lockout";

async function updateFailedLoginState(key: string, update: object[], upsert: boolean): Promise<Date | null> {
  const updated = await LoginAttempt.findOneAndUpdate(
    { key },
    update,
    { new: true, upsert, updatePipeline: true },
  )
    .select("lockoutUntil")
    .lean<{ lockoutUntil?: Date } | null>();
  return updated?.lockoutUntil ?? null;
}

/** Database-only user operations used by authentication services. */
export const authRepository = {
  findByEmailWithPassword(email: string) {
    return User.findOne({ email }).select("+passwordHash");
  },
  async getLoginLockoutUntil(email: string): Promise<Date | null> {
    const attempt = await LoginAttempt.findOne({ key: loginAccountAttemptKey(email) })
      .select("lockoutUntil")
      .lean<{ lockoutUntil?: Date } | null>();
    return attempt?.lockoutUntil ?? null;
  },
  async recordFailedLogin(email: string): Promise<Date | null> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + getLoginLockoutEscalationResetMs());
    const key = loginAccountAttemptKey(email);
    const activeLockout = { $gt: ["$lockoutUntil", now] };
    const startsLockout = { $gte: ["$_failureCount", MAX_CONSECUTIVE_LOGIN_FAILURES] };
    const lockoutDuration = {
      $switch: {
        branches: Array.from({ length: 8 }, (_, previousLockouts) => ({
          case: { $eq: ["$_escalationCount", previousLockouts] },
          then: Math.min(BASE_LOGIN_LOCKOUT_MS * 2 ** previousLockouts, MAX_LOGIN_LOCKOUT_MS),
        })),
        default: MAX_LOGIN_LOCKOUT_MS,
      },
    };
    const update = [
      {
        $set: {
          _failureCount: {
            $cond: [
              { $gt: ["$expiresAt", now] },
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
              1,
            ],
          },
          _escalationCount: {
            $cond: [
              { $gt: ["$lockoutResetAt", now] },
              { $ifNull: ["$lockoutCount", 0] },
              0,
            ],
          },
          _alreadyLocked: activeLockout,
        },
      },
      {
        $set: {
          count: {
            $cond: [
              "$_alreadyLocked",
              { $ifNull: ["$count", 0] },
              { $cond: [startsLockout, 0, "$_failureCount"] },
            ],
          },
          lockoutUntil: {
            $cond: [
              "$_alreadyLocked",
              "$lockoutUntil",
              { $cond: [startsLockout, { $add: [now, lockoutDuration] }, "$$REMOVE"] },
            ],
          },
          lockoutCount: {
            $cond: [
              "$_alreadyLocked",
              { $ifNull: ["$lockoutCount", 0] },
              { $cond: [startsLockout, { $add: ["$_escalationCount", 1] }, "$_escalationCount"] },
            ],
          },
          lockoutResetAt: {
            $cond: [
              "$_alreadyLocked",
              "$lockoutResetAt",
              {
                $cond: [
                  startsLockout,
                  { $add: [resetAt, lockoutDuration] },
                  {
                    $cond: [
                      { $gt: ["$_escalationCount", 0] },
                      "$lockoutResetAt",
                      "$$REMOVE",
                    ],
                  },
                ],
              },
            ],
          },
          expiresAt: {
            $cond: [
              "$_alreadyLocked",
              "$expiresAt",
              {
                $cond: [
                  startsLockout,
                  { $add: [resetAt, lockoutDuration] },
                  {
                    $cond: [
                      { $gt: ["$_escalationCount", 0] },
                      "$lockoutResetAt",
                      { $add: [now, LOGIN_ATTEMPT_WINDOW_MS] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { $unset: ["_failureCount", "_escalationCount", "_alreadyLocked"] },
    ];

    try {
      return await updateFailedLoginState(key, update, true);
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) throw error;
      return updateFailedLoginState(key, update, false);
    }
  },
  async resetFailedLoginState(email: string): Promise<boolean> {
    const now = new Date();
    const key = loginAccountAttemptKey(email);
    const cleared = await LoginAttempt.findOneAndDelete({
      key,
      $or: [
        { lockoutUntil: { $exists: false } },
        { lockoutUntil: null },
        { lockoutUntil: { $lte: now } },
      ],
    }).select("key").lean<{ key: string } | null>();
    if (cleared) return true;
    const activeLockout = await LoginAttempt.findOne({
      key,
      lockoutUntil: { $gt: new Date() },
    }).select("lockoutUntil").lean<{ lockoutUntil: Date } | null>();
    return !activeLockout;
  },
  async createCustomer(input: { name: string; email: string; passwordHash: string }) {
    await User.init();
    return User.create({ ...input, role: "customer" });
  },
};
