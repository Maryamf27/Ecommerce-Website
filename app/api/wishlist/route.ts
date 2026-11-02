import { findSessionUser, getRequestSessionToken } from "@/lib/auth";
import { getWishlist, parseProductIds, resolveWishlist, setWishlist } from "@/lib/commerce-service";
import { apiErrorResponse } from "@/lib/api-error";

import { withApiRequestLogging } from "@/lib/api-request-logging";
const noStore = { "Cache-Control": "no-store" };

async function GETHandler(request: Request) {
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: noStore });
    if (user.role === "admin") return Response.json({ success: false, error: { message: "Administrator accounts cannot use customer shopping features." } }, { status: 403, headers: noStore });
    return Response.json({ success: true, data: { items: await getWishlist(user.id) } }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse({ context: "api/wishlist GET", error, payload: { success: false, error: { message: "Your wishlist is temporarily unavailable." } }, status: 503, headers: noStore });
  }
}

async function PUTHandler(request: Request) {
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
    if (user?.role === "admin") return Response.json({ success: false, error: { message: "Administrator accounts cannot use customer shopping features." } }, { status: 403, headers: noStore });
    const items = user ? await setWishlist(user.id, ids) : await resolveWishlist(ids);
    return Response.json({ success: true, data: { items } }, { headers: noStore });
  } catch (error) {
    return apiErrorResponse({ context: "api/wishlist PUT", error, payload: { success: false, error: { message: "Your wishlist could not be updated." } }, status: 503, headers: noStore });
  }
}

export const GET = withApiRequestLogging("GET /api/wishlist", GETHandler);
export const PUT = withApiRequestLogging("PUT /api/wishlist", PUTHandler);
