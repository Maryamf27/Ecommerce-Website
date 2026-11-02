import { productController } from "@/controllers/product-controller";
import { requireAdmin } from "@/lib/admin";
import { withApiRequestLogging } from "@/lib/api-request-logging";

/** Admin-only product listing. The existing controller handles filtering and pagination. */
async function GETHandler(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  return productController.list(request);
}

/** Admin-only product creation. The controller also enforces the write-origin check. */
async function POSTHandler(request: Request) {
  return productController.create(request);
}

export const GET = withApiRequestLogging("GET /api/admin/products", GETHandler);
export const POST = withApiRequestLogging("POST /api/admin/products", POSTHandler);
