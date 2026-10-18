"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackStoreEvent } from "@/lib/client-tracking";

function setCookie(name: string, value: string, maxAge = 2592000) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function sourceFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "campaign_id", "adset_id", "ad_id", "fbclid", "ttclid"];
  const source: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value) source[key] = value;
  }
  return source;
}

export default function TrackingProvider() {
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const source = sourceFromUrl();
    if (Object.keys(source).length) {
      const existingFirst = document.cookie.split("; ").find((row) => row.startsWith("zm_first_touch="));
      if (!existingFirst) setCookie("zm_first_touch", JSON.stringify(source));
      setCookie("zm_last_touch", JSON.stringify(source));

      if (source.fbclid && !document.cookie.includes("_fbc=")) {
        setCookie("_fbc", `fb.1.${Date.now()}.${source.fbclid}`);
      }
      if (source.ttclid) {
        setCookie("ttclid", source.ttclid);
      }
    }

  }, []);

  useEffect(() => {
    const key = `${pathname}?${search.toString()}`;
    if (last.current === key) return;
    last.current = key;

    trackStoreEvent("PageView").catch(() => undefined);
  }, [pathname, search]);

  return null;
}
