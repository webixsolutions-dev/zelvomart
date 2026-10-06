import Image from "next/image";
import Link from "next/link";

type StorefrontHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  priority?: boolean;
};

export default function StorefrontHero({
  eyebrow,
  title,
  description,
  image,
  alt,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  priority = false,
}: StorefrontHeroProps) {
  return (
    <section className="zm-storefront-hero" aria-label={`${title} hero`}>
      <div className="zm-storefront-hero-media">
        <Image
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          unoptimized={image.startsWith("/images/")}
        />
      </div>
      <div className="zm-storefront-hero-shade" aria-hidden="true" />
      <div className="site-shell zm-storefront-hero-inner">
        <div className="zm-storefront-hero-copy">
          <span className="mock-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="zm-storefront-hero-actions">
            <Link href={primaryHref} className="mock-btn-dark">{primaryLabel}</Link>
            {secondaryLabel && secondaryHref ? (
              <Link href={secondaryHref} className="mock-btn-light">{secondaryLabel}</Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
