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

  useEffect(()=>{
    const contact=(event:MouseEvent)=>{const link=(event.target as Element)?.closest?.('a[href]');if(!link||link.hasAttribute('data-contact-tracked'))return;try{const url=new URL(link.getAttribute('href')||'',location.href);if(['wa.me','api.whatsapp.com'].includes(url.hostname))void trackStoreEvent('Contact',{contact_method:'whatsapp'});}catch{}};
    document.addEventListener('click',contact);return()=>document.removeEventListener('click',contact);
  },[]);
  useEffect(()=>{const term=search.get('q')||search.get('search');if(pathname==='/search'&&term)void trackStoreEvent('Search',{search_string:/@|(?:\d[\s-]*){7,}/.test(term)?'[redacted]':term.slice(0,150)});},[pathname,search]);
  return null;
}
