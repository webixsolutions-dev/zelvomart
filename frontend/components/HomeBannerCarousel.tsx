"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { storeImages } from "@/lib/store-images";

const slides = [
  {
    eyebrow: "PAKISTAN'S EVERYDAY ONLINE STORE",
    heading: "Online Shopping in Pakistan | Zelvomart",
    description:
      "Shop useful products for everyday life at Zelvomart, from home essentials, fitness and kids' products to lifestyle finds, with convenient Cash on Delivery across Pakistan.",
    image: storeImages.heroOnline.src,
    mobileImage: storeImages.heroOnlineMobile.src,
    alt: "Zelvomart online store essentials for home, fitness and kids",
    primary: {
      label: "Shop Now",
      href: "/shop",
    },
    secondary: {
      label: "Explore Categories",
      href: "/shop#products",
    },
  },
  {
    eyebrow: "HOME · LIVING · LIFESTYLE",
    heading: "Items for You and Your Household, Delivered by Zelvomart",
    description:
      "From home and living essentials to tech gadgets, kids' products and fitness gear, Zelvomart brings everyday finds for every room and every member of the family to your doorstep. Pay on delivery anywhere in Pakistan, with help on WhatsApp whenever you need it.",
    image: storeImages.heroHousehold.src,
    mobileImage: storeImages.heroHouseholdMobile.src,
    alt: "Zelvomart household and home essentials",
    primary: {
      label: "Shop Home & Living",
      href: "/product-category/home-living/",
    },
    secondary: {
      label: "Order on WhatsApp",
      href: "whatsapp",
    },
  },
  {
    eyebrow: "FITNESS · SPORTS · ACTIVE LIVING",
    heading: "Move More, Train Better: Fitness & Sports Gear at Zelvomart",
    description:
      "From home workouts to gym days, find fitness and sports essentials at Zelvomart that keep you training, recovering and moving with confidence. Order online, pay on delivery across Pakistan, and get help on WhatsApp anytime.",
    image: storeImages.heroFitness.src,
    mobileImage: storeImages.heroFitnessMobile.src,
    alt: "Zelvomart fitness and sports products",
    primary: {
      label: "Shop Fitness & Sports",
      href: "/product-category/sports-fitness/",
    },
    secondary: {
      label: "Order on WhatsApp",
      href: "whatsapp",
    },
  },
] as const;

const benefits = [
  {
    title: "Cash on Delivery",
    text: "Pay with cash at delivery.",
    icon: "cod",
  },
  {
    title: "Fast Delivery",
    text: "Quick delivery across Pakistan",
    icon: "delivery",
  },
  {
    title: "Affordable Prices",
    text: "Premium quality, budget friendly",
    icon: "price",
  },
  {
    title: "24/7 Support",
    text: "We're here to help anytime",
    icon: "support",
  },
] as const;

function BenefitIcon({
  type,
}: {
  type: (typeof benefits)[number]["icon"];
}) {
  if (type === "delivery") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }

  if (type === "price") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h14v9H5z" />
        <path d="M8 9V6h8v3M8 13h.01M12 13h.01M16 13h.01" />
        <circle cx="12" cy="5" r="1.4" />
      </svg>
    );
  }

  if (type === "support") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
        <path d="M4 12h3v6H5a1 1 0 0 1-1-1zM20 12h-3v6h2a1 1 0 0 0 1-1z" />
        <path d="M17 18c-.8 1.5-2.2 2-4 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 14h3l2-6h6l2 6h5" />
      <path d="M5 14v4h14v-4M9 18v2M17 18v2" />
      <path d="M2 11h4M18 11h4" />
    </svg>
  );
}

