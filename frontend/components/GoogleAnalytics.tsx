'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { adsAllowed } from '@/lib/tracking-policy';
import { analyticsPageUrl } from '@/lib/google-analytics';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  zmGoogleConfigured?: string;
};

export default function GoogleAnalytics() {
  const pathname = usePathname(), search = useSearchParams(), last = useRef('');
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-9SJCXNENVE';
  useEffect(() => {
    if (!/^G-[A-Z0-9]+$/.test(id)) return;
    const w = window as unknown as AnalyticsWindow & Record<string, unknown>;
    const allowed = adsAllowed() && !!analyticsPageUrl(location.href);
    w[`ga-disable-${id}`] = !allowed;
    if (!allowed) return;
    const page = analyticsPageUrl(location.href)!;
    if (!w.zmGoogleConfigured) {
      w.dataLayer ||= [];
      w.gtag = function () { w.dataLayer!.push(arguments); };
      w.gtag('js', new Date());
      w.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      w.zmGoogleConfigured = id;
      const script = document.createElement('script');
      script.id = 'zelvomart-google-analytics'; script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
      document.head.appendChild(script);
    }
    if (last.current === page) return () => { w[`ga-disable-${id}`] = true; };
    last.current = page;
    w.gtag?.('event', 'page_view', {
      page_location: page,
      page_referrer: analyticsPageUrl(document.referrer) || '',
      // Avoid customer names/order numbers introduced by account/confirmation titles.
      page_title: pathname.startsWith('/checkout') || pathname.startsWith('/order-confirmed') ? 'Zelvomart checkout' : document.title,
    });
    return () => { w[`ga-disable-${id}`] = true; };
  }, [pathname, search, id]);
  return null;
}
