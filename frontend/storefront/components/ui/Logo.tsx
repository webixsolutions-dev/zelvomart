import Image from "next/image";
import Link from "next/link";

/**
 * Full Zelvomart lockup from /public/Zelvomart logo.png. Never preloaded (the header and the menu drawer both show it,
 * which used to preload it twice); the header copy loads eagerly, the drawer copy lazily. fetchPriority low keeps
 * React from preloading it and leaves the bandwidth to the hero image.
 */
export function Logo({ light = false, className = "", eager = false }: { light?: boolean; className?: string; eager?: boolean }) {
  return (
    <Link href="/" className={`logo ${light ? "logo-light" : ""} ${className}`} aria-label="Zelvomart — home">
      <Image src="/Zelvomart%20logo.png" alt="Zelvomart" width={354} height={235} className="logo-lockup" loading={eager ? "eager" : "lazy"} fetchPriority="low" />
    </Link>
  );
}
