import { tagController } from "@/controllers/tag-controller";
import { withApiRequestLogging } from "@/lib/api-request-logging";

type TagRouteContext = { params: Promise<{ id: string }> };

export const PATCH = withApiRequestLogging(
  "PATCH /api/admin/tags/[id]",
  (request: Request, context: TagRouteContext) => tagController.rename(request, context),
);
export const DELETE = withApiRequestLogging(
  "DELETE /api/admin/tags/[id]",
  (request: Request, context: TagRouteContext) => tagController.remove(request, context),
);
