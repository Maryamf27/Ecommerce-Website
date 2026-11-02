import { checkoutController } from "@/controllers/checkout-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const POST = withApiRequestLogging("POST /api/checkout/session", checkoutController.createSession);
