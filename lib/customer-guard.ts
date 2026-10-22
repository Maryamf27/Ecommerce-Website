import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findSessionUser, SESSION_COOKIE, type PublicUser } from "@/lib/auth";

/** Customer-only pages: administrators are sent to the dashboard instead. Returns the user (or null for guests). */
export async function redirectAdminAway(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  let user: PublicUser | null = null;
  try { user = await findSessionUser(cookieStore.get(SESSION_COOKIE)?.value); } catch { user = null; }
  if (user?.role === "admin") redirect("/admin");
  return user;
}
