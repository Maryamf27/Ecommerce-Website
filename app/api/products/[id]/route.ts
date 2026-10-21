import { connectToDatabase } from "@/lib/db";
import { validateProductUpdate } from "@/lib/product-validation";
import { deleteProduct, getProduct, updateProduct, validProductId } from "@/services/product-service";

type ProductRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: ProductRouteContext) {
  const { id } = await context.params;
  if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
  try {
    await connectToDatabase();
    const product = await getProduct(id);
    if (!product) return Response.json({ success: false, error: { message: "Product not found." } }, { status: 404 });
    return Response.json({ success: true, data: product });
  } catch {
    return Response.json({ success: false, error: { message: "Product service is temporarily unavailable." } }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: ProductRouteContext) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ success: false, error: { message: "Product writes are disabled until admin authentication is added." } }, { status: 403 });
  }
  const { id } = await context.params;
  if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const parsed = validateProductUpdate(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: { message: "Product validation failed.", details: parsed.errors } }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const product = await updateProduct(id, parsed.data);
    if (!product) return Response.json({ success: false, error: { message: "Product not found or id is invalid." } }, { status: 404 });
    return Response.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof Error && error.name === "ValidationError") {
      return Response.json({ success: false, error: { message: "Product validation failed." } }, { status: 400 });
    }
    return Response.json({ success: false, error: { message: "Product could not be updated." } }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: ProductRouteContext) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ success: false, error: { message: "Product writes are disabled until admin authentication is added." } }, { status: 403 });
  }
  const { id } = await context.params;
  if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
  try {
    await connectToDatabase();
    const deleted = await deleteProduct(id);
    if (!deleted) return Response.json({ success: false, error: { message: "Product not found or id is invalid." } }, { status: 404 });
    return Response.json({ success: true, data: { id, deleted: true } });
  } catch {
    return Response.json({ success: false, error: { message: "Product could not be deleted." } }, { status: 503 });
  }
}
