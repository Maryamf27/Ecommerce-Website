import { connectToDatabase } from "@/lib/db";
import { findSessionUser, getRequestSessionToken, hashPassword, requestHasValidOrigin, revokeOtherUserSessions, verifyPassword } from "@/lib/auth";
import { logServerError } from "@/lib/server-logging";
import User from "@/models/User";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
  const data = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const currentPassword = typeof data.currentPassword === "string" ? data.currentPassword : "";
  const newPassword = typeof data.newPassword === "string" ? data.newPassword : "";
  const confirmPassword = typeof data.confirmPassword === "string" ? data.confirmPassword : "";
  const fields: Record<string, string> = {};
  if (!currentPassword) fields.currentPassword = "Enter your current password.";
  if (newPassword.length < 8) fields.newPassword = "Use at least 8 characters.";
  else if (new TextEncoder().encode(newPassword).length > 72) fields.newPassword = "Password is too long. Please choose a shorter one.";
  else if (newPassword === currentPassword) fields.newPassword = "Choose a password different from your current one.";
  if (confirmPassword !== newPassword) fields.confirmPassword = "Passwords do not match.";
  if (Object.keys(fields).length) return Response.json({ success: false, fields, error: { message: "Check the highlighted fields." } }, { status: 400, headers: noStore });

  try {
    const token = getRequestSessionToken(request);
    const sessionUser = await findSessionUser(token);
    if (!sessionUser) return Response.json({ success: false, error: { message: "Sign in to continue." } }, { status: 401, headers: noStore });
    await connectToDatabase();
    const user = await User.findById(sessionUser.id).select("+passwordHash");
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return Response.json({ success: false, fields: { currentPassword: "Current password is incorrect." }, error: { message: "Current password is incorrect." } }, { status: 400, headers: noStore });
    }
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await revokeOtherUserSessions(sessionUser.id, token);
    return Response.json({ success: true, data: { changed: true } }, { headers: noStore });
  } catch (error) {
    logServerError("api/account/password POST", error);
    return Response.json({ success: false, error: { message: "Your password could not be changed." } }, { status: 503, headers: noStore });
  }
}
