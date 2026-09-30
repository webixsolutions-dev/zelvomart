import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/types/product";

const CATEGORY_FALLBACKS: Record<string, string> = {
  "home-living": "/images/categories/home-living.svg",
  "home-decor": "/images/categories/home-decor.svg",
  "beauty-personal-care": "/images/categories/beauty-personal-care.svg",
  "tech-gadgets": "/images/categories/tech-gadgets.svg",
  "fashion-accessories": "/images/categories/fashion-accessories.svg",
  "sports-fitness": "/images/categories/sports-fitness.svg",
  "kids-toys": "/images/categories/kids-toys.svg",
};

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="category-grid">
      {categories.map((category) => {
        const image = category.image || CATEGORY_FALLBACKS[category.slug];

        return (
          <Link
            className="category-card"
            href={`/product-category/${category.slug}/`}
            key={category.id}
          >
            {image ? (
              <Image
                src={image}
                alt={category.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw"
              />
            ) : (
              <div className="category-card-fallback" aria-hidden="true" />
            )}

            <div className="category-card-copy">
              <h3>{category.name}</h3>
              <span>
                {category.count ? `${category.count} products` : "Explore collection"}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
