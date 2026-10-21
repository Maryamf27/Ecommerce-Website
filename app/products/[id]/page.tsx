import StoreHeader from "@/components/StoreHeader";
import ProductDetail from "@/components/ProductDetail";

export const instant = false;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><StoreHeader /><ProductDetail id={id} /></>;
}
