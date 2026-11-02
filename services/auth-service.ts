import { authRepository } from "@/repositories/auth-repository";
import {
  createUserSession,
  hashPassword,
  isSignupRateLimited,
  revokeUserSession,
  REFRESH_COOKIE,
  serializePublicUser,
} from "@/lib/auth";
import { authenticateLogin } from "@/services/login-authentication";

export const authService = {
  async login(email: string, password: string, request: Request) {
    const authentication = await authenticateLogin(email, password, request);
    if (authentication.kind !== "authenticated") return authentication;
    const user = authentication.account;
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
