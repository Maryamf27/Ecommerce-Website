/** Cart use-cases and business rules. Database access is delegated to cartRepository. */
export {
  CartStockError,
  getCart,
  getCartStockIssues,
  parseCartLines,
  resolveCart,
  setCart,
  type CartStockIssue,
  type CartViewItem,
} from "@/lib/commerce-service";
