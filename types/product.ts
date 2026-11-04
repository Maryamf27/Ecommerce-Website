export type ProductRating = {
  rate: number;
  count: number;
};

export type TagDTO = {
  _id: string;
  name: string;
  slug: string;
};

export type ProductDTO = {
  _id: string;
  externalId: number | null;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: ProductRating;
  tags: TagDTO[];
  stock: number;
  stockStatus: "out-of-stock" | "low-stock" | "in-stock";
  createdAt: string;
  updatedAt: string;
};

export type FakeStoreProduct = {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: ProductRating;
};
