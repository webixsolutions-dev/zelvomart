"use client";

import { useEffect, useRef, useState } from "react";
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
  const [active, setActive] = useState(true);
  const firstMount = useRef(true);
  const safetyTimer = useRef<number | undefined>(undefined);

  const start = () => {
    setActive(true);
    if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    // Never leave the screen blocked if a navigation is cancelled or errors.
    safetyTimer.current = window.setTimeout(() => setActive(false), 8000);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(false), firstMount.current ? 700 : 420);
    firstMount.current = false;
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = undefined;
    }
    return () => window.clearTimeout(timer);
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

    document.addEventListener("click", onClick);
    window.addEventListener("zelvo:route-start", onProgrammaticStart);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
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