export default function HomeBannerCarousel({
  whatsapp,
}: {
  whatsapp: string;
}) {
  const [active, setActive] = useState(0);
  const [pointerActive, setPointerActive] = useState(false);

  useEffect(() => {
    if (pointerActive) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [pointerActive]);

  function showSlideForPointer(clientX: number, bounds: DOMRect) {
    if (bounds.width <= 0) return;

    const ratio = Math.min(
      1,
      Math.max(0, (clientX - bounds.left) / bounds.width)
    );
    const index = Math.min(
      slides.length - 1,
      Math.floor(ratio * slides.length)
    );

    setActive(index);
  }

  return (
    <>
      <section
        className="zm-home-banner"
        aria-label="Zelvomart highlights"
        onMouseEnter={(event) => {
          setPointerActive(true);
          showSlideForPointer(
            event.clientX,
            event.currentTarget.getBoundingClientRect()
          );
        }}
        onMouseMove={(event) => {
          showSlideForPointer(
            event.clientX,
            event.currentTarget.getBoundingClientRect()
          );
        }}
        onMouseLeave={() => setPointerActive(false)}
      >
        <div className="zm-home-banner-track">
          {slides.map((slide, index) => {
            const secondaryHref =
              slide.secondary.href === "whatsapp"
                ? `https://wa.me/${whatsapp}`
                : slide.secondary.href;

            return (
              <article
                key={slide.heading}
                className={`zm-home-banner-slide ${
                  index === active ? "is-active" : ""
                }`}
                aria-hidden={index !== active}
              >
                <picture className="zm-home-banner-picture">
                  <source
                    media="(max-width: 720px)"
                    srcSet={slide.mobileImage}
                  />

                  <Image
                    src={slide.image}
                    alt={slide.alt}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                  />
                </picture>

                <div className="site-shell zm-home-banner-inner">
                  <div className="zm-home-banner-copy zm-hero-copy">
                    <span className="mock-eyebrow">
                      {slide.eyebrow}
                    </span>

                    {index === 0 ? (
                      <h1>{slide.heading}</h1>
                    ) : (
                      <h2>{slide.heading}</h2>
                    )}

                    <p>{slide.description}</p>

                    <div className="zm-home-banner-actions">
                      <Link
                        href={slide.primary.href}
                        className="mock-btn-dark"
                      >
                        {slide.primary.label}
                      </Link>

                      {slide.secondary.href === "whatsapp" ? (
                        <a
                          href={secondaryHref}
                          target="_blank"
                          rel="noreferrer"
                          className="mock-btn-light"
                        >
                          {slide.secondary.label}
                        </a>
                      ) : (
                        <Link
                          href={secondaryHref}
                          className="mock-btn-light"
                        >
                          {slide.secondary.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div
          className="zm-home-banner-controls"
          aria-label="Choose banner"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.heading}
              type="button"
              className={index === active ? "is-active" : ""}
              onClick={() => setActive(index)}
              aria-label={`Show banner ${index + 1}`}
            />
          ))}
        </div>

      </section>

      <section
        className="zm-hero-benefits"
        aria-label="Zelvomart shopping benefits"
      >
        <div className="zm-hero-benefits-track">
          {benefits.map((benefit) => (
            <article
              className="zm-hero-benefit"
              key={benefit.title}
            >
              <span className="zm-hero-benefit-icon">
                <BenefitIcon type={benefit.icon} />
              </span>

              <span className="zm-hero-benefit-copy">
                <strong>{benefit.title}</strong>
                <small>{benefit.text}</small>
              </span>
            </article>
          ))}
        </div>
      </section>

      <style jsx global>{`
        /*
         * IMPORTANT:
         * Same exact dimensions as .site-shell.
         * Is liye Cash on Delivery strip aur
         * Find what you came for left/right same honge.
         */

        .zm-hero-benefits {
          width: 100%;
          box-sizing: border-box;

          background: #f4f8fa;

          border-top: 1px solid #e0e9ee;
          border-bottom: 1px solid #dbe5ea;

          box-shadow: 0 8px 24px rgba(16, 39, 51, 0.035);
        }

        .zm-hero-benefits-track {
          width: min(
            calc(100% - var(--zm-page-gutter, 32px)),
            var(--zm-content-max, 1280px)
          ) !important;

          max-width: var(--zm-content-max, 1280px) !important;

          margin-left: auto !important;
          margin-right: auto !important;

          padding: 0 !important;

          display: grid;

          grid-template-columns:
            repeat(4, minmax(0, 1fr));

          align-items: stretch;

          box-sizing: border-box;
        }

        .zm-hero-benefit {
          min-width: 0;
          min-height: 82px;

          display: flex;

          align-items: center;

          gap: 12px;

          padding: 15px 18px;

          border-right: 1px solid #cbd7dd;

          background: transparent;

          box-sizing: border-box;

          transition:
            background 0.18s ease;
        }

        /*
         * First / last card ko extra external margin nahi.
         * Track khud category container ke saath aligned hai.
         */
        .zm-hero-benefit:first-child {
          padding-left: 0;
        }

        .zm-hero-benefit:last-child {
          border-right: 0;
          padding-right: 0;
        }

        .zm-hero-benefit:hover {
          background: rgba(255, 255, 255, 0.72);
        }

        .zm-hero-benefit-icon {
          width: 42px;
          height: 42px;

          flex: 0 0 42px;

          display: inline-flex;

          align-items: center;
          justify-content: center;

          border-radius: 12px;

          color: #079fd8;

          background: #e4f5fb;

          border: 1px solid #d4edf6;
        }

        .zm-hero-benefit-icon svg {
          width: 24px;
          height: 24px;

          fill: none;

          stroke: currentColor;

          stroke-width: 1.9;

          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .zm-hero-benefit-copy {
          display: flex;

          flex-direction: column;

          min-width: 0;

          gap: 3px;
        }

        .zm-hero-benefit-copy strong {
          color: #0a202b;

          font-size: 16px;

          line-height: 1.1;

          font-weight: 800;
        }

        .zm-hero-benefit-copy small {
          color: #536873;

          font-size: 11px;

          line-height: 1.3;

          font-weight: 500;
        }

        @media (max-width: 900px) {
          .zm-hero-benefit {
            padding: 14px 11px;

            gap: 9px;
          }

          .zm-hero-benefit:first-child {
            padding-left: 0;
          }

          .zm-hero-benefit:last-child {
            padding-right: 0;
          }

          .zm-hero-benefit-icon {
            width: 40px;
            height: 40px;

            flex-basis: 40px;
          }

          .zm-hero-benefit-copy strong {
            font-size: 14px;
          }

          .zm-hero-benefit-copy small {
            font-size: 10px;
          }
        }

        @media (max-width: 760px) {
          .zm-hero-benefits {
            padding: 10px 0 11px;

            overflow: hidden;
          }

          /*
           * Mobile par bhi same page gutter.
           */
          .zm-hero-benefits-track {
            width: calc(
              100% - var(--zm-page-gutter, 24px)
            ) !important;

            max-width: none !important;

            margin-left: auto !important;
            margin-right: auto !important;

            padding: 0 0 3px !important;

            display: flex;

            gap: 10px;

            overflow-x: auto;
            overflow-y: hidden;

            scroll-snap-type: x mandatory;

            overscroll-behavior-x: contain;

            scrollbar-width: none;

            -ms-overflow-style: none;

            -webkit-overflow-scrolling: touch;
          }

          .zm-hero-benefits-track::-webkit-scrollbar {
            display: none;
          }

          .zm-hero-benefit {
            flex: 0 0 min(78vw, 300px);

            min-height: 76px;

            padding: 12px 13px;

            gap: 11px;

            scroll-snap-align: start;

            border: 1px solid #d8e3e8 !important;

            border-radius: 12px;

            background: #fff;

            box-shadow:
              0 4px 14px rgba(16, 39, 51, 0.045);
          }

          .zm-hero-benefit:first-child {
            padding-left: 13px;
          }

          .zm-hero-benefit:last-child {
            padding-right: 13px;
          }

          .zm-hero-benefit-icon {
            width: 42px;
            height: 42px;

            flex-basis: 42px;

            border-radius: 11px;
          }

          .zm-hero-benefit-icon svg {
            width: 24px;
            height: 24px;
          }

          .zm-hero-benefit-copy strong {
            font-size: 14px;

            white-space: normal;
          }

          .zm-hero-benefit-copy small {
            font-size: 11px;

            white-space: normal;
          }
        }
      `}</style>
    </>
  );
}