import { authRepository } from "@/repositories/auth-repository";
import {
  clearLoginAttempts,
  createUserSession,
  hashPassword,
  isLoginRateLimited,
  isSignupRateLimited,
   revokeUserSession,
  REFRESH_COOKIE,
  serializePublicUser,
  verifyPassword,
} from "@/lib/auth";

export const authService = {
  async login(email: string, password: string, request: Request) {
    if (await isLoginRateLimited(email, request)) return { kind: "rate_limited" as const };
    const user = await authRepository.findByEmailWithPassword(email);
    const passwordMatches = await verifyPassword(password, user?.passwordHash);
    if (!user || !passwordMatches) return { kind: "invalid_credentials" as const };
    await clearLoginAttempts(email, request);
    const cookies = request.headers.get("cookie")?.split(";").map((item) => item.trim()) ?? [];
    await Promise.all([
      revokeUserSession(cookies.find((item) => item.startsWith("nexora_access="))?.slice("nexora_access=".length)),
      revokeUserSession(cookies.find((item) => item.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1)),
    ]);
    const session = await createUserSession(user._id.toString());
    return { kind: "success" as const, user: serializePublicUser(user), session };
  },

  async register(input: { name: string; email: string; password: string }, request: Request) {
    if (await isSignupRateLimited(request)) return { kind: "rate_limited" as const };
    const user = await authRepository.createCustomer({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    const cookies = request.headers.get("cookie")?.split(";").map((item) => item.trim()) ?? [];
    await Promise.all([
      revokeUserSession(cookies.find((item) => item.startsWith("nexora_access="))?.slice("nexora_access=".length)),
      revokeUserSession(cookies.find((item) => item.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1)),
    ]);
    const session = await createUserSession(user._id.toString());
    return { kind: "success" as const, user: serializePublicUser(user), session };
  },
};
