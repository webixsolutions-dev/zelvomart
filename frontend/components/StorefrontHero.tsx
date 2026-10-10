"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import SafeImage from "./SafeImage";

type StorefrontHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  image: string;
  alt?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  priority?: boolean;
  children?: ReactNode;
};

function HeroAction({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const external = /^(https?:|mailto:|tel:)/.test(href);

  if (external) {
    return (
      <a
        href={href}
        className={className}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function StorefrontHero({
  eyebrow,
  title,
  description,
  image,
  alt = "",
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  priority = false,
  children,
}: StorefrontHeroProps) {
  return (
    <section className="zm-storefront-hero">
      <div className="zm-storefront-hero-media">
        <SafeImage
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          fallbackSrc="/images/Zelvomart images/home and living zelvomart.png"
        />
      </div>

      <div className="site-shell zm-storefront-hero-inner">
        <div className="zm-storefront-hero-copy zm-hero-copy">
          {eyebrow ? <span className="mock-eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}

          {(primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) ? (
            <div className="zm-storefront-hero-actions">
              {primaryLabel && primaryHref ? (
                <HeroAction href={primaryHref} className="mock-btn-dark">
                  {primaryLabel}
                </HeroAction>
              ) : null}
              {secondaryLabel && secondaryHref ? (
                <HeroAction href={secondaryHref} className="mock-btn-light">
                  {secondaryLabel}
                </HeroAction>
              ) : null}
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </section>
  );
}
