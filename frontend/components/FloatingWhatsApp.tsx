"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/Icons";
import { trackStoreEvent } from "@/lib/client-tracking";

export const DEFAULT_WHATSAPP_NUMBER = "923002026711";

export function whatsappHelpMessage(pathname: string) {
  return `Hi Zelvomart, I need help with ${pathname.startsWith("/product/") ? `this product: ${pathname}` : pathname}`;
}

export function whatsappHelpHref(number: string | undefined, pathname: string) {
  const clean = String(number || DEFAULT_WHATSAPP_NUMBER);
  return `https://wa.me/${clean}?text=${encodeURIComponent(whatsappHelpMessage(pathname))}`;
}

export function trackWhatsAppTap(pathname: string) {
  trackStoreEvent("Contact", { content_name: pathname }, { clarityEvent: "whatsapp_tap" }).catch(() => undefined);
}

export default function FloatingWhatsApp({ number = DEFAULT_WHATSAPP_NUMBER }: { number?: string }) {
  const pathname = usePathname() || "/";
  return (
    <a
      className="floating-whatsapp"
      href={whatsappHelpHref(number, pathname)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      onClick={() => trackWhatsAppTap(pathname)}
    >
      <WhatsAppIcon size={27} />
    </a>
  );
}
