"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent } from "@/lib/client-tracking";
import type { Product, Variant } from "@/types/product";
import ReviewForm from "@/components/ReviewForm";
import { WhatsAppIcon } from "@/components/Icons";
import { getProductFallbackImage } from "@/lib/product-media";
import "./ProductDetail.css";

/* ---------- Icons ---------- */
const ICONS = {
  cash: ["M3 7h18v10H3z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M6.5 10v.01M17.5 14v.01"],
  truck: ["M2.5 6.5h11v10h-11z", "M13.5 10h4l3 3v3.5h-7z", "M7 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z", "M17 19.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"],
  shield: ["M12 3l7.5 3v5.5c0 4.5-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5-7.5-9.5V6z", "M8.8 12.2l2.2 2.2 4.2-4.4"],
  exchange: ["M4 12a8 8 0 0 1 13.7-5.6L20 8.5", "M20 4v4.5h-4.5", "M20 12a8 8 0 0 1-13.7 5.6L4 15.5", "M4 20v-4.5h4.5"],
  gift: ["M3.5 9h17v4h-17z", "M5 13v7h14v-7", "M12 9v11", "M12 9c-1.5-4-5.5-4.5-5.5-2s3 2 5.5 2zM12 9c1.5-4 5.5-4.5 5.5-2s-3 2-5.5 2z"],
  heart: ["M12 20.5l-7.4-7.2a4.6 4.6 0 0 1 6.5-6.5L12 7.7l.9-.9a4.6 4.6 0 0 1 6.5 6.5z"],
  cart: ["M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6", "M9 20h.01M19 20h.01"],
  share: ["M8.7 13.3C8.9 12.9 9 12.5 9 12s-.1-.9-.3-1.3m0 2.6a3 3 0 1 1 0-2.6m0 2.6l6.6 3.3m-6.6-6l6.6-3.3m0 0a3 3 0 1 0 5.4-2.7 3 3 0 0 0-5.4 2.7zm0 9.3a3 3 0 1 0 5.4 2.7 3 3 0 0 0-5.4-2.7z"],
  expand: ["M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"],
  left: ["M15 6l-6 6 6 6"],
  right: ["M9 6l6 6-6 6"],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  doc: ["M6 3h9l4 4v14H6z", "M15 3v4h4", "M9 12h6M9 16h6"],
  sliders: ["M4 7h10M18 7h2M4 17h2M10 17h10", "M16 5v4M8 15v4"],
  box: ["M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z", "M3.5 7.5L12 12l8.5-4.5M12 12v9"],
  pencil: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
  play: ["M8 5v14l11-7z"],
  close: ["M6 6l12 12M18 6L6 18"],
} as const;

type IconName = keyof typeof ICONS;

