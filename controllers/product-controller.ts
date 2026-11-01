import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/api-error";
import { validateProductCreate, validateProductUpdate } from "@/lib/product-validation";
import { createProduct, deleteProduct, getProduct, listProducts, parseProductListQuery, updateProduct, validProductId } from "@/services/product-service";

type ProductRouteContext = { params: Promise<{ id: string }> };

/** HTTP orchestration only: parse requests, enforce access, and shape responses. */
export const productController = {
  async list(request: Request) {
    const parsed = parseProductListQuery(new URL(request.url).searchParams);
    if (!parsed.success) return Response.json({ success: false, error: { message: parsed.message } }, { status: 400 });
    try {
      await connectToDatabase();
      const result = await listProducts(parsed.data);
      return Response.json({ success: true, data: result.products, categories: result.categories, pagination: result.pagination });
    } catch (error) {
      return apiErrorResponse({ context: "api/products GET", error, message: "Product service is temporarily unavailable.", status: 503 });
    }
  },

  async create(request: Request) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400 }); }
    const parsed = validateProductCreate(body);
    if (!parsed.success) return Response.json({ success: false, error: { message: "Product validation failed.", details: parsed.errors } }, { status: 400 });
    try {
      await connectToDatabase();
      const product = await createProduct(parsed.data);
      return Response.json({ success: true, data: product }, { status: 201 });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return Response.json({ success: false, error: { message: "A product with this externalId already exists." } }, { status: 409 });
      }
      if (error instanceof Error && error.name === "ValidationError") return Response.json({ success: false, error: { message: "Product validation failed." } }, { status: 400 });
      return apiErrorResponse({ context: "api/products POST", error, message: "Product could not be created.", status: 503 });
    }
  },

  async get(request: Request, context: ProductRouteContext) {
    const { id } = await context.params;
    if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
    try {
      await connectToDatabase();
      const product = await getProduct(id);
      if (!product) return Response.json({ success: false, error: { message: "Product not found." } }, { status: 404 });
      return Response.json({ success: true, data: product });
    } catch (error) {
      return apiErrorResponse({ context: "api/products/[id] GET", error, message: "Product service is temporarily unavailable.", status: 503 });
    }
  },

  async update(request: Request, context: ProductRouteContext) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    const { id } = await context.params;
    if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400 }); }
    const parsed = validateProductUpdate(body);
    if (!parsed.success) return Response.json({ success: false, error: { message: "Product validation failed.", details: parsed.errors } }, { status: 400 });
    try {
      await connectToDatabase();
      const product = await updateProduct(id, parsed.data);
      if (!product) return Response.json({ success: false, error: { message: "Product not found or id is invalid." } }, { status: 404 });
      return Response.json({ success: true, data: product });
    } catch (error) {
      if (error instanceof Error && error.name === "ValidationError") return Response.json({ success: false, error: { message: "Product validation failed." } }, { status: 400 });
      return apiErrorResponse({ context: "api/products/[id] PATCH", error, message: "Product could not be updated.", status: 503 });
    }
  },

  async remove(request: Request, context: ProductRouteContext) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    const { id } = await context.params;
    if (!validProductId(id)) return Response.json({ success: false, error: { message: "Product id is invalid." } }, { status: 400 });
    try {
      await connectToDatabase();
      const deleted = await deleteProduct(id);
      if (!deleted) return Response.json({ success: false, error: { message: "Product not found or id is invalid." } }, { status: 404 });
      return Response.json({ success: true, data: { id, deleted: true } });
    } catch (error) {
      return apiErrorResponse({ context: "api/products/[id] DELETE", error, message: "Product could not be deleted.", status: 503 });
    }
  },
};
