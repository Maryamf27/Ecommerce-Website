import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { getProduct } from "@/services/product-service";

export const instant = false;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try {
    await connectToDatabase();
    product = await getProduct(id);
  } catch {
    return <main className="product-detail-shell"><Link href="/" className="text-link">← Back to Nexora</Link><p className="catalog-message">Product details are temporarily unavailable.</p></main>;
  }
  if (!product) notFound();

  return <main className="product-detail-shell">
    <Link href="/" className="text-link">← Back to Nexora</Link>
    <article className="product-detail">
      <div className="product-detail-image"><Image src={product.image} alt={product.title} fill sizes="(max-width: 700px) 90vw, 45vw" priority /></div>
      <div className="product-detail-copy">
        <p className="product-category">{product.category}</p>
        <h1>{product.title}</h1>
        <div className="product-rating" aria-label={`${product.rating.rate} out of 5 stars`}><span aria-hidden="true">{"★".repeat(Math.round(product.rating.rate))}{"☆".repeat(5 - Math.round(product.rating.rate))}</span><small>({product.rating.count})</small></div>
        <p className="product-detail-price">${product.price.toFixed(2)}</p>
        <p className="product-description">{product.description}</p>
        <p className="product-stock">{product.stock > 0 ? `${product.stock} in stock` : "Availability confirmed at checkout"}</p>
      </div>
    </article>
  </main>;
}
