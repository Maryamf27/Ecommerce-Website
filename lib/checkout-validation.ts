import { Types } from "mongoose";

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

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, max)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validates untrusted checkout JSON. Prices are checked against database values later. */
export function validateCheckoutRequest(value: unknown):
  | { success: true; data: CheckoutRequestData }
  | { success: false; errors: CheckoutFieldErrors; message?: string } {
  if (!isRecord(value)) {
    return { success: false, errors: {}, message: "Checkout details are invalid." };
  }

  const requestKey = clean(value.requestKey, 64);
  const shipping = {
    name: clean(value.name, 80),
    email: clean(value.email, 254).toLowerCase(),
    address: clean(value.address, 180),
    city: clean(value.city, 100),
    postalCode: clean(value.postalCode, 20),
    country: clean(value.country, 80),
  };
  const errors: CheckoutFieldErrors = {};

  if (!/^[\w-]{16,64}$/.test(requestKey)) errors.requestKey = "Refresh checkout and try again.";
  if (shipping.name.length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) errors.email = "Enter a valid email address.";
  if (shipping.address.length < 5) errors.address = "Enter a complete street address.";
  if (shipping.city.length < 2) errors.city = "Enter your city.";
  if (!/^[\p{L}\p{N} -]{2,20}$/u.test(shipping.postalCode)) errors.postalCode = "Enter a valid postal code.";
  if (shipping.country.length < 2) errors.country = "Enter your country.";

  const rawItems = value.expectedItems;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
    errors.expectedItems = "Your cart details are invalid.";
  } else {
    const seen = new Set<string>();
    const validItems: CheckoutExpectedItem[] = [];
    for (const rawItem of rawItems) {
      if (!isRecord(rawItem)
        || typeof rawItem.productId !== "string"
        || !Types.ObjectId.isValid(rawItem.productId)
        || !Number.isSafeInteger(rawItem.quantity)
        || (rawItem.quantity as number) < 1
        || (rawItem.quantity as number) > 99
        || !Number.isSafeInteger(rawItem.unitAmount)
        || (rawItem.unitAmount as number) < 0) {
        errors.expectedItems = "Your cart details are invalid.";
        break;
      }
      const productId = rawItem.productId.toLowerCase();
      if (seen.has(productId)) {
        errors.expectedItems = "Your cart contains duplicate products. Refresh checkout and try again.";
        break;
      }
      seen.add(productId);
      validItems.push({
        productId,
        quantity: rawItem.quantity as number,
        unitAmount: rawItem.unitAmount as number,
      });
    }
    if (!errors.expectedItems) {
      if (validItems.length !== rawItems.length) errors.expectedItems = "Your cart details are invalid.";
      else if (Object.keys(errors).length === 0) {
        return { success: true, data: { requestKey, shipping, expectedItems: validItems } };
      }
    }
  }

  return { success: false, errors };
}
