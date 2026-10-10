"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCart } from "@/components/CartProvider";
import { money } from "@/lib/format";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";
import type { Product, Variant } from "@/types/product";

import ProductGallery from "./pdp/ProductGallery";
import ProductBuyBox from "./pdp/ProductBuyBox";
import ProductTabs from "./pdp/ProductTabs";
import ProductReviews from "./pdp/ProductReviews";
import { isValidImageUrl } from "./pdp/pdp-icons";
import "./ProductDetail.css";

// Helper to reliably extract the first valid image whether stored as string or object
function getInitialProductImage(product?: Product | null, fallback: string = "/placeholder.png"): string {
  if (!product) return fallback;
  if (product.image && isValidImageUrl(product.image)) return product.image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    const src = typeof first === "string" ? first : first?.src;
    if (src && isValidImageUrl(src)) return src;
  }

  return fallback;
}

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
  const { addItem, setOpen } = useCart();
  const actionRef = useRef<HTMLDivElement | null>(null);

  // Safe fallback image derivation
  const fallbackImage = product ? getProductFallbackImage(product) : "/placeholder.png";

  // Component State
  const [selectedImage, setSelectedImage] = useState<string>(() =>
    getInitialProductImage(product, fallbackImage)
  );
  const [variant, setVariant] = useState<Variant | null>(product?.variants?.[0] || null);
  const [bundleSize, setBundleSize] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [sticky, setSticky] = useState<boolean>(false);
  const [stickyLift, setStickyLift] = useState<number>(0);

  // Synchronize state if product changes across navigation
  useEffect(() => {
    if (product) {
      setSelectedImage(getInitialProductImage(product, fallbackImage));
      setVariant(product.variants?.[0] || null);
    }
  }, [product?.id, fallbackImage]);

  // Pricing calculations
  const basePrice = Number(variant?.priceOverride ?? product?.price ?? 0);
  const discountPercent = Number(product?.bundleDiscountPercent ?? defaultBundleDiscount);
  const inStock = variant ? (variant.stock ?? 0) > 0 : product?.stockStatus === "instock";
  const isPrimary = !pathname || (product?.slug ? pathname.includes(product.slug) : true);

  const bundleTotal = useMemo(() => {
    const raw = basePrice * bundleSize;
    return bundleSize === 2 && product?.bundleEnabled ? raw * (1 - discountPercent / 100) : raw;
  }, [basePrice, bundleSize, discountPercent, product?.bundleEnabled]);

  // Analytics tracking
  useEffect(() => {
    if (!product) return;
    trackStoreEvent(
      "ViewContent",
      {
        content_ids: [variant?.sku || product.sku],
        content_type: "product",
        value: basePrice,
        currency: "PKR",
      },
      { clarityEvent: "view_product" }
    ).catch(() => undefined);
  }, [product?.id, basePrice, product?.sku, variant?.sku]);

  // Sticky order bar viewport intersection
  useEffect(() => {
    const node = actionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setSticky(!entry.isIntersecting), {
      threshold: 0.05,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Avoid overlap with page footer
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

  const handleSelectVariant = (next: Variant) => {
    setVariant(next);
    if (isValidImageUrl(next?.imageUrl)) {
      setSelectedImage(next.imageUrl!);
    }
  };

  const handleAddToCart = async (goCheckout = false) => {
    if (!product || !inStock) return;

    addItem({
      productId: product.id,
      variantId: variant?.id,
      sku: variant?.sku || product.sku,
      slug: product.slug,
      name: product.name,
      image: (isValidImageUrl(variant?.imageUrl) ? variant?.imageUrl : null) || selectedImage,
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
        contents: [
          {
            id: variant?.sku || product.sku,
            quantity: quantity * bundleSize,
            item_price: basePrice,
          },
        ],
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

  const onStickyImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!event.currentTarget.src.endsWith(fallbackImage)) {
      event.currentTarget.src = fallbackImage;
    }
  };

  if (!product) {
    return (
      <div style={{ padding: "5rem 1rem", textAlign: "center", color: "#64748b" }}>
        <h2>Product details unavailable</h2>
      </div>
    );
  }

  return (
    <div className="mock-pdp-container">
      <div className="mock-pdp-top">
        {/* 1. Gallery Section */}
        <ProductGallery
          product={product}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          fallbackImage={fallbackImage}
        />

        {/* 2. Buy Box & Variant Selector Section */}
        <ProductBuyBox
          product={product}
          variant={variant}
          onSelectVariant={handleSelectVariant}
          bundleSize={bundleSize}
          setBundleSize={setBundleSize}
          quantity={quantity}
          setQuantity={setQuantity}
          basePrice={basePrice}
          bundleTotal={bundleTotal}
          discountPercent={discountPercent}
          inStock={inStock}
          onAdd={handleAddToCart}
          whatsapp={whatsapp}
          actionRef={actionRef}
        />
      </div>

      {/* 3. Specifications & Description Tabs */}
      <ProductTabs product={product} variant={variant} inStock={inStock} />

      {/* 4. Customer Reviews Section */}
      <ProductReviews product={product} />

      {/* Sticky Bottom Order Bar */}
      {sticky && isPrimary && typeof document !== "undefined"
        ? createPortal(
            <div className="mock-sticky-atc" style={{ bottom: stickyLift }}>
              <div className="mock-sticky-atc-inner">
                <div className="mock-sticky-atc-info">
                  <div className="thumb">
                    {isValidImageUrl(selectedImage) ? (
                      <Image
                        src={selectedImage}
                        alt={product.name || "Product preview"}
                        fill
                        sizes="44px"
                        onError={onStickyImageError}
                      />
                    ) : null}
                  </div>
                  <div className="mock-sticky-atc-text">
                    <b>{product.name}</b>
                    <span>{money(bundleTotal * quantity)}</span>
                  </div>
                </div>
                <button type="button" disabled={!inStock} onClick={() => handleAddToCart(true)}>
                  {inStock ? "Order Now" : "Out of stock"}
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}