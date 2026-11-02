import { getCustomerOrder } from "@/controllers/order-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const instant = false;

async function GETHandler(request: Request) {
  return getCustomerOrder(request);
}

export const GET = withApiRequestLogging("GET /api/orders", GETHandler);
