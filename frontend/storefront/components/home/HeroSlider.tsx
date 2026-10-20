"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { site } from "@/lib/site";
import { waLink } from "@/lib/format";

type Slide = {
  desktop: string;
  /** Portrait art used on phones; the same heading and copy are restyled there by CSS. */
  mobile: string;
  alt: string;
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  /** `external` buttons (WhatsApp) open in a new tab. */
  buttons: { label: string; href: string; external?: boolean }[];
};

const slides: Slide[] = [
  {
    desktop: "/images/banners/desktop/home-01.webp",
    mobile: "/images/banners/mobile/hero/slide-1.webp",
    alt: "Zelvomart everyday essentials for home, fitness and kids",
    eyebrow: "Pakistan’s everyday online store",
    title: "Online Shopping in Pakistan | Zelvomart",
    sub: "Shop useful products for everyday life at Zelvomart, from home essentials, fitness and kids’ products to lifestyle finds, with convenient Cash on Delivery across Pakistan.",
    buttons: [
      { label: "Shop Now", href: "/shop-all-products/" },
      { label: "Explore Categories", href: "/#categories" },
    ],
  },
  {
    desktop: "/images/banners/desktop/home-02.webp",
    mobile: "/images/banners/mobile/hero/slide-2.webp",
    alt: "Zelvomart household and home living essentials",
    eyebrow: "Home · Living · Lifestyle",
    title: "Items for You and Your Household, Delivered by Zelvomart",
    sub: "From home and living essentials to tech gadgets, kids’ products and fitness gear, Zelvomart brings everyday finds for every room and every member of the family to your doorstep. Pay on delivery anywhere in Pakistan, with help on WhatsApp whenever you need it.",
    buttons: [
      { label: "Shop Home & Living", href: "/category/home-and-living/" },
      { label: "Order on WhatsApp", href: waLink(site.whatsappNumber), external: true },
    ],
  },
  {
    desktop: "/images/banners/desktop/home-03.webp",
    mobile: "/images/banners/mobile/hero/slide-3.webp",
    alt: "Zelvomart fitness and sports gear for home workouts",
    eyebrow: "Fitness · Sports · Active living",
    title: "Move More, Train Better: Fitness & Sports Gear at Zelvomart",
    sub: "From home workouts to gym days, find fitness and sports essentials at Zelvomart that keep you training, recovering and moving with confidence. Order online, pay on delivery across Pakistan, and get help on WhatsApp anytime.",
    buttons: [
      { label: "Shop Fitness & Sports", href: "/category/sports-and-fitness/" },
      { label: "Order on WhatsApp", href: waLink(site.whatsappNumber), external: true },
    ],
  },
];

/** Pixels the pointer must travel before a drag counts as a swipe. */
const SWIPE = 50;
export function HeroSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (paused || dragging) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [paused, dragging]);

  const go = (n: number) => setI((n + slides.length) % slides.length);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const x = e.clientX - s.x;
    if (!dragging) {
      // Let vertical scrolling win on touch screens.
      if (Math.abs(x) < 8 || Math.abs(x) < Math.abs(e.clientY - s.y)) return;
      setDragging(true);
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(x);
  };
  const endDrag = () => {
    if (!start.current) return;
    start.current = null;
    if (dragging) {
      if (dx <= -SWIPE) go(i + 1);
      else if (dx >= SWIPE) go(i - 1);
    }
    setDragging(false);
    setDx(0);
  };

  return (
    <section
      className={`hero hero-full hero-slider ${dragging ? "is-dragging" : ""}`}
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        // A drag that ends over a link should not open it.
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="slider-track" style={{ transform: `translate3d(calc(${-i * 100}% + ${dx}px), 0, 0)` }}>
        {slides.map((s, idx) => (
          <div key={idx} className={`slide ${idx === i ? "active" : ""}`} aria-hidden={idx !== i} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${slides.length}`}>
            <picture className="hero-art">
              <source media="(max-width: 760px)" srcSet={encodeURI(s.mobile)} />
              <img src={s.desktop} alt={s.alt} draggable={false} fetchPriority={idx === 0 ? "high" : "low"} loading={idx === 0 ? "eager" : "lazy"} decoding="async" />
            </picture>
            <div className="container hero-inner">
              <div className="hero-content">
                <div className="eyebrow">{s.eyebrow}</div>
                {idx === 0 ? <h1>{s.title}</h1> : <h2 className="h1">{s.title}</h2>}
                <p>{s.sub}</p>
                <div className="hero-buttons">
                  {s.buttons.map((b, bi) =>
                    b.external ? (
                      <a key={b.href} className={`btn ${bi ? "secondary" : ""}`} href={b.href} target="_blank" rel="noopener noreferrer" tabIndex={idx === i ? 0 : -1}>
                        {b.label} <ArrowRight size={16} />
                      </a>
                    ) : (
                      <Link key={b.href} className={`btn ${bi ? "secondary" : ""}`} href={b.href} tabIndex={idx === i ? 0 : -1}>
                        {b.label} <ArrowRight size={16} />
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="slider-ui container">
        <div className="dots">
          {slides.map((_, idx) => (
            <button key={idx} type="button" className={idx === i ? "active" : ""} aria-label={`Go to slide ${idx + 1}`} onClick={() => go(idx)} />
          ))}
        </div>
        <div className="arrows">
          <button type="button" aria-label="Previous slide" onClick={() => go(i - 1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Next slide" onClick={() => go(i + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
