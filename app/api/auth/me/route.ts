import { cookies } from "next/headers";
import { findSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { logServerError } from "@/lib/server-logging";

export const instant = false;

export async function GET() {
  const cookieStore = await cookies();
  try {
    const user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
    if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ success: true, data: { user } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError("api/auth/me GET", error);
    return Response.json({ success: false, error: { message: "Account information is temporarily unavailable." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
