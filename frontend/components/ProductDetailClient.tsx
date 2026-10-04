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
import { WhatsAppIcon } from "@/components/Icons";
import { getProductFallbackImage } from "@/lib/product-media";

const tabs = ["Overview", "Why Choose Us", "Specifications", "Shipping & Warranty", "Reviews"] as const;

export default function ProductDetailClient({ product, defaultBundleDiscount = 5, whatsapp = "923002026711" }: { product: Product; defaultBundleDiscount?: number; whatsapp?: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const fallbackImage = getProductFallbackImage(product);
  const [selectedImage, setSelectedImage] = useState(product.image || product.images[0]?.src || fallbackImage);
  const [variant, setVariant] = useState<Variant | null>(product.variants[0] || null);
  const [bundleSize, setBundleSize] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [sticky, setSticky] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const actionRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const swipedGallery = useRef(false);


  const galleryImages = useMemo(() => product.images.map((image) => image.src).filter(Boolean), [product.images]);
  const moveGallery = (direction: -1 | 1) => {
    if (galleryImages.length < 2) return;
    const current = Math.max(0, galleryImages.indexOf(selectedImage));
    const next = (current + direction + galleryImages.length) % galleryImages.length;
    setSelectedImage(galleryImages[next]);
  };
  const onGalleryTouchEnd = (clientX: number) => {
    if (touchStartX.current == null) return;
    const delta = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 45) return;
    swipedGallery.current = true;
    moveGallery(delta < 0 ? 1 : -1);
  };

  const basePrice = Number(variant?.priceOverride ?? product.price);
  const discountPercent = Number(product.bundleDiscountPercent ?? defaultBundleDiscount);
  const bundleTotal = useMemo(() => {
    const raw = basePrice * bundleSize;
    return bundleSize === 2 && product.bundleEnabled ? raw * (1 - discountPercent / 100) : raw;
  }, [basePrice, bundleSize, discountPercent, product.bundleEnabled]);
  const saving = Math.max(0, basePrice * bundleSize - bundleTotal);
  const inStock = variant ? variant.stock > 0 : product.stockStatus === "instock";
  const maxQuantity = Math.max(1, Math.min(10, variant ? Math.max(variant.stock, 1) : Math.max(product.stockQuantity || 10, 1)));
  const specificationRows = useMemo(() => {
    const rows: Array<[string, string]> = [
      ["Category", product.categories[0]?.name || "Zelvomart Collection"],
      ["SKU", variant?.sku || product.sku],
      ["Product type", product.hasOptions ? "Product with options" : (product.categories[0]?.name || "Everyday product")],
      ["Availability", inStock ? `${variant ? variant.stock : product.stockQuantity} in stock` : "Out of stock"],
      ["Payment", "Cash on Delivery"],
      ["Delivery", "Nationwide delivery across Pakistan"],
    ];
    for (const [key, value] of Object.entries(variant?.attributes || {})) {
      if (value) rows.splice(Math.max(3, rows.length - 3), 0, [key.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), String(value)]);
    }
    return rows;
  }, [product.categories, product.hasOptions, product.sku, product.stockQuantity, variant, inStock]);

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
      sku: variant?.sku || product.sku,
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

  const productPath = `/product/${product.slug}/`;
  const whatsappMessage = encodeURIComponent(`Hi Zelvomart, I want to ask about ${product.name}: ${productPath}`);

  return (
    <>
      <div className="product-layout">
        <div className="product-gallery">
          <button type="button" className="product-main-image cursor-zoom-in" onClick={() => { if (swipedGallery.current) { swipedGallery.current = false; return; } if (selectedImage) setZoomOpen(true); }} onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }} onTouchEnd={(e) => onGalleryTouchEnd(e.changedTouches[0]?.clientX ?? 0)} aria-label="Zoom product image">
            {selectedImage ? <Image src={selectedImage} alt={product.name} fill priority sizes="(max-width:900px) 100vw, 50vw" onError={() => { if (selectedImage !== fallbackImage) setSelectedImage(fallbackImage); }} /> : null}
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

        <div className="product-info pdp-modern-card">
          <div className="product-rating">{product.reviewCount ? `Rated ${product.averageRating?.toFixed(2)} out of 5 • ${product.reviewCount} real reviews` : "Quality checked before dispatch"}</div>
          <h1>{product.name}</h1>
          <div className="pdp-price">
            <strong>{money(basePrice)}</strong>
            {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
          </div>
          <div className="pdp-benefit-line"><span>Free Delivery</span><span>Cash on Delivery</span></div>
          {product.shortDescription ? <p className="pdp-short">{product.shortDescription}</p> : null}

          <div className="pdp-highlights">
            <div className="pdp-highlights-title">Product highlights</div>
            <div className="pdp-highlights-table">
              {specificationRows.slice(0, 6).map(([label, value]) => (
                <div className="pdp-highlight-row" key={label}>
                  <b>{label}</b><span>{value}</span>
                </div>
              ))}
            </div>
          </div>

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

          <div className="pdp-quantity-row">
            <div><b>Quantity</b><small>Choose how many you need</small></div>
            <div className="pdp-quantity-control" aria-label="Quantity selector">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={quantity >= maxQuantity} aria-label="Increase quantity">+</button>
            </div>
            {saving > 0 ? <span className="bundle-saving">Bundle saving {money(saving * quantity)}</span> : null}
          </div>

          <div ref={actionRef} className="pdp-actions pdp-reference-actions">
            <button className="btn-dark" disabled={!inStock} onClick={() => add(false)}>{inStock ? "Add to cart" : "Out of stock"}</button>
            <button className="btn-green" disabled={!inStock} onClick={() => add(true)}>Buy Now</button>
          </div>

          <div className="pdp-reference-mini-benefits" aria-label="Purchase benefits">
            <span>Cash on Delivery</span>
            <span>Nationwide delivery</span>
            <span>WhatsApp support</span>
          </div>
        </div>
      </div>

      <section className="pdp-reference-whatsapp-card" aria-label="WhatsApp product support">
        <div className="pdp-reference-whatsapp-icon" aria-hidden="true"><WhatsAppIcon size={27} /></div>
        <div className="pdp-reference-whatsapp-copy">
          <h2>For quick delivery contact on WhatsApp</h2>
          <p>Share the product name or your question and our team can help confirm availability, details and delivery.</p>
        </div>
        <a
          className="pdp-reference-whatsapp-button"
          href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackStoreEvent("Contact", { content_name: product.name }, { clarityEvent: "whatsapp_tap" })}
        >
          <WhatsAppIcon size={20} /> WhatsApp Us
        </a>
      </section>

      <section className="product-details product-details-modern">
        <div className="product-details-nav" role="tablist" aria-label="Product information">
          {tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </div>
        <div className="product-details-body">
          {tab === "Overview" ? <div className="pdp-tab-content pdp-overview-content">
            <h2>{product.name}</h2>
            {product.description ? <div dangerouslySetInnerHTML={{ __html: product.description }} /> : <p>{product.shortDescription || "Clear product information will appear here when it is added in Admin."}</p>}
          </div> : null}
          {tab === "Why Choose Us" ? <div className="pdp-tab-content"><h2>Why choose Zelvomart?</h2><div className="pdp-reason-grid"><article><b>Cash on Delivery</b><p>Pay only when your order arrives.</p></article><article><b>Quality Checked</b><p>Products are checked before dispatch.</p></article><article><b>Nationwide Delivery</b><p>We deliver across Pakistan.</p></article><article><b>Real Support</b><p>Talk to a real person on WhatsApp before or after ordering.</p></article></div></div> : null}
          {tab === "Specifications" ? <div className="pdp-tab-content"><h2>Product specifications</h2><div className="pdp-spec-table">{specificationRows.map(([label, value]) => <div className="pdp-spec-row" key={label}><b>{label}</b><span>{value}</span></div>)}</div></div> : null}
          {tab === "Shipping & Warranty" ? <div className="pdp-tab-content"><h2>Shipping & order support</h2><div className="pdp-shipping-grid"><article><span>01</span><div><b>Place your order</b><p>Order online with Cash on Delivery.</p></div></article><article><span>02</span><div><b>Confirmation</b><p>We confirm the order by phone or WhatsApp when needed.</p></div></article><article><span>03</span><div><b>Dispatch</b><p>Your parcel is packed and handed to the courier.</p></div></article><article><span>04</span><div><b>Delivery & support</b><p>Pay on delivery. For return or exchange questions, use the policy page or contact support.</p></div></article></div></div> : null}
          {tab === "Reviews" ? (
            <div className="pdp-tab-content">
              <h2>Customer reviews</h2>
              {product.reviews?.length ? <div className="pdp-review-grid">{product.reviews.map((review) => <article className="pdp-review-card" key={review.id}><div className="pdp-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</div><p>{review.body}</p><small>{review.name}{review.verified ? " • Verified order" : ""}</small></article>)}</div> : <p>Reviews are shown only when they come from real customers and are approved.</p>}
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
