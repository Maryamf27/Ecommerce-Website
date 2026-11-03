import { render, screen, waitFor } from "@testing-library/react";
import ProductCatalog from "../../components/ProductCatalog";

jest.mock("../../components/Select", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/ProductImage", () => ({ __esModule: true, default: () => null }));
jest.mock("../../components/CommerceActions", () => ({
  AddToCartButton: () => null,
  WishlistButton: () => null,
}));

describe("product catalog price-range regression", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows a min-greater-than-max error without requesting or rendering the product list", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, categories: [] }),
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;

    render(<ProductCatalog initialMinPrice="50" initialMaxPrice="10" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/minimum price can't be higher than the maximum price/i);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(jest.mocked(fetchMock).mock.calls[0][0])).toContain("limit=1");
    expect(String(jest.mocked(fetchMock).mock.calls[0][0])).not.toContain("minPrice");
    expect(screen.queryByLabelText("Loading products")).not.toBeInTheDocument();
  });
});
