import { patchAdminOrder } from "@/controllers/order-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
async function PATCHHandler(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return patchAdminOrder(request, id);
}

export const PATCH = withApiRequestLogging("PATCH /api/admin/orders/[id]", PATCHHandler);
