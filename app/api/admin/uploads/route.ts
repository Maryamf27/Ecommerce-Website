import { requireAdmin } from "@/lib/admin";
import { connectToDatabase } from "@/lib/db";
import { detectImageType, MAX_UPLOAD_BYTES } from "@/lib/image-upload";
import { logServerError } from "@/lib/server-logging";
import ProductImage from "@/models/ProductImage";

const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, message: string) => Response.json({ success: false, error: { message } }, { status, headers: noStore });

/** Admin-only: upload one product image (multipart field "file"). Returns the site path to store on the product. */
export async function POST(request: Request) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin.ok) return admin.response;

  // Reject obviously oversized bodies before reading them (a little headroom for multipart overhead).
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "Image is too large. The maximum size is 2 MB.");

  let file: FormDataEntryValue | null;
  try { file = (await request.formData()).get("file"); } catch { return fail(400, "Upload must be a multipart form with a file."); }
  if (!(file instanceof File)) return fail(400, "Choose an image file to upload.");
  if (file.size === 0) return fail(400, "The selected file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "Image is too large. The maximum size is 2 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) return fail(415, "Only PNG, JPG, WebP or GIF images are supported.");

  try {
    await connectToDatabase();
    const image = await ProductImage.create({ data: Buffer.from(bytes), contentType, size: bytes.length });
    return Response.json({ success: true, data: { url: `/api/images/${image._id.toString()}` } }, { status: 201, headers: noStore });
  } catch (error) {
    logServerError("api/admin/uploads POST", error);
    return fail(503, "The image could not be saved right now. Please try again.");
  }
}
