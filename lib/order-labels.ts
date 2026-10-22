// Client-safe helpers (no database imports) so UI components can use them.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  inventory_issue: "Under review",
};

export function orderStatusLabel(order: { status: string; paymentStatus: string }): string {
  if (order.paymentStatus === "failed") return "Payment failed";
  if (order.paymentStatus === "pending") return "Awaiting payment";
  return ORDER_STATUS_LABELS[order.status] ?? order.status;
}
