import { authRepository } from "@/repositories/auth-repository";
import {
  clearLoginAttempts,
  createUserSession,
  hashPassword,
  isLoginRateLimited,
  isSignupRateLimited,
  revokeUserSession,
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
    await revokeUserSession(request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("nexora_session="))?.slice("nexora_session=".length));
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
    const currentToken = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("nexora_session="))?.slice("nexora_session=".length);
    await revokeUserSession(currentToken);
    const session = await createUserSession(user._id.toString());
    return { kind: "success" as const, user: serializePublicUser(user), session };
  },
};
