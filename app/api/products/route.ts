import { productController } from "@/controllers/product-controller";

import { withApiRequestLogging } from "@/lib/api-request-logging";
export const GET = withApiRequestLogging("GET /api/products", productController.list);
export const POST = withApiRequestLogging("POST /api/products", productController.create);
