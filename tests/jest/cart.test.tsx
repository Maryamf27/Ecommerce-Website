import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommerceProvider } from "../../components/CommerceProvider";
import CartPageContent from "../../components/CartPageContent";
import { AddToCartButton } from "../../components/CommerceActions";
import type { ProductDTO } from "../../types/product";

jest.mock("../../components/AuthProvider", () => ({ useAuth: () => ({ user: null }) }));

const product: ProductDTO = {
  _id: "507f1f77bcf86cd799439011",
  externalId: null,
  title: "Test headphones",
  description: "A test product",
  price: 19.99,
  category: "Audio",
  image: "/headphone.png",
  rating: { rate: 4.5, count: 10 },
  tags: [],
  stock: 10,
  stockStatus: "in-stock",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 401, json: async () => data } as Response;
}

function mockCommerceApi() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/auth/me") return jsonResponse({ success: false }, false);
    if (url === "/api/wishlist") return jsonResponse({ success: true, data: { items: [] } });
    if (url === "/api/cart") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { items?: Array<{ productId: string; quantity: number }> };
      const items = (body.items ?? []).filter((item) => item.productId === product._id).map(({ quantity }) => ({
        product,
        quantity,
        lineTotal: product.price * quantity,
        available: quantity <= product.stock,
      }));
      return jsonResponse({
        success: true,
        data: {
          items,
          subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
          count: items.reduce((total, item) => total + item.quantity, 0),
        },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  global.fetch = fetchMock as typeof fetch;
}

function renderCart(initialQuantity = 0) {
  localStorage.clear();
  if (initialQuantity > 0) {
    localStorage.setItem("nexora_guest_cart", JSON.stringify([{ productId: product._id, quantity: initialQuantity }]));
  }
  mockCommerceApi();
  return render(
    <CommerceProvider>
      <AddToCartButton product={product} />
      <CartPageContent />
    </CommerceProvider>,
  );
}

describe("cart interactions", () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("adds a product and updates the cart total", async () => {
    const user = userEvent.setup();
    renderCart();
    await user.click(await screen.findByRole("button", { name: "Add Test headphones to cart" }));

    const cart = await screen.findByRole("region", { name: "Items in your cart" });
    expect(within(cart).getByText("Test headphones")).toBeInTheDocument();
    expect(within(screen.getByRole("complementary")).getByText("$19.99")).toBeInTheDocument();
  });

  it("updates the quantity and recalculates both line total and subtotal", async () => {
    const user = userEvent.setup();
    renderCart(1);
    const cart = await screen.findByRole("region", { name: "Items in your cart" });
    expect(within(cart).getByText("$19.99")).toBeInTheDocument();

    await user.click(within(cart).getByRole("button", { name: "Increase quantity" }));

    await waitFor(() => expect(within(cart).getByText("$39.98")).toBeInTheDocument());
    expect(within(screen.getByRole("complementary")).getByText("$39.98")).toBeInTheDocument();
    expect(within(cart).getByText("2")).toBeInTheDocument();
  });

  it("removes the product and shows the empty-cart state", async () => {
    const user = userEvent.setup();
    renderCart(1);
    const cart = await screen.findByRole("region", { name: "Items in your cart" });

    await user.click(within(cart).getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Items in your cart" })).not.toBeInTheDocument();
  });

  it("shows the empty-cart state when there are no saved items", async () => {
    renderCart();

    expect(await screen.findByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute("href", "/shop");
  });
});
