"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVEAL_SELECTOR = [
  "main section",
  "main .page-head",
  "main .static-page-head",
  "main .blog-head",
  "main .brand-shop-hero-inner",
  "main .premium-content-hero-inner",
  "main .premium-dynamic-content > *",
  "main .product-card",
  "main .premium-category-card",
  "main .premium-editorial-card",
  "main .blog-card",
  "main .faq-item",
  "main .brand-process-card",
  "main .brand-support-card",
  "main .static-content-card",
  "main .content-card",
  "main .checkout-card",
  "main .summary-card",
  "main .product-main-image",
  "main .product-info",
  "main .professional-journal-card",
  "main .professional-contact-cards > a",
  "main .professional-values-grid article",
  "main .premium-contact-form",
  "main .professional-page-endcap",
    ".mock-product-card",
  "main .mock-category-minis > a",
  "main .mock-category-feature",
  "main .mock-editorial",
  "main .mock-review-media > *",
  "main .mock-standard-cards > article",
  "main .mock-step-grid > article",
  "main .mock-unbox-art",
  "main .mock-unbox-copy",
  "main .mock-listing-categories > a",
  "main .mock-other-cats a",
].join(",");

const CARD_SELECTOR = [
  ".product-card",
  ".premium-category-card",
  ".premium-editorial-card",
  ".blog-card",
  ".faq-item",
  ".brand-process-card",
  ".static-content-card",
  ".content-card",
  ".professional-journal-card",
  ".professional-contact-cards > a",
  ".professional-values-grid article",
  ".premium-contact-form",
  ".mock-product-card",
  ".mock-category-minis > a",
  ".mock-category-feature",
  ".mock-editorial",
  ".mock-review-media > *",
  ".mock-standard-cards > article",
  ".mock-step-grid > article",
  ".mock-listing-categories > a",
  ".mock-other-cats a",
].join(",");

export default function PageMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const main = document.querySelector<HTMLElement>("main.public-site-main");
    if (!main || reduceMotion) return;

    document.documentElement.classList.add("zm-motion-enabled");
    main.classList.remove("zm-route-enter");
    // Restart the lightweight route entrance on client-side navigation.
    void main.offsetWidth;
    main.classList.add("zm-route-enter");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );

    const seen = new WeakSet<Element>();

    const register = (root: ParentNode = document) => {
      const elements = Array.from(
        root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR),
      );
      elements.forEach((element, index) => {
        if (seen.has(element) || element.closest("[data-no-motion='true']"))
          return;
        seen.add(element);
        element.classList.add("zm-reveal");

        if (element.matches(CARD_SELECTOR)) {
          element.classList.add("zm-reveal-card");
        }

        element.style.setProperty(
          "--zm-motion-delay",
          `${Math.min(index % 5, 4) * 55}ms`,
        );

        const bounds = element.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.94 && bounds.bottom > 0) {
          requestAnimationFrame(() => element.classList.add("is-visible"));
        } else {
          observer.observe(element);
        }
      });
    };

    register(main);

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.matches(REVEAL_SELECTOR)) register(main);
            else register(node);
          }
        });
      }
    });

    mutationObserver.observe(main, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      main.classList.remove("zm-route-enter");
    };
  }, [pathname]);

  return null;
}
