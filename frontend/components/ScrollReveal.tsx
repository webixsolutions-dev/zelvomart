"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
};

function revealTarget(el: HTMLElement) {
  if (getComputedStyle(el).display === "contents") {
    return (el.firstElementChild as HTMLElement | null) ?? el;
  }
  return el;
}

export default function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
  style,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Stay visible until we know the block is below the fold. Hiding by default
  // leaves the homepage blank while the client bundle is still compiling.
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const target = revealTarget(el);
    const box = target.getBoundingClientRect();
    const hasBox = box.width > 0 || box.height > 0;
    const inView = hasBox && box.top < window.innerHeight * 0.96 && box.bottom > 0;

    if (!hasBox || inView) {
      setVisible(true);
      return;
    }

    setPending(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPending(false);
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`zm-scroll-reveal ${pending ? "zm-reveal-pending" : ""} ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ ...style, transitionDelay: delayMs ? `${delayMs}ms` : undefined }}
    >
      {children}
    </div>
  );
}

