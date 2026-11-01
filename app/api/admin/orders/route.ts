import { getAdminOrders } from "@/controllers/order-controller";

export const instant = false;

export async function GET(request: Request) {
  return getAdminOrders(request);
}
