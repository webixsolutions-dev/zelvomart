"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getCategory, type Product } from "@/lib/launch/catalog";
import { discountPct } from "@/lib/launch/format";
import { useShop } from "@/lib/launch/store";
import { Price } from "@/components/launch/ui/Price";
import { Stars } from "@/components/launch/ui/Stars";

export function ProductCard({ p, priority = false, featured = false }: { p: Product; priority?: boolean; featured?: boolean }) {
  const { addToCart, toggleWish, isWished, ready } = useShop();
  const wished = ready && isWished(p.id);
  const pct = discountPct(p.price, p.compare);
  const href = `/product/${p.slug}/`;

  const details = (
    <>
      <div className="product-meta">
        <div className="kicker">{p.categoryName}</div>
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <Stars rating={p.rating} count={p.reviewCount} size={13} className="card-stars" />
        {featured && <p className="featured-blurb">{p.tagline}</p>}
        <Price price={p.price} compare={p.compare} />
      </div>
      <div className="product-bottom">
        <button className="btn block sm" type="button" disabled={!p.inStock} onClick={() => addToCart(p, { variant: p.variants?.options[0].name })}>
          {p.raw.hasOptions?"Choose options":p.inStock?"Add to Cart":"Out of stock"}
        </button>
      </div>
    </>
  );

  return (
    <article className={featured ? "product-card product-card-featured" : "product-card"}>
      <div className="product-photo">
        <Link href={href} tabIndex={-1} aria-hidden="true">
          <Image
            src={p.image}
            alt={p.name}
            width={600}
            height={600}
            priority={priority}
            sizes={featured ? "(max-width:760px) 100vw, 560px" : "(max-width:760px) 50vw, 300px"}
          />
        </Link>
        <span className="photo-sheen" aria-hidden="true" />
        <div className="badges">
          {p.badge && <span className={`badge badge-${p.badge.replace(/\s/g, "").toLowerCase()}`}>{p.badge}</span>}
          {pct > 0 && <span className="badge badge-sale">-{pct}%</span>}
        </div>
        <button
          className={`heart ${wished ? "active" : ""}`}
          type="button"
          aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
          aria-pressed={wished}
          onClick={() => toggleWish(p.id,p)}
        >
          <Heart size={17} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      {featured ? <div className="product-body">{details}</div> : details}
    </article>
  );
}
