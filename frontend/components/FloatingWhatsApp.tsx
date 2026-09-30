"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/Icons";
import { trackStoreEvent } from "@/lib/client-tracking";

export default function FloatingWhatsApp({ number = "923002026711" }: { number?: string }) {
  const pathname = usePathname();
  const message = `Hi Zelvomart, I need help with ${pathname.startsWith("/product/") ? `this product: ${typeof window !== "undefined" ? window.location.href : pathname}` : pathname}`;
  return <a className="floating-whatsapp" href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" onClick={() => trackStoreEvent("Contact", { content_name: pathname }, { clarityEvent: "whatsapp_tap" }).catch(() => undefined)}><WhatsAppIcon size={27} /></a>;
}
