"use client";

import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { categoryImageFallback } from "@/lib/store-images";
import ScrollReveal from "@/components/ScrollReveal";

type EditorialCategory = {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
};

type HomeEditorialGridProps = {
  categories: EditorialCategory[];
  imageBySlug: Record<string, string>;
};

const LABELS = ["THE STYLE EDIT", "THE TECH EDIT", "EVERYDAY PICKS"];
const TONES = ["pink", "blue", "cream"];

export default function HomeEditorialGrid({ categories, imageBySlug }: HomeEditorialGridProps) {
  if (!categories.length) return null;

  return (
    <section className="site-shell mock-editorial-grid zm-editorial-reveal">
      {categories.map((category, index) => (
        <ScrollReveal key={category.id} delayMs={index * 140} className="zm-editorial-reveal-item">
          <Link
            href={`/product-category/${category.slug}/`}
            className={`mock-editorial ${TONES[index] ?? "cream"}`}
          >
            <div className="mock-editorial-img">
              <SafeImage
                src={imageBySlug[category.slug] || category.image}
                fallbackSrc={categoryImageFallback}
                alt={category.name}
                fill
                sizes="(max-width:900px) 100vw, 33vw"
              />
            </div>
            <span>{LABELS[index] ?? "SHOP NOW"}</span>
            <h3>{category.name}</h3>
            <b>Shop {category.name} →</b>
          </Link>
        </ScrollReveal>
      ))}
    </section>
  );
}

