import { getAdminOrders } from "@/controllers/order-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const instant = false;

async function GETHandler(request: Request) {
  return getAdminOrders(request);
}

export const GET = withApiRequestLogging("GET /api/admin/orders", GETHandler);
