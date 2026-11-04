import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/api-error";
import { normalizeTagName } from "@/lib/tag-validation";
import { createTag, deleteTag, listTags, renameTag, TagInUseError } from "@/services/tag-service";

const noStore = { "Cache-Control": "no-store" };
type TagRouteContext = { params: Promise<{ id: string }> };

async function readJson(request: Request): Promise<unknown | null> {
  try { return await request.json(); } catch { return null; }
}

function success(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status, headers: noStore });
}

function badRequest(message: string) {
  return Response.json({ success: false, error: { message } }, { status: 400, headers: noStore });
}

export const tagController = {
  async list(request: Request) {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
    try {
      await connectToDatabase();
      return success(await listTags());
    } catch (error) {
      return apiErrorResponse({ context: "api/admin/tags GET", error, message: "Tags could not be loaded.", status: 503, headers: noStore });
    }
  },

  async create(request: Request) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    const body = await readJson(request);
    if (typeof body !== "object" || body === null || Array.isArray(body) || !("name" in body)) return badRequest("A tag name is required.");
    const normalized = normalizeTagName(body.name);
    if (!normalized) return badRequest("Tag name must be 1–60 characters and include at least one letter or number.");
    try {
      await connectToDatabase();
      return success(await createTag(normalized.name, normalized.slug), 201);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return Response.json({ success: false, error: { message: "A tag with this name already exists." } }, { status: 409, headers: noStore });
      }
      return apiErrorResponse({ context: "api/admin/tags POST", error, message: "Tag could not be created.", status: 503, headers: noStore });
    }
  },

  async rename(request: Request, context: TagRouteContext) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    const { id } = await context.params;
    if (!mongoose.isObjectIdOrHexString(id)) return badRequest("Tag id is invalid.");
    const body = await readJson(request);
    if (typeof body !== "object" || body === null || Array.isArray(body) || !("name" in body)) return badRequest("A tag name is required.");
    const normalized = normalizeTagName(body.name);
    if (!normalized) return badRequest("Tag name must be 1–60 characters and include at least one letter or number.");
    try {
      await connectToDatabase();
      const tag = await renameTag(id, normalized.name, normalized.slug);
      if (!tag) return Response.json({ success: false, error: { message: "Tag not found." } }, { status: 404, headers: noStore });
      return success(tag);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return Response.json({ success: false, error: { message: "A tag with this name already exists." } }, { status: 409, headers: noStore });
      }
      return apiErrorResponse({ context: "api/admin/tags PATCH", error, message: "Tag could not be updated.", status: 503, headers: noStore });
    }
  },

  async remove(request: Request, context: TagRouteContext) {
    const admin = await requireAdmin(request, { write: true });
    if (!admin.ok) return admin.response;
    const { id } = await context.params;
    if (!mongoose.isObjectIdOrHexString(id)) return badRequest("Tag id is invalid.");
    try {
      await connectToDatabase();
      const deleted = await deleteTag(id);
      if (!deleted) return Response.json({ success: false, error: { message: "Tag not found." } }, { status: 404, headers: noStore });
      return success({ id, deleted: true });
    } catch (error) {
      if (error instanceof TagInUseError) {
        return Response.json({ success: false, error: { message: error.message } }, { status: 409, headers: noStore });
      }
      return apiErrorResponse({ context: "api/admin/tags DELETE", error, message: "Tag could not be deleted.", status: 503, headers: noStore });
    }
  },
};
