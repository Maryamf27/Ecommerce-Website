import { tagController } from "@/controllers/tag-controller";
import { withApiRequestLogging } from "@/lib/api-request-logging";

export const GET = withApiRequestLogging("GET /api/admin/tags", tagController.list);
export const POST = withApiRequestLogging("POST /api/admin/tags", tagController.create);
