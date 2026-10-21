import { connectToDatabase } from "@/lib/db";
import { clearLoginAttempts, createUserSession, getRequestSessionToken, isLoginRateLimited, requestHasValidOrigin, revokeUserSession, serializePublicUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { validateLogin } from "@/lib/auth-validation";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore });
  }

  const validation = validateLogin(body);
  if (!validation.success) {
    return Response.json({ success: false, fields: validation.errors, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });
  }

  try {
    await connectToDatabase();
    if (await isLoginRateLimited(validation.data.email, request)) {
      return Response.json({ success: false, error: { message: "Too many sign-in attempts. Try again in 15 minutes." } }, { status: 429, headers: { ...noStore, "Retry-After": "900" } });
    }

    const user = await User.findOne({ email: validation.data.email }).select("+passwordHash");
    const passwordMatches = await verifyPassword(validation.data.password, user?.passwordHash);
    if (!user || !passwordMatches) {
      return Response.json({ success: false, error: { message: "Email or password is incorrect." } }, { status: 401, headers: noStore });
    }

    await clearLoginAttempts(validation.data.email, request);
    await revokeUserSession(getRequestSessionToken(request));
    const session = await createUserSession(user._id.toString());
    const response = Response.json({ success: true, data: { user: serializePublicUser(user) } }, { headers: noStore });
    return setSessionCookie(response, session.token, session.expiresAt);
  } catch (error) {
    logServerError("api/auth/login POST", error);
    return Response.json({ success: false, error: { message: "Sign-in is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}
