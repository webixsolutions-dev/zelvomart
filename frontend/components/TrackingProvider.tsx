"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackStoreEvent } from "@/lib/client-tracking";

declare global {
  interface Window { clarity?: (...args: any[]) => void; }
}

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
      if (source.ttclid && !document.cookie.includes("ttclid=")) {
        setCookie("ttclid", source.ttclid);
      }
    }

    try {
      const current = source;
      window.clarity?.("set", "utm_source", current.utm_source || "direct");
      window.clarity?.("set", "utm_campaign", current.utm_campaign || "");
      window.clarity?.("set", "utm_content", current.utm_content || "");
      window.clarity?.("set", "paid_meta", current.fbclid || current.utm_source?.toLowerCase().includes("facebook") || current.utm_source?.toLowerCase().includes("instagram") ? "yes" : "no");
      window.clarity?.("set", "device", window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop");
      try {
        const experiments = document.cookie.split("; ").find((row) => row.startsWith("zm_experiments="));
        if (experiments) {
          const parsed = JSON.parse(decodeURIComponent(experiments.slice("zm_experiments=".length)));
          Object.entries(parsed || {}).forEach(([name, variant]) => window.clarity?.("set", `experiment_${name}`, String(variant)));
        }
      } catch {}
    } catch {}
  }, []);

  useEffect(() => {
    const key = `${pathname}?${search.toString()}`;
    if (last.current === key) return;
    last.current = key;

    trackStoreEvent("PageView").catch(() => undefined);
    try {
      const type = pathname.startsWith("/product/")
        ? "product"
        : pathname.startsWith("/product-category/") || pathname.startsWith("/category/")
          ? "category"
          : pathname === "/checkout"
            ? "checkout"
            : pathname === "/"
              ? "home"
              : "page";
      window.clarity?.("set", "page_type", type);
    } catch {}
  }, [pathname, search]);

  return null;
}
