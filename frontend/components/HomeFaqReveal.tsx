"use client";

import type { ReactNode } from "react";
import ScrollReveal from "@/components/ScrollReveal";

type HomeFaqRevealProps = {
  intro: ReactNode;
  children: ReactNode;
};

export default function HomeFaqReveal({ intro, children }: HomeFaqRevealProps) {
  return (
    <section className="site-shell mock-faq-section zm-faq-reveal-section">
      <ScrollReveal className="zm-faq-reveal-intro">{intro}</ScrollReveal>
      <ScrollReveal className="zm-faq-reveal-list" delayMs={160}>{children}</ScrollReveal>
    </section>
  );
}

