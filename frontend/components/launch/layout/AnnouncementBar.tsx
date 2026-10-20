"use client";
import Link from "next/link";
import { Banknote, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import {useSite} from "@/lib/launch/store";
import { waLink } from "@/lib/launch/format";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";

const icons = [Banknote, Truck, PackageCheck, ShieldCheck];

export function AnnouncementBar() {
 const site=useSite();
 const announcements=["Cash on Delivery across Pakistan",`Free delivery from Rs. ${site.shipping.freeOver.toLocaleString("en-PK")}`,"Every order checked before dispatch","Real people on WhatsApp — ask before you buy"];
  const items = announcements.map((a, i) => {
    const Icon = icons[i % icons.length];
    return (
      <li key={a}>
        <Icon size={14} aria-hidden="true" /> {a}
      </li>
    );
  });
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <ul className="topbar-points" aria-label="Store promises">
          {items.slice(0, 3)}
        </ul>
        {/* Mobile: continuous ticker. The list is doubled so the loop is seamless. */}
        <div className="topbar-ticker" aria-hidden="true">
          <ul>
            {items}
            {items}
          </ul>
        </div>
        <div className="topbar-links">
          <Link href="/track-your-order/">Track order</Link>
          <Link href="/contact-us/">Contact us</Link>
          <a href={waLink(site.whatsappNumber)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={13} /> {site.phoneDisplay}
          </a>
        </div>
      </div>
    </div>
  );
}
