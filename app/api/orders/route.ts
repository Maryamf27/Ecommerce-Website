import { getCustomerOrder } from "@/controllers/order-controller";

export const instant = false;

export async function GET(request: Request) {
  return getCustomerOrder(request);
}
