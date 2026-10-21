import { findSessionUser, getRequestSessionToken } from "@/lib/auth";
import { getWishlist, parseProductIds, resolveWishlist, setWishlist } from "@/lib/commerce-service";
import { logServerError } from "@/lib/server-logging";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: noStore });
    return Response.json({ success: true, data: { items: await getWishlist(user.id) } }, { headers: noStore });
  } catch (error) {
    logServerError("api/wishlist GET", error);
    return Response.json({ success: false, error: { message: "Your wishlist is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore });
  }
  const ids = typeof body === "object" && body !== null && !Array.isArray(body)
    ? parseProductIds((body as Record<string, unknown>).productIds)
    : null;
  if (!ids) return Response.json({ success: false, error: { message: "Wishlist product IDs are invalid." } }, { status: 400, headers: noStore });

  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    const items = user ? await setWishlist(user.id, ids) : await resolveWishlist(ids);
    return Response.json({ success: true, data: { items } }, { headers: noStore });
  } catch (error) {
    logServerError("api/wishlist PUT", error);
    return Response.json({ success: false, error: { message: "Your wishlist could not be updated." } }, { status: 503, headers: noStore });
  }
}
