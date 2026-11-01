import { patchAdminOrder } from "@/controllers/order-controller";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return patchAdminOrder(request, id);
}
