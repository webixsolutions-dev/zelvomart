"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    eyebrow: "PAKISTAN'S EVERYDAY ONLINE STORE",
    heading: "Online Shopping in Pakistan | Zelvomart",
    description:
      "Shop useful products for everyday life at Zelvomart, from home essentials, fitness and kids' products to lifestyle finds, with convenient Cash on Delivery across Pakistan.",
    image: "/images/home-banners/banner-online-shopping.png",
    mobileImage: "/images/home-banners/banner-online-shopping-mobile.png",
    alt: "Zelvomart online store essentials for home, fitness and kids styled in a bright living room",
    primary: { label: "Shop Now", href: "/shop" },
    secondary: { label: "Explore Categories", href: "/shop#products" },
  },
  {
    eyebrow: "HOME · LIVING · LIFESTYLE",
    heading: "Items for You and Your Household, Delivered by Zelvomart",
    description:
      "From home and living essentials to tech gadgets, kids' products and fitness gear, Zelvomart brings everyday finds for every room and every member of the family to your doorstep. Pay on delivery anywhere in Pakistan, with help on WhatsApp whenever you need it.",
    image: "/images/home-banners/banner-household.png",
    mobileImage: "/images/home-banners/banner-household-mobile.png",
    alt: "Zelvomart household and home décor essentials on a marble table: table lamp, aroma diffuser, planter, tumbler and vase",
    primary: { label: "Shop Home & Living", href: "/product-category/home-living/" },
    secondary: { label: "Order on WhatsApp", href: "whatsapp" },
  },
  {
    eyebrow: "FITNESS · SPORTS · ACTIVE LIVING",
    heading: "Move More, Train Better: Fitness & Sports Gear at Zelvomart",
    description:
      "From home workouts to gym days, find fitness and sports essentials at Zelvomart that keep you training, recovering and moving with confidence. Order online, pay on delivery across Pakistan, and get help on WhatsApp anytime.",
    image: "/images/home-banners/banner-fitness.png",
    mobileImage: "/images/home-banners/banner-fitness-mobile.png",
    alt: "Zelvomart fitness and sports gear for home workouts and gym training, arranged on a clean studio background",
    primary: { label: "Shop Fitness & Sports", href: "/product-category/sports-fitness/" },
    secondary: { label: "Order on WhatsApp", href: "whatsapp" },
  },
] as const;

export default function HomeBannerCarousel({ whatsapp }: { whatsapp: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="zm-home-banner" aria-label="Zelvomart highlights">
      <div className="zm-home-banner-track">
        {slides.map((slide, index) => {
          const secondaryHref = slide.secondary.href === "whatsapp" ? `https://wa.me/${whatsapp}` : slide.secondary.href;
          return (
            <article key={slide.heading} className={`zm-home-banner-slide ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
              <picture className="zm-home-banner-picture">
                <source media="(max-width: 720px)" srcSet={slide.mobileImage} />
                <Image src={slide.image} alt={slide.alt} fill priority={index === 0} sizes="100vw" />
              </picture>
              <div className="site-shell zm-home-banner-inner">
                <div className="zm-home-banner-copy">
                  <span className="mock-eyebrow">{slide.eyebrow}</span>
                  {index === 0 ? <h1>{slide.heading}</h1> : <h2>{slide.heading}</h2>}
                  <p>{slide.description}</p>
                  <div className="zm-home-banner-actions">
                    <Link href={slide.primary.href} className="mock-btn-dark">{slide.primary.label}</Link>
                    {slide.secondary.href === "whatsapp" ? (
                      <a href={secondaryHref} target="_blank" rel="noreferrer" className="mock-btn-light">{slide.secondary.label}</a>
                    ) : (
                      <Link href={secondaryHref} className="mock-btn-light">{slide.secondary.label}</Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="zm-home-banner-controls" aria-label="Choose banner">
        {slides.map((slide, index) => (
          <button key={slide.heading} type="button" className={index === active ? "is-active" : ""} onClick={() => setActive(index)} aria-label={`Show banner ${index + 1}`} />
        ))}
      </div>
      <button type="button" className="zm-banner-arrow prev" aria-label="Previous banner" onClick={() => setActive((active - 1 + slides.length) % slides.length)}>‹</button>
      <button type="button" className="zm-banner-arrow next" aria-label="Next banner" onClick={() => setActive((active + 1) % slides.length)}>›</button>
    </section>
  );
}
