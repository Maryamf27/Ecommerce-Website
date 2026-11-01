import { productController } from "@/controllers/product-controller";

type ProductRouteContext = { params: Promise<{ id: string }> };

export function GET(request: Request, context: ProductRouteContext) {
  return productController.get(request, context);
}

export function PATCH(request: Request, context: ProductRouteContext) {
  return productController.update(request, context);
}

export function DELETE(request: Request, context: ProductRouteContext) {
  return productController.remove(request, context);
}
