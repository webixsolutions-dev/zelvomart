"use client";

import Image from "next/image";
import { useState, useRef, useMemo, useEffect } from "react";
import type { SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/types/product";
import { money } from "@/lib/format";
import { useDeliveryPolicy } from "@/components/DeliveryPolicy";
import { Icon, isValidImageUrl, type IconName } from "./pdp-icons";
import { parseVideoUrl } from "@/lib/product-video";

interface ProductGalleryProps {
  product: Product;
  selectedImage: string;
  setSelectedImage: (url: string) => void;
  fallbackImage: string;
}

export default function ProductGallery({
  product,
  selectedImage,
  setSelectedImage,
  fallbackImage,
}: ProductGalleryProps) {
  const [lightbox, setLightbox] = useState(false);
  // The video player (iframe) is only created after the shopper clicks the video thumbnail.
  const [playing, setPlaying] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const touchStartX = useRef<number | null>(null);
  const delivery = useDeliveryPolicy();
  const freeShipping = Boolean(product?.freeShipping);

  const badges = Array.isArray(product?.badges) ? product.badges.filter(Boolean).slice(0, 3) : [];

  const displayImage =
    (isValidImageUrl(selectedImage) && selectedImage) ||
    (isValidImageUrl(product?.image) && product.image) ||
    fallbackImage;

  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (product?.image && isValidImageUrl(product.image)) list.push(product.image);

    if (Array.isArray(product?.images)) {
      for (const item of product.images) {
        const src = typeof item === "string" ? item : item?.src;
        if (src && isValidImageUrl(src) && !list.includes(src)) list.push(src);
      }
    }

    if (selectedImage && isValidImageUrl(selectedImage) && !list.includes(selectedImage)) {
      list.push(selectedImage);
    }

    return list.length ? list : [fallbackImage];
  }, [product?.image, product?.images, selectedImage, fallbackImage]);

  // Alt text and title saved for this image in the admin "Edit details" panel.
  const displayMeta = Array.isArray(product?.images) ? product.images.find((item) => item?.src === displayImage) : undefined;
  const displayAlt = displayMeta?.alt || product.name || "Product Image";
  const displayTitle = displayMeta?.title || undefined;

  const video = useMemo(() => {
    const parsed = parseVideoUrl(product?.videoUrl);
    return parsed ? { ...parsed, thumbnailUrl: parsed.thumbnailUrl || product?.videoThumbnail || null } : null;
  }, [product?.videoUrl, product?.videoThumbnail]);

  const hasMany = galleryImages.length > 1;
  const showThumbs = hasMany || Boolean(video);
  const showImage = (src: string) => {
    setPlaying(false);
    setSelectedImage(src);
  };
  const currentIndex = Math.max(0, galleryImages.indexOf(displayImage));

  const moveGallery = (direction: -1 | 1) => {
    if (!hasMany) return;
    const next = (currentIndex + direction + galleryImages.length) % galleryImages.length;
    showImage(galleryImages[next]);
  };
  const moveRef = useRef(moveGallery);
  moveRef.current = moveGallery;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") moveRef.current(-1);
      if (e.key === "ArrowRight") moveRef.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!product) return null;

  const onProductImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!e.currentTarget.src.endsWith(fallbackImage)) {
      e.currentTarget.src = fallbackImage;
    }
  };

  const trustItems: Array<{ icon: IconName; title: string; text: string }> = [
    { icon: "cash", title: "Cash on Delivery", text: "Pay when it arrives" },
    {
      icon: "truck",
      title: freeShipping ? "Free shipping" : "Delivery charges",
      text: freeShipping ? "On this product" : money(delivery.flatRate),
    },
    { icon: "shield", title: "Checked before dispatch", text: "Quality guaranteed" },
    { icon: "exchange", title: "Easy exchange", text: "If it doesn't match" },
  ];

  return (
    <div className="zpd-gallery">
      <div className={`zpd-gallery-frame${showThumbs ? " has-thumbs" : ""}`}>
        {/* Main stage image */}
        <div
          className={`zpd-stage${playing ? " is-video" : ""}`}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse" && !playing) setIsZoomed(true);
          }}
          onPointerLeave={() => setIsZoomed(false)}
          onMouseMove={handleMouseMove}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current == null) return;
            const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) >= 45) moveGallery(delta < 0 ? 1 : -1);
          }}
        >
          {/* Top-left pills: Sale! + product badges */}
          {!playing && (product.onSale || badges.length > 0) && (
            <div className="zpd-badges">
              {product.onSale && <span className="zpd-badge is-sale">Sale!</span>}
              {badges.map((badge) => (
                <span key={badge} className="zpd-badge">
                  {badge}
                </span>
              ))}
            </div>
          )}

          {playing && video ? (
            <div className="zpd-stage-video">
              <iframe
                src={video.embedUrl}
                title={`${product.name || "Product"} video`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : null}

          {!playing ? (
          <button
            type="button"
            className="zpd-stage-btn zpd-zoom-btn"
            aria-label="Zoom image"
            onClick={() => setLightbox(true)}
          >
            <Icon name="expand" />
          </button>
          ) : null}

          {/* Hover zoom surface */}
          <div
            className="zpd-stage-zoom"
            style={{
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              transform: isZoomed ? "scale(2.2)" : "scale(1)",
              transition: isZoomed ? "none" : "transform 0.25s ease-out",
            }}
          >
            <Image
              src={displayImage}
              alt={displayAlt}
              title={displayTitle}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              onError={() => {
                if (displayImage !== fallbackImage) setSelectedImage(fallbackImage);
              }}
            />
          </div>

          {hasMany && !playing && (
            <>
              <div className="zpd-stage-arrows">
                <button type="button" className="zpd-stage-btn" onClick={() => moveGallery(-1)} aria-label="Previous image">
                  <Icon name="left" />
                </button>
                <button type="button" className="zpd-stage-btn" onClick={() => moveGallery(1)} aria-label="Next image">
                  <Icon name="right" />
                </button>
              </div>
              <span className="zpd-stage-count">
                {currentIndex + 1} / {galleryImages.length}
              </span>
            </>
          )}
        </div>

        {/* Thumbnails (the product video, when there is one, is the last one) */}
        {showThumbs && (
          <div className="zpd-thumbs">
            <div className="zpd-thumbs-track">
              {galleryImages.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => showImage(src)}
                  className={`zpd-thumb${!playing && displayImage === src ? " is-active" : ""}`}
                  aria-label={`Show image ${index + 1}`}
                  aria-current={!playing && displayImage === src}
                >
                  <Image src={src} alt={`Thumbnail ${index + 1}`} fill sizes="72px" onError={onProductImageError} />
                </button>
              ))}
              {video ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setPlaying(true);
                  }}
                  className={`zpd-thumb zpd-thumb-video${playing ? " is-active" : ""}`}
                  aria-label="Play product video"
                  aria-current={playing}
                >
                  {/* Plain <img>: a small i.ytimg.com / Vimeo thumbnail; next/image would fail until next.config is reloaded. */}
                  {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="Product video" loading="lazy" className="zpd-thumb-video-img" /> : null}
                  <span className="zpd-thumb-play" aria-hidden="true">
                    <Icon name="play" />
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Trust strip */}
      <ul className="zpd-trust">
        {trustItems.map((item) => (
          <li key={item.title}>
            <span className="zpd-trust-icon">
              <Icon name={item.icon} />
            </span>
            <span>
              <b>{item.title}</b>
              <span>{item.text}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Lightbox */}
      {lightbox && typeof document !== "undefined"
        ? createPortal(
            <div className="zpd-portal zpd-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}>
              <button type="button" className="is-close" onClick={() => setLightbox(false)} aria-label="Close lightbox">
                <Icon name="close" />
              </button>
              {hasMany && (
                <>
                  <button
                    type="button"
                    className="is-prev"
                    aria-label="Previous image"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveGallery(-1);
                    }}
                  >
                    <Icon name="left" />
                  </button>
                  <button
                    type="button"
                    className="is-next"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveGallery(1);
                    }}
                  >
                    <Icon name="right" />
                  </button>
                </>
              )}
              <div className="zpd-lightbox-img" onClick={(e) => e.stopPropagation()}>
                <Image src={displayImage} alt={displayAlt} title={displayTitle} fill sizes="92vw" onError={onProductImageError} />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
