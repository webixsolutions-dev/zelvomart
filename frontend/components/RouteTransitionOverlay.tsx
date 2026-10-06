"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [active, setActive] = useState(false);
  const mounted = useRef(false);
  const safetyTimer = useRef<number | undefined>(undefined);

  const start = () => {
    // Force the overlay to paint before Next.js handles the navigation.
    flushSync(() => setActive(true));
    if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    // Keep route feedback brief: never block the screen for more than 650ms.
    safetyTimer.current = window.setTimeout(() => setActive(false), 650);
  };

  useEffect(() => {
    // Do not show a loader after the initial page has already rendered.
    if (!mounted.current) {
      mounted.current = true;
      setActive(false);
      return;
    }

    // A changed route key means the destination is ready; remove the overlay
    // on the very next paint rather than keeping it over the new page.
    const frame = window.requestAnimationFrame(() => setActive(false));
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = undefined;
    }
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!canInterceptAnchor(anchor)) return;
      const nextUrl = new URL(anchor.href);
      const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath === currentPath) return;
      start();
    };
    const onProgrammaticStart = () => start();
    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("zelvo:route-start", onProgrammaticStart);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("zelvo:route-start", onProgrammaticStart);
      window.removeEventListener("popstate", onPopState);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    };
  }, []);

  return (
    <div className={`zm-route-loader ${active ? "is-active" : ""}`} aria-hidden="true">
      <div className="zm-route-loader-ring" />
    </div>
  );
}
