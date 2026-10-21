import { connectToDatabase } from "@/lib/db";
import { createUserSession, getRequestSessionToken, hashPassword, requestHasValidOrigin, revokeUserSession, serializePublicUser, setSessionCookie } from "@/lib/auth";
import { validateRegistration } from "@/lib/auth-validation";
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

  const validation = validateRegistration(body);
  if (!validation.success) {
    return Response.json({ success: false, fields: validation.errors, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });
  }

  try {
    await connectToDatabase();
    await User.init();
    const user = await User.create({
      name: validation.data.name,
      email: validation.data.email,
      passwordHash: await hashPassword(validation.data.password),
      role: "customer",
    });
    await revokeUserSession(getRequestSessionToken(request));
    const session = await createUserSession(user._id.toString());
    const response = Response.json({ success: true, data: { user: serializePublicUser(user) } }, { status: 201, headers: noStore });
    return setSessionCookie(response, session.token, session.expiresAt);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return Response.json({ success: false, fields: { email: "An account with this email already exists." }, error: { message: "This email is already registered." } }, { status: 409, headers: noStore });
    }
    logServerError("api/auth/register POST", error);
    return Response.json({ success: false, error: { message: "Registration is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}
