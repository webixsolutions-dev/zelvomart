import Image from "next/image";
import Link from "next/link";

/** Full Zelvomart lockup from /public/Zelvomart logo.png */
export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  return (
    <Link prefetch={false} href="/" className={`logo ${light ? "logo-light" : ""} ${className}`} aria-label="Zelvomart — home">
      <Image src="/launch/Zelvomart%20logo.png" alt="Zelvomart" width={354} height={235} className="logo-lockup" priority />
    </Link>
  );
}
