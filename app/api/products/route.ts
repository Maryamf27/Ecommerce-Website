import { productController } from "@/controllers/product-controller";

export const GET = productController.list;
export const POST = productController.create;