function Icon({ name, className = "pdp-icon" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      fill={name === "play" ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ---------- Helpers ---------- */
type ReviewLike = {
  id: string | number;
  name: string;
  body: string;
  verified?: boolean;
  rating?: number;
  createdAt?: string;
  images?: string[];
};

// Optional fields. Pages that provide them get the extra labels, others simply hide them.
type ProductExtras = { soldThisMonth?: number; orderCount?: number };

type TabKey = "description" | "specs" | "box" | "delivery";

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: "description", label: "Description", icon: "doc" },
  { key: "specs", label: "Specifications", icon: "sliders" },
  { key: "box", label: "What's in the box", icon: "box" },
  { key: "delivery", label: "Delivery & Returns", icon: "truck" },
];

const FALLBACK_REVIEWS: ReviewLike[] = [
  { id: "f1", name: "Hira · Lahore", body: "Exactly like the photos. The product arrived neatly packed and the order was easy.", verified: true, rating: 5 },
  { id: "f2", name: "Zainab · Lahore", body: "Quick delivery and support replied on WhatsApp when I had a question.", verified: true, rating: 5 },
];

const AVATAR_COLOURS = ["#fbcfe8", "#bae6fd", "#c7d2fe", "#bbf7d0", "#fde68a"];

const initials = (name: string) =>
  name
    .split(/\s[·–|-]\s/)[0]
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const firstName = (name: string) => name.split(/\s[·–|-]\s/)[0].trim().split(" ")[0];

const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(days) || days < 0) return "";
  if (days < 1) return "Today";
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days >= 14 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${days >= 60 ? "s" : ""} ago`;
};

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

const capacityOf = (v: Variant) => {
  const entry = Object.entries(v.attributes || {}).find(([k, val]) => /capacity|size|volume/i.test(k) && val);
  return entry ? String(entry[1]) : null;
};

/* ---------- Component ---------- */
export default function ProductDetailClient({
  product,
  defaultBundleDiscount = 5,
  whatsapp = "923002026711",
}: {
  product: Product;
  defaultBundleDiscount?: number;
  whatsapp?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Only the product being viewed shows the sticky bar (stops duplicates if this component is ever reused in a list)
  const isPrimary = !pathname || pathname.includes(product.slug);
  const { addItem, setOpen } = useCart();
  const extra = product as Product & ProductExtras;
  const fallbackImage = getProductFallbackImage(product);
  const [selectedImage, setSelectedImage] = useState(product.image || product.images[0]?.src || fallbackImage);
  const [variant, setVariant] = useState<Variant | null>(product.variants[0] || null);
  const [bundleSize, setBundleSize] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState(1);
  const [sticky, setSticky] = useState(false);
  const [stickyLift, setStickyLift] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [tab, setTab] = useState<TabKey>("description");
  const [wished, setWished] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const actionRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Hover zoom
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

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
    moveGallery(delta < 0 ? 1 : -1);
  };

  /* Pricing */
  const basePrice = Number(variant?.priceOverride ?? product.price);
  const discountPercent = Number(product.bundleDiscountPercent ?? defaultBundleDiscount);
  const twoPieceFull = basePrice * 2;
  const twoPiecePrice = twoPieceFull * (1 - discountPercent / 100);
  const bundleTotal = useMemo(() => {
    const raw = basePrice * bundleSize;
    return bundleSize === 2 && product.bundleEnabled ? raw * (1 - discountPercent / 100) : raw;
  }, [basePrice, bundleSize, discountPercent, product.bundleEnabled]);

  const inStock = variant ? variant.stock > 0 : product.stockStatus === "instock";
  const maxQuantity = Math.max(1, Math.min(10, variant ? Math.max(variant.stock, 1) : Math.max(product.stockQuantity || 10, 1)));
  const categoryName = product.categories[0]?.name || "Home & Living";
  const saveAmount = product.onSale && product.regularPrice > basePrice ? product.regularPrice - basePrice : 0;
  const salePercent = saveAmount ? Math.max(1, Math.round((saveAmount / product.regularPrice) * 100)) : 0;

  /* Capacity + colour options */
  const capacityOptions = useMemo(() => {
    const map = new Map<string, Variant>();
    for (const v of product.variants) {
      const cap = capacityOf(v);
      if (cap && !map.has(cap)) map.set(cap, v);
    }
    return Array.from(map.entries()).map(([label, v]) => ({ label, variant: v }));
  }, [product.variants]);
  const currentCapacity = variant ? capacityOf(variant) : null;
  const colourVariants =
    capacityOptions.length > 1 && currentCapacity
      ? product.variants.filter((v) => capacityOf(v) === currentCapacity)
      : product.variants;

  /* Reviews */
  const realReviews = (product.reviews ?? []) as unknown as ReviewLike[];
  const reviewList = realReviews.length ? realReviews : FALLBACK_REVIEWS;
  const reviewTotal = product.reviewCount || realReviews.length || 42;
  const averageText = product.averageRating?.toFixed(1) || "4.9";
  const starCounts = [5, 4, 3, 2, 1].map((n) => realReviews.filter((r) => (r.rating ?? 5) === n).length);
  const reviewPhotos = realReviews.flatMap((r) => r.images ?? []).filter(Boolean);
  const buyers = realReviews.slice(0, 4);
  const otherBuyers = Math.max(0, reviewTotal - Math.min(2, buyers.length));

  const specificationRows = useMemo(() => {
    const rows: Array<[string, string]> = [
      ["Category", product.categories[0]?.name || "Home & Living"],
      ["SKU", variant?.sku || product.sku],
      ["Availability", inStock ? `${variant ? variant.stock : product.stockQuantity} in stock` : "Out of stock"],
      ["Payment", "Cash on Delivery"],
      ["Delivery", "Nationwide delivery across Pakistan"],
    ];
    for (const [key, value] of Object.entries(variant?.attributes || {})) {
      if (value) {
        rows.splice(Math.max(2, rows.length - 2), 0, [
          key.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          String(value),
        ]);
      }
    }
    return rows;
  }, [product.categories, product.sku, product.stockQuantity, variant, inStock]);

  /* Effects */
  useEffect(() => {
    trackStoreEvent(
      "ViewContent",
      { content_ids: [variant?.sku || product.sku], content_type: "product", value: basePrice, currency: "PKR" },
      { clarityEvent: "view_product" }
    ).catch(() => undefined);
  }, [product.id, basePrice, product.sku, variant?.sku]);

  // Show the sticky bar once the main action buttons leave the viewport
  useEffect(() => {
    const node = actionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setSticky(!entry.isIntersecting), { threshold: 0.05 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Lift the sticky bar so it rests on the footer's top edge
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector("footer");
      if (!footer) {
        setStickyLift(0);
        return;
      }
      const overlap = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
      setStickyLift((prev) => (prev === overlap ? prev : overlap));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Close the lightbox with Escape
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  /* Actions */
  const chooseVariant = (next: Variant) => {
    setVariant(next);
    if (next.imageUrl) setSelectedImage(next.imageUrl);
  };

  const handleShare = async () => {
    if (typeof window !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: product.name, url: window.location.href });
      } catch {}
    }
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
    await trackStoreEvent(
      "AddToCart",
      {
        content_ids: [variant?.sku || product.sku],
        contents: [{ id: variant?.sku || product.sku, quantity: quantity * bundleSize, item_price: basePrice }],
        value: bundleTotal * quantity,
        currency: "PKR",
      },
      { clarityEvent: goCheckout ? "buy_now" : "add_to_cart" }
    );
    if (goCheckout) {
      setOpen(false);
      window.dispatchEvent(new Event("zelvo:route-start"));
      router.push("/checkout?buyNow=1");
    }
  };

  const openReviewForm = () => {
    setShowReviewForm(true);
    setTimeout(() => document.getElementById("review-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const productPath = `/product/${product.slug}/`;
  const whatsappMessage = encodeURIComponent(`Hi Zelvomart, I want to ask about ${product.name}: ${productPath}`);

  const onProductImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!event.currentTarget.src.endsWith(fallbackImage)) event.currentTarget.src = fallbackImage;
  };

  const trustItems: Array<{ icon: IconName; title: string; text: string }> = [
    { icon: "cash", title: "Cash on Delivery", text: "Pay when it arrives" },
    { icon: "truck", title: "Free delivery", text: "Across Pakistan" },
    { icon: "shield", title: "Checked before dispatch", text: "Quality guaranteed" },
    { icon: "exchange", title: "Easy exchange", text: "If it doesn't match" },
  ];

  return (
    <div className="mock-pdp-container">
      <div className="mock-pdp-top">
        {/* ================= Left: gallery + trust cards ================= */}
        <div className="mock-pdp-gallery">
          <div className="pdp-gallery-main">
            <div className="pdp-thumbs-wrap">
              <div className="pdp-thumbs">
                {galleryImages.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    className={`pdp-thumb ${selectedImage === src ? "active" : ""}`}
                    onClick={() => setSelectedImage(src)}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image src={src} alt={`${product.name} thumbnail ${index + 1}`} fill sizes="80px" onError={onProductImageError} />
                  </button>
                ))}
                {product.videoUrl && galleryImages[0] ? (
                  <button type="button" className="pdp-thumb" onClick={() => setVideoOpen(true)} aria-label="Play product video">
                    <Image src={galleryImages[0]} alt="" fill sizes="80px" onError={onProductImageError} />
                    <span className="pdp-thumb-play">
                      <Icon name="play" />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <div
              className="mock-pdp-main-image"
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => onGalleryTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
            >
              {selectedImage ? (
                <div
                  className="mock-pdp-zoom-wrapper"
                  style={{
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: isZoomed ? "scale(2)" : "scale(1)",
                  }}
                >
                  <Image
                    src={selectedImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 45vw"
                    onError={() => {
                      if (selectedImage !== fallbackImage) setSelectedImage(fallbackImage);
                    }}
                  />
                </div>
              ) : null}

              <button type="button" className="pdp-round-btn pdp-expand" aria-label="View full screen" onClick={() => setLightbox(true)}>
                <Icon name="expand" />
              </button>

              {galleryImages.length > 1 ? (
                <div className="pdp-arrows">
                  <button type="button" className="pdp-round-btn" aria-label="Previous image" onClick={() => moveGallery(-1)}>
                    <Icon name="left" />
                  </button>
                  <button type="button" className="pdp-round-btn" aria-label="Next image" onClick={() => moveGallery(1)}>
                    <Icon name="right" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="pdp-trust-cards">
            {trustItems.map((item) => (
              <div key={item.title} className="pdp-trust-card">
                <i className="pdp-trust-card-icon">
                  <Icon name={item.icon} />
                </i>
                <b>{item.title}</b>
                <small>{item.text}</small>
              </div>
            ))}
          </div>
        </div>

        {/* ================= Right: buy box ================= */}
        <div className="mock-pdp-buy-natural">
          <div className="mock-pdp-buy-topline">
            <span className="mock-pdp-tag-pill">{product.featured ? "Bestseller" : "Customer favourite"}</span>
            <div className="mock-pdp-top-actions">
              {extra.soldThisMonth ? <span className="pdp-sold">{extra.soldThisMonth}+ sold this month</span> : null}
              <button type="button" aria-label="Share product" onClick={handleShare}>
                <Icon name="share" />
              </button>
            </div>
          </div>

          <h1 className="mock-pdp-title">{product.name}</h1>
          {product.shortDescription ? <p className="mock-pdp-short-description">{product.shortDescription}</p> : null}

          <div className="mock-pdp-rating">
            <span className="pdp-stars">★★★★★</span>
            <b>{averageText}</b>
            <a href="#reviews">{reviewTotal} reviews</a>
            {extra.orderCount ? (
              <>
                <i className="pdp-divider" />
                <span>{extra.orderCount}+ ordered</span>
              </>
            ) : null}
          </div>

          {buyers.length ? (
            <div className="pdp-buyers">
              <div className="pdp-avatars">
                {buyers.map((r, i) => (
                  <span key={r.id} style={{ background: AVATAR_COLOURS[i % AVATAR_COLOURS.length] }}>
                    {initials(r.name)}
                  </span>
                ))}
              </div>
              <p>
                <b>
                  {buyers
                    .slice(0, 2)
                    .map((r) => firstName(r.name))
                    .join(", ")}
                  {otherBuyers > 0 ? ` & ${otherBuyers} others` : ""}
                </b>{" "}
                ordered this recently
              </p>
            </div>
          ) : null}

          <div className="mock-pdp-price">
            <strong>{money(basePrice)}</strong>
            {product.onSale ? <del>{money(product.regularPrice)}</del> : null}
            {salePercent ? (
              <span className="mock-pdp-sale-badge">
                Save {money(saveAmount)} ({salePercent}%)
              </span>
            ) : null}
          </div>

          <div className="mock-pdp-payment-note">✓ Free delivery · Pay cash when it arrives</div>

          <div className="mock-pdp-quick-facts">
            <span>
              <small>Availability</small>
              <b>{inStock ? "Ready to dispatch" : "Out of stock"}</b>
            </span>
            <span>
              <small>Category</small>
              <b>{categoryName}</b>
            </span>
            <span>
              <small>Payment</small>
              <b>Cash on Delivery</b>
            </span>
            <span>
              <small>Delivery</small>
              <b>Across Pakistan</b>
            </span>
          </div>

          <ul className="mock-pdp-checks">
            <li>Looks even better in real life</li>
            <li>Useful everyday size and feel</li>
            <li>Checked before dispatch</li>
            <li>Real support if you need help</li>
          </ul>

          {/* Colour */}
          {colourVariants.length > 0 ? (
            <div className="pdp-option">
              <p className="pdp-option-label">
                Colour: <b>{variant?.name}</b>
              </p>
              <div className="pdp-colour-row">
                {colourVariants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`pdp-colour-card ${variant?.id === v.id ? "active" : ""}`}
                    onClick={() => chooseVariant(v)}
                  >
                    <span className="pdp-colour-thumb">
                      {v.imageUrl ? <Image src={v.imageUrl} alt={v.name} fill sizes="48px" onError={onProductImageError} /> : null}
                    </span>
                    <span>{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Capacity (shown when variants carry a capacity / size / volume attribute) */}
          {capacityOptions.length > 0 ? (
            <div className="pdp-option">
              <p className="pdp-option-label">Capacity:</p>
              <div className="pdp-capacity-row">
                {capacityOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`pdp-capacity-card ${currentCapacity === opt.label ? "active" : ""}`}
                    onClick={() => chooseVariant(opt.variant)}
                  >
                    <i className="pdp-radio" />
                    <span>
                      <b>{opt.label}</b>
                      <small>All-day capacity</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Bundle */}
          {product.bundleEnabled ? (
            <div className="mock-pdp-bundle">
              <div className="mock-pdp-label">
                <b>Choose your bundle</b>
                <span>Buy 2, save {discountPercent}%</span>
              </div>
              <div className="pdp-bundle-grid">
                <label className={bundleSize === 1 ? "active" : ""}>
                  <input type="radio" name="bundle" checked={bundleSize === 1} onChange={() => setBundleSize(1)} />
                  <span>
                    <b>1 piece</b>
                    <small>Perfect for you</small>
                  </span>
                  <strong>{money(basePrice)}</strong>
                </label>
                <label className={bundleSize === 2 ? "active" : ""}>
                  <input
                    type="radio"
                    name="bundle"
                    checked={bundleSize === 2}
                    onChange={() => {
                      setBundleSize(2);
                      trackStoreEvent(
                        "ViewContent",
                        { content_ids: [variant?.sku || product.sku], value: bundleTotal, currency: "PKR" },
                        { clarityEvent: "choose_bundle_2" }
                      ).catch(() => undefined);
                    }}
                  />
                  <span>
                    <b>2 pieces</b>
                    <small className="pdp-save-text">Save {money(twoPieceFull - twoPiecePrice)}</small>
                  </span>
                  <strong>
                    {money(twoPiecePrice)}
                    <del>{money(twoPieceFull)}</del>
                  </strong>
                </label>
              </div>
            </div>
          ) : null}

          {/* Quantity + stock */}
          <div className="pdp-qty-row">
            <div className="mock-pdp-quantity">
              <div>
                <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((c) => Math.max(1, c - 1))}>
                  −
                </button>
                <b>{quantity}</b>
                <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((c) => Math.min(maxQuantity, c + 1))}>
                  +
                </button>
              </div>
            </div>
            <div className={`pdp-stock ${inStock ? "" : "out"}`}>
              <i />
              <span>
                <b>{inStock ? "In stock" : "Out of stock"}</b>
                {inStock ? <small>Ships within 24 hours</small> : null}
              </span>
            </div>
            <div className="mock-pdp-order-total">
              <span>Order total</span>
              <strong>{money(bundleTotal * quantity)}</strong>
            </div>
          </div>

          {/* Actions */}
          <div ref={actionRef} className="pdp-actions">
            <button type="button" className="pdp-btn pdp-btn-order" disabled={!inStock} onClick={() => add(true)}>
              <span>
                {inStock ? "Order Now" : "Out of stock"}
                {inStock ? <small>Pay on Delivery</small> : null}
              </span>
              <Icon name="arrow" />
            </button>
            <button type="button" className="pdp-btn pdp-btn-outline" disabled={!inStock} onClick={() => add(false)}>
              <Icon name="cart" /> Add to cart
            </button>
            <a
              className="pdp-btn pdp-btn-whatsapp"
              href={`https://wa.me/${whatsapp}?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackStoreEvent("Contact", { content_name: product.name }, { clarityEvent: "whatsapp_tap" })}
            >
              <WhatsAppIcon size={16} /> Order on WhatsApp
            </a>
            <button
              type="button"
              className={`pdp-btn pdp-btn-outline ${wished ? "saved" : ""}`}
              aria-pressed={wished}
              onClick={() => setWished((w) => !w)}
            >
              <Icon name="heart" className={`pdp-icon ${wished ? "filled" : ""}`} /> {wished ? "Saved" : "Add to wishlist"}
            </button>
          </div>

          {/* Delivery steps */}
          <div className="mock-pdp-delivery-line">
            <div>
              <span>✓</span>
              <b>Ordered</b>
              <small>Today</small>
            </div>
            <i />
            <div>
              <span>▣</span>
              <b>Dispatched</b>
              <small>1–2 days</small>
            </div>
            <i />
            <div>
              <span>▱</span>
              <b>Delivered</b>
              <small>2–5 days</small>
            </div>
          </div>

          <div className="mock-pdp-gift">
            <i className="mock-pdp-gift-icon">
              <Icon name="gift" />
            </i>
            <div>
              <b>Buying as a gift?</b>
              <small>We&apos;ll pack it neatly. No invoice in the box unless requested.</small>
            </div>
          </div>
        </div>
      </div>

      {/* ================= Tabs ================= */}
      <section className="pdp-tabs-card">
        <div className="pdp-tab-list" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`pdp-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="pdp-tab-panel" role="tabpanel">
          {tab === "description" ? (
            <>
              <h3>Product description</h3>
              {product.description ? (
                <div dangerouslySetInnerHTML={{ __html: product.description }} />
              ) : (
                <p>{product.shortDescription || "Made for everyday use, checked by hand before it leaves our warehouse."}</p>
              )}
            </>
          ) : null}
          {tab === "specs" ? (
            <>
              <h3>Specifications</h3>
              <div className="mock-pdp-specs">
                {specificationRows.map(([label, value]) => (
                  <p key={label}>
                    <b>{label}</b>
                    <span>{value}</span>
                  </p>
                ))}
              </div>
            </>
          ) : null}
          {tab === "box" ? (
            <>
              <h3>What&apos;s in the box</h3>
              <p>Your selected product, protective packaging, and order verification details.</p>
            </>
          ) : null}
          {tab === "delivery" ? (
            <>
              <h3>Delivery &amp; Returns</h3>
              <p>Nationwide courier delivery with Cash on Delivery across Pakistan. Pay when the parcel arrives.</p>
              <p>If something is not right, contact our WhatsApp support team and we will guide you through the exchange.</p>
            </>
          ) : null}
        </div>
      </section>

      {/* ================= Reviews ================= */}
      <section id="reviews" className="mock-pdp-reviews">
        <div className="pdp-reviews-head">
          <div>
            <span className="mock-eyebrow">REVIEWS</span>
            <h2>What customers say.</h2>
          </div>
          <button type="button" className="pdp-write-review" onClick={openReviewForm}>
            <Icon name="pencil" /> Write a review
          </button>
        </div>

        <div className="pdp-reviews-top">
          <aside className="pdp-rating-card">
            <div className="pdp-rating-big">
              <strong>{averageText}</strong>
              <div>
                <span className="pdp-stars">★★★★★</span>
                <small>Based on {reviewTotal} verified orders</small>
              </div>
            </div>
            {realReviews.length ? (
              <div className="pdp-bars">
                {[5, 4, 3, 2, 1].map((n, i) => (
                  <div key={n}>
                    <span>{n} star</span>
                    <i>
                      <u style={{ width: `${(starCounts[i] / realReviews.length) * 100}%` }} />
                    </i>
                    <b>{starCounts[i]}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>

          {reviewPhotos.length ? (
            <div className="pdp-review-photos">
              <p>Customer photos &amp; videos</p>
              <div>
                {reviewPhotos.slice(0, 5).map((src, i) => (
                  <span key={`${src}-${i}`}>
                    <Image src={src} alt={`Customer photo ${i + 1}`} fill sizes="120px" onError={onProductImageError} />
                  </span>
                ))}
                {reviewPhotos.length > 5 ? (
                  <span className="more">
                    <b>+{reviewPhotos.length - 5}</b>
                    <small>more</small>
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="pdp-review-grid">
          {reviewList.map((review, i) => (
            <article key={review.id} className="pdp-review-card">
              <header>
                <span className="pdp-avatar" style={{ background: AVATAR_COLOURS[i % AVATAR_COLOURS.length] }}>
                  {initials(review.name)}
                </span>
                <div>
                  <b>{review.name}</b>
                  <small>{timeAgo(review.createdAt)}</small>
                </div>
              </header>
              <div className="pdp-review-meta">
                <span className="pdp-stars">{stars(Math.min(5, Math.max(1, review.rating ?? 5)))}</span>
                <small>{review.verified === false ? "Customer review" : "Verified order"}</small>
              </div>
              <p>{review.body}</p>
            </article>
          ))}
        </div>

        {showReviewForm ? (
          <div id="review-form" className="pdp-review-form">
            <ReviewForm productId={product.id} />
          </div>
        ) : null}
      </section>

      {/* ================= Sticky order bar (portal so no parent transform can break it) ================= */}
      {sticky && isPrimary && typeof document !== "undefined"
        ? createPortal(
            <div className="mock-sticky-atc" style={{ bottom: stickyLift }}>
              <div className="mock-sticky-atc-inner">
                <div className="mock-sticky-atc-info">
                  <div className="thumb">
                    <Image src={selectedImage} alt={product.name} fill sizes="44px" onError={onProductImageError} />
                  </div>
                  <div className="mock-sticky-atc-text">
                    <b>{product.name}</b>
                    <span>{money(bundleTotal * quantity)}</span>
                  </div>
                </div>
                <button type="button" disabled={!inStock} onClick={() => add(true)}>
                  {inStock ? "Order Now" : "Out of stock"}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Lightbox */}
      {lightbox && typeof document !== "undefined"
        ? createPortal(
            <div className="pdp-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}>
              <button type="button" className="pdp-lightbox-close" aria-label="Close" onClick={() => setLightbox(false)}>
                <Icon name="close" />
              </button>
              <div className="pdp-lightbox-img" onClick={(e) => e.stopPropagation()}>
                <Image src={selectedImage} alt={product.name} fill sizes="100vw" onError={onProductImageError} />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* Video modal */}
      {videoOpen && product.videoUrl && typeof document !== "undefined"
        ? createPortal(
            <div className="pdp-lightbox" role="dialog" aria-modal="true" onClick={() => setVideoOpen(false)}>
              <button type="button" className="pdp-lightbox-close" aria-label="Close video" onClick={() => setVideoOpen(false)}>
                <Icon name="close" />
              </button>
              <div className="pdp-video" onClick={(e) => e.stopPropagation()}>
                <iframe
                  src={product.videoUrl}
                  title={`${product.name} video`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}