import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/product";

export default function ProductGrid({ products, emptyText = "No products available right now." }: { products: Product[]; emptyText?: string }) {
  if (!products.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <h3 className="text-lg font-extrabold text-slate-800">No products available</h3>
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
        <a className="btn-green mt-5" href="https://wa.me/923002026711" target="_blank" rel="noreferrer">Ask on WhatsApp</a>
      </div>
    );
  }
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
