"use client";

import Image from "next/image";
import { useState, useRef, useMemo, useEffect } from "react";
import type { SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/types/product";
import { Icon, isValidImageUrl, type IconName } from "./pdp-icons";

interface ProductGalleryProps {
  product: Product;
  selectedImage: string;
  setSelectedImage: (url: string) => void;
  fallbackImage: string;
}

function formatEmbedVideoUrl(rawUrl?: string | null): { url: string; isDirectVideo: boolean } | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(trimmed)) {
    return { url: trimmed, isDirectVideo: true };
  }

  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return {
      url: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
      isDirectVideo: false,
    };
  }

  return { url: trimmed, isDirectVideo: false };
}

export default function ProductGallery({
  product,
  selectedImage,
  setSelectedImage,
  fallbackImage,
}: ProductGalleryProps) {
  const [lightbox, setLightbox] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const touchStartX = useRef<number | null>(null);

  if (!product) return null;

  const videoData = useMemo(() => formatEmbedVideoUrl(product?.videoUrl), [product?.videoUrl]);

  const displayImage =
    (isValidImageUrl(selectedImage) && selectedImage) ||
    (isValidImageUrl(product.image) && product.image) ||
    fallbackImage;

  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (product.image && isValidImageUrl(product.image)) list.push(product.image);

    if (Array.isArray(product.images)) {
      for (const item of product.images) {
        const src = typeof item === "string" ? item : item?.src;
        if (src && isValidImageUrl(src) && !list.includes(src)) list.push(src);
      }
    }

    if (selectedImage && isValidImageUrl(selectedImage) && !list.includes(selectedImage)) {
      list.push(selectedImage);
    }

    return list.length ? list : [fallbackImage];
  }, [product.image, product.images, selectedImage, fallbackImage]);

  const moveGallery = (direction: -1 | 1) => {
    if (galleryImages.length < 2) return;
    const current = Math.max(0, galleryImages.indexOf(displayImage));
    const next = (current + direction + galleryImages.length) % galleryImages.length;
    setSelectedImage(galleryImages[next]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  useEffect(() => {
    if (!lightbox && !videoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(false);
        setVideoOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, videoOpen]);

  const onProductImageError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (!e.currentTarget.src.endsWith(fallbackImage)) {
      e.currentTarget.src = fallbackImage;
    }
  };

  const trustItems: Array<{ icon: IconName; title: string; text: string }> = [
    { icon: "cash", title: "Cash on Delivery", text: "Pay when it arrives" },
    { icon: "truck", title: "Free delivery", text: "Across Pakistan" },
    { icon: "shield", title: "Checked before dispatch", text: "Quality guaranteed" },
    { icon: "exchange", title: "Easy exchange", text: "If it doesn't match" },
  ];

  return (
    <div className="w-full flex flex-col gap-3 font-sans">
      {/* ========================================================= */}
      {/* 1. MAIN PRODUCT SHOWCASE CARD                             */}
      {/* ========================================================= */}
      <div className="w-full bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3">
        
        {/* Main Stage Image */}
        <div
          className="group relative w-full aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-slate-50/70 select-none cursor-crosshair border border-slate-100"
          onMouseEnter={() => setIsZoomed(true)}
          onMouseLeave={() => setIsZoomed(false)}
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
          {/* Sale! Pill Badge */}
          {product.onSale && (
            <span className="absolute top-3 left-3 z-10 px-3 py-1 bg-gradient-to-r from-[#ff4d15] to-[#ea580c] text-white text-[11px] font-extrabold uppercase tracking-wider rounded-full shadow-sm">
              Sale!
            </span>
          )}

          {/* Zoom Indicator Button */}
          <button
            type="button"
            className="absolute top-3 right-3 z-10 w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-white text-slate-700 shadow-md flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
            aria-label="Zoom image"
            onClick={() => setLightbox(true)}
          >
            <svg
              className="w-4 h-4 text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
          </button>

          {/* Smooth Zoom Surface */}
          <div
            className="relative w-full h-full"
            style={{
              transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
              transform: isZoomed ? "scale(2.2)" : "scale(1)",
              transition: isZoomed ? "none" : "transform 0.25s ease-out",
            }}
          >
            <Image
              src={displayImage}
              alt={product.name || "Product Image"}
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              className="object-cover"
              onError={() => {
                if (displayImage !== fallbackImage) setSelectedImage(fallbackImage);
              }}
            />
          </div>

          {/* Navigation Arrows for Multiple Images */}
          {galleryImages.length > 1 && (
            <div className="absolute inset-y-0 inset-x-2.5 flex items-center justify-between pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white/95 shadow-md pointer-events-auto flex items-center justify-center text-slate-700 hover:text-slate-900 hover:scale-105 active:scale-95 transition cursor-pointer"
                onClick={() => moveGallery(-1)}
                aria-label="Previous image"
              >
                <Icon name="left" />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-white/95 shadow-md pointer-events-auto flex items-center justify-center text-slate-700 hover:text-slate-900 hover:scale-105 active:scale-95 transition cursor-pointer"
                onClick={() => moveGallery(1)}
                aria-label="Next image"
              >
                <Icon name="right" />
              </button>
            </div>
          )}
        </div>

        {/* 2. Sleek Thumbnail Strip */}
        <div className="flex gap-2 sm:gap-2.5 overflow-x-auto items-center py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {galleryImages.map((src, index) => {
            const isActive = displayImage === src;
            return (
              <button
                key={`${src}-${index}`}
                type="button"
                onClick={() => setSelectedImage(src)}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer border-2 ${
                  isActive
                    ? "border-sky-600 ring-2 ring-sky-200/90 shadow-xs scale-102"
                    : "border-slate-200/80 hover:border-slate-300 opacity-80 hover:opacity-100"
                }`}
              >
                <Image
                  src={src}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  onError={onProductImageError}
                />
              </button>
            );
          })}

          {/* Video Preview Chip */}
          {videoData && (
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 border-slate-200/80 bg-slate-900 flex items-center justify-center group cursor-pointer"
            >
              {galleryImages[0] && (
                <Image
                  src={galleryImages[0]}
                  alt="Video thumbnail"
                  fill
                  sizes="64px"
                  className="object-cover opacity-60 group-hover:opacity-40 transition"
                />
              )}
              <span className="relative z-10 w-6 h-6 rounded-full bg-white/95 flex items-center justify-center text-slate-900 shadow-xs">
                <Icon name="play" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FOUR TRUST CARDS: 1 PER ROW ON MOBILE, 4 ON DESKTOP    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 w-full mt-0.5">
        {trustItems.map((item) => (
          <div
            key={item.title}
            className="flex flex-row sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5 p-3 sm:p-2.5 rounded-2xl sm:rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/70 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all duration-200 h-full"
          >
            {/* Icon Container with Subtle Background Badge */}
            <span className="w-8.5 h-8.5 sm:w-7 sm:h-7 rounded-xl sm:rounded-none bg-sky-50 sm:bg-transparent text-sky-600 flex items-center justify-center shrink-0">
              <Icon name={item.icon} />
            </span>

            {/* Typography */}
            <div className="flex flex-col text-left sm:text-center">
              <b className="text-[12.5px] sm:text-[11.5px] font-bold text-slate-800 tracking-tight leading-snug">
                {item.title}
              </b>
              <span className="text-[11px] sm:text-[10px] text-slate-500 font-medium tracking-normal leading-tight mt-0.5">
                {item.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* LIGHTBOX MODAL                                            */}
      {/* ========================================================= */}
      {lightbox && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pdp-lightbox fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
              role="dialog"
              aria-modal="true"
              onClick={() => setLightbox(false)}
            >
              <button
                type="button"
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-sm font-bold backdrop-blur-xs transition cursor-pointer"
                onClick={() => setLightbox(false)}
                aria-label="Close lightbox"
              >
                ✕
              </button>
              <div className="relative max-w-3xl w-full max-h-[85vh] h-[550px]" onClick={(e) => e.stopPropagation()}>
                <Image
                  src={displayImage}
                  alt="Product view"
                  fill
                  className="object-contain"
                  onError={onProductImageError}
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {/* ========================================================= */}
      {/* VIDEO MODAL                                               */}
      {/* ========================================================= */}
      {videoOpen && videoData && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
              role="dialog"
              aria-modal="true"
              onClick={() => setVideoOpen(false)}
            >
              <button
                type="button"
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-sm font-bold backdrop-blur-xs transition cursor-pointer"
                onClick={() => setVideoOpen(false)}
                aria-label="Close video"
              >
                ✕
              </button>
              <div
                className="relative max-w-3xl w-full max-h-[85vh] h-[500px] bg-black rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {videoData.isDirectVideo ? (
                  <video src={videoData.url} controls autoPlay playsInline className="w-full h-full object-contain" />
                ) : (
                  <iframe
                    src={videoData.url}
                    title="Product video"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full aspect-video border-0"
                  />
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}