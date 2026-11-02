import { apiErrorResponse } from "@/lib/api-error";
import { validateLogin, validateRegistration } from "@/lib/auth-validation";
import { clearSessionCookie, getRequestSessionToken, REFRESH_COOKIE, refreshUserSession, requestHasValidOrigin, revokeUserSession, setTokenCookies } from "@/lib/auth";
import { authService } from "@/services/auth-service";

const noStore = { "Cache-Control": "no-store" };

export const authController = {
  async login(request: Request) {
    if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
    const validation = validateLogin(body);
    if (!validation.success) return Response.json({ success: false, fields: validation.errors, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });
    try {
      const result = await authService.login(validation.data.email, validation.data.password, request);
      if (result.kind === "rate_limited") return Response.json({ success: false, error: { message: "Too many sign-in attempts. Try again in 15 minutes." } }, { status: 429, headers: { ...noStore, "Retry-After": "900" } });
      if (result.kind === "invalid_credentials") return Response.json({ success: false, error: { message: "Email or password is incorrect." } }, { status: 401, headers: noStore });
      const response = Response.json({ success: true, data: { user: result.user } }, { headers: noStore });
      return setTokenCookies(response, result.session);
    } catch (error) {
      return apiErrorResponse({ context: "api/auth/login POST", error, payload: { success: false, error: { message: "Sign-in is temporarily unavailable." } }, status: 503, headers: noStore });
    }
  },

  async register(request: Request) {
    if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
    const validation = validateRegistration(body);
    if (!validation.success) return Response.json({ success: false, fields: validation.errors, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });
    try {
      const result = await authService.register(validation.data, request);
      if (result.kind === "rate_limited") return Response.json({ success: false, error: { message: "Too many signup attempts. Try again in 15 minutes." } }, { status: 429, headers: { ...noStore, "Retry-After": "900" } });
      const response = Response.json({ success: true, data: { user: result.user } }, { status: 201, headers: noStore });
      return setTokenCookies(response, result.session);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return Response.json({ success: false, fields: { email: "An account with this email already exists." }, error: { message: "This email is already registered." } }, { status: 409, headers: noStore });
      return apiErrorResponse({ context: "api/auth/register POST", error, payload: { success: false, error: { message: "Registration is temporarily unavailable." } }, status: 503, headers: noStore });
    }
  },

  async refresh(request: Request) {
    if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
    const refreshToken = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1);
    try {
      const result = await refreshUserSession(refreshToken);
      if (!result) return clearSessionCookie(Response.json({ success: false, error: { message: "Session expired. Please sign in again." } }, { status: 401, headers: noStore }));
      const response = Response.json({ success: true, data: { user: result.user } }, { headers: noStore });
      return setTokenCookies(response, result.tokens);
    } catch (error) {
      return apiErrorResponse({ context: "api/auth/refresh POST", error, payload: { success: false, error: { message: "Session refresh is temporarily unavailable." } }, status: 503, headers: noStore });
    }
  },

  async logout(request: Request) {
    if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
    try {
      await Promise.all([
        revokeUserSession(getRequestSessionToken(request)),
        revokeUserSession(request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1)),
      ]);
      return clearSessionCookie(Response.json({ success: true }, { headers: noStore }));
    } catch (error) {
      return apiErrorResponse({ context: "api/auth/logout POST", error, payload: { success: false, error: { message: "Sign-out is temporarily unavailable." } }, status: 503, headers: noStore });
    }
  },
};
