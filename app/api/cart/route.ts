import { getRequestSessionToken, findSessionUser } from "@/lib/auth";
import { CartStockError, getCart, getCartStockIssues, parseCartLines, resolveCart, setCart } from "@/lib/commerce-service";
import { logServerError } from "@/lib/server-logging";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    if (!user) return Response.json({ success: false, error: { message: "Authentication required." } }, { status: 401, headers: noStore });
    return Response.json({ success: true, data: await getCart(user.id) }, { headers: noStore });
  } catch (error) {
    logServerError("api/cart GET", error);
    return Response.json({ success: false, error: { message: "Your cart is temporarily unavailable." } }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore });
  }
  const lines = typeof body === "object" && body !== null && !Array.isArray(body)
    ? parseCartLines((body as Record<string, unknown>).items)
    : null;
  if (!lines) return Response.json({ success: false, error: { message: "Cart items or quantities are invalid." } }, { status: 400, headers: noStore });

  try {
    const user = await findSessionUser(getRequestSessionToken(request));
    let data;
    if (user) data = await setCart(user.id, lines);
    else {
      const issues = await getCartStockIssues(lines);
      if (issues.length > 0) return Response.json({ success: false, error: { message: formatStockIssues(issues), details: issues } }, { status: 409, headers: noStore });
      const items = await resolveCart(lines);
      data = { items, subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0), count: items.reduce((sum, item) => sum + item.quantity, 0) };
    }
    return Response.json({ success: true, data }, { headers: noStore });
  } catch (error) {
    if (error instanceof CartStockError) return Response.json({ success: false, error: { message: formatStockIssues(error.issues), details: error.issues } }, { status: 409, headers: noStore });
    logServerError("api/cart PUT", error);
    return Response.json({ success: false, error: { message: "Your cart could not be updated." } }, { status: 503, headers: noStore });
  }
}

function formatStockIssues(issues: Array<{ title: string; requested: number; available: number }>) {
  return issues.map((issue) => `${issue.title}: requested ${issue.requested}, ${issue.available} available.`).join(" ");
}
