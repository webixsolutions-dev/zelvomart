import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";

export type HeroProps = {
  desktop: string;
  mobile?: string;
  /** Alt text for the banner art; empty (decorative) when omitted. */
  alt?: string;
  mobileImageFull?: boolean;
  eyebrow?: string;
  title: React.ReactNode;
  sub?: string;
  buttons?: { label: string; href: string }[];
  size?: "full" | "short" | "band";
  priority?: boolean;
  as?: "h1" | "h2";
  /** Trail shown on the art, above the eyebrow. "Home" is added automatically. */
  breadcrumbs?: Crumb[];
  children?: React.ReactNode;
};

/** Banner art stays the desktop crop on every screen. On phones the right side is zoomed in; copy stays real HTML. */
export function Hero({ desktop, mobile, alt = "", mobileImageFull = false, eyebrow, title, sub, buttons = [], size = "full", priority = false, as = "h1", breadcrumbs, children }: HeroProps) {
  const H = as;
  return (
    <section className={`hero hero-${size}${mobileImageFull ? " hero-mobile-image-full" : ""}`}>
      <picture className="hero-art">
        {mobile && <source media="(max-width: 760px)" srcSet={mobile} />}
        <img src={desktop} alt={alt} fetchPriority={priority ? "high" : "auto"} loading={priority ? "eager" : "lazy"} decoding="async" />
      </picture>
      <div className="container hero-inner">
        <div className="hero-content">
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} inHero />}
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <H>{title}</H>
          {sub && <p>{sub}</p>}
          {buttons.length > 0 && (
            <div className="hero-buttons">
              {buttons.map((b, i) => (
                <Link key={b.href} className={`btn ${i ? "secondary" : ""}`} href={b.href}>
                  {b.label} <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
