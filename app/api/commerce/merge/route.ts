import { findSessionUser, getRequestSessionToken } from "@/lib/auth";
import { CartStockError, mergeCommerce, parseCartLines, parseProductIds } from "@/lib/commerce-service";
import { logServerError } from "@/lib/server-logging";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let user;
  try { user = await findSessionUser(getRequestSessionToken(request)); } catch (error) {
    logServerError("api/commerce/merge auth", error);
    return Response.json({ success: false, error: { message: "Shopping data is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
  if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: noStore });

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ success: false, error: { message: "Guest shopping data is invalid." } }, { status: 400, headers: noStore });
  }
  const input = body as Record<string, unknown>;
  const cartItems = parseCartLines(input.cartItems);
  const wishlistIds = parseProductIds(input.wishlistIds);
  if (!cartItems || !wishlistIds || typeof input.mergeId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.mergeId)) return Response.json({ success: false, error: { message: "Guest shopping data is invalid." } }, { status: 400, headers: noStore });

  try {
    const data = await mergeCommerce(user.id, cartItems, wishlistIds, input.mergeId);
    return Response.json({ success: true, data }, { headers: noStore });
  } catch (error) {
    if (error instanceof CartStockError) return Response.json({ success: false, error: { message: error.issues.map((issue) => `${issue.title}: ${issue.available} available, ${issue.requested} requested.`).join(" "), details: error.issues } }, { status: 409, headers: noStore });
    if (error instanceof RangeError) return Response.json({ success: false, error: { message: error.message } }, { status: 409, headers: noStore });
    logServerError("api/commerce/merge POST", error);
    return Response.json({ success: false, error: { message: "Your shopping data could not be merged." } }, { status: 503, headers: noStore });
  }
}
