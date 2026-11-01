import { clearSessionCookie, getRequestSessionToken, requestHasValidOrigin, revokeUserSession } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await revokeUserSession(getRequestSessionToken(request));
    const response = Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    return clearSessionCookie(response);
  } catch (error) {
    return apiErrorResponse({ context: "api/auth/logout POST", error, payload: { success: false, error: { message: "Sign-out is temporarily unavailable." } }, status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
