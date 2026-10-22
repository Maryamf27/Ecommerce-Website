import type { ProductRating } from "@/types/product";

export type ProductCreateInput = {
  externalId?: number;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating?: ProductRating;
  stock?: number;
};

export type ProductUpdateInput = Partial<Omit<ProductCreateInput, "externalId">>;

type ValidationResult<T> = { success: true; data: T } | { success: false; errors: string[] };

const editableFields = ["title", "description", "price", "category", "image", "rating", "stock"] as const;
const creatableFields = [...editableFields, "externalId"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFields(value: unknown, partial: boolean): ValidationResult<ProductCreateInput | ProductUpdateInput> {
  if (!isRecord(value)) return { success: false, errors: ["Request body must be a JSON object."] };

  const errors: string[] = [];
  const allowed = partial ? editableFields : creatableFields;
  for (const key of Object.keys(value)) {
    if (!(allowed as readonly string[]).includes(key)) errors.push(`Unknown or protected field: ${key}.`);
  }
  if (partial && Object.keys(value).length === 0) errors.push("Provide at least one field to update.");

  const requiredText = ["title", "description", "category", "image"] as const;
  for (const key of requiredText) {
    if (!partial && !(key in value)) errors.push(`${key} is required.`);
    const field = value[key];
    if (field === undefined) continue;
    if (typeof field !== "string" || !field.trim()) errors.push(`${key} must be a non-empty string.`);
    else {
      const maxLength = key === "description" ? 4000 : key === "title" ? 180 : key === "image" ? 2048 : 100;
      if (field.trim().length > maxLength) errors.push(`${key} must be ${maxLength} characters or fewer.`);
    }
  }

  if (!partial && !("price" in value)) errors.push("price is required.");
  if ("price" in value && (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0)) {
    errors.push("price must be a finite non-negative number.");
  }

  if ("externalId" in value && (!Number.isSafeInteger(value.externalId) || (value.externalId as number) < 1)) {
    errors.push("externalId must be a positive integer.");
  }

  if ("stock" in value && (!Number.isSafeInteger(value.stock) || (value.stock as number) < 0)) {
    errors.push("stock must be a non-negative integer.");
  }

  if ("image" in value && typeof value.image === "string" && value.image.trim()) {
    const image = value.image.trim();
    // Site-relative paths such as /headphone.png (files in /public) are allowed besides full URLs.
    if (image.startsWith("/") && !image.startsWith("//") && !/[\\\s]/.test(image)) {
      // valid local image path
    } else {
      try {
        const imageUrl = new URL(image);
        if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") errors.push("image must use HTTP or HTTPS.");
      } catch {
        errors.push("image must be a valid URL or a site path such as /headphone.png.");
      }
    }
  }

  if ("rating" in value) {
    const rating = value.rating;
    if (!isRecord(rating)
      || typeof rating.rate !== "number" || !Number.isFinite(rating.rate) || rating.rate < 0 || rating.rate > 5
      || !Number.isSafeInteger(rating.count) || (rating.count as number) < 0) {
      errors.push("rating must contain a rate from 0 to 5 and a non-negative integer count.");
    }
  }

  if (errors.length > 0) return { success: false, errors };

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in value)) continue;
    const field = value[key];
    data[key] = typeof field === "string" ? field.trim() : field;
  }

  return { success: true, data: data as ProductCreateInput | ProductUpdateInput };
}

export function validateProductCreate(value: unknown): ValidationResult<ProductCreateInput> {
  return validateFields(value, false) as ValidationResult<ProductCreateInput>;
}

export function validateProductUpdate(value: unknown): ValidationResult<ProductUpdateInput> {
  return validateFields(value, true) as ValidationResult<ProductUpdateInput>;
}
