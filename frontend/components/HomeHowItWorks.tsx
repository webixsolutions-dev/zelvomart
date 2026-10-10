"use client";

import ScrollReveal from "@/components/ScrollReveal";
import { storeImages } from "@/lib/store-images";

const STEPS = [
  {
    icon: storeImages.stepChoose.href,
    step: "01",
    title: "Choose",
    text: "Browse and add your favourite products",
    tone: "choose",
  },
  {
    icon: storeImages.stepConfirm.href,
    step: "02",
    title: "Confirm",
    text: "Share your details and confirm order",
    tone: "confirm",
  },
  {
    icon: storeImages.stepPacked.href,
    step: "03",
    title: "Delivered",
    text: "We pack and ship to your doorstep",
    tone: "deliver",
  },
  {
    icon: storeImages.stepDelivered.href,
    step: "04",
    title: "Pay Cash",
    text: "Pay when you receive your order",
    tone: "pay",
  },
] as const;

export default function HomeHowItWorks() {
  return (
    <section className="zm-how-it-works zm-how-it-works-vivid">
      <div className="site-shell">
        <ScrollReveal className="zm-how-heading">
          <h2>How It Works</h2>
          <p>Shopping on Zelvomart is simple and secure.</p>
        </ScrollReveal>

        <div className="zm-how-grid">
          {STEPS.flatMap((step, index) => {
            const nodes = [
              <ScrollReveal key={step.tone} delayMs={index * 90} className="zm-how-reveal-cell">
                <article className={`zm-how-step zm-how-step--${step.tone}`}>
                  <span className="zm-how-index">{step.step}</span>
                  <span className="zm-how-icon">
                    <img src={step.icon} alt="" width={54} height={54} />
                  </span>
                  <div className="zm-how-copy">
                    <b>{step.title}</b>
                    <p>{step.text}</p>
                  </div>
                </article>
              </ScrollReveal>,
            ];
            if (index > 0) {
              nodes.unshift(
                <i key={`arrow-${step.tone}`} className={`zm-how-arrow zm-how-arrow--${step.tone}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </i>,
              );
            }
            return nodes;
          })}
        </div>
      </div>
    </section>
  );
}

