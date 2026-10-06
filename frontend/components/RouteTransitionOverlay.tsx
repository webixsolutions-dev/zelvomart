"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function canInterceptAnchor(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.getAttribute("href")?.startsWith("#")) return false;
  if (anchor.getAttribute("data-no-route-loader") === "true") return false;
  const href = anchor.href;
  if (!href) return false;
  try {
    const next = new URL(href);
    return next.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function RouteTransitionOverlay() {
  const pathname = usePathname();
  const [active, setActive] = useState(true);
  const firstMount = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(false), firstMount.current ? 700 : 600);
    firstMount.current = false;
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!canInterceptAnchor(anchor)) return;
      const nextPath = `${new URL(anchor.href).pathname}${new URL(anchor.href).search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath === currentPath) return;
      setActive(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className={`zm-route-loader ${active ? "is-active" : ""}`} aria-hidden="true">
      <div className="zm-route-loader-ring">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
