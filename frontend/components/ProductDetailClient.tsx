"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCart } from "@/components/CartProvider";
import { bundleLineTotal, BUY_TWO_DISCOUNT_PERCENT } from "@/lib/bundle-price";
import { money } from "@/lib/format";
import { trackStoreEvent } from "@/lib/client-tracking";
import { getProductFallbackImage } from "@/lib/product-media";
import { productPricing } from "@/lib/product-price";
import type { Product, Variant } from "@/types/product";
import type { ResolvedProductTab } from "@/lib/product-tabs";

import ProductGallery from "./pdp/ProductGallery";
import ProductBuyBox from "./pdp/ProductBuyBox";
import ProductTabs from "./pdp/ProductTabs";
import ProductReviews from "./pdp/ProductReviews";
import { isValidImageUrl } from "./pdp/pdp-icons";
import "./ProductDetail.css";
import "./pdp/pdp.css";

function variantInStock(variant: Variant) {
  const status = variant.stockStatus ?? (variant.attributes?.stockStatus as string | undefined);
  if (status === "outofstock") return false;
  return status === "instock" || (variant.stock ?? 0) > 0;
}

// Open on a variant the shopper can actually buy
function getInitialVariant(product?: Product | null): Variant | null {
  const variants = product?.variants || [];
  return variants.find(variantInStock) || variants[0] || null;
}

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
  sections = [],
}: {
  product: Product;
  defaultBundleDiscount?: number;
  whatsapp?: string;
  sections?: ResolvedProductTab[];
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
  const [variant, setVariant] = useState<Variant | null>(() => getInitialVariant(product));
  const [bundleSize, setBundleSize] = useState<1 | 2>(1);
  const [quantity, setQuantity] = useState<number>(1);
  const [sticky, setSticky] = useState<boolean>(false);
  const [stickyLift, setStickyLift] = useState<number>(0);

  // Synchronize state if product changes across navigation
  useEffect(() => {
    if (product) {
      setSelectedImage(getInitialProductImage(product, fallbackImage));
      setVariant(getInitialVariant(product));
    }
  }, [product?.id, fallbackImage]);

  // Pricing calculations
  const pricing = useMemo(() => productPricing(product, variant), [product, variant]);
  const basePrice = pricing.price;
  const discountPercent = Number(product?.buyTwoDiscountPercent ?? defaultBundleDiscount ?? BUY_TWO_DISCOUNT_PERCENT);
  const inStock = variant ? variantInStock(variant) : product?.stockStatus === "instock";
  const isPrimary = !pathname || (product?.slug ? pathname.includes(product.slug) : true);

  const priced = useMemo(
    () => bundleLineTotal(basePrice, quantity, bundleSize === 2 && product?.bundleEnabled ? 2 : 1, discountPercent),
    [basePrice, quantity, bundleSize, discountPercent, product?.bundleEnabled],
  );
  const bundleTotal = quantity > 0 ? priced.total / quantity : priced.total;

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

  const galleryProduct = useMemo(() => {
    const existing = (product.images || [])
      .map((item) => (typeof item === "string" ? item : item.src))
      .filter((src) => src && isValidImageUrl(src));
    const variantSources = (product.variants || [])
      .flatMap((item) => [...(item.images || []), item.imageUrl || ""])
      .filter((src) => src && isValidImageUrl(src));
    const merged: string[] = [];
    for (const src of [...existing, ...variantSources]) {
      if (!merged.includes(src)) merged.push(src);
    }
    if (!merged.length) return product;
    // Alt text and image title from the admin belong to the main product image only.
    const mainSrc = existing[0];
    return {
      ...product,
      image: merged[0] || product.image,
      images: merged.map((src) =>
        src === mainSrc
          ? { src, alt: product.imageAlt || product.name, ...(product.imageTitle ? { title: product.imageTitle } : {}) }
          : { src, alt: product.name },
      ),
    };
  }, [product]);

  const handleSelectVariant = (next: Variant) => {
    setVariant(next);
    const first = next.images?.find((src) => isValidImageUrl(src)) || next.imageUrl;
    if (isValidImageUrl(first)) {
      setSelectedImage(first!);
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
      freeShipping: Boolean(product.freeShipping),
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
    <div className="zpd">
      <div className="zpd-top">
        {/* 1. Gallery Section */}
        <ProductGallery
          product={galleryProduct}
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
          pricing={pricing}
          bundleTotal={bundleTotal}
          discountPercent={discountPercent}
          inStock={inStock}
          onAdd={handleAddToCart}
          whatsapp={whatsapp}
          actionRef={actionRef}
        />
      </div>

      {/* 3. Specifications & Description Tabs */}
      <ProductTabs product={product} variant={variant} inStock={inStock} sections={sections} />

      {/* 4. Customer Reviews Section */}
      <ProductReviews product={product} />

      {/* Sticky Bottom Order Bar */}
      {sticky && isPrimary && typeof document !== "undefined"
        ? createPortal(
            <div className="zpd-portal zpd-sticky" style={{ bottom: stickyLift }}>
              <div className="zpd-sticky-inner">
                <div className="zpd-sticky-info">
                  <div className="zpd-sticky-thumb">
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
                  <div className="zpd-sticky-text">
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