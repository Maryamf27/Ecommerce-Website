import { findSessionUser, getRequestSessionToken, requestHasValidOrigin, type PublicUser } from "@/lib/auth";
import { logServerError } from "@/lib/server-logging";

const noStore = { "Cache-Control": "no-store" };

type AdminResult = { ok: true; user: PublicUser } | { ok: false; response: Response };

/**
 * Guard for admin API routes. Requires a signed-in user with the admin role.
 * Write requests must also come from the configured app origin.
 */
export async function requireAdmin(request: Request, options: { write?: boolean } = {}): Promise<AdminResult> {
  const fail = (status: number, message: string): AdminResult => ({
    ok: false,
    response: Response.json({ success: false, error: { message } }, { status, headers: noStore }),
  });
  if (options.write && !requestHasValidOrigin(request)) return fail(403, "Request origin could not be verified.");
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return fail(401, "Sign in to continue.");
    if (user.role !== "admin") return fail(403, "Administrator access is required.");
    return { ok: true, user };
  } catch (error) {
    logServerError("requireAdmin", error);
    return fail(503, "Account information is temporarily unavailable.");
  }
}
