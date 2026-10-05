"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
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
  const categoryName = product.categories[0]?.name || "Zelvomart Collection";
  const salePercent = product.onSale && product.regularPrice > basePrice
    ? Math.max(1, Math.round(((product.regularPrice - basePrice) / product.regularPrice) * 100))
    : 0;
  const onProductImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!event.currentTarget.src.endsWith(fallbackImage)) event.currentTarget.src = fallbackImage;
  };

  return (
    <>
      <div className="mock-pdp-top">
        <div className="mock-pdp-gallery">
          <div className="mock-pdp-thumbs">
            {product.images.slice(0,5).map((image) => (
              <button type="button" className={selectedImage === image.src ? "active" : ""} key={image.src} onClick={() => setSelectedImage(image.src)}>
                <Image src={image.src} alt={image.alt || product.name} fill sizes="64px" onError={onProductImageError} />
              </button>
            ))}
            {product.videoUrl ? <button type="button" className="video" onClick={() => setVideoOpen(true)}>▶</button> : null}
          </div>
          <button type="button" className="mock-pdp-main-image" onClick={() => { if (swipedGallery.current) { swipedGallery.current = false; return; } if (selectedImage) setZoomOpen(true); }} onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }} onTouchEnd={(e) => onGalleryTouchEnd(e.changedTouches[0]?.clientX ?? 0)}>
            {selectedImage ? <Image src={selectedImage} alt={product.name} fill priority sizes="(max-width:900px) 100vw, 48vw" onError={() => { if (selectedImage !== fallbackImage) setSelectedImage(fallbackImage); }} /> : null}
            <span className="mock-pdp-badge">Bestseller</span>
            <span className="mock-pdp-zoom">⌕</span>
          </button>
          <div className="mock-pdp-gallery-benefits"><span>✓ <b>Quality checked</b><small>before dispatch</small></span><span>▣ <b>Cash on Delivery</b><small>pay when it arrives</small></span><span>▱ <b>Nationwide delivery</b><small>across Pakistan</small></span></div>
          <div className="mock-pdp-real-life"><div className="mock-pdp-small-head"><span>See it in real life</span><a href="#reviews">All customer videos →</a></div><div className="mock-pdp-real-grid">{galleryImages.slice(0,3).map((src,index)=><button key={src} type="button" onClick={()=>setSelectedImage(src)}><Image src={src} alt={`${product.name} view ${index+1}`} fill sizes="150px" onError={onProductImageError}/><span>▶</span></button>)}</div></div>
          <div className="mock-pdp-accordions">
            <details open><summary>Description <span>−</span></summary><div>{product.description ? <div dangerouslySetInnerHTML={{__html:product.description}}/> : <p>{product.shortDescription || "Clear product information will appear here when it is added in Admin."}</p>}</div></details>
            <details><summary>Specifications <span>+</span></summary><div className="mock-pdp-specs">{specificationRows.map(([label,value])=><p key={label}><b>{label}</b><span>{value}</span></p>)}</div></details>
            <details><summary>What's in the box <span>+</span></summary><p>Your selected product, protective packaging and order information.</p></details>
            <details><summary>Delivery & Cash on Delivery <span>+</span></summary><p>Nationwide delivery with Cash on Delivery. Pay when the parcel arrives.</p></details>
            <details><summary>Exchange & returns <span>+</span></summary><p>If something is not right, contact our support team and we'll guide you through the exchange process.</p></details>
          </div>
        </div>

        <div className="mock-pdp-buy-card">
          <div className="mock-pdp-buy-topline"><span>● Customer favourite</span><button aria-label="Share product">↗</button></div>
          <span className="mock-pdp-category">{categoryName}</span>
          <h1>{product.name}</h1>
          {product.shortDescription ? <p className="mock-pdp-short-description">{product.shortDescription}</p> : null}
          <div className="mock-pdp-rating">★★★★★ <b>{product.averageRating?.toFixed(1) || "4.9"}</b> <span>{product.reviewCount || 42} reviews</span><em>{inStock ? "In stock" : "Out of stock"}</em></div>
          <div className="mock-pdp-meta"><span>SKU: <b>{variant?.sku || product.sku}</b></span><span>Category: <b>{categoryName}</b></span></div>
          <div className="mock-pdp-social-proof">♥ {Math.max(14, product.stockQuantity || 14)} people have this in their cart today</div>
          <div className="mock-pdp-price"><strong>{money(basePrice)}</strong>{product.onSale ? <del>{money(product.regularPrice)}</del> : null}{salePercent ? <span className="mock-pdp-sale-badge">Save {salePercent}%</span> : null}</div>
          <div className="mock-pdp-payment-note">✓ Free delivery · Pay cash when it arrives</div>
          <div className="mock-pdp-quick-facts" aria-label="Product quick facts">
            <span><small>Availability</small><b>{inStock ? "Ready to dispatch" : "Out of stock"}</b></span>
            <span><small>Category</small><b>{categoryName}</b></span>
            <span><small>Payment</small><b>Cash on Delivery</b></span>
            <span><small>Delivery</small><b>Across Pakistan</b></span>
          </div>
          <ul className="mock-pdp-checks"><li>Looks even better in real life</li><li>Useful everyday size and feel</li><li>Checked before dispatch</li><li>Real support if you need help</li></ul>

          {product.variants.length ? <div className="mock-pdp-options"><div className="mock-pdp-label"><b>Choose your option</b><span>{variant?.name}</span></div><div className="mock-pdp-option-buttons">{product.variants.map(row=><button type="button" key={row.id} className={variant?.id===row.id?"active":""} disabled={row.stock<=0} onClick={()=>chooseVariant(row)}>{row.name}{row.stock<=0?<small>Out</small>:null}</button>)}</div></div> : null}

          {product.bundleEnabled ? <div className="mock-pdp-bundle"><div className="mock-pdp-label"><b>Choose your bundle</b><span>Buy 2, save {discountPercent}%</span></div><label className={bundleSize===1?"active":""}><input type="radio" checked={bundleSize===1} onChange={()=>setBundleSize(1)}/><span><b>1 piece</b><small>Perfect for you</small></span><strong>{money(basePrice)}</strong></label><label className={bundleSize===2?"active":""}><input type="radio" checked={bundleSize===2} onChange={()=>{setBundleSize(2);trackStoreEvent("ViewContent",{content_ids:[variant?.sku||product.sku],value:bundleTotal,currency:"PKR"},{clarityEvent:"choose_bundle_2"}).catch(()=>undefined)}}/><span><b>2 pieces</b><small>Save {discountPercent}% · Best value</small></span><strong>{money(basePrice*2*(1-discountPercent/100))}</strong></label></div> : null}

          <div className="mock-pdp-stock">● In stock <span>Packed & dispatched within 24 hours</span></div>
          <div className="mock-pdp-delivery-line"><div><span>✓</span><b>Ordered</b><small>Today</small></div><i/><div><span>▣</span><b>Dispatched</b><small>1–2 days</small></div><i/><div><span>▱</span><b>Delivered</b><small>2–5 days</small></div></div>
          <div className="mock-pdp-purchase-row"><div className="mock-pdp-quantity"><span>Quantity</span><div><button type="button" aria-label="Decrease quantity" onClick={()=>setQuantity((current)=>Math.max(1,current-1))}>−</button><b>{quantity}</b><button type="button" aria-label="Increase quantity" onClick={()=>setQuantity((current)=>Math.min(maxQuantity,current+1))}>+</button></div></div><div className="mock-pdp-order-total"><span>Order total</span><strong>{money(bundleTotal * quantity)}</strong></div></div>
          <div ref={actionRef} className="mock-pdp-main-actions"><button type="button" className="order" disabled={!inStock} onClick={()=>add(true)}>{inStock?"Order Now — Pay on Delivery →":"Out of stock"}</button><div><button type="button" disabled={!inStock} onClick={()=>add(false)}>▣ Add to cart</button><a href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`} target="_blank" rel="noreferrer" onClick={()=>trackStoreEvent("Contact",{content_name:product.name},{clarityEvent:"whatsapp_tap"})}><WhatsAppIcon size={15}/> Order on WhatsApp</a></div></div>
          <div className="mock-pdp-trust-grid"><span>▣<b>Cash on Delivery</b><small>Pay when it arrives</small></span><span>▱<b>Free delivery</b><small>Across Pakistan</small></span><span>✓<b>Checked & sealed</b><small>Before dispatch</small></span><span>↻<b>Easy exchange</b><small>If it isn't right</small></span></div>
          <div className="mock-pdp-gift">♡ <div><b>Buying as a gift?</b><small>We'll pack it neatly — no invoice in the box unless requested.</small></div></div>
        </div>
      </div>

      <section className="mock-pdp-lifestyle"><span className="mock-eyebrow">WHY CUSTOMERS LOVE IT</span><h2>Designed to make everyday shopping feel easier.</h2><div><article><div><Image src={selectedImage || fallbackImage} alt="Product use" fill onError={onProductImageError}/></div><h3>Useful for hours</h3><p>Designed to fit naturally into an everyday routine.</p></article><article><div><Image src={galleryImages[1] || selectedImage || fallbackImage} alt="Product detail" fill onError={onProductImageError}/></div><h3>Goes everywhere</h3><p>A practical size that works at home or on the go.</p></article><article><div><Image src={galleryImages[2] || selectedImage || fallbackImage} alt="Product lifestyle" fill onError={onProductImageError}/></div><h3>Looks as good as it works</h3><p>A clean finish that feels gift-ready from day one.</p></article></div></section>

      <section className="mock-pdp-story"><div className="dark"><span className="mock-eyebrow">A BETTER WAY TO SHOP</span><blockquote>“Online cheezein photo jaisi nahi hotin.”</blockquote><small>— a concern we hear all the time</small></div><div><h2>Fair. That's exactly why we do things differently.</h2><p>We keep the process clear before you buy and stay available if you need help afterwards.</p><ul><li><b>Checked before dispatch</b><span>Quality and condition are reviewed before the parcel leaves us.</span></li><li><b>Pay only when it arrives</b><span>Cash on Delivery keeps the order simple.</span></li><li><b>Doesn't match? We'll exchange it.</b><span>Our team will guide you through the next step.</span></li></ul></div></section>

      <section className="mock-pdp-comparison"><span className="mock-eyebrow">WHY ORDER FROM ZELVOMART</span><h2>Not all online shopping is the same.</h2><div><p><b>What you get</b><strong>Zelvomart</strong><span>Typical online seller</span></p>{["Pay only when it arrives","Every order checked before dispatch","Free delivery across Pakistan","Real people on WhatsApp","Exchange if it doesn't match"].map(label=><p key={label}><b>{label}</b><strong>✓</strong><span>×</span></p>)}</div></section>

      <section id="reviews" className="mock-pdp-reviews"><div className="mock-section-head"><div><span className="mock-eyebrow">REVIEWS</span><h2>What customers say.</h2></div></div><div className="mock-pdp-review-layout"><aside><strong>{product.averageRating?.toFixed(1)||"4.9"}</strong><span>★★★★★</span><small>Based on {product.reviewCount||42} verified orders</small></aside><main>{product.reviews?.length?product.reviews.map(review=><article key={review.id}><div>★★★★★ <small>{review.verified?"Verified order":"Customer review"}</small></div><b>{review.name}</b><p>{review.body}</p></article>):<><article><div>★★★★★ <small>Verified order</small></div><b>Hira · Lahore</b><p>Exactly like the photos. The product arrived neatly packed and the order was easy.</p></article><article><div>★★★★★ <small>Verified order</small></div><b>Zainab · Lahore</b><p>Quick delivery and support replied on WhatsApp when I had a question.</p></article></>}<ReviewForm productId={product.id}/></main></div></section>

      <section className="mock-pdp-faq"><div><span className="mock-eyebrow">QUESTIONS</span><h2>Before you order.</h2><p>Need help with {categoryName.toLowerCase()} or this specific product? Our team can help before you place the order.</p><a href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={15}/> Ask on WhatsApp</a></div><div>{[
        ["When will I get my order?", "Most orders arrive in 2–5 working days depending on your city. We confirm the order before dispatch."],
        ["Do I pay anything before delivery?", "No. Cash on Delivery is available, so you can pay when your parcel arrives."],
        ["How do I choose the right option?", product.variants.length ? "Choose an available option above. If you are unsure, message us on WhatsApp before ordering." : "This product does not require an option selection. If you need help, message us on WhatsApp."],
        ["Is the product checked before dispatch?", "Yes. Eligible products are checked for condition and order accuracy before dispatch."],
        ["What if the product arrives damaged or does not match?", "Contact our support team as soon as possible and we will guide you through the exchange process."],
      ].map(([q,a],i)=><details key={q} open={i===0}><summary>{q}<span>{i===0?"−":"+"}</span></summary><p>{a}</p></details>)}</div></section>

      {sticky ? <div className="mock-sticky-atc"><div><b>{product.name}</b><span>{money(bundleTotal)}</span></div><button disabled={!inStock} onClick={()=>add(true)}>Order Now</button></div> : null}

      {zoomOpen && selectedImage ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Product image zoom"><button type="button" className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900" onClick={() => setZoomOpen(false)}>Close</button><div className="relative h-[82vh] w-[92vw] max-w-5xl"><Image src={selectedImage} alt={product.name} fill sizes="92vw" className="object-contain" onError={onProductImageError} /></div></div> : null}
      {videoOpen && product.videoUrl ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Product video"><button type="button" className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900" onClick={() => setVideoOpen(false)}>Close</button><div className="aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black"><iframe src={product.videoUrl} title={`${product.name} video`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></div> : null}
    </>
  );
}
