import { productController } from "@/controllers/product-controller";
import { withApiRequestLogging } from "@/lib/api-request-logging";

type ProductRouteContext = { params: Promise<{ id: string }> };

function GETHandler(request: Request, context: ProductRouteContext) {
  return productController.get(request, context);
}

function PATCHHandler(request: Request, context: ProductRouteContext) {
  return productController.update(request, context);
}

function DELETEHandler(request: Request, context: ProductRouteContext) {
  return productController.remove(request, context);
}

export const GET = withApiRequestLogging("GET /api/products/[id]", GETHandler);
export const PATCH = withApiRequestLogging("PATCH /api/products/[id]", PATCHHandler);
export const DELETE = withApiRequestLogging("DELETE /api/products/[id]", DELETEHandler);
