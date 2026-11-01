import { Types } from "mongoose";
import { z } from "zod";

export type CheckoutExpectedItem = {
  productId: string;
  quantity: number;
  unitAmount: number;
};

export type CheckoutRequestData = {
  requestKey: string;
  shipping: {
    name: string;
    email: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  expectedItems: CheckoutExpectedItem[];
};

export type CheckoutFieldErrors = Partial<Record<
  "requestKey" | "name" | "email" | "address" | "city" | "postalCode" | "country" | "expectedItems",
  string
>>;

const checkoutSchema = z.object({
  requestKey: z.string().trim().regex(/^[\w-]{16,64}$/, "Refresh checkout and try again."),
  name: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 80)).refine((value) => value.length >= 2, "Enter your full name."),
  email: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 254).toLowerCase()).pipe(z.string().email("Enter a valid email address.")),
  address: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 180)).refine((value) => value.length >= 5, "Enter a complete street address."),
  city: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 100)).refine((value) => value.length >= 2, "Enter your city."),
  postalCode: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 20)).pipe(z.string().regex(/^[\p{L}\p{N} -]{2,20}$/u, "Enter a valid postal code.")),
  country: z.string().trim().transform((value) => value.replace(/[<>\u0000-\u001f]/g, "").slice(0, 80)).refine((value) => value.length >= 2, "Enter your country."),
  expectedItems: z.array(z.object({
    productId: z.string().refine((value) => Types.ObjectId.isValid(value), "Your cart details are invalid.").transform((value) => value.toLowerCase()),
    quantity: z.number().int().min(1).max(99),
    // This is only a cart consistency hint; checkout uses trusted database prices.
    unitAmount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  }).strict()).min(1).max(100).refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Your cart contains duplicate products. Refresh checkout and try again."),
}).strict();

/** Validates untrusted checkout JSON. Prices are checked against database values later. */
export function validateCheckoutRequest(value: unknown):
  | { success: true; data: CheckoutRequestData }
  | { success: false; errors: CheckoutFieldErrors; message?: string } {
  const parsed = checkoutSchema.safeParse(value);
  const errors: CheckoutFieldErrors = {};
  if (parsed.success) {
    const { requestKey, expectedItems, name, email, address, city, postalCode, country } = parsed.data;
    const shipping = { name, email, address, city, postalCode, country };
    return { success: true, data: { requestKey, shipping, expectedItems } };
  }
  for (const issue of parsed.error.issues) {
    const path = issue.path[0];
    if (path === "requestKey" || path === "name" || path === "email" || path === "address" || path === "city" || path === "postalCode" || path === "country" || path === "expectedItems") {
      errors[path] ??= path === "expectedItems" && issue.message !== "Your cart contains duplicate products. Refresh checkout and try again."
        ? "Your cart details are invalid."
        : issue.message;
    }
  }
  return { success: false, errors };
}
