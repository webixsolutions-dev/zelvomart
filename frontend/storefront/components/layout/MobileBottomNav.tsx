"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { useShop } from "@/lib/store";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount, ready, setCartOpen } = useShop();
  const is = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      <Link href="/" className={is("/") ? "active" : ""}>
        <House size={20} />
        Home
      </Link>
      <Link href="/shop-all-products/" className={is("/shop") || is("/category") ? "active" : ""}>
        <LayoutGrid size={20} />
        Shop
      </Link>
      <Link href="/wishlist/" className={is("/wishlist") ? "active" : ""}>
        <Heart size={20} />
        Saved
      </Link>
      <button type="button" onClick={() => setCartOpen(true)}>
        <span className="badge-wrap">
          <ShoppingBag size={20} />
          {ready && cartCount > 0 && <b className="count">{cartCount}</b>}
        </span>
        Cart
      </button>
      <Link href="/my-account/" className={is("/account") ? "active" : ""}>
        <User size={20} />
        Account
      </Link>
    </nav>
  );
}
