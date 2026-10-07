"use client";

import Image from "next/image";
import Link from "next/link";

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
};

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
}: StorefrontHeroProps) {
  return (
    <section className="zm-storefront-hero">
      <div className="zm-storefront-hero-media">
        <Image
          src={image}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
        />
      </div>

      <div className="zm-storefront-hero-copy">
        {eyebrow ? <span className="mock-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}

        {(primaryLabel && primaryHref) || (secondaryLabel && secondaryHref) ? (
          <div className="zm-storefront-hero-actions">
            {primaryLabel && primaryHref ? (
              <Link className="zm-storefront-primary" href={primaryHref}>
                {primaryLabel}
              </Link>
            ) : null}
            {secondaryLabel && secondaryHref ? (
              <Link className="zm-storefront-secondary" href={secondaryHref}>
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>


      <style jsx>{`
        .zm-storefront-hero {
          position: relative;
          width: 100%;
          min-height: 500px;
          display: flex;
          align-items: stretch;
          overflow: hidden;
          background: #f3f6f7;
          border-top: 1px solid #e7edf0;
          border-bottom: 1px solid #e2eaee;
        }

        .zm-storefront-hero-copy {
          position: relative;
          z-index: 2;
          width: 42%;
          min-height: 500px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 58px 36px;
          background: transparent;
        }

        .zm-storefront-hero-copy :global(.mock-eyebrow) {
          margin-bottom: 10px;
          color: #079fd8;
        }

        .zm-storefront-hero-copy h1 {
          margin: 0;
          max-width: 620px;
          color: #0a2f46;
          text-shadow: 0 1px 0 rgba(255,255,255,.35);
        }

        .zm-storefront-hero-copy p {
          max-width: 560px;
          margin: 18px 0 0;
          color: #577184;
        }

        .zm-storefront-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 24px;
        }

        .zm-storefront-hero-actions :global(a) {
          min-height: 42px;
          padding: 0 15px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
        }

        .zm-storefront-primary {
          background: #102733;
          color: #fff;
          border: 1px solid #102733;
        }

        .zm-storefront-secondary {
          background: #fff;
          color: #102733;
          border: 1px solid #cfdce3;
        }

        .zm-storefront-hero-media {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          background: #f3f6f7;
        }

        .zm-storefront-hero-media :global(img) {
          width: 100% !important;
          height: 100% !important;
          object-fit: fill !important;
          object-position: center center !important;
        }

        .zm-storefront-hero-media::before,
        .zm-storefront-hero-media::after {
          display: none !important;
          content: none !important;
          background: none !important;
        }

        @media (max-width: 760px) {
          .zm-storefront-hero {
            min-height: 390px;
          }

          .zm-storefront-hero-copy {
            width: 56%;
            min-width: 0;
            min-height: 390px;
            padding: 30px 14px 30px 16px;
          }

          .zm-storefront-hero-copy :global(.mock-eyebrow) {
            margin-bottom: 7px;
            font-size: 10px !important;
            letter-spacing: 1.2px;
          }

          .zm-storefront-hero-copy h1 {
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          .zm-storefront-hero-copy p {
            margin-top: 12px;
            max-width: 100%;
            font-size: 13px !important;
            line-height: 1.5 !important;
          }

          .zm-storefront-hero-actions {
            width: 100%;
            gap: 7px;
            margin-top: 18px;
          }

          .zm-storefront-hero-actions :global(a) {
            min-height: 38px;
            padding: 0 10px;
            font-size: 11px !important;
          }

          .zm-storefront-hero-media :global(img) {
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
            object-position: center center !important;
          }
        }

        @media (max-width: 430px) {
          .zm-storefront-hero {
            min-height: 360px;
          }

          .zm-storefront-hero-copy {
            width: 58%;
            min-height: 360px;
            padding: 26px 10px 26px 12px;
          }

          .zm-storefront-hero-copy p {
            font-size: 12px !important;
          }

          .zm-storefront-hero-actions {
            flex-direction: column;
            align-items: flex-start;
          }

          .zm-storefront-hero-actions :global(a) {
            width: auto;
            max-width: 100%;
          }


        }
      `}</style>
    </section>
  );
}
