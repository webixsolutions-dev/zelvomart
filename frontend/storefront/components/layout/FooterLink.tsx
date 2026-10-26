"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** Footer destinations open with the full header visible, without scrolling up through the old page. */
export function FooterLink(props: Omit<ComponentProps<typeof Link>, "onNavigate" | "scroll">) {
  const pathname = usePathname();
  const navigating = useRef(false);
  useLayoutEffect(() => {
    if (!navigating.current) return;
    navigating.current = false;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <Link
      {...props}
      scroll={false}
      onNavigate={() => {
        navigating.current = true;
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }}
    />
  );
}
