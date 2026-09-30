"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, WalletIcon } from "@/components/Icons";
import type { Product } from "@/types/product";

const DEFAULT_HERO_IMAGE = "/images/hero/zelvomart-shopping.svg";

export default function Hero({ products, config }: { products: Product[]; config?: any }) {
  const slides = useMemo(
    () => products.filter((product) => product.image).slice(0, 5),
    [products],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % slides.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const current = slides[active];
  const heroImage = current?.image || config?.heroImage || DEFAULT_HERO_IMAGE;

  return (
    <section className="hero-main">
      <div
        className="hero-bg"
        aria-hidden="true"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="hero-overlay" />

      <div className="site-shell hero-inner">
        <div className="hero-copy">
          <span className="hero-kicker">
            {config?.heroKicker || "ZELVOMART • CASH ON DELIVERY"}
          </span>
          <h1>{config?.heroTitle || "Everyday finds, delivered across Pakistan."}</h1>
          <p>
            {config?.heroBody ||
              "Shop useful products for home, beauty, tech, fashion, fitness and more with convenient Cash on Delivery."}
          </p>

          <div className="hero-actions">
            <Link href="/shop" className="hero-link">
              Shop Now <ArrowRight size={18} />
            </Link>
            <Link href="/shipping-delivery" className="btn-green">
              <WalletIcon size={18} /> Cash on Delivery
            </Link>
          </div>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="hero-dots" aria-label="Hero slides">
          {slides.map((product, index) => (
            <button
              type="button"
              key={product.id}
              className={index === active ? "active" : ""}
              aria-label={`Show slide ${index + 1}`}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
