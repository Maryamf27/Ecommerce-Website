import { cookies } from "next/headers";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const instant = false;

async function GETHandler(_request: Request) {
  const cookieStore = await cookies();
  try {
    const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ success: true, data: { user } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse({ context: "api/auth/me GET", error, payload: { success: false, error: { message: "Account information is temporarily unavailable." } }, status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = withApiRequestLogging("GET /api/auth/me", GETHandler);
