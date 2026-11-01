import { getRequestSessionToken, findSessionUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { CartStockError, getCart, getCartStockIssues, parseCartLines, resolveCart, setCart } from "@/services/cart-service";

const noStore = { "Cache-Control": "no-store" };
const adminMessage = "Administrator accounts cannot use customer shopping features.";
const authMessage = "Authentication required.";

export const cartController = {
  async get(request: Request) {
    try {
      const user = await findSessionUser(getRequestSessionToken(request));
      if (!user) return Response.json({ success: false, error: { message: authMessage } }, { status: 401, headers: noStore });
      if (user.role === "admin") return Response.json({ success: false, error: { message: adminMessage } }, { status: 403, headers: noStore });
      return Response.json({ success: true, data: await getCart(user.id) }, { headers: noStore });
    } catch (error) {
      return apiErrorResponse({ context: "api/cart GET", error, payload: { success: false, error: { message: "Your cart is temporarily unavailable." } }, status: 503, headers: noStore });
    }
  },

  async update(request: Request) {
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore }); }
    const lines = typeof body === "object" && body !== null && !Array.isArray(body)
      ? parseCartLines((body as Record<string, unknown>).items)
      : null;
    if (!lines) return Response.json({ success: false, error: { message: "Cart items or quantities are invalid." } }, { status: 400, headers: noStore });

    try {
      const user = await findSessionUser(getRequestSessionToken(request));
      if (user?.role === "admin") return Response.json({ success: false, error: { message: adminMessage } }, { status: 403, headers: noStore });
      let data;
      if (user) data = await setCart(user.id, lines);
      else {
        const issues = await getCartStockIssues(lines);
        if (issues.length) return stockConflict(issues);
        const items = await resolveCart(lines);
        data = { items, subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0), count: items.reduce((sum, item) => sum + item.quantity, 0) };
      }
      return Response.json({ success: true, data }, { headers: noStore });
    } catch (error) {
      if (error instanceof CartStockError) return stockConflict(error.issues);
      return apiErrorResponse({ context: "api/cart PUT", error, payload: { success: false, error: { message: "Your cart could not be updated." } }, status: 503, headers: noStore });
    }
  },
};

function stockConflict(issues: Array<{ title: string; requested: number; available: number }>) {
  const message = issues.map((issue) => `${issue.title}: requested ${issue.requested}, ${issue.available} available.`).join(" ");
  return Response.json({ success: false, error: { message, details: issues } }, { status: 409, headers: noStore });
}
