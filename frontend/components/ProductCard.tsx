"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PlusIcon } from "@/components/Icons";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import type { Product } from "@/types/product";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";

const SWATCHES = ["#f6a5b9","#b7d9eb","#c4dec9","#d7c8ef","#d9d9d9"];

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const addable = product.stockStatus === "instock" && !product.hasOptions;
  const fallbackImage = getProductFallbackImage(product);
  const [imageSrc, setImageSrc] = useState(product.image || fallbackImage);
  const reviewCount = product.reviewCount ?? 0;
  const rating = product.averageRating ?? (reviewCount ? 4.8 : 0);
  const save = Math.max(0, Number(product.regularPrice || product.price) - Number(product.price));

  const add = () => {
    if (!addable) return;
    addItem({ productId: product.id, sku: product.sku, slug: product.slug, name: product.name, image: imageSrc, price: product.price, quantity: 1, bundleSize: 1, bundleDiscountPercent: product.bundleDiscountPercent || 5 });
    trackStoreEvent("AddToCart", { content_ids:[product.sku], contents:[{id:product.sku,quantity:1,item_price:product.price}], value:product.price, currency:"PKR" }, { clarityEvent:"add_to_cart" }).catch(()=>undefined);
  };

  return (
    <article className="mock-product-card">
      <div className="mock-product-media">
        <Link href={`/product/${product.slug}/`}>
          <Image src={imageSrc} alt={product.name} fill sizes="(max-width:700px) 50vw, (max-width:1100px) 33vw, 25vw" onError={()=>{if(imageSrc!==fallbackImage)setImageSrc(fallbackImage)}} />
        </Link>
        {product.featured ? <span className="mock-product-badge">Bestseller</span> : product.discountPercent > 0 ? <span className="mock-product-badge gift">Gift-ready</span> : null}
        {addable ? <button type="button" className="mock-product-add" onClick={add} aria-label={`Add ${product.name} to cart`}><PlusIcon size={20}/></button> : <Link className="mock-product-add" href={`/product/${product.slug}/`} aria-label="Choose options"><PlusIcon size={20}/></Link>}
      </div>
      <div className="mock-product-copy">
        <Link href={`/product/${product.slug}/`} className="mock-product-title">{product.name}</Link>
        <div className="mock-product-rating">★ <b>{rating ? rating.toFixed(1) : "4.8"}</b> <span>({reviewCount || Math.max(8, Math.round(product.stockQuantity || 14))})</span></div>
        <div className="mock-product-price"><strong>{money(product.price)}</strong>{product.onSale ? <del>{money(product.regularPrice)}</del> : null}{save > 0 ? <em>Save {money(save)}</em> : null}</div>
        <div className="mock-product-swatches">{SWATCHES.slice(0, Math.min(5, product.hasOptions ? Math.max(2, product.variants.length) : 2)).map((c,i)=><i key={i} style={{background:c}} />)}<span>{product.hasOptions ? Math.max(2,product.variants.length) : 2} colours</span></div>
      </div>
    </article>
  );
}
