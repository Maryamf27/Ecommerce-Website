import { findSessionUser, getRequestSessionToken, requestHasValidOrigin } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { validateCheckoutRequest } from "@/lib/checkout-validation";
import { createCheckoutSession } from "@/services/checkout-service";

const noStore = { "Cache-Control": "no-store" };

export const checkoutController = {
  async createSession(request: Request) {
    if (!requestHasValidOrigin(request)) {
      return Response.json({ success: false, error: { message: "Request origin could not be verified." } }, { status: 403, headers: noStore });
    }

    let user;
    try {
      user = await findSessionUser(getRequestSessionToken(request));
    } catch (error) {
      return apiErrorResponse({ context: "api/checkout/session auth", error, payload: { success: false, error: { message: "Your account is temporarily unavailable." } }, status: 503, headers: noStore });
    }
    if (!user) return Response.json({ success: false, error: { message: "Sign in to continue to checkout." } }, { status: 401, headers: noStore });
    if (user.role === "admin") return Response.json({ success: false, error: { message: "Administrator accounts cannot place orders." } }, { status: 403, headers: noStore });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400, headers: noStore });
    }

    const validation = validateCheckoutRequest(body);
    if (!validation.success) {
      return Response.json({
        success: false,
        error: { message: validation.message ?? "Check the highlighted checkout details.", fields: validation.errors },
      }, { status: 400, headers: noStore });
    }

    try {
      const result = await createCheckoutSession(user.id, validation.data);
      switch (result.kind) {
        case "success":
          return Response.json({ success: true, data: { url: result.url } }, { headers: noStore });
        case "cart_changed":
          return Response.json({ success: false, error: { code: "cart_changed", message: "Your cart changed. Review it before paying." } }, { status: 409, headers: noStore });
        case "price_changed":
          return Response.json({ success: false, error: { code: "price_changed", message: "Product prices or quantities changed. Review the updated cart and confirm again.", data: result.data } }, { status: 409, headers: noStore });
        case "unavailable":
          return Response.json({ success: false, error: { code: "unavailable", message: result.message, details: result.details } }, { status: 409, headers: noStore });
        case "zero_total":
          return Response.json({ success: false, error: { message: "The cart total must be greater than zero." } }, { status: 400, headers: noStore });
        case "not_payable":
          return Response.json({ success: false, error: { message: "This checkout attempt can no longer be paid. Start a new checkout." } }, { status: 409, headers: noStore });
      }
    } catch (error) {
      if (error instanceof RangeError) return Response.json({ success: false, error: { message: error.message } }, { status: 409, headers: noStore });
      return apiErrorResponse({ context: "api/checkout/session POST", error, payload: { success: false, error: { message: "Secure checkout is temporarily unavailable. Please try again." } }, status: 503, headers: noStore });
    }
  },
};
