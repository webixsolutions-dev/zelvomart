"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent } from "@/lib/client-tracking";
import type { Product, Variant } from "@/types/product";
import ReviewForm from "@/components/ReviewForm";

const tabs = ["Why Choose Zelvomart", "Shipping Process", "General FAQ", "Description", "Additional information", "Reviews"] as const;

export default function ProductDetailClient({ product, defaultBundleDiscount = 5, whatsapp = "923002026711" }: { product: Product; defaultBundleDiscount?: number; whatsapp?: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState(product.image || product.images[0]?.src || "");
  const [variant, setVariant] = useState<Variant | null>(product.variants[0] || null);
  const [bundleSize, setBundleSize] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Why Choose Zelvomart");
  const [sticky, setSticky] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const actionRef = useRef<HTMLDivElement | null>(null);

  const basePrice = Number(variant?.priceOverride ?? product.price);
  const discountPercent = Number(product.bundleDiscountPercent ?? defaultBundleDiscount);
  const bundleTotal = useMemo(() => {
    const raw = basePrice * bundleSize;
    return bundleSize === 2 && product.bundleEnabled ? raw * (1 - discountPercent / 100) : raw;
  }, [basePrice, bundleSize, discountPercent, product.bundleEnabled]);
  const saving = Math.max(0, basePrice * bundleSize - bundleTotal);
  const inStock = variant ? variant.stock > 0 : product.stockStatus === "instock";

  useEffect(() => {
    trackStoreEvent("ViewContent", {
      content_ids: [variant?.sku || product.sku],
      content_type: "product",
      value: basePrice,
      currency: "PKR",
    }, { clarityEvent: "view_product" }).catch(() => undefined);
    try {
      window.clarity?.("set", "product_sku", product.sku);
      window.clarity?.("set", "category", product.categories[0]?.slug || "");
    } catch {}
  }, [product.id]);

  useEffect(() => {
    const node = actionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setSticky(!entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chooseVariant = (next: Variant) => {
    setVariant(next);
    if (next.imageUrl) setSelectedImage(next.imageUrl);
  };

  const add = async (goCheckout = false) => {
    if (!inStock) return;
    addItem({
      productId: product.id,
      variantId: variant?.id,
      slug: product.slug,
      name: product.name,
      image: variant?.imageUrl || product.image,
      price: basePrice,
      quantity,
      bundleSize,
      bundleDiscountPercent: discountPercent,
      variantLabel: variant?.name,
    });
    await trackStoreEvent("AddToCart", {
      content_ids: [variant?.sku || product.sku],
      contents: [{ id: variant?.sku || product.sku, quantity: quantity * bundleSize, item_price: basePrice }],
      value: bundleTotal * quantity,
      currency: "PKR",
    }, { clarityEvent: goCheckout ? "buy_now" : "add_to_cart" });
    if (goCheckout) router.push("/checkout?buyNow=1");
  };

  const whatsappMessage = encodeURIComponent(`Hi Zelvomart, I want to ask about ${product.name}: ${typeof window !== "undefined" ? window.location.href : `/product/${product.slug}/`}`);

  return (
    <>
      <div className="product-layout">
        <div className="product-gallery">
          <button type="button" className="product-main-image cursor-zoom-in" onClick={() => selectedImage && setZoomOpen(true)} aria-label="Zoom product image">
            {selectedImage ? <Image src={selectedImage} alt={product.name} fill priority sizes="(max-width:900px) 100vw, 50vw" /> : null}
            {selectedImage ? <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-slate-700 shadow">Zoom</span> : null}
          </button>
          {product.images.length > 1 || product.videoUrl ? (
            <div className="product-thumbs">
              {product.images.map((image) => (
                <button type="button" className={`product-thumb ${selectedImage === image.src ? "active" : ""}`} key={image.src} onClick={() => setSelectedImage(image.src)}>
                  <Image src={image.src} alt={image.alt || product.name} fill sizes="72px" />
                </button>
              ))}
              {product.videoUrl ? <button type="button" className="product-thumb grid place-items-center bg-slate-950 text-xs font-black text-white" onClick={() => setVideoOpen(true)} aria-label="Play product video">▶ Video</button> : null}
            </div>
          ) : null}
        </div>

        <div className="product-info">
          <div className="product-rating">{product.reviewCount ? `Rated ${product.averageRating?.toFixed(2)} out of 5 • ${product.reviewCount} real reviews` : "Quality checked before dispatch"}</div>
          <h1>{product.name}</h1>
          <div className="pdp-price">
            <strong>{money(basePrice)}</strong>
            {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
          </div>
          <div className="pdp-benefit-line"><span>Free Delivery</span><span>Cash on Delivery</span></div>
          {product.shortDescription ? <p className="pdp-short">{product.shortDescription}</p> : null}

          {product.variants.length ? (
            <div className="variant-list">
              <label>Choose an option</label>
              <div className="variant-options">
                {product.variants.map((row) => (
                  <button className={`variant-option ${variant?.id === row.id ? "active" : ""}`} key={row.id} disabled={row.stock <= 0} onClick={() => chooseVariant(row)}>
                    {row.name}{row.stock <= 0 ? " • Out of stock" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {product.bundleEnabled ? (
            <div className="bundle-box">
              <b>Choose your bundle:</b>
              <div className="bundle-options">
                <label className={`bundle-option ${bundleSize === 1 ? "active" : ""}`}>
                  <input type="radio" checked={bundleSize === 1} onChange={() => setBundleSize(1)} />
                  <span><b>Buy 1</b><small>Standard order</small></span>
                  <strong>{money(basePrice)}</strong>
                </label>
                <label className={`bundle-option ${bundleSize === 2 ? "active" : ""}`}>
                  <input type="radio" checked={bundleSize === 2} onChange={() => { setBundleSize(2); trackStoreEvent("ViewContent", { content_ids: [variant?.sku || product.sku], value: bundleTotal, currency: "PKR" }, { clarityEvent: "choose_bundle_2" }).catch(() => undefined); }} />
                  <span><b>Best value • Buy 2</b><small>Great for gifting • Pay on delivery</small></span>
                  <span><strong>{money(basePrice * 2 * (1 - discountPercent / 100))}</strong><small className="bundle-saving">Save {money(basePrice * 2 * (discountPercent / 100))}</small></span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 py-3">
            <label className="text-xs font-extrabold text-slate-600" htmlFor="qty">Quantity</label>
            <select id="qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {saving > 0 ? <span className="bundle-saving">Bundle saving {money(saving * quantity)}</span> : null}
          </div>

          <div ref={actionRef} className="pdp-actions">
            <button className="btn-dark" disabled={!inStock} onClick={() => add(false)}>{inStock ? "Add to Cart" : "Out of stock"}</button>
            <button className="btn-green" disabled={!inStock} onClick={() => add(true)}>Order Now – Cash on Delivery</button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Pay when your parcel arrives • Delivered by PostEx</p>
          <a className="pdp-whatsapp" href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`} target="_blank" rel="noreferrer" onClick={() => trackStoreEvent("Contact", { content_name: product.name }, { clarityEvent: "whatsapp_tap" })}>Ask on WhatsApp</a>

          <div className="pdp-trust">
            <div>Cash on Delivery</div><div>Easy Returns</div><div>Quality Checked</div><div>WhatsApp Support</div>
          </div>
        </div>
      </div>

      <section className="product-details">
        <h2 className="mb-4 text-2xl font-black text-slate-800">Details, delivery & reviews</h2>
        <div className="product-details-nav">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
        <div className="product-details-body">
          {tab === "Why Choose Zelvomart" ? <div><p><b>Cash on Delivery</b> — pay only when your order arrives.</p><p><b>Quality Checked</b> — every product is inspected before dispatch.</p><p><b>Nationwide Delivery</b> — we deliver across Pakistan.</p><p><b>Real Support</b> — message us on WhatsApp and talk to a person.</p></div> : null}
          {tab === "Shipping Process" ? <ol className="list-decimal space-y-2 pl-5"><li>Order placed.</li><li>We confirm by phone or WhatsApp.</li><li>Your parcel is packed and handed to the courier.</li><li>It is delivered to your city and you pay cash on delivery.</li></ol> : null}
          {tab === "General FAQ" ? <div><p><b>Is COD available?</b> Yes, COD is the launch payment method.</p><p><b>How long does delivery take?</b> It depends on your city and is configured in admin.</p><p><b>Can I return a product?</b> See the Returns & Exchange page for the current policy.</p></div> : null}
          {tab === "Description" ? <div dangerouslySetInnerHTML={{ __html: product.description || "<p>No additional description is available.</p>" }} /> : null}
          {tab === "Additional information" ? <div><p><b>SKU:</b> {variant?.sku || product.sku}</p>{variant ? <p><b>Selected option:</b> {variant.name}</p> : null}</div> : null}
          {tab === "Reviews" ? (
            <div>
              {product.reviews?.length ? <div className="grid gap-4">{product.reviews.map((review) => <article className="rounded-xl border border-slate-200 p-4" key={review.id}><div className="font-extrabold text-slate-800">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</div><p className="my-2 text-sm">{review.body}</p><small className="text-slate-500">{review.name}{review.verified ? " • Verified order" : ""}</small></article>)}</div> : <p>Reviews are shown only when they come from real customers and are approved.</p>}
              <ReviewForm productId={product.id}/>
            </div>
          ) : null}
        </div>
      </section>

      {sticky ? <div className="sticky-atc"><button className="btn-dark" disabled={!inStock} onClick={() => add(false)}>Add to Cart</button><button className="btn-green" disabled={!inStock} onClick={() => add(true)}>Buy Now</button></div> : null}

      {zoomOpen && selectedImage ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Product image zoom"><button type="button" className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900" onClick={() => setZoomOpen(false)}>Close</button><div className="relative h-[82vh] w-[92vw] max-w-5xl"><Image src={selectedImage} alt={product.name} fill sizes="92vw" className="object-contain" /></div></div> : null}

      {videoOpen && product.videoUrl ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Product video"><button type="button" className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900" onClick={() => setVideoOpen(false)}>Close</button><div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black"><iframe src={product.videoUrl} title={`${product.name} video`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></div> : null}
    </>
  );
}
