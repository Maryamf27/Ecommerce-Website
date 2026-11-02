import { cartController } from "@/controllers/cart-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const GET = withApiRequestLogging("GET /api/cart", cartController.get);
export const PUT = withApiRequestLogging("PUT /api/cart", cartController.update);
