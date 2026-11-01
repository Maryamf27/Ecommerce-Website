import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import ProductImage from "@/models/ProductImage";
import { apiErrorResponse } from "@/lib/api-error";

type Context = { params: Promise<{ id: string }> };

/** Public: serves an uploaded product image. Each upload gets a new id, so it can be cached forever. */
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!mongoose.isObjectIdOrHexString(id)) return new Response("Not found", { status: 404 });
  try {
    await connectToDatabase();
    const image = await ProductImage.findById(id);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(image.data), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return apiErrorResponse({ context: "api/images GET", error, responseBody: "Image service is temporarily unavailable.", contentType: "text/plain; charset=utf-8", status: 503 });
  }
}
