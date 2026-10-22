import { connectToDatabase } from "@/lib/db";
import { validateProductCreate } from "@/lib/product-validation";
import { createProduct, listProducts, parseProductListQuery } from "@/services/product-service";
import { logServerError } from "@/lib/server-logging";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const parsed = parseProductListQuery(new URL(request.url).searchParams);
  if (!parsed.success) {
    return Response.json({ success: false, error: { message: parsed.message } }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const result = await listProducts(parsed.data);
    return Response.json({ success: true, data: result.products, categories: result.categories, pagination: result.pagination });
  } catch (error) {
    logServerError("api/products GET", error);
    return Response.json({ success: false, error: { message: "Product service is temporarily unavailable." } }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin.ok) return admin.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return Response.json({ success: false, error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const parsed = validateProductCreate(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: { message: "Product validation failed.", details: parsed.errors } }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const product = await createProduct(parsed.data);
    return Response.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return Response.json({ success: false, error: { message: "A product with this externalId already exists." } }, { status: 409 });
    }
    if (error instanceof Error && error.name === "ValidationError") {
      return Response.json({ success: false, error: { message: "Product validation failed." } }, { status: 400 });
    }
    logServerError("api/products POST", error);
    return Response.json({ success: false, error: { message: "Product could not be created." } }, { status: 503 });
  }
}
