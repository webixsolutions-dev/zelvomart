"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** A new destination starts at the header. History and in-page anchors keep browser behaviour. */
export function RouteScrollReset() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const historyNavigation = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      historyNavigation.current =
        window.location.pathname.replace(/\/$/, "") !==
        previous.current.replace(/\/$/, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const preserve = historyNavigation.current || Boolean(window.location.hash);
    historyNavigation.current = false;
    if (!preserve) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
