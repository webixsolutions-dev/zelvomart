import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/types/product";
import { CATEGORY_BLURBS } from "@/lib/dummy-content";

const CATEGORY_FALLBACKS: Record<string, string> = {
  "home-living": "/images/categories/home-living.webp",
  "home-decor": "/images/categories/home-decor.webp",
  "beauty-personal-care": "/images/categories/beauty-personal-care.webp",
  "tech-gadgets": "/images/categories/tech-gadgets.webp",
  "fashion-accessories": "/images/categories/fashion-accessories.webp",
  "sports-fitness": "/images/categories/sports-fitness.webp",
  "kids-toys": "/images/categories/kids-toys.svg",
};

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="category-grid category-grid--showcase premium-category-grid">
      {categories.map((category, index) => {
        const localFallback = CATEGORY_FALLBACKS[category.slug];
        const databaseImage = category.image && !/\.svg(?:\?|$)/i.test(category.image) ? category.image : null;
        const image = localFallback || databaseImage;
        const blurb = category.description || CATEGORY_BLURBS[category.slug] || "Explore the collection";

        return (
          <Link
            className="category-card premium-category-card"
            href={`/product-category/${category.slug}/`}
            key={category.id}
          >
            <div className="premium-category-media">
              {image ? (
                <Image
                  src={image}
                  alt={category.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1100px) 50vw, 33vw"
                  loading={index < 6 ? "eager" : "lazy"}
                  fetchPriority={index < 3 ? "high" : "auto"}
                  unoptimized={image.startsWith("/images/")}
                />
              ) : (
                <div className="category-card-fallback" aria-hidden="true" />
              )}
              <span className="category-number">0{index + 1}</span>
            </div>

            <div className="category-card-copy premium-category-copy">
              <div>
                <span className="category-card-label">COLLECTION</span>
                <h3>{category.name}</h3>
                <span className="category-blurb">{blurb}</span>
              </div>
              <em className="category-card-btn">Shop <span aria-hidden="true">→</span></em>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
