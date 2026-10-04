"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "@/components/Icons";
import type { Product } from "@/types/product";

const HERO_SLIDES = [
  {
    image: "/images/hero/zelvomart-slider-01.webp",
    kicker: "CURATED FOR EVERYDAY",
    title: "Useful things, picked with better taste.",
    body: "A cleaner way to shop fashion, home, beauty, tech and fitness essentials — with Cash on Delivery across Pakistan.",
    primaryText: "Shop bestsellers",
    primaryHref: "/shop",
    secondaryText: "Explore collections",
    secondaryHref: "/shop",
  },
  {
    image: "/images/hero/zelvomart-slider-02.webp",
    kicker: "TECH • PLAY • EVERYDAY",
    title: "Good finds for the way you actually live.",
    body: "Practical products, simple choices and real support when you need it. No clutter, no complicated checkout.",
    primaryText: "Shop new finds",
    primaryHref: "/shop",
    secondaryText: "Why Zelvomart",
    secondaryHref: "/about-us",
  },
] as const;

export default function Hero({ config }: { products: Product[]; config?: any }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % HERO_SLIDES.length);
    }, 7200);
    return () => window.clearInterval(timer);
  }, []);

  const current = HERO_SLIDES[active];
  const title = active === 0 && config?.heroTitle ? String(config.heroTitle) : current.title;
  const body = active === 0 && config?.heroBody ? String(config.heroBody) : current.body;
  const kicker = active === 0 && config?.heroKicker ? String(config.heroKicker) : current.kicker;

  return (
    <section className="premium-hero" aria-label="Zelvomart featured collection">
      <div className="premium-hero-media" aria-hidden="true">
        {HERO_SLIDES.map((slide, index) => (
          <Image
            key={slide.image}
            src={slide.image}
            alt=""
            fill
            priority={index === 0}
            fetchPriority={index === 0 ? "high" : "auto"}
            loading={index === 0 ? "eager" : undefined}
            sizes="100vw"
            unoptimized
            className={index === active ? "premium-hero-image is-active" : "premium-hero-image"}
          />
        ))}
      </div>
      <div className="premium-hero-shade" aria-hidden="true" />

      <div className="site-shell premium-hero-inner">
        <div className="premium-hero-copy">
          <span className="premium-hero-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p>{body}</p>
          <div className="premium-hero-actions">
            <Link href={current.primaryHref} className="premium-button premium-button-light">
              {current.primaryText} <ArrowRight size={16} />
            </Link>
            <Link href={current.secondaryHref} className="premium-text-link">
              {current.secondaryText} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="premium-hero-controls" aria-label="Hero slides">
          <span className="premium-hero-counter">0{active + 1} / 0{HERO_SLIDES.length}</span>
          <div className="premium-hero-dots">
            {HERO_SLIDES.map((slide, index) => (
              <button
                type="button"
                key={slide.image}
                className={index === active ? "is-active" : ""}
                aria-label={`Show slide ${index + 1}`}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </div>

        <div className="premium-hero-mobile-arrows" aria-label="Hero navigation">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => setActive((value) => (value - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setActive((value) => (value + 1) % HERO_SLIDES.length)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
